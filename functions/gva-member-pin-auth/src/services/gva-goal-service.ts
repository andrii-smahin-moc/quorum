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
      new AnswerOption(AnswerOptionsList.ZERO_NUMBER, [/^0+$/, 'zero']),
    ]);
  }

  async initialStep(context: HandlerPayload): Promise<HandlerResult> {
    // add check is need to authenticate ot not
    await this.logger.info(`EngagementId: ${context.engagementId}, Starting initial step`);
    const customJourneyContext = this.getCustomJurneyContext(context);
    customJourneyContext.STEP = GVAGoalSteps.VALIDATE_MEMBER_NUMBER;

    return this.buildHandlerResultPayload({
      // <<< прокинутий існуючий контекст + новий STEP
      customJourneyContext,
      responseId: this.config.gvaGoals.needToAuthentication,
    });
  }

  async validateMemberNumber(context: HandlerPayload): Promise<HandlerResult> {
    await this.logger.info(`EngagementId: ${context.engagementId}, Validating member number`);

    const detectedAnswer = this.answerDetectorService.detect(context);
    const customJourneyContext = this.getCustomJurneyContext(context);

    let failedAttempts = Number(customJourneyContext.failedAttempts ?? 0);

    if (detectedAnswer && detectedAnswer.name === AnswerOptionsList.MEMBER_NUMBER) {
      await this.logger.info(`EngagementId: ${context.engagementId}, Valid member number received: ${detectedAnswer.matchedText}`);
      // save member number to KV store
      // send OTP to visitor
      customJourneyContext.failedAttempts = 0; // reset attempts on success
      customJourneyContext.STEP = GVAGoalSteps.VALIDATE_PIN;
      return this.buildHandlerResultPayload({
        customJourneyContext,
        responseId: this.config.gvaGoals.enterAPin,
      });
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

    if (failedAttempts >= this.config.inputValidationFailedAttemptsLimit) {
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
    const limit = Number(this.config.inputValidationFailedAttemptsLimit) || 3;
    let enterPinFailedAttempts = Number(customJourneyContext.enterPinFailedAttempts || 0);

    if (context.messageType === 'text' && context.text) {
      const userInput = context.text.trim();

      if (MEMBER_PIN_REGEX.test(userInput)) {
        await this.logger.info(`EngagementId: ${context.engagementId}, Valid PIN received: ${userInput}`);
        // get MEMBER NUMBER from KV store
        // validate PIN and MEMBER NUMBER
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

    if (enterPinFailedAttempts >= limit) {
      // 3-я (або limit-та) спроба → не показуємо "Invalid PIN", одразу ескалація
      await this.logger.info(
        `EngagementId: ${context.engagementId}, Exceeded allowed PIN attempts (${enterPinFailedAttempts}/${limit}), escalating`,
      );

      // Якщо у конфігу є окрема картка для локауту PIN — використовуємо її, інакше фолбек на transferToLiveOperator
      // const lockoutResponseId = (this.config.gvaGoals as any).pinattemptsexceeded ?? this.config.gvaGoals.transferToLiveOperator;

      return this.buildHandlerResultPayload({
        isFinalStep: true,
        responseId: this.config.gvaGoals.pinattemptsexceeded,
      });
    }

    // Показуємо повідомлення з лічильником тільки для спроб 1..(limit-1)
    const attemptsText = `The PIN you entered was incorrect. Please try again. (Attempt ${enterPinFailedAttempts} of ${limit})`;
    await this.logger.info(`EngagementId: ${context.engagementId}, Invalid PIN, attempt ${enterPinFailedAttempts} of ${limit}`);

    customJourneyContext.STEP = GVAGoalSteps.VALIDATE_PIN;

    return this.buildHandlerResultPayload({
      customJourneyContext,
      // Можна використати існуючу картку invalidPin і підтягнути текст із responseData
      responseData: {
        pinAttemptCounterText: attemptsText,
        pinAttemptNumber: enterPinFailedAttempts,
        pinAttemptsLimit: limit,
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
}
