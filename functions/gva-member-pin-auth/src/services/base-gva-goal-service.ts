import { GVAFunctionPayloadSchema } from '../schemas';
import { GoalStepHandler, HandlerPayload, HandlerResult, ValidationResult } from '../types';
import { validateSchema } from '../validator';

export class BaseGVAGoalService {
  private goalHandlers = new Map<string, GoalStepHandler>();

  public buildHandlerResultPayload(overrides: Partial<HandlerResult>): HandlerResult {
    const defaults = {
      customJourneyContext: {},
      customPayload: {},
      isFinalStep: false,
      responseData: {},
      responseId: '',
      transferToHuman: false,
    };

    return {
      ...defaults,
      ...overrides,
    };
  }

  public execute(step: string, context: HandlerPayload): Promise<HandlerResult> {
    const handler = this.resolve(step);
    return handler(context);
  }

  public parsePayload(rawPayload: string): ValidationResult<HandlerPayload> {
    const logPrefix = 'Parse GVA Payload';
    const parsedResult = this.safeJSONParse(rawPayload);
    if (!parsedResult.status) {
      const message = `${logPrefix}: ${parsedResult.message}`;
      return { message, status: false };
    }

    return validateSchema(GVAFunctionPayloadSchema, parsedResult.output, logPrefix);
  }

  public register(step: string, handler: GoalStepHandler): void {
    this.goalHandlers.set(step, handler);
  }

  public resolve(step: string): GoalStepHandler {
    const handler = this.goalHandlers.get(step);
    if (!handler) {
      throw new Error(`No handler registered for step "${step}"`);
    }
    return handler;
  }

  public safeJSONParse(jsonString: string): ValidationResult<Record<string, unknown>> {
    try {
      const output = JSON.parse(jsonString) as Record<string, unknown>;
      return { output, status: true };
    } catch (error) {
      const logError = error instanceof Error ? error : new Error(String(error));
      const message = `Failed to parse JSON. Error: ${logError.message}`;
      return { message, status: false };
    }
  }
}
