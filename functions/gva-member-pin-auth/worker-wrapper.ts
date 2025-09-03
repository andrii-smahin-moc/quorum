import { onInvoke } from './src/function';

export default {
  async fetch(request: Request, environment: Record<string, unknown>): Promise<Response> {
    return onInvoke(request, environment);
  },
};
