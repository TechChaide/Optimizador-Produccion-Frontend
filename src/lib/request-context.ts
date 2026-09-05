import { AsyncLocalStorage } from 'node:async_hooks';

export const requestContext = new AsyncLocalStorage<any>();

export function getRequestContext() {
  return requestContext.getStore();
}
