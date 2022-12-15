'use strict'
const { test } = require('tap')
const FakeTimers = require('@sinonjs/fake-timers')
const SubscriptionClient = require('../lib/subscription-client')
const WS = require('ws')
const { once } = require('events')
const mercurius = require('mercurius')
const Fastify = require('fastify')

test('subscription client initialization fails when a not supported protocol is in the options', (t) => {
  t.plan(1)
  t.throws(
    () =>
      new SubscriptionClient('ws://localhost:1234', {
        protocols: ['unsupported-protocol'],
        serviceName: 'test-service'
      }),
    'Invalid options: unsupported-protocol is not a valid gateway subscription protocol'
  )
})

test('subscription client calls the publish method with the correct payload', (t) => {
  const server = new WS.Server({ port: 0 })
  const port = server.address().port

  server.on('connection', function connection (ws) {
    ws.on('message', function incoming (message, isBinary) {
      const data = JSON.parse(isBinary ? message : message.toString())
      if (data.type === 'connection_init') {
        ws.send(JSON.stringify({ id: undefined, type: 'connection_ack' }))
      } else if (data.type === 'subscribe') {
        ws.send(
          JSON.stringify({
            id: '1',
            type: 'next',
            payload: { data: { foo: 'bar' } }
          })
        )
      }
    })
  })

  const client = new SubscriptionClient(`ws://localhost:${port}`, {
    reconnect: true,
    maxReconnectAttempts: 10,
    serviceName: 'test-service',
    protocols: ['graphql-transport-ws'],
    connectionCallback: () => {
      client.createSubscription('query', {}, (data) => {
        t.same(data, {
          topic: 'test-service_1',
          payload: {
            foo: 'bar'
          }
        })
        client.close()
        server.close()
        t.end()
      })
    }
  })

  client.connect()
})

test('subscription client calls the publish method with the correct payload', (t) => {
  const server = new WS.Server({ port: 0 })
  const port = server.address().port

  server.on('connection', function connection (ws) {
    ws.on('message', function incoming (message, isBinary) {
      const data = JSON.parse(isBinary ? message : message.toString())
      if (data.type === 'connection_init') {
        ws.send(JSON.stringify({ id: undefined, type: 'connection_ack' }))
      } else if (data.type === 'subscribe') {
        ws.send(
          JSON.stringify({
            id: '1',
            type: 'next',
            payload: { data: { foo: 'bar' } }
          })
        )
      }
    })
  })

  const client = new SubscriptionClient(`ws://localhost:${port}`, {
    reconnect: true,
    maxReconnectAttempts: 10,
    serviceName: 'test-service',
    connectionCallback: () => {
      client.createSubscription('query', {}, (data) => {
        t.same(data, {
          topic: 'test-service_1',
          payload: {
            foo: 'bar'
          }
        })
        client.close()
        server.close()
        t.end()
      })
    }
  })
  client.connect()
})

test('subscription client calls the publish method with null after GQL_COMPLETE type payload received', (t) => {
  const server = new WS.Server({ port: 0 })
  const port = server.address().port

  server.on('connection', function connection (ws) {
    ws.on('message', function incoming (message, isBinary) {
      const data = JSON.parse(isBinary ? message : message.toString())
      if (data.type === 'connection_init') {
        ws.send(JSON.stringify({ id: undefined, type: 'connection_ack' }))
      } else if (data.type === 'subscribe') {
        ws.send(JSON.stringify({ id: '1', type: 'complete' }))
      }
    })
  })

  const client = new SubscriptionClient(`ws://localhost:${port}`, {
    reconnect: true,
    maxReconnectAttempts: 10,
    serviceName: 'test-service',
    connectionCallback: () => {
      client.createSubscription('query', {}, (data) => {
        t.same(data, {
          topic: 'test-service_1',
          payload: null
        })
        client.close()
        server.close()
        t.end()
      })
    }
  })
  client.connect()
})

