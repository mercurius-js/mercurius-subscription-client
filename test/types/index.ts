import { MercuriusContext } from 'mercurius'
import { GRAPHQL_TRANSPORT_WS_PROTOCOL } from 'graphql-ws'
import { expectAssignable, expectType } from 'tsd'
import { SubscriptionClient, SubscriptionClientConfig, SubscriptionOperationId } from '../..'

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

expectAssignable<SubscriptionClientConfig>(config)

expectAssignable<SubscriptionClientConfig>({
  serviceName: 'test'
})

const subscriptionClient = new SubscriptionClient('ws://localhost', config)

expectType<void>(subscriptionClient.connect())
expectType<void>(subscriptionClient.close(true))
expectType<void>(subscriptionClient.unsubscribeAll())

const subscription = subscriptionClient.createSubscription('query', {}, async () => {
}, {} as MercuriusContext)

expectType<SubscriptionOperationId>(subscription)
expectType<void>(subscriptionClient.unsubscribe(subscription))
