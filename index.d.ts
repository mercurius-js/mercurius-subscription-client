import { MercuriusContext } from "mercurius";

export interface SubscriptionClientConfig {
  protocols: Array<string>,
  reconnect: boolean,
  maxReconnectAttempts: number,
  serviceName: string,
  connectionCallback: (params: any) => Promise<void>,
  failedConnectionCallback: (params: any) => Promise<void>,
  failedReconnectCallback: (params: any) => Promise<void>,
  connectionInitPayload: any,
  rewriteConnectionInitPayload: any,
  keepAlive: boolean
}

export type SubscriptionOperationId = string

export class SubscriptionClient {
  constructor(uri: string, config: SubscriptionClientConfig)

  connect(): void
  close (tryReconnect: boolean, closedByUser?: boolean): void
  getReconnectDelay() : number
  reconnect() : void
  unsubscribe (operationId: SubscriptionOperationId, forceUnsubscribe: boolean) : void
  unsubscribeAll() : void
  sendMessage (operationId: SubscriptionOperationId, type: any, payload : any, extensions: any) : void
  handleMessage (message: any) : Promise<void>
  startOperation (operationId: SubscriptionOperationId) : void

  createSubscription (query: string, variables: any, publish: (props: any) => Promise<void>, context: MercuriusContext) : SubscriptionOperationId
  startKeepAliveInterval() : void
  stopKeepAliveInterval() : void
}
