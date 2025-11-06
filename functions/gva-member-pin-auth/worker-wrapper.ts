import { onInvoke } from './src/function';
import { kvStoreFactory } from './glia-kv-sdk';

export default {
  async fetch(request: Request, environment: Record<string, unknown>): Promise<Response> {
    return onInvoke(request, environment, kvStoreFactory);
  },
};
