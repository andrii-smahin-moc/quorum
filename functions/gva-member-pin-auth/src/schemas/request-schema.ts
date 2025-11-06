import * as v from 'valibot';

export const BaseRequestPayloadSchema = v.object({
  metadata: v.object({
    action: v.literal('web_api_invoke'),
    id: v.string(),
    invoker: v.object({
      id: v.string(),
      type: v.literal('operator'),
    }),
    timestamp: v.string(),
  }),
  payload: v.string(),
});
