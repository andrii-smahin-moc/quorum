import { QuorumApi } from '../apis';
import { INITIAL_STEP, MEMBER_NUMBER_REGEX, MEMBER_PIN_REGEX, ZERO_NUMBER } from '../constants';
import { FunctionConfig, HandlerPayload, HandlerResult, LoggerInterface } from '../types';

import { AnswerDetectorService } from './answer-detector-service';
import { BaseGVAGoalService } from './base-gva-goal-service';
import { AnswerOption } from './possible-answer';

export enum GVAGoalSteps {
  VALIDATE_MEMBER_NUMBER = 'VALIDATE_MEMBER_NUMBER',
  VALIDATE_PIN = 'VALIDATE_PIN',
}

export const AnswerOptionsList = {
  FORGET_THE_PIN: 'forget_the_pin',
  MEMBER_NUMBER: 'member_number',
  MEMBER_PIN: 'member_pin',
  ZERO_NUMBER: 'zero_number',
};

export class GVAGoalService extends BaseGVAGoalService {
  private answerDetectorService: AnswerDetectorService;
  private quorumApi: QuorumApi;
  constructor(
    private config: FunctionConfig,
    private logger: LoggerInterface,
  ) {
    super();
    this.quorumApi = new QuorumApi(config, logger);
    this.register(INITIAL_STEP, this.initialStep.bind(this));
    this.register(GVAGoalSteps.VALIDATE_MEMBER_NUMBER, this.validateMemberNumber.bind(this));
    this.register(GVAGoalSteps.VALIDATE_PIN, this.validatePin.bind(this));

    this.answerDetectorService = new AnswerDetectorService(this.config, this.logger, [
      new AnswerOption(AnswerOptionsList.FORGET_THE_PIN, ['I forgot', 'forgot', 'forget', 'lost', 'no', 'not', 'don']),
      new AnswerOption(AnswerOptionsList.MEMBER_NUMBER, [MEMBER_NUMBER_REGEX]),
      new AnswerOption(AnswerOptionsList.MEMBER_PIN, [MEMBER_PIN_REGEX]),
      new AnswerOption(AnswerOptionsList.ZERO_NUMBER, [ZERO_NUMBER, 'zero']),
    ]);
  }

  async initialStep(context: HandlerPayload): Promise<HandlerResult> {
    await this.logger.info(`EngagementId: ${context.engagementId}, Starting initial step`);
    const customJourneyContext = this.getCustomJurneyContext(context);
    customJourneyContext.STEP = GVAGoalSteps.VALIDATE_MEMBER_NUMBER;

    return this.buildHandlerResultPayload({
      customJourneyContext,
      responseId: this.config.gvaGoals.needToAuthentication,
    });
  }

  async validateMemberNumber(context: HandlerPayload): Promise<HandlerResult> {
    await this.logger.info(`EngagementId: ${context.engagementId}, Validating member number`);

    const detectedAnswer = await this.answerDetectorService.detect(context);
    const customJourneyContext = this.getCustomJurneyContext(context);

    let failedAttempts = Number(customJourneyContext.failedAttempts ?? 0);

    if (detectedAnswer && detectedAnswer.name === AnswerOptionsList.MEMBER_NUMBER && detectedAnswer.matchedText) {
      await this.logger.info(`EngagementId: ${context.engagementId}, Valid member number received: ${detectedAnswer.matchedText}`);
      const isMemberExists = await this.verifyIsMemberExists(detectedAnswer.matchedText);

      if (isMemberExists) {
        customJourneyContext.memberNumber = detectedAnswer.matchedText;
        customJourneyContext.failedAttempts = 0;
        customJourneyContext.STEP = GVAGoalSteps.VALIDATE_PIN;
        return this.buildHandlerResultPayload({
          customJourneyContext,
          responseId: this.config.gvaGoals.enterAPin,
        });
      }
    }

    if (detectedAnswer && detectedAnswer.name === AnswerOptionsList.ZERO_NUMBER) {
      await this.logger.info(`EngagementId: ${context.engagementId}, Zero press detected`);
      return this.buildHandlerResultPayload({
        isFinalStep: true,
        responseId: this.config.gvaGoals.zeroPress,
      });
    }

    failedAttempts += 1;
    customJourneyContext.failedAttempts = failedAttempts;

    const attemptLimit = this.config.inputValidationFailedAttemptsLimit;

    if (failedAttempts >= attemptLimit) {
      await this.logger.info(`EngagementId: ${context.engagementId}, Too many failed attempts`);
      return this.buildHandlerResultPayload({
        isFinalStep: true,
        responseId: this.config.gvaGoals.transferToLiveOperator,
      });
    }

    await this.logger.info(`EngagementId: ${context.engagementId}, Invalid member number`);
    customJourneyContext.STEP = GVAGoalSteps.VALIDATE_MEMBER_NUMBER;

    return this.buildHandlerResultPayload({
      customJourneyContext,
      responseId: this.config.gvaGoals.invalidMemberNumber,
    });
  }

