import { INITIAL_STEP, MEMBER_NUMBER_REGEX, MEMBER_PIN_REGEX } from '../constants';
import { FunctionConfig, HandlerPayload, HandlerResult, LoggerInterface } from '../types';

import { BaseGVAGoalService } from './base-gva-goal-service';

export enum GVAGoalSteps {
  VALIDATE_MEMBER_NUMBER = 'VALIDATE_MEMBER_NUMBER',
  VALIDATE_PIN = 'VALIDATE_PIN',
}

export class GVAGoalService extends BaseGVAGoalService {
  constructor(
    private config: FunctionConfig,
    private logger: LoggerInterface,
  ) {
    super();
    this.register(INITIAL_STEP, this.initialStep.bind(this));
    this.register(GVAGoalSteps.VALIDATE_MEMBER_NUMBER, this.validateMemberNumber.bind(this));
    this.register(GVAGoalSteps.VALIDATE_PIN, this.validatePin.bind(this));
  }

  async initialStep(context: HandlerPayload): Promise<HandlerResult> {
    // add check is need to authenticate ot not
    await this.logger.info(`EngagementId: ${context.engagementId}, Starting initial step`);
    return this.buildHandlerResultPayload({
      customJourneyContext: { STEP: GVAGoalSteps.VALIDATE_MEMBER_NUMBER },
      responseId: this.config.gvaGoals.needToAuthentication,
    });
  }

  async validateMemberNumber(context: HandlerPayload): Promise<HandlerResult> {
    await this.logger.info(`EngagementId: ${context.engagementId}, Validating member number`);

    if (context.messageType === 'text' && context.text) {
      const userInput = context.text.trim();
      if (MEMBER_NUMBER_REGEX.test(userInput)) {
        await this.logger.info(`EngagementId: ${context.engagementId}, Valid member number received: ${userInput}`);
        // save member number to KV store
        // send OTP to visitor
        return this.buildHandlerResultPayload({
          customJourneyContext: { STEP: GVAGoalSteps.VALIDATE_PIN },
          responseId: this.config.gvaGoals.enterAPin,
        });
      }
    }

    await this.logger.info(`EngagementId: ${context.engagementId}, Invalid member number`);
    return this.buildHandlerResultPayload({
      customJourneyContext: { STEP: GVAGoalSteps.VALIDATE_MEMBER_NUMBER },
      responseId: this.config.gvaGoals.invalidMemberNumber,
    });
  }

  async validatePin(context: HandlerPayload): Promise<HandlerResult> {
    await this.logger.info(`EngagementId: ${context.engagementId}, Validating PIN`);

    if (context.messageType === 'text' && context.text) {
      const userInput = context.text.trim();
      if (MEMBER_PIN_REGEX.test(userInput)) {
        await this.logger.info(`EngagementId: ${context.engagementId}, Valid PIN received: ${userInput}`);
        // get MEMBER NUMBER from KV store
        // validate PIN and MEMBER NUMBER
        return this.buildHandlerResultPayload({
          customJourneyContext: { STEP: null },
          isFinalStep: true,
          responseId: this.config.gvaGoals.successfullyVerifiesMemberNumberAndPin,
        });
      }
    }

    await this.logger.info(`EngagementId: ${context.engagementId}, Invalid PIN`);
    return this.buildHandlerResultPayload({
      customJourneyContext: { STEP: GVAGoalSteps.VALIDATE_PIN },
      responseId: this.config.gvaGoals.enterAPin,
    });
  }
}
