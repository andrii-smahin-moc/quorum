import { FORGET_THE_PIN, INITIAL_STEP, MEMBER_NUMBER_REGEX, MEMBER_PIN_REGEX } from '../constants';
import { FunctionConfig, HandlerPayload, HandlerResult, LoggerInterface } from '../types';

import { AnswerDetectorService } from './answer-detector-service';
import { BaseGVAGoalService } from './base-gva-goal-service';
import { AnswerOption } from './possible-answer';

export enum GVAGoalSteps {
  VALIDATE_MEMBER_NUMBER = 'VALIDATE_MEMBER_NUMBER',
  VALIDATE_PIN = 'VALIDATE_PIN',
}

export const AnswerOptionsList = {
  // CANCEL: 'cancel',
  // CONFIRM: 'confirm',
  MEMBER_NUMBER: 'member_number',
};

export class GVAGoalService extends BaseGVAGoalService {
  private answerDetectorService: AnswerDetectorService;
  constructor(
    private config: FunctionConfig,
    private logger: LoggerInterface,
  ) {
    super();
    this.register(INITIAL_STEP, this.initialStep.bind(this));
    this.register(GVAGoalSteps.VALIDATE_MEMBER_NUMBER, this.validateMemberNumber.bind(this));
    this.register(GVAGoalSteps.VALIDATE_PIN, this.validatePin.bind(this));

    this.answerDetectorService = new AnswerDetectorService(this.config, this.logger, [
      // new AnswerOption(AnswerOptionsList.CANCEL, ['To Cancel', 'cancel', 'stop', 'abort']),
      // new AnswerOption(AnswerOptionsList.CONFIRM, ['To continue', 'Confirm', 'yes', 'ok']),
      new AnswerOption(AnswerOptionsList.MEMBER_NUMBER, [MEMBER_NUMBER_REGEX]),
    ]);
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

    const detectedAnswer = await this.answerDetectorService.detect(context);

    if (detectedAnswer && detectedAnswer.name === AnswerOptionsList.MEMBER_NUMBER) {
      await this.logger.info(`EngagementId: ${context.engagementId}, Valid member number received: ${detectedAnswer.matchedText}`);
      // save member number to KV store
      // send OTP to visitor
      return this.buildHandlerResultPayload({
        customJourneyContext: { STEP: GVAGoalSteps.VALIDATE_PIN },
        responseId: this.config.gvaGoals.enterAPin,
      });
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

      if (FORGET_THE_PIN.test(userInput.toLowerCase())) {
        await this.logger.info(`EngagementId: ${context.engagementId}, User forgot PIN`);
        return this.buildHandlerResultPayload({
          customJourneyContext: { STEP: null },
          isFinalStep: true,
          responseId: this.config.gvaGoals.forgotPin,
        });
      }
    }

    await this.logger.info(`EngagementId: ${context.engagementId}, Invalid PIN`);
    return this.buildHandlerResultPayload({
      customJourneyContext: { STEP: GVAGoalSteps.VALIDATE_PIN },
      responseId: this.config.gvaGoals.invalidPin,
    });
  }
}