  async validatePin(context: HandlerPayload): Promise<HandlerResult> {
    await this.logger.info(`EngagementId: ${context.engagementId}, Validating PIN`);

    const detectedAnswer = await this.answerDetectorService.detect(context);
    const customJourneyContext = this.getCustomJurneyContext(context);
    let enterPinFailedAttempts = Number(customJourneyContext.enterPinFailedAttempts || 0);

    if (detectedAnswer && detectedAnswer.name === AnswerOptionsList.MEMBER_PIN && detectedAnswer.matchedText) {
      await this.logger.info(`EngagementId: ${context.engagementId}, Valid PIN received: ${detectedAnswer.matchedText}`);
      const memberNumber = customJourneyContext.memberNumber;

      if (!memberNumber || typeof memberNumber !== 'string') {
        await this.logger.error(`EngagementId: ${context.engagementId}, memberNumber is missing or invalid in customJourneyContext`);
        return this.buildHandlerResultPayload({
          isFinalStep: true,
          responseId: this.config.gvaGoals.invalidMemberNumber,
        });
      }
      const authResult = await this.verifyMemberPin(String(customJourneyContext.memberNumber), detectedAnswer.matchedText);
      if (authResult && typeof authResult.token === 'string' && typeof authResult.expiresIn === 'string') {
        await this.logger.info(`EngagementId: ${context.engagementId}, PIN verified successfully`);

        return this.buildHandlerResultPayload({
          auth: {
            expiresIn: Number(authResult.expiresIn),
            token: authResult.token,
          },
          isFinalStep: true,
          responseId: this.config.gvaGoals.successfullyVerifiesMemberNumberAndPin,
        });
      }
    }
    if (detectedAnswer && detectedAnswer.name === AnswerOptionsList.FORGET_THE_PIN) {
      await this.logger.info(`EngagementId: ${context.engagementId}, User forgot PIN`);
      return this.buildHandlerResultPayload({
        isFinalStep: true,
        responseId: this.config.gvaGoals.forgotPin,
      });
    }
    enterPinFailedAttempts += 1;
    customJourneyContext.enterPinFailedAttempts = enterPinFailedAttempts;

    const attemptLimit = this.config.inputValidationFailedAttemptsLimit;

    if (enterPinFailedAttempts >= attemptLimit) {
      await this.logger.info(
        `EngagementId: ${context.engagementId}, Exceeded allowed PIN attempts ` + `(${enterPinFailedAttempts}/${attemptLimit}), escalating`,
      );

      return this.buildHandlerResultPayload({
        isFinalStep: true,
        responseId: this.config.gvaGoals.pinattemptsexceeded,
      });
    }
    await this.logger.info(`EngagementId: ${context.engagementId}, Invalid PIN, attempt ${enterPinFailedAttempts} of ${attemptLimit}`);

    customJourneyContext.STEP = GVAGoalSteps.VALIDATE_PIN;

    return this.buildHandlerResultPayload({
      customJourneyContext,
      responseData: {
        pinAttemptLimit: this.config.inputValidationFailedAttemptsLimit,
        pinAttemptNumber: enterPinFailedAttempts,
      },
      responseId: this.config.gvaGoals.invalidPin,
    });
  }

  private getCustomJurneyContext(context: HandlerPayload) {
    let customJourneyContext: Record<string, unknown> = {};
    if (context.customJourneyContext) {
      const parseResult = this.safeJSONParse(context.customJourneyContext);
      if (parseResult.status) {
        customJourneyContext = parseResult.output;
      }
    }
    return customJourneyContext;
  }

  private async verifyIsMemberExists(memberNumber: string) {
    try {
      const response = await this.quorumApi.verifyMemberExists(memberNumber);
      if (response) {
        return true;
      }
      return false;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error in setValueToKV';
      await this.logger.error(`Error verifying member existence: ${message}`);
      return false;
    }
  }
  private async verifyMemberPin(memberNumber: string, pin: string) {
    try {
      return this.quorumApi.verifyMemberPin(memberNumber, pin);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error in setValueToKV';
      await this.logger.error(`Error verifying member PIN: ${message}`);
      return null;
    }
  }
}
