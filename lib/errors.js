'use strict'

const createError = require('@fastify/error')

const errors = {
  /**
   * General errors
   */
  MER_ERR_INVALID_OPTS: createError(
    'MER_ERR_INVALID_OPTS',
    'Invalid options: %s'
  ),
  /**
   * Subscription errors
   */
  MER_ERR_GQL_SUBSCRIPTION_CONNECTION_NOT_READY: createError(
    'MER_ERR_GQL_SUBSCRIPTION_CONNECTION_NOT_READY',
    'Connection is not ready'
  ),
  MER_ERR_GQL_SUBSCRIPTION_MESSAGE_INVALID: createError(
    'MER_ERR_GQL_SUBSCRIPTION_MESSAGE_INVALID',
    'Invalid message received: %s'
  )
}

module.exports = errors
