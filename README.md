# @mercuriusjs/subscription-client

A websocket client for [Mercurius subscriptions](https://github.com/mercurius-js/mercurius/blob/master/docs/subscriptions.md).

## Quick start

```javascript
npm i @mercuriusjs/subscription-client
```

### SubscriptionClient

`SubscriptionClient`: `class extends EventEmitter`

- The SubscriptionClient class constructor takes two parameters:
  - `uri`: `string` The uri of the websocket server.
  - `config`: `object` the configuration object.
    - `protocols`: `Array<string>` The WebSocket sub-protocol. **default**: `graphql-transport-ws`.
    - `reconnect`: `boolean` Enables the client to attempt to reconnect if the connection is interrupted. **default**: `false`.
    - `maxReconnectAttempts`: `number` The maximum amount of attempts the client should perform when reconnecting. **default**: `Infinity`.
    - `serviceName`: `string` The service name.
    - `connectionCallback`: `(params: any) : Promise<void>` A callback that is executed when the client is successfully connected to the server.
    - `failedConnectionCallback`: `(params: any) : Promise<void>` A callback that is executed when the client fails connecting to the server.
    - `failedReconnectCallback`: `(params: any) : Promise<void>` A callback that is executed when the client fails reconnecting to the server.
    - `connectionInitPayload`: `any` The connection init payload or a function that returns it.
    - `rewriteConnectionInitPayload`: `(connectionInit, context) => void` A function that allows to rewrite the default connection init payload.
    - `keepAlive`: `number` The milliseconds value of the connection keep-alive interval. **default**: `false`

- `subscriptionClient.connect()` : `void` Creates a connection to the server.
- `subscriptionClient.close(tryReconnect, closedByUser?)` : `void` Closes the connection to the server.
- `unsubscribe(operationId, forceUnsubscribe)` : `void` Unsuscribes from the topic with the provided `operationId`.
- `subscriptionClient.unsubscribeAll()` : `void` Unsuscribes from all topics.
- `subscriptionClient.createSubscription(query, variables, publish, context)` : `string`. Creates a subscription to a query. Returns the `SubscriptionOperationId`

`SubscriptionClient` extends `EventEmitter` class from `node:events`, and it is possibile add listeners to the following events:

- `SocketOpen` Emits when the connection is open.
- `ready` Emits when the `connection_ack` is received and it is ready to communicate.
- `SocketError` Emits when an error occurred.
- `SocketClose` Emits when the socket is closed.


Examples:

```cjs
const { SubscriptionClient } = require( "@mercuriusjs/subscription-client")
const { once } = require('events') 

const client = new SubscriptionClient('ws://localhost:3000', {
  protocols: ["graphql-transport-ws"],
  reconnect: true,
  maxReconnectAttempts: 10,
  serviceName: "test-service",
  connectionCallback: () => {
    // executes callback on connection
  },
  failedConnectionCallback: (err) => {
    // executes callback on connection error
  },
  failedReconnectCallback: () => {
    // executes callback on reconnection error
  },
  connectionInitPayload: 'foo', // connection payload
  rewriteConnectionInitPayload: (connectionInit, context) => {
    // rewrite the connection init payload
  },
  keepAlive: 1000
});

client.connect()

await once(client, 'ready')

const operationId1 = client.createSubscription('query', {}, (data)=> {
  // data returned from the query
})

client.unsubscribe(operationId1)

const operationId2 = client.createSubscription('query', {}, (data)=> {
  // data returned from the query
})

client.unsuscribeAll()

client.close()
```
