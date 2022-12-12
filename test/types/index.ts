import { MercuriusContext } from 'mercurius'
import { GRAPHQL_TRANSPORT_WS_PROTOCOL } from 'graphql-ws'

import { SubscriptionClient } from '../..'

const subscriptionClient = new SubscriptionClient('ws://localhost', {
  protocols: [GRAPHQL_TRANSPORT_WS_PROTOCOL],
  reconnect: false,
  maxReconnectAttempts: 10,
  serviceName: 'sample-name',
  connectionCallback: async () => {
  },
  failedConnectionCallback: async () => {
  },
  failedReconnectCallback: async () => {
  },
  connectionInitPayload: {},
  rewriteConnectionInitPayload: () => {
  },
  keepAlive: 1000
})

subscriptionClient.connect()
subscriptionClient.reconnect()
subscriptionClient.close(true)
subscriptionClient.getReconnectDelay()
subscriptionClient.unsubscribeAll()
subscriptionClient.sendMessage('opId', 'test', {}, {})
subscriptionClient.handleMessage({ foo: 'bar' })
subscriptionClient.startOperation('opId')
subscriptionClient.createSubscription('query', {}, async () => {
}, {} as MercuriusContext)
subscriptionClient.startKeepAliveInterval()
subscriptionClient.stopKeepAliveInterval()
