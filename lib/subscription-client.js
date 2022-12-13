'use strict'

const sJSON = require('secure-json-parse')

const WebSocket = require('ws')
const {
  GRAPHQL_TRANSPORT_WS,
  getProtocolByName
} = require('./subscription-protocol')
const { MER_ERR_GQL_SUBSCRIPTION_MESSAGE_INVALID, MER_ERR_GQL_SUBSCRIPTION_CONNECTION_NOT_READY, MER_ERR_INVALID_OPTS } = require('./errors')
const { EventEmitter } = require('stream')

class SubscriptionClient extends EventEmitter {
  constructor (uri, config) {
    super()
    this._socket = null
    this._operationId = 0
    this._ready = false
    this.operations = new Map()
    this.operationsCount = {}
    this._subscriptionQueryMap = {}
    this._reconnectAttempts = 0
    this._keepAliveInterval = undefined

    const {
      protocols = [],
      reconnect,
      maxReconnectAttempts = Infinity,
      serviceName,
      connectionCallback,
      failedConnectionCallback,
      failedReconnectCallback,
      connectionInitPayload,
      rewriteConnectionInitPayload,
      keepAlive
    } = config

    this.uri = uri
    this.serviceName = serviceName
    this.maxReconnectAttempts = maxReconnectAttempts
    this.connectionCallback = connectionCallback
    this.failedConnectionCallback = failedConnectionCallback
    this.failedReconnectCallback = failedReconnectCallback
    this.connectionInitPayload = connectionInitPayload
    this.rewriteConnectionInitPayload = rewriteConnectionInitPayload
    this.keepAlive = keepAlive
    this.tryReconnect = reconnect

    if (Array.isArray(protocols) && protocols.length > 0) {
      this.protocols = protocols
    } else {
      this.protocols = [GRAPHQL_TRANSPORT_WS]
    }

    this._protocolMessageTypes = getProtocolByName(this.protocols[0])

    if (this._protocolMessageTypes === null) {
      throw new MER_ERR_INVALID_OPTS(`${this.protocols[0]} is not a valid gateway subscription protocol`)
    }
  }

  connect () {
    this._socket = new WebSocket(this.uri, this.protocols)

    this._socket.onopen = async () => {
      /* istanbul ignore else */
      if (this._socket && this._socket.readyState === WebSocket.OPEN) {
        try {
          this.emit('socketOpen')
          const payload = typeof this.connectionInitPayload === 'function'
            ? await this.connectionInitPayload()
            : this.connectionInitPayload
          this._sendMessage(null, this._protocolMessageTypes.GQL_CONNECTION_INIT, payload)
          if (this.keepAlive) {
            this._startKeepAliveInterval()
          }
        } catch (err) {
          this.close(this.tryReconnect, false)
        }
      }
    }

    this._socket.onclose = () => {
      if (!this.closedByUser) {
        this.close(this.tryReconnect, false)
      }
      this.emit('socketClose')
    }

    this._socket.onerror = () => {
      this.emit('socketError')
    }

    this._socket.onmessage = async ({ data }) => {
      await this._handleMessage(data)
    }
  }

  close (tryReconnect, closedByUser = true) {
    this.closedByUser = closedByUser
    this._ready = false

    if (this._socket !== null) {
      if (closedByUser) {
        this.unsubscribeAll()
      }

      if (this.keepAlive && this.keepAliveTimeoutId) {
        this._stopKeepAliveInterval()
      }

      this._socket.close()
      this._socket = null
      this.reconnecting = false

      if (tryReconnect) {
        for (const operationId of this.operations.keys()) {
          const { options, handler, extensions } = this.operations.get(operationId)

          this.operations.set(operationId, {
            options,
            handler,
            extensions,
            started: false
          })
        }

        this._reconnect()
      }
    }
  }

  _getReconnectDelay () {
    const delayMs = 100 * Math.pow(2, this._reconnectAttempts)

    return Math.min(delayMs, 10000)
  }

  _reconnect () {
    if (
      this.reconnecting ||
      this._reconnectAttempts > this.maxReconnectAttempts
    ) {
      return this.failedReconnectCallback && this.failedReconnectCallback()
    }

    this._reconnectAttempts++
    this.reconnecting = true

    const delay = this._getReconnectDelay()

    this.reconnectTimeoutId = setTimeout(() => {
      this.connect()
    }, delay)
  }

  unsubscribe (operationId, forceUnsubscribe) {
    let count = this.operationsCount[operationId]
    count--

    if (count === 0 || forceUnsubscribe) {
      this._sendMessage(operationId, this._protocolMessageTypes.GQL_STOP, null)
      this.operationsCount[operationId] = 0
    } else {
      this.operationsCount[operationId] = count
    }
  }

  unsubscribeAll () {
    for (const operationId of this.operations.keys()) {
      this.unsubscribe(operationId, true)
    }
  }

