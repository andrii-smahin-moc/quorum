import { FunctionConfig, HandlerPayload, HandlerResult, LoggerInterface } from '../types';

import { BaseGVAGoalService } from './base-gva-goal-service';

export enum GVAGoalSteps {
  ASK_NUMBER = 'ask_number',
  VALIDATE_NUMBER = 'validate_number',
}

export class GVAGoalService extends BaseGVAGoalService {
  constructor(
    private config: FunctionConfig,
    private logger: LoggerInterface,
  ) {
    super();
    this.register('default', this.handleAskNumberStep.bind(this));
    this.register(GVAGoalSteps.ASK_NUMBER, this.handleAskNumberStep.bind(this));
    this.register(GVAGoalSteps.VALIDATE_NUMBER, this.handleValidateNumberStep.bind(this));
  }

  async handleAskNumberStep(context: HandlerPayload): Promise<HandlerResult> {
    await this.logger.info(`EngagementId: ${context.engagementId}, Asking user for a number`);
    return this.buildHandlerResultPayload({
      customJourneyContext: { STEP: GVAGoalSteps.VALIDATE_NUMBER },
      responseId: this.config.gvaGoals.askNumberGoalId,
    });
  }

  async handleValidateNumberStep(context: HandlerPayload): Promise<HandlerResult> {
    await this.logger.info(`EngagementId: ${context.engagementId}, Validating number input from user`);

    if (context.messageType === 'text' && context.text) {
      const numberRegex = /^\d+$/;
      const enteredText = context.text.trim();

      if (numberRegex.test(enteredText)) {
        await this.logger.info(`EngagementId: ${context.engagementId}, Valid number received: ${enteredText}`);
        return this.buildHandlerResultPayload({
          customJourneyContext: { STEP: null },
          isFinalStep: true,
          responseData: { number: enteredText },
          responseId: this.config.gvaGoals.validNumberGoalId,
        });
      }
    }

    await this.logger.info(`EngagementId: ${context.engagementId}, Invalid input received, re-asking for number`);
    return this.buildHandlerResultPayload({
      customJourneyContext: { STEP: GVAGoalSteps.VALIDATE_NUMBER },
      responseId: this.config.gvaGoals.reAskNumberGoalId,
    });
  }
}