test('subscription client tries to reconnect when server closes', (t) => {
  let server = new WS.Server({ port: 0 })
  const port = server.address().port

  server.on('connection', function connection (ws) {
    ws.send(JSON.stringify({ id: undefined, type: 'connection_ack' }))
  })

  function createSubscription () {
    client.createSubscription('query', {}, (data) => {
      t.same(data, {
        topic: 'test-service_1',
        payload: null
      })
      client.close()
      server.close()
      t.end()
    })
  }

  let shouldCloseServer = true

  function connectionCallback () {
    if (shouldCloseServer) {
      server.close()
      for (const ws of server.clients) {
        ws.terminate()
      }
      shouldCloseServer = false
      server = new WS.Server({ port }, () => {
        createSubscription()
      })
      server.on('connection', function connection (ws) {
        ws.on('message', function incoming (message, isBinary) {
          const data = JSON.parse(isBinary ? message : message.toString())
          if (data.type === 'connection_init') {
            ws.send(JSON.stringify({ id: undefined, type: 'connection_ack' }))
          } else if (data.type === 'subscribe') {
            ws.send(JSON.stringify({ id: '1', type: 'complete' }))
          }
        })
      })
    }
  }

  const client = new SubscriptionClient(`ws://localhost:${port}`, {
    reconnect: true,
    maxReconnectAttempts: 10,
    serviceName: 'test-service',
    connectionCallback
  })

  client.connect()
})

test('subscription client stops trying reconnecting after maxReconnectAttempts', (t) => {
  const server = new WS.Server({ port: 0 })
  const port = server.address().port

  server.on('connection', function connection (ws) {
    ws.send(JSON.stringify({ id: undefined, type: 'connection_ack' }))
  })

  const client = new SubscriptionClient(`ws://localhost:${port}`, {
    reconnect: true,
    maxReconnectAttempts: 1,
    serviceName: 'test-service',
    failedReconnectCallback: () => {
      client.close()
      server.close()
      t.end()
    }
  })

  client.connect()
  server.close()
})

test(
  'subscription client multiple subscriptions is handled by one operation',
  { only: true },
  (t) => {
    const server = new WS.Server({ port: 0 })
    const port = server.address().port

    server.on('connection', function connection (ws) {
      ws.on('message', function incoming (message, isBinary) {
        const data = JSON.parse(isBinary ? message : message.toString())
        if (data.type === 'connection_init') {
          ws.send(JSON.stringify({ id: undefined, type: 'connection_ack' }))
        } else if (data.type === 'subscribe') {
          ws.send(JSON.stringify({ id: '1', type: 'complete' }))
        }
      })
    })

    const client = new SubscriptionClient(`ws://localhost:${port}`, {
      reconnect: true,
      maxReconnectAttempts: 10,
      serviceName: 'test-service',
      connectionCallback: () => {
        client.createSubscription('query', {}, publish)
        client.createSubscription('query', {}, publish)
      }
    })

    client.connect()

    function publish (data) {
      client.close()
      server.close()
      t.end()
    }
  }
)

test('subscription client multiple subscriptions unsubscribe removes only one subscription', (t) => {
  const server = new WS.Server({ port: 0 })
  const port = server.address().port

  server.on('connection', function connection (ws) {
    ws.on('message', function incoming (message, isBinary) {
      const data = JSON.parse(isBinary ? message : message.toString())
      if (data.type === 'complete') {
        ws.send(JSON.stringify({ id: '1', type: 'complete' }))
      }
    })

    ws.send(JSON.stringify({ id: undefined, type: 'connection_ack' }))
  })

  const client = new SubscriptionClient(`ws://localhost:${port}`, {
    reconnect: true,
    maxReconnectAttempts: 10,
    serviceName: 'test-service',
    connectionCallback: () => {
      function publish (data) {
        client.close()
        server.close()
        t.end()
      }

      const operationId1 = client.createSubscription('query', {}, publish)
      const operationId2 = client.createSubscription('query', {}, publish)
      t.equal(operationId1, operationId2)

      client.unsubscribe(operationId1)
      t.equal(client.operationsCount[operationId1], 1)

      client.unsubscribe(operationId1)
    }
  })

  client.connect()
})

test('subscription client closes the connection after GQL_CONNECTION_ERROR type payload received', (t) => {
  const server = new WS.Server({ port: 0 })
  const port = server.address().port

  server.on('connection', function connection (ws) {
    ws.on('message', function incoming (message, isBinary) {
      const data = JSON.parse(isBinary ? message : message.toString())
      if (data.type === 'connection_init') {
        ws.send(JSON.stringify({ id: '1', type: 'connection_error' }))
      }
    })

    ws.on('close', function () {
      client.close()
      server.close()
      t.end()
    })
  })

  const client = new SubscriptionClient(`ws://localhost:${port}`, {
    reconnect: false,
    serviceName: 'test-service'
  })

  client.connect()
})