  _sendMessage (operationId, type, payload = {}, extensions) {
    this._socket.send(
      JSON.stringify({
        id: operationId,
        type,
        payload,
        extensions
      })
    )
  }

  async _handleMessage (message) {
    let data
    let operationId
    let operation

    try {
      data = sJSON.parse(message.toString())
      operationId = data.id
    } catch (e) {
      /* istanbul ignore next */
      throw new MER_ERR_GQL_SUBSCRIPTION_MESSAGE_INVALID(`"${message}" must be JSON parsable.`)
    }

    if (operationId) {
      operation = this.operations.get(operationId)
    }

    switch (data.type) {
      case this._protocolMessageTypes.GQL_CONNECTION_ACK:
        this.reconnecting = false
        this._ready = true
        this.emit('ready')
        this._reconnectAttempts = 0

        for (const operationId of this.operations.keys()) {
          this._startOperation(operationId)
        }

        if (this.connectionCallback) {
          this.connectionCallback()
        }

        break
      case this._protocolMessageTypes.GQL_DATA:
        /* istanbul ignore else */
        if (operation) {
          operation.handler(data.payload.data)
        }
        break
      case this._protocolMessageTypes.GQL_ERROR:
        /* istanbul ignore else */
        if (operation) {
          operation.handler(null)
          this.operations.delete(operationId)
          this._sendMessage(
            operationId,
            this._protocolMessageTypes.GQL_ERROR,
            data.payload
          )
        }
        break
      case this._protocolMessageTypes.GQL_COMPLETE:
        /* istanbul ignore else */
        if (operation) {
          operation.handler(null)
          this.operations.delete(operationId)
        }

        break
      case this._protocolMessageTypes.GQL_CONNECTION_ERROR:
        this.close(this.tryReconnect, false)
        if (this.failedConnectionCallback) {
          await this.failedConnectionCallback(data.payload)
        }
        break
      case this._protocolMessageTypes.GQL_CONNECTION_KEEP_ALIVE:
        if (this._socket) {
          this._sendMessage(
            operationId,
            this._protocolMessageTypes.GQL_CONNECTION_KEEP_ALIVE_ACK
          )
        }
        break
      default:
        // GQL_CONNECTION_KEEP_ALIVE_ACK is only defined in the graphql-ws protocol
        /* istanbul ignore next */
        if (
          this._protocolMessageTypes.GQL_CONNECTION_KEEP_ALIVE_ACK &&
          data.type === this._protocolMessageTypes.GQL_CONNECTION_KEEP_ALIVE_ACK
        ) {
          break
        }

        /* istanbul ignore next */
        throw new MER_ERR_GQL_SUBSCRIPTION_MESSAGE_INVALID(
          `Invalid message type "${data.type}"`
        )
    }
  }

  _startOperation (operationId) {
    const { started, options, handler, extensions } = this.operations.get(operationId)
    if (!started) {
      if (!this._ready) {
        throw new MER_ERR_GQL_SUBSCRIPTION_CONNECTION_NOT_READY()
      }
      this.operations.set(operationId, { started: true, options, handler, extensions })
      this._sendMessage(operationId, this._protocolMessageTypes.GQL_START, options, extensions)
    }
  }

  createSubscription (query, variables, publish, context) {
    const subscriptionString = JSON.stringify({ query, variables })
    let operationId = this._subscriptionQueryMap[subscriptionString]

    if (operationId && this.operations.get(operationId)) {
      this.operationsCount[operationId] = this.operationsCount[operationId] + 1
      return operationId
    }

    operationId = String(++this._operationId)

    const operation = {
      started: false,
      options: { query, variables },
      handler: async (data) => {
        await publish({
          topic: `${this.serviceName}_${operationId}`,
          payload: data
        })
      }
    }

    let connectionInit
    if (context) {
      connectionInit = context._connectionInit
    }
    if (this.rewriteConnectionInitPayload) {
      connectionInit = this.rewriteConnectionInitPayload(connectionInit, context)
    }

    if (connectionInit) {
      operation.extensions = [{
        type: 'connectionInit',
        payload: connectionInit
      }]
    }

    this.operations.set(operationId, operation)
    this._startOperation(operationId)
    this.operationsCount[operationId] = 1

    this._subscriptionQueryMap[subscriptionString] = operationId

    return operationId
  }

  _startKeepAliveInterval () {
    this.keepAliveTimeoutId = setInterval(() => {
      this._sendMessage(null, this._protocolMessageTypes.GQL_CONNECTION_KEEP_ALIVE)
    }, this.keepAlive)
    this.keepAliveTimeoutId.unref()
  }

  _stopKeepAliveInterval () {
    clearTimeout(this.keepAliveTimeoutId)
  }
}

module.exports = SubscriptionClient
