import * as v from 'valibot';

import { GVAFunctionPayloadSchema } from '../schemas';

export type HandlerPayload = v.InferOutput<typeof GVAFunctionPayloadSchema>;

export interface HandlerResult {
  responseId: string;
  responseData: Record<string, unknown>;
  customJourneyContext: Record<string, unknown>;
  isFinalStep: boolean;
  transferToHuman: boolean;
  customPayload: Record<string, unknown>;
}

export type GoalStepHandler = (context: HandlerPayload) => Promise<HandlerResult>;
