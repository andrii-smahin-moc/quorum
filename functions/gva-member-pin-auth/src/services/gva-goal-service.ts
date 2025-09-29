import { QuorumApi } from '../apis';
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
  MEMBER_NUMBER: 'member_number',
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
      // new AnswerOption(AnswerOptionsList.CANCEL, ['To Cancel', 'cancel', 'stop', 'abort']),
      // new AnswerOption(AnswerOptionsList.CONFIRM, ['To continue', 'Confirm', 'yes', 'ok']),
      new AnswerOption(AnswerOptionsList.MEMBER_NUMBER, [MEMBER_NUMBER_REGEX]),
      new AnswerOption(AnswerOptionsList.ZERO_NUMBER, [/^0+$/, 'zero']),
    ]);
  }

  async initialStep(context: HandlerPayload): Promise<HandlerResult> {
    // add check is need to authenticate ot not
    await this.logger.info(`EngagementId: ${context.engagementId}, Starting initial step`);
    const customJourneyContext = this.getCustomJurneyContext(context);
    customJourneyContext.STEP = GVAGoalSteps.VALIDATE_MEMBER_NUMBER;

    return this.buildHandlerResultPayload({
      // need to integrate existing context and new STEP
      customJourneyContext,
      responseId: this.config.gvaGoals.needToAuthentication,
    });
  }

  async validateMemberNumber(context: HandlerPayload): Promise<HandlerResult> {
    await this.logger.info(`EngagementId: ${context.engagementId}, Validating member number`);

    const detectedAnswer = this.answerDetectorService.detect(context);
    const customJourneyContext = this.getCustomJurneyContext(context);

    let failedAttempts = Number(customJourneyContext.failedAttempts ?? 0);

    if (detectedAnswer && detectedAnswer.name === AnswerOptionsList.MEMBER_NUMBER && detectedAnswer.matchedText) {
      await this.logger.info(`EngagementId: ${context.engagementId}, Valid member number received: ${detectedAnswer.matchedText}`);
      // validate member number via Quorum API
      const isMemberExists = await this.verifyIsMemberExists(detectedAnswer.matchedText);

      if (isMemberExists) {
        customJourneyContext.memberNumber = detectedAnswer.matchedText;
        customJourneyContext.failedAttempts = 0; // reset attempts on success
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

    const customJourneyContext = this.getCustomJurneyContext(context);
    let enterPinFailedAttempts = Number(customJourneyContext.enterPinFailedAttempts || 0);

    if (context.messageType === 'text' && context.text) {
      const userInput = context.text.trim();

      if (MEMBER_PIN_REGEX.test(userInput)) {
        await this.logger.info(`EngagementId: ${context.engagementId}, Valid PIN received: ${userInput}`);
        const memberNumber = customJourneyContext.memberNumber;

        if (!memberNumber || typeof memberNumber !== 'string') {
          await this.logger.error(`EngagementId: ${context.engagementId}, memberNumber is missing or invalid in customJourneyContext`);
          return this.buildHandlerResultPayload({
            isFinalStep: true,
            responseId: this.config.gvaGoals.invalidMemberNumber,
          });
        }

        // сходить на API і перевірить пін
        const authResult = await this.verifyMemberPin(String(customJourneyContext.memberNumber), context.text);
        if (authResult && typeof authResult.token === 'string' && typeof authResult.expiresIn === 'string') {
          await this.logger.info(`EngagementId: ${context.engagementId}, PIN verified successfully`);

          return this.buildHandlerResultPayload({
            auth: {
              expiresIn: Number(authResult.expiresIn),
              token: authResult.token,
            },
            customJourneyContext,
            isFinalStep: true,
            responseId: this.config.gvaGoals.successfullyVerifiesMemberNumberAndPin,
          });
        }
        // якщо існує відповідну текстовку
        // якщо ні то Invalid PIN path

        customJourneyContext.enterPinFailedAttempts = 0; // reset on success
        customJourneyContext.STEP = null;
        return this.buildHandlerResultPayload({
          customJourneyContext,
          isFinalStep: true,
          responseId: this.config.gvaGoals.successfullyVerifiesMemberNumberAndPin,
        });
      }

      if (FORGET_THE_PIN.test(userInput.toLowerCase())) {
        await this.logger.info(`EngagementId: ${context.engagementId}, User forgot PIN`);
        customJourneyContext.STEP = null;
        return this.buildHandlerResultPayload({
          customJourneyContext,
          isFinalStep: true,
          responseId: this.config.gvaGoals.forgotPin,
        });
      }
    }

    // Invalid PIN path
    enterPinFailedAttempts += 1;
    customJourneyContext.enterPinFailedAttempts = enterPinFailedAttempts;

    const attemptLimit = this.config.inputValidationFailedAttemptsLimit;

    if (enterPinFailedAttempts >= attemptLimit) {
      // Exceeded allowed attempts or limit > do not show invalid pin message > immediate escalation
      await this.logger.info(
        `EngagementId: ${context.engagementId}, Exceeded allowed PIN attempts ` + `(${enterPinFailedAttempts}/${attemptLimit}), escalating`,
      );

      return this.buildHandlerResultPayload({
        isFinalStep: true,
        responseId: this.config.gvaGoals.pinattemptsexceeded,
      });
    }
    // Show invalid PIN message with attempt counter 1..(limit-1)
    const attemptsText = `The PIN you entered was incorrect. Please try again. (Attempt ${enterPinFailedAttempts} of ${attemptLimit})`;
    await this.logger.info(`EngagementId: ${context.engagementId}, Invalid PIN, attempt ${enterPinFailedAttempts} of ${attemptLimit}`);

    customJourneyContext.STEP = GVAGoalSteps.VALIDATE_PIN;

    return this.buildHandlerResultPayload({
      customJourneyContext,
      // Able to use existing invalidPin card and pull text from responseData
      responseData: {
        pinAttemptCounterText: attemptsText,
        pinAttemptNumber: enterPinFailedAttempts,
        pinAttemptsLimit: this.config.inputValidationFailedAttemptsLimit,
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
