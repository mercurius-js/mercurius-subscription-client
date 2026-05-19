import { MercuriusContext } from 'mercurius'
import { GRAPHQL_TRANSPORT_WS_PROTOCOL } from 'graphql-ws'
import { expect } from 'tstyche'
import { SubscriptionClient, SubscriptionClientConfig, SubscriptionOperationId } from '..'

const config = {
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
}

expect<SubscriptionClientConfig>().type.toBeAssignableFrom(config)

expect<SubscriptionClientConfig>().type.toBeAssignableFrom({ serviceName: 'test' })

const subscriptionClient = new SubscriptionClient('ws://localhost', config)

expect(subscriptionClient.connect()).type.toBe<void>()
expect(subscriptionClient.close(true)).type.toBe<void>()
expect(subscriptionClient.unsubscribeAll()).type.toBe<void>()

const subscription = subscriptionClient.createSubscription('query', {}, async () => {
}, {} as MercuriusContext)

expect(subscription).type.toBe<SubscriptionOperationId>()
expect(subscriptionClient.unsubscribe(subscription)).type.toBe<void>()
