import { MercuriusContext } from "mercurius";
import { EventEmitter } from "stream";

export interface SubscriptionClientConfig {
  protocols?: Array<string>,
  reconnect?: boolean,
  maxReconnectAttempts?: number,
  serviceName: string,
  connectionCallback?: (params: any) => Promise<void>,
  failedConnectionCallback?: (params: any) => Promise<void>,
  failedReconnectCallback?: (params: any) => Promise<void>,
  connectionInitPayload?: any,
  rewriteConnectionInitPayload?: (connectionInit: any, context: MercuriusContext) => void,
  keepAlive?: number
}

export type SubscriptionOperationId = string

export class SubscriptionClient extends EventEmitter {
  constructor(uri: string, config: SubscriptionClientConfig)

  connect(): void
  close (tryReconnect: boolean, closedByUser?: boolean): void
  unsubscribe (operationId: SubscriptionOperationId, forceUnsubscribe?: boolean) : void
  unsubscribeAll() : void
  createSubscription (query: string, variables: any, publish: (props: any) => Promise<void>, context: MercuriusContext) : SubscriptionOperationId
}
