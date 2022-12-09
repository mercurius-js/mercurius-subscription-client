'use strict'

const SubscriptionClient = require('./lib/subscription-client')
const { getProtocolByName, GRAPHQL_TRANSPORT_WS, GRAPHQL_WS } = require('./lib/subscription-protocol')

module.exports = {
  SubscriptionClient,
  getProtocolByName,
  GRAPHQL_TRANSPORT_WS,
  GRAPHQL_WS
}
