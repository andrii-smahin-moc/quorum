import { GliaAuthApi, QuorumApi } from '../apis';
import { GliaTransferApi } from '../apis/glia-transfer-api';
import { INITIAL_STEP, MEMBER_NUMBER_REGEX, MEMBER_PIN_REGEX, ZERO_NUMBER } from '../constants';
import { GliaKVValueSchema } from '../schemas';
import { FunctionConfig, HandlerPayload, HandlerResult, IdentifierFailedAttemptsHistory, KvStoreFactory, LoggerInterface } from '../types';
import { validateSchema } from '../validator';

import { AnswerDetectorService } from './answer-detector-service';
import { BaseGVAGoalService } from './base-gva-goal-service';
import { GliaKVService } from './glia-kv-service';
import { AnswerOption } from './possible-answer';

export enum GVAGoalSteps {
  VALIDATE_MEMBER_NUMBER = 'VALIDATE_MEMBER_NUMBER',
  VALIDATE_PIN = 'VALIDATE_PIN',
}

export const AnswerOptionsList = {
  FORGET_THE_PIN: 'forget_the_pin',
  MEMBER_EXIT_OPTION: 'member_exit',
  MEMBER_NUMBER: 'member_number',
  MEMBER_PIN: 'member_pin',
  ZERO_NUMBER: 'zero_number',
};

export class GVAGoalService extends BaseGVAGoalService {
  private answerDetectorService: AnswerDetectorService;
  private gliaAuthApi: GliaAuthApi;
  private gliaKVService: GliaKVService;
  private gliaTransferApi: GliaTransferApi;
  private quorumApi: QuorumApi;

  constructor(
    private config: FunctionConfig,
    private logger: LoggerInterface,
    kvStoreFactory: KvStoreFactory,
  ) {
    super();
    this.gliaAuthApi = new GliaAuthApi(config, logger);
    this.quorumApi = new QuorumApi(config, logger);
    this.gliaKVService = new GliaKVService(config, logger, kvStoreFactory);
    this.gliaTransferApi = new GliaTransferApi(config, logger);
    this.register(INITIAL_STEP, this.initialStep.bind(this));
    this.register(GVAGoalSteps.VALIDATE_MEMBER_NUMBER, this.validateMemberNumber.bind(this));
    this.register(GVAGoalSteps.VALIDATE_PIN, this.validatePin.bind(this));

    this.answerDetectorService = new AnswerDetectorService(this.config, this.logger, [
      new AnswerOption(AnswerOptionsList.FORGET_THE_PIN, ['I forgot', 'forgot', 'forget', 'lost', 'no', 'not', 'don']),
      new AnswerOption(AnswerOptionsList.MEMBER_NUMBER, [MEMBER_NUMBER_REGEX]),
      new AnswerOption(AnswerOptionsList.MEMBER_PIN, [MEMBER_PIN_REGEX]),
      new AnswerOption(AnswerOptionsList.ZERO_NUMBER, [ZERO_NUMBER, 'zero']),
      new AnswerOption(AnswerOptionsList.MEMBER_EXIT_OPTION, [
        'exit',
        'quit',
        'finish',
        'end',
        'cancel',
        'abort',
        'nevermind',
        'never mind',
        'stop',
        'bye',
        'goodbye',
        'main menu',
        'menu',
        'back',
        'go back',
        'start over',
        'restart',
        'begin',
      ]),
    ]);
  }

  async initialStep(context: HandlerPayload): Promise<HandlerResult> {
    await this.logger.info(`EngagementId: ${context.engagementId}, Starting initial step`);
    const customJourneyContext = this.getCustomJourneyContext(context);
    customJourneyContext.STEP = GVAGoalSteps.VALIDATE_MEMBER_NUMBER;

    return this.buildHandlerResultPayload({
      customJourneyContext,
      responseId: this.config.gvaGoals.needToAuthentication,
    });
  }

