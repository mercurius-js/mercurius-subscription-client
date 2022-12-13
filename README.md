# @mercurius/subscription-client

A websocket client for [Mercurius subscriptions](https://github.com/mercurius-js/mercurius/blob/master/docs/subscriptions.md).

## Quick start

```javascript
npm i @mercuriusjs/subscription-client
```

### SubscriptionClient

`SubscriptionClient`: `class`

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
- `subscriptionClient.reconnect()` : `void` Attempts to reconnect to the server.
- `subscriptionClient.close(tryReconnect, closedByUser?)` : `void` Closes the connection to the server.
- `subscriptionClient.unsubscribeAll()` : `void` Unsuscribes from all topics.
- `subscriptionClient.createSubscription(query, variables, publish, context)` : `string`. Creates a subscription to a query. Returns the `SubscriptionOperationId`

Examples:

```js
import { SubscriptionClient } from "@mercuriusjs/subscription-client";

const uri = `ws://localhost:3000`; // uri of the server
const client = new SubscriptionClient(uri, {
  reconnect: true,
  maxReconnectAttempts: 10,
  serviceName: "test-service",
  protocols: ["graphql-transport-ws"],
  connectionCallback: () => {
    client.createSubscription("query", {}, (data) => {
      console.log(data); // data returned from the query
      client.close();
    });
  },
});


```