test('subscription client connectionInitPayload is correctly passed', (t) => {
  const connectionInitPayload = {
    hello: 'world'
  }
  const server = new WS.Server({ port: 0 })
  const port = server.address().port

  server.on('connection', function connection (ws) {
    ws.on('message', function incoming (message, isBinary) {
      const data = JSON.parse(isBinary ? message : message.toString())
      if (data.type === 'connection_init') {
        t.same(data.payload, connectionInitPayload)
        client.close()
        server.close()
        t.end()
      }
    })
  })

  const client = new SubscriptionClient(`ws://localhost:${port}`, {
    reconnect: false,
    serviceName: 'test-service',
    connectionInitPayload: async function () {
      return connectionInitPayload
    }
  })

  client.connect()
})

test('subscription client closes the connection if connectionInitPayload throws', (t) => {
  const server = new WS.Server({ port: 0 })
  const port = server.address().port

  server.on('connection', function connection (ws) {
    ws.on('close', function () {
      client.close()
      server.close()
      t.end()
    })
  })

  const client = new SubscriptionClient(`ws://localhost:${port}`, {
    reconnect: false,
    serviceName: 'test-service',
    connectionInitPayload: async function () {
      throw new Error('kaboom')
    }
  })

  client.connect()
})

test('subscription client sending empty object payload on connection init', (t) => {
  const server = new WS.Server({ port: 0 })
  const port = server.address().port

  server.on('connection', function connection (ws) {
    ws.on('message', function incoming (message, isBinary) {
      const data = JSON.parse(isBinary ? message : message.toString())
      if (data.type === 'connection_init') {
        t.same(data.payload, {})
        ws.send(JSON.stringify({ id: '1', type: 'complete' }))
      }
    })

    ws.send(JSON.stringify({ id: undefined, type: 'connection_ack' }))
  })

  const maxReconnectAttempts = 10
  const client = new SubscriptionClient(`ws://localhost:${port}`, {
    reconnect: true,
    maxReconnectAttempts,
    serviceName: 'test-service',
    connectionCallback: () => {
      client.createSubscription('query', {}, (data) => {
        client.close()
        server.close()
        t.end()
      })
    }
  })

  client.connect()
})

test('subscription client sends GQL_CONNECTION_KEEP_ALIVE when the keep alive option is active', (t) => {
  const server = new WS.Server({ port: 0 })
  const port = server.address().port
  const clock = FakeTimers.createClock()

  server.on('connection', function connection (ws) {
    ws.on('message', function incoming (message, isBinary) {
      const data = JSON.parse(isBinary ? message : message.toString())
      if (data.type === 'connection_init') {
        ws.send(JSON.stringify({ id: '1', type: 'connection_ack' }))
      } else if (data.type === 'start') {
        ws.send(JSON.stringify({ id: '2', type: 'complete' }))
      } else if (data.type === 'ping') {
        // this is a client sent ping, we reply with our pong
        ws.send(JSON.stringify({ id: '3', type: 'pong' }))

        // send a ping to the client so that it replies with its own pong
        // pings and pongs are bidirectional
        ws.send(JSON.stringify({ id: '4', type: 'ping' }))
      } else if (data.type === 'pong') {
        client.close()
        server.close()
        t.end()
      }
    })
  })

  const client = new SubscriptionClient(`ws://localhost:${port}`, {
    reconnect: false,
    serviceName: 'test-service',
    keepAlive: 1000
  })

  client.connect()
  clock.tick(1000)
})

test('subscription client not throwing error on GQL_CONNECTION_KEEP_ALIVE type payload received', (t) => {
  const clock = FakeTimers.createClock()
  const server = new WS.Server({ port: 0 })
  const port = server.address().port
  t.teardown(() => {
    server.close()
  })

  server.on('connection', function connection (ws) {
    ws.on('message', function incoming (message, isBinary) {
      const data = JSON.parse(isBinary ? message : message.toString())
      if (data.type === 'subscribe') {
        ws.send(JSON.stringify({ id: '1', type: 'complete' }))
      }
    })

    ws.send(JSON.stringify({ id: undefined, type: 'connection_ack' }))

    clock.setInterval(() => {
      ws.send(JSON.stringify({ type: 'ping' }))
    }, 200)
  })

  const client = new SubscriptionClient(`ws://localhost:${port}`, {
    reconnect: true,
    maxReconnectAttempts: 10,
    serviceName: 'test-service',
    connectionCallback: () => {
      client.createSubscription('query', {}, (data) => {
        t.same(data, {
          topic: 'test-service_1',
          payload: null
        })
        clock.tick(200)
        client.close()
        t.end()
      })

      clock.tick(200)
      clock.tick(200)
    }
  })

  client.connect()
})

