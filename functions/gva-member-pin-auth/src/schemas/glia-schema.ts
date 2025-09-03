import * as v from 'valibot';

export const GVAFunctionPayloadSchema = v.object({
  authToken: v.optional(v.string()),
  buttonPayload: v.optional(v.record(v.string(), v.unknown())),

  buttonText: v.optional(v.string()),
  customJourneyContext: v.optional(v.string()),

  engagementId: v.string(),

  gvaId: v.string(),
  messageType: v.union([v.literal('text'), v.literal('quickReplyTap')]),
  text: v.optional(v.string()),
});