  async validateMemberNumber(context: HandlerPayload): Promise<HandlerResult> {
    await this.logger.info(`EngagementId: ${context.engagementId}, Validating member number`);

    const detectedAnswer = await this.answerDetectorService.detect(context);
    const customJourneyContext = this.getCustomJourneyContext(context);

    let failedAttempts = Number(customJourneyContext.failedAttempts ?? 0);

    if (detectedAnswer && detectedAnswer.name === AnswerOptionsList.ZERO_NUMBER) {
      await this.logger.info(`EngagementId: ${context.engagementId}, Zero press detected`);
      await this.tryToTransferToQueue(context.engagementId);
      return this.buildHandlerResultPayload({
        isFinalStep: true,
        responseId: this.config.gvaGoals.zeroPress,
      });
    }

    if (detectedAnswer && detectedAnswer.name === AnswerOptionsList.MEMBER_NUMBER && detectedAnswer.matchedText) {
      await this.logger.info(`EngagementId: ${context.engagementId}, Valid member number received: ${detectedAnswer.matchedText}`);

      const failedAttempts = await this.getFailedAttempts(detectedAnswer.matchedText);
      if (failedAttempts.length >= this.config.inputValidationFailedAttemptsLimit) {
        await this.logger.info(
          `EngagementId: ${context.engagementId}, Member number ${detectedAnswer.matchedText} has too many failed attempts`,
        );
        await this.tryToTransferToQueue(context.engagementId);
        return this.buildHandlerResultPayload({
          isFinalStep: true,
          responseId: this.config.gvaGoals.transferToLiveOperator,
        });
      }

      const isMemberExistsResponse = await this.verifyIsMemberExists(detectedAnswer.matchedText);

      if (isMemberExistsResponse && isMemberExistsResponse.statusCode === 503) {
        // update it and start OTP flow
        return this.buildHandlerResultPayload({
          isFinalStep: true,
          responseId: this.config.gvaGoals.transferToLiveOperator,
        });
      }

      if (isMemberExistsResponse && isMemberExistsResponse.ok) {
        customJourneyContext.memberNumber = detectedAnswer.matchedText;
        customJourneyContext.failedAttempts = 0;
        customJourneyContext.STEP = GVAGoalSteps.VALIDATE_PIN;
        return this.buildHandlerResultPayload({
          customJourneyContext,
          responseId: this.config.gvaGoals.enterAPin,
        });
      }
    }

    failedAttempts += 1;
    customJourneyContext.failedAttempts = failedAttempts;

    const attemptLimit = this.config.inputValidationFailedAttemptsLimit;

    if (failedAttempts >= attemptLimit) {
      await this.logger.info(`EngagementId: ${context.engagementId}, Too many failed attempts`);
      await this.tryToTransferToQueue(context.engagementId);
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
    const customJourneyContext = this.getCustomJourneyContext(context);

    const memberNumber = this.getMemberNumberFromContext(customJourneyContext);

    if (!memberNumber) {
      await this.logger.error(`EngagementId: ${context.engagementId}, memberNumber is missing or invalid in customJourneyContext`);
      await this.tryToTransferToQueue(context.engagementId);
      return this.buildHandlerResultPayload({
        isFinalStep: true,
        responseId: this.config.gvaGoals.invalidMemberNumber,
      });
    }

    const failedAttempts = await this.getFailedAttempts(memberNumber);
    if (failedAttempts.length >= this.config.inputValidationFailedAttemptsLimit) {
      await this.logger.info(`EngagementId: ${context.engagementId}, Member number ${memberNumber} has too many failed attempts`);
      await this.tryToTransferToQueue(context.engagementId);
      return this.buildHandlerResultPayload({
        isFinalStep: true,
        responseId: this.config.gvaGoals.transferToLiveOperator,
      });
    }

    if (detectedAnswer && detectedAnswer.name === AnswerOptionsList.MEMBER_PIN && detectedAnswer.matchedText) {
      await this.logger.info(`EngagementId: ${context.engagementId}, Valid PIN received: ${detectedAnswer.matchedText}`);

      const authResultResponse = await this.verifyMemberPin(memberNumber, detectedAnswer.matchedText);
      if (
        authResultResponse &&
        authResultResponse.ok &&
        typeof authResultResponse.payload.token === 'string' &&
        typeof authResultResponse.payload.expiresIn === 'string'
      ) {
        await this.logger.info(`EngagementId: ${context.engagementId}, PIN verified successfully`);

        await this.resetFailedAttemptsHistory(memberNumber);

        return this.buildHandlerResultPayload({
          auth: {
            expiresIn: Number(authResultResponse.payload.expiresIn),
            token: authResultResponse.payload.token,
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

    const newFailedAttempts = await this.saveFailedAttempt(memberNumber, failedAttempts);

    const attemptLimit = this.config.inputValidationFailedAttemptsLimit;

    if (newFailedAttempts.length >= attemptLimit) {
      await this.logger.info(
        `EngagementId: ${context.engagementId}, Exceeded allowed PIN attempts ` +
          `(${newFailedAttempts.length}/${attemptLimit}), escalating`,
      );
      await this.tryToTransferToQueue(context.engagementId);
      return this.buildHandlerResultPayload({
        isFinalStep: true,
        responseId: this.config.gvaGoals.pinAttemptExceeded,
      });
    }
    await this.logger.info(`EngagementId: ${context.engagementId}, Invalid PIN, attempt ${newFailedAttempts.length} of ${attemptLimit}`);

    customJourneyContext.STEP = GVAGoalSteps.VALIDATE_PIN;

    return this.buildHandlerResultPayload({
      customJourneyContext,
      responseData: {
        pinAttemptLimit: this.config.inputValidationFailedAttemptsLimit,
        pinAttemptNumber: newFailedAttempts.length,
      },
      responseId: this.config.gvaGoals.invalidPin,
    });
  }

  private async fetchAuthToken() {
    try {
      const authResponse = await this.gliaAuthApi.fetchUserBearerToken();
      if (authResponse.ok && authResponse.payload.token) {
        return authResponse.payload.token;
      }
      return null;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error in fetchAuthToken';
      await this.logger.error(`Error fetching auth token: ${message}`);
      return null;
    }
  }

  private getCustomJourneyContext(context: HandlerPayload) {
    let customJourneyContext: Record<string, unknown> = {};
    if (context.customJourneyContext) {
      const parseResult = this.safeJSONParse(context.customJourneyContext);
      if (parseResult.status) {
        customJourneyContext = parseResult.output;
      }
    }
    return customJourneyContext;
  }

  private async getFailedAttempts(identifierValue: string): Promise<number[]> {
    const history = await this.getValueFromKV<IdentifierFailedAttemptsHistory>(identifierValue);
    const recent = this.reviseFailedAttemptsHistory(history?.failedAttempts ?? []);
    return recent;
  }

  private getMemberNumberFromContext(customJourneyContext: Record<string, unknown>): string | null {
    return typeof customJourneyContext.memberNumber === 'string' ? customJourneyContext.memberNumber : null;
  }

  private async getValueFromKV<T>(key: string): Promise<T | null> {
    try {
      const raw = await this.gliaKVService.getValue(key);
      const result = validateSchema(GliaKVValueSchema, raw, 'getValueFromKV');
      if (!result.status || !result.output?.value) {
        return null;
      }
      return JSON.parse(result.output.value) as T;
    } catch (error) {
      await this.logger.error(`getValueFromKV failed for key ${key}: ${String(error)}`);
      return null;
    }
  }

  private async resetFailedAttemptsHistory(identifier: string): Promise<void> {
    await this.saveToKvStore(identifier, JSON.stringify({ failedAttempts: [] }));
  }

  private reviseFailedAttemptsHistory(attempts: number[]): number[] {
    const limit = 24 * 60 * 60 * 1000; // 24 hours
    return attempts.filter((t) => Date.now() - t < limit);
  }

  private async saveFailedAttempt(memberNumber: string, failedAttempts: number[]): Promise<number[]> {
    failedAttempts.push(Date.now());
    await this.saveToKvStore(memberNumber, JSON.stringify({ failedAttempts }));
    return failedAttempts;
  }

  private async saveToKvStore(engagementId: string, value: string): Promise<boolean> {
    try {
      await this.gliaKVService.setValue(engagementId, value);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error in setValueToKV';
      await this.logger.error(`Error saving to KV store: ${message}`);
      return false;
    }
  }
  private async tryToTransferToQueue(engagementId: string) {
    const token = await this.fetchAuthToken();
    if (!token) {
      await this.logger.error(`EngagementId: ${engagementId}, Unable to fetch auth token for transferToQueue`);
      return;
    }
    try {
      const result = await this.gliaTransferApi.transferToQueue(token, engagementId);
      await this.logger.info(`EngagementId: ${engagementId}, Transfer to queue result: ${result.statusCode}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error in tryToTransferToQueue';
      await this.logger.error(`EngagementId: ${engagementId}, Error transferring to queue: ${message}`);
    }

    return;
  }
  private async verifyIsMemberExists(memberNumber: string) {
    try {
      return await this.quorumApi.verifyMemberExists(memberNumber);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error in setValueToKV';
      await this.logger.error(`Error verifying member existence: ${message}`);
      return false;
    }
  }
  private async verifyMemberPin(memberNumber: string, pin: string) {
    try {
      return await this.quorumApi.verifyMemberPin(memberNumber, pin);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error in setValueToKV';
      await this.logger.error(`Error verifying member PIN: ${message}`);
      return null;
    }
  }
}