test('subscription client should throw on createSubscription if connection is not ready', (t) => {
  const server = new WS.Server({ port: 0 })
  const port = server.address().port

  server.on('connection', function connection (ws) {
    ws.on('message', function incoming (message, isBinary) {
      const data = JSON.parse(isBinary ? message : message.toString())
      if (data.type === 'connection_init') {
        ws.send(JSON.stringify({ id: undefined, type: 'connection_error' }))
      }
    })
  })

  const client = new SubscriptionClient(`ws://localhost:${port}`, {
    reconnect: false,
    maxReconnectAttempts: 0,
    serviceName: 'test-service',
    failedConnectionCallback: () => {
      try {
        client.createSubscription('query', {})
      } catch (err) {
        t.ok(err instanceof Error)
      }
      server.close()
      client.close()
      t.end()
    }
  })

  client.connect()
})

test('subscription client should pass the error payload to failedConnectionCallback in case of a connection_error', (t) => {
  const server = new WS.Server({ port: 0 })
  const port = server.address().port
  const errorPayload = { message: 'error' }

  server.on('connection', function connection (ws) {
    ws.on('message', function incoming (message, isBinary) {
      const data = JSON.parse(isBinary ? message : message.toString())
      if (data.type === 'connection_init') {
        ws.send(
          JSON.stringify({
            id: undefined,
            type: 'connection_error',
            payload: errorPayload
          })
        )
      }
    })
  })

  const client = new SubscriptionClient(`ws://localhost:${port}`, {
    reconnect: false,
    maxReconnectAttempts: 0,
    serviceName: 'test-service',
    failedConnectionCallback: (err) => {
      t.same(err, errorPayload)

      server.close()
      client.close()
      t.end()
    }
  })

  client.connect()
})

test('subscription client does not send message if operation is already started', (t) => {
  let sent = false
  class MockSubscriptionClient extends SubscriptionClient {
    _sendMessage (operationId, type, payload) {
      if (operationId && type === 'subscribe') {
        if (!sent) {
          t.pass()
          sent = true
        } else {
          t.fail('Should not send message if operation is already started')
        }
      }
    }
  }

  const server = new WS.Server({ port: 0 })
  const port = server.address().port

  server.on('connection', function connection (ws) {
    ws.send(JSON.stringify({ id: undefined, type: 'connection_ack' }))
  })

  const client = new MockSubscriptionClient(`ws://localhost:${port}`, {
    reconnect: true,
    maxReconnectAttempts: 10,
    serviceName: 'test-service',
    connectionCallback: async () => {
      const operationId = client.createSubscription('query', {}, publish)
      client._startOperation(operationId)
      server.close()
      client.close()
      t.end()
    }
  })

  client.connect()

  function publish (data) {}
})

test('subscription client sends an error and deletes the associated operation after GQL_ERROR type payload received', (t) => {
  const server = new WS.Server({ port: 0 })
  const port = server.address().port
  const testPayload = 'test-payload'
  let client = null
  const operationId = '1'

  server.on('connection', function connection (ws) {
    ws.on('message', function incoming (message, isBinary) {
      const data = JSON.parse(isBinary ? message : message.toString())
      if (data.type === 'connection_init') {
        ws.send(JSON.stringify({ id: undefined, type: 'connection_ack' }))
        ws.send(
          JSON.stringify({
            id: operationId,
            type: 'error',
            payload: testPayload
          })
        )
      } else if (data.type === 'error') {
        t.equal(data.payload, testPayload)
        t.equal(client.operationsCount[operationId], 1)
        t.equal(client.operations.get(operationId), undefined)
        client.close()
        server.close()
        t.end()
      }
    })
  })

  client = new SubscriptionClient(`ws://localhost:${port}`, {
    reconnect: false,
    serviceName: 'test-service',
    connectionCallback: async () => {
      client.createSubscription('query', {}, publish)
    }
  })

  client.connect()

  function publish (data) {}
})

test('rewriteConnectionInitPayload is called with context', (t) => {
  const initialPayload = { token: 'some-token' }
  const rewritePayload = { user: { id: '1' } }

  function rewriteConnectionInitPayload (payload, context) {
    t.same(payload, initialPayload)
    t.has(context, rewritePayload)
    return { user: context.user }
  }

  const server = new WS.Server({ port: 0 })
  const port = server.address().port

  server.on('connection', function connection (ws) {
    ws.send(JSON.stringify({ id: undefined, type: 'connection_ack' }))
  })

  const client = new SubscriptionClient(`ws://localhost:${port}`, {
    reconnect: true,
    maxReconnectAttempts: 10,
    serviceName: 'test-service',
    rewriteConnectionInitPayload,
    connectionCallback: async () => {
      const operationId = client.createSubscription('query', {}, publish, {
        ...rewritePayload,
        _connectionInit: initialPayload
      })
      client._startOperation(operationId)
      server.close()
      client.close()
      t.end()
    }
  })

  client.connect()

  function publish (data) {}
})

test('event emitters', async (t) => {
  const server = new WS.Server({ port: 0 })
  const port = server.address().port

  server.on('connection', function connection (ws) {
    ws.on('message', function incoming (message, isBinary) {
      const data = JSON.parse(isBinary ? message : message.toString())
      if (data.type === 'connection_init') {
        ws.send(JSON.stringify({ id: undefined, type: 'connection_ack' }))
      } else if (data.type === 'subscribe') {
        ws.send(
          JSON.stringify({
            id: '1',
            type: 'next',
            payload: { data: { foo: 'bar' } }
          })
        )
      }
    })
  })

  const client = new SubscriptionClient(`ws://localhost:${port}`, {
    reconnect: true,
    maxReconnectAttempts: 10,
    serviceName: 'test-service'
  })

  client.connect()

  await t.resolves(async () => await once(client, 'socketOpen'))
  await t.resolves(async () => await once(client, 'ready'))

  const operationId1 = client.createSubscription('query', {}, () => {})

  client.unsubscribe(operationId1)
  client.close()

  await t.resolves(async () => await once(client, 'socketClose'))
  server.close()
})

test('mercurius integration', async (t) => {
  const app = Fastify()

  const schema = `
  type Notification {
    id: ID!
    message: String
  }

  type Query {
    notifications: [Notification]
  }

  type Mutation {
    addNotification(message: String): Notification
  }

  type Subscription {
    notificationAdded: Notification
  }
`

  let idCount = 1
  const notifications = [
    {
      id: idCount,
      message: 'Notification message'
    }
  ]

  const resolvers = {
    Query: {
      notifications: () => notifications
    },
    Mutation: {
      addNotification: async (_, { message }, { pubsub }) => {
        const id = idCount++
        const notification = {
          id,
          message
        }
        notifications.push(notification)
        await pubsub.publish({
          topic: 'NOTIFICATION_ADDED_1',
          payload: {
            notificationAdded: notification
          }
        })

        return notification
      }
    },
    Subscription: {
      notificationAdded: {
        subscribe: async (root, args, { pubsub }) =>
          await pubsub.subscribe('NOTIFICATION_ADDED')
      }
    }
  }

  app.register(mercurius, {
    schema,
    resolvers,
    subscription: true
  })

  await app.listen({ port: 0 })

  const client = new SubscriptionClient(
    `ws://localhost:${app.server.address().port}/graphql`,
    {
      reconnect: true,
      maxReconnectAttempts: 10
    }
  )

  client.connect()

  await once(client, 'ready')

  const subscription = `
    subscription {
      notificationAdded {
        id
        message
      }
    }`

  const operationId = client.createSubscription(subscription, {}, async (data) => {
    // expect to see data from subscription here
    console.log('DATA', data)
    // client.unsubscribe(operationId)
    // client.close()
    // app.close()
    // t.end()
  })

  const query = `
    mutation {
      addNotification(message: "test") {
        id
        message
      }
    }`

  await app.inject({
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    url: '/graphql',
    body: JSON.stringify({ query })
  })

  client.unsubscribe(operationId)
  client.close()
  app.close()
  t.end()
})
