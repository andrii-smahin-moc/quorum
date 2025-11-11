import { GliaAuthApi, GliaEngagementApi, GliaTransferApi, LynktekApi } from '../apis';
import { AnswerOptionsList, AnswerSynonyms, GVAGoalSteps, IdentifierTitles, INITIAL_STEP } from '../constants';
import { EngagementLegMediaTypeSchema, GliaKVValueSchema } from '../schemas';
import { FunctionConfig, HandlerPayload, HandlerResult, IdentifierFailedAttemptsHistory, KvStoreFactory, LoggerInterface } from '../types';
import { validateSchema } from '../validator';

import { AnswerDetectorService } from './answer-detector-service';
import { BaseGVAGoalService } from './base-gva-goal-service';
import { GliaKVService } from './glia-kv-service';
import { AnswerOption } from './possible-answer';

export class GVAGoalService extends BaseGVAGoalService {
  private answerDetectorService: AnswerDetectorService;
  private gliaAuthApi: GliaAuthApi;
  private gliaEngagementApi: GliaEngagementApi;
  private gliaKVService: GliaKVService;
  private gliaTransferApi: GliaTransferApi;
  private lynktekApi: LynktekApi;

  constructor(
    private config: FunctionConfig,
    private logger: LoggerInterface,
    kvStoreFactory: KvStoreFactory,
  ) {
    super();
    this.gliaAuthApi = new GliaAuthApi(config, logger);
    this.lynktekApi = new LynktekApi(config, logger);
    this.gliaKVService = new GliaKVService(config, logger, kvStoreFactory);
    this.gliaTransferApi = new GliaTransferApi(config, logger);
    this.gliaEngagementApi = new GliaEngagementApi(config, logger);

    this.register(INITIAL_STEP, this.initialStep.bind(this));
    this.register(GVAGoalSteps.VALIDATE_MEMBER_NUMBER, this.validateMemberNumber.bind(this));
    this.register(GVAGoalSteps.VALIDATE_PIN, this.validatePin.bind(this));
    this.register(GVAGoalSteps.VALIDATE_OTP_IDENTIFIER, this.validateOtpIdentifier.bind(this));
    this.register(GVAGoalSteps.VALIDATE_OTP_CODE, this.validateOtpCode.bind(this));

    this.answerDetectorService = new AnswerDetectorService(this.config, this.logger, [
      new AnswerOption(AnswerOptionsList.FORGET_THE_PIN, AnswerSynonyms.FORGET_THE_PIN),
      new AnswerOption(AnswerOptionsList.MEMBER_NUMBER, AnswerSynonyms.MEMBER_NUMBER),
      new AnswerOption(AnswerOptionsList.MEMBER_PIN, AnswerSynonyms.MEMBER_PIN),
      new AnswerOption(AnswerOptionsList.ZERO_NUMBER, AnswerSynonyms.ZERO_NUMBER),
      new AnswerOption(AnswerOptionsList.OTP_IDENTIFIER, AnswerSynonyms.OTP_IDENTIFIER),
      new AnswerOption(AnswerOptionsList.OTP_CODE, AnswerSynonyms.OTP_CODE),
      new AnswerOption(AnswerOptionsList.TALK_TO_AGENT_OPTION, AnswerSynonyms.TALK_TO_AGENT_OPTION),
      new AnswerOption(AnswerOptionsList.MEMBER_EXIT_OPTION, AnswerSynonyms.MEMBER_EXIT_OPTION),
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

    let detectedAnswer = await this.answerDetectorService.detect(context);
    
    // Context-specific pattern matching for member numbers (6-12 digits)
    if (context.text) {
      const memberNumberMatch = /(?<!\d)\d{6,12}(?!\d)/.exec(context.text);
      if (memberNumberMatch) {
        detectedAnswer = this.createContextSpecificAnswer(AnswerOptionsList.MEMBER_NUMBER, memberNumberMatch[0]);
      }
    }
    
    const exitHandled = await this.handleMemberExitOption(context, detectedAnswer);
    if (exitHandled) {
      return exitHandled;
    }

    const customJourneyContext = this.getCustomJourneyContext(context);

    let memberNumberFailedAttempts = Number(customJourneyContext.memberNumberFailedAttempts || 0);

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

      const failedAttempts = await this.getFailedIdentifierVerifyAttempts(detectedAnswer.matchedText);
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
        customJourneyContext.STEP = GVAGoalSteps.VALIDATE_OTP_IDENTIFIER;

        return this.buildHandlerResultPayload({
          customJourneyContext,
          responseData: {
            identifierType: IdentifierTitles[this.config.lynktekConfig.otpIdentifierType as keyof typeof IdentifierTitles],
          },
          responseId: this.config.gvaGoals.otpFlowStart,
        });
      }

      if (isMemberExistsResponse && isMemberExistsResponse.ok) {
        customJourneyContext.memberNumber = detectedAnswer.matchedText;
        customJourneyContext.STEP = GVAGoalSteps.VALIDATE_PIN;
        return this.buildHandlerResultPayload({
          customJourneyContext,
          responseId: this.config.gvaGoals.enterAPin,
        });
      }
    }

    memberNumberFailedAttempts += 1;

    if (memberNumberFailedAttempts >= this.config.inputValidationFailedAttemptsLimit) {
      await this.logger.info(`EngagementId: ${context.engagementId}, Too many failed attempts`);
      await this.tryToTransferToQueue(context.engagementId);
      return this.buildHandlerResultPayload({
        isFinalStep: true,
        responseId: this.config.gvaGoals.transferToLiveOperator,
      });
    }

    customJourneyContext.memberNumberFailedAttempts = memberNumberFailedAttempts;

    await this.logger.info(`EngagementId: ${context.engagementId}, Invalid member number`);
    customJourneyContext.STEP = GVAGoalSteps.VALIDATE_MEMBER_NUMBER;
    return this.buildHandlerResultPayload({
      customJourneyContext,
      responseId: this.config.gvaGoals.invalidMemberNumber,
    });
  }

  async validateOtpCode(context: HandlerPayload): Promise<HandlerResult> {
    await this.logger.info(`EngagementId: ${context.engagementId}, Validating OTP code`);

    let detectedAnswer = await this.answerDetectorService.detect(context);
    
    // Context-specific pattern matching for OTP code (exactly 6 digits)
    if (context.text) {
      const otpCodeMatch = /(?<!\d)\d{6}(?!\d)/.exec(context.text);
      if (otpCodeMatch) {
        detectedAnswer = this.createContextSpecificAnswer(AnswerOptionsList.OTP_CODE, otpCodeMatch[0]);
      }
    }
    
    const exitHandled = await this.handleMemberExitOption(context, detectedAnswer);
    if (exitHandled) {
      return exitHandled;
    }

    const customJourneyContext = this.getCustomJourneyContext(context);

    const otpIdentifier = this.getIdentifierFromContext(customJourneyContext);
    if (!otpIdentifier) {
      await this.logger.error(`EngagementId: ${context.engagementId}, otpIdentifier is missing before OTP code validation`);
      customJourneyContext.STEP = GVAGoalSteps.VALIDATE_OTP_IDENTIFIER;
      return this.buildHandlerResultPayload({
        customJourneyContext,
        responseData: {
          identifierType: IdentifierTitles[this.config.lynktekConfig.otpIdentifierType as keyof typeof IdentifierTitles],
        },
        responseId: this.config.gvaGoals.invalidOtpIdentifier,
      });
    }

    const attemptLimit = this.config.inputValidationFailedAttemptsLimit;
    const previousFailedAttempts = await this.getFailedIdentifierVerifyAttempts(otpIdentifier);

    if (detectedAnswer && detectedAnswer.name === AnswerOptionsList.OTP_CODE && detectedAnswer.matchedText) {
      const verifyResponse = await this.verifyOtpCode(otpIdentifier, detectedAnswer.matchedText);

      if (verifyResponse && verifyResponse.ok && typeof verifyResponse.payload.token === 'string' && verifyResponse.payload.expiresIn) {
        await this.resetFailedAttemptsHistory(otpIdentifier); // reset attempts for identifier upon successful OTP verification THIS IS NEW FIXED LINE

        const expiresIn = this.calculateExpiresIn(Number(verifyResponse.payload.expiresIn));

        await this.saveToKvStore(context.engagementId, JSON.stringify({ expiresIn, token: verifyResponse.payload.token }));

        return this.buildHandlerResultPayload({
          auth: {
            expiresIn,
            token: verifyResponse.payload.token,
          },
          isFinalStep: true,
          responseId: this.config.gvaGoals.successfullyVerifiesMemberNumberAndPin,
        });
      }
    }

    const newAttempts = await this.saveIdentifierFailedAttempt(otpIdentifier, previousFailedAttempts);

    if (newAttempts.length >= attemptLimit) {
      await this.logger.info(
        `EngagementId: ${context.engagementId}, Exceeded allowed OTP attempts (${newAttempts.length}/${attemptLimit}), escalating`,
      );
      await this.tryToTransferToQueue(context.engagementId);
      return this.buildHandlerResultPayload({
        isFinalStep: true,
        responseId: this.config.gvaGoals.transferToLiveOperator,
      });
    }

    customJourneyContext.STEP = GVAGoalSteps.VALIDATE_OTP_CODE;

    return this.buildHandlerResultPayload({
      customJourneyContext,
      responseData: {
        otpAttemptLimit: attemptLimit,
        otpAttemptNumber: newAttempts.length,
      },
      responseId: this.config.gvaGoals.invalidOtp,
    });
  }

  async validateOtpIdentifier(context: HandlerPayload): Promise<HandlerResult> {
    await this.logger.info(`EngagementId: ${context.engagementId}, Validating OTP identifier`);

    let detectedAnswer = await this.answerDetectorService.detect(context);

    // Context-specific pattern matching for OTP identifier (exactly 9 digits)
    if (context.text) {
      const otpIdentifierMatch = /(?<!\d)\d{9}(?!\d)/.exec(context.text);
      if (otpIdentifierMatch) {
        detectedAnswer = this.createContextSpecificAnswer(AnswerOptionsList.OTP_IDENTIFIER, otpIdentifierMatch[0]);
      }
    }

    const exitHandled = await this.handleMemberExitOption(context, detectedAnswer);
    if (exitHandled) {
      return exitHandled;
    }
    const customJourneyContext = this.getCustomJourneyContext(context);

    if (detectedAnswer && detectedAnswer.name === AnswerOptionsList.OTP_IDENTIFIER && detectedAnswer.matchedText) {
      const failedAttempts = await this.getFailedIdentifierVerifyAttempts(detectedAnswer.matchedText);
      if (failedAttempts.length >= this.config.inputValidationFailedAttemptsLimit) {
        await this.logger.info(`EngagementId: ${context.engagementId}, OTP identifier has too many failed attempts`);
        await this.tryToTransferToQueue(context.engagementId);
        return this.buildHandlerResultPayload({
          isFinalStep: true,
          responseId: this.config.gvaGoals.transferToLiveOperator,
        });
      }

      const initAuthResponse = await this.initOtpAuthentication(detectedAnswer.matchedText);
      if (initAuthResponse && initAuthResponse.ok) {
        customJourneyContext.otpIdentifier = detectedAnswer.matchedText;
        customJourneyContext.STEP = GVAGoalSteps.VALIDATE_OTP_CODE;
        return this.buildHandlerResultPayload({
          customJourneyContext,
          responseId: this.config.gvaGoals.enterOTPCode,
        });
      }
    }

    let identifierFailedAttempts = Number(customJourneyContext.identifierFailedAttempts || 0);
    const attemptLimit = this.config.inputValidationFailedAttemptsLimit;

    identifierFailedAttempts += 1;
    if (identifierFailedAttempts >= attemptLimit) {
      await this.logger.info(
        `EngagementId: ${context.engagementId}, ` +
          `Exceeded allowed OTP identifier attempts (${identifierFailedAttempts}/${attemptLimit}), escalating`,
      );
      await this.tryToTransferToQueue(context.engagementId);
      return this.buildHandlerResultPayload({
        isFinalStep: true,
        responseId: this.config.gvaGoals.transferToLiveOperator,
      });
    }

    customJourneyContext.identifierFailedAttempts = identifierFailedAttempts;
    customJourneyContext.STEP = GVAGoalSteps.VALIDATE_OTP_IDENTIFIER;

    return this.buildHandlerResultPayload({
      customJourneyContext,
      responseData: {
        identifierType: IdentifierTitles[this.config.lynktekConfig.otpIdentifierType as keyof typeof IdentifierTitles],
      },
      responseId: this.config.gvaGoals.invalidOtpIdentifier,
    });
  }

  async validatePin(context: HandlerPayload): Promise<HandlerResult> {
    await this.logger.info(`EngagementId: ${context.engagementId}, Validating PIN`);

    let detectedAnswer = await this.answerDetectorService.detect(context);

    // Context-specific pattern matching for PIN (exactly 4 digits)
    if (context.text) {
      const pinMatch = /(?<!\d)\d{4}(?!\d)/.exec(context.text);
      if (pinMatch) {
        detectedAnswer = this.createContextSpecificAnswer(AnswerOptionsList.MEMBER_PIN, pinMatch[0]);
      }
    }

    const exitHandled = await this.handleMemberExitOption(context, detectedAnswer);
    if (exitHandled) {
      return exitHandled;
    }

    if (detectedAnswer && detectedAnswer.name === AnswerOptionsList.FORGET_THE_PIN) {
      await this.handleMemberExitOption(context, detectedAnswer);
      await this.logger.info(`EngagementId: ${context.engagementId}, User forgot PIN`);
      await this.tryToTransferToQueue(context.engagementId);
      return this.buildHandlerResultPayload({
        isFinalStep: true,
        responseId: this.config.gvaGoals.forgotPin,
      });
    }

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

    if (detectedAnswer && detectedAnswer.name === AnswerOptionsList.MEMBER_PIN && detectedAnswer.matchedText) {
      if (detectedAnswer.matchedText === this.config.lynktekConfig.defaultPin) {
        await this.logger.info(
          `EngagementId: ${context.engagementId}, Default PIN matched (${this.config.lynktekConfig.defaultPin}), switching to OTP flow`,
        );
        customJourneyContext.STEP = GVAGoalSteps.VALIDATE_OTP_IDENTIFIER;
        return this.buildHandlerResultPayload({
          customJourneyContext,
          responseData: {
            identifierType: IdentifierTitles[this.config.lynktekConfig.otpIdentifierType as keyof typeof IdentifierTitles],
          },
          responseId: this.config.gvaGoals.otpFlowStart,
        });
      }

      await this.logger.info(`EngagementId: ${context.engagementId}, Valid PIN received`);

      const authResultResponse = await this.verifyMemberPin(memberNumber, detectedAnswer.matchedText);
      if (
        authResultResponse &&
        authResultResponse.ok &&
        typeof authResultResponse.payload.token === 'string' &&
        authResultResponse.payload.expiresIn
      ) {
        await this.logger.info(`EngagementId: ${context.engagementId}, PIN verified successfully`);

        await this.resetFailedAttemptsHistory(memberNumber);

        const expiresIn = this.calculateExpiresIn(Number(authResultResponse.payload.expiresIn));

        await this.saveToKvStore(context.engagementId, JSON.stringify({ expiresIn, token: authResultResponse.payload.token }));

        return this.buildHandlerResultPayload({
          auth: {
            expiresIn,
            token: authResultResponse.payload.token,
          },
          isFinalStep: true,
          responseId: this.config.gvaGoals.successfullyVerifiesMemberNumberAndPin,
        });
      }
    }

    const failedAttempts = await this.getFailedIdentifierVerifyAttempts(memberNumber);
    if (failedAttempts.length >= this.config.inputValidationFailedAttemptsLimit) {
      await this.logger.info(`EngagementId: ${context.engagementId}, Member number ${memberNumber} has too many failed attempts`);
      await this.tryToTransferToQueue(context.engagementId);
      return this.buildHandlerResultPayload({
        isFinalStep: true,
        responseId: this.config.gvaGoals.transferToLiveOperator,
      });
    }

    const newFailedAttempts = await this.saveIdentifierFailedAttempt(memberNumber, failedAttempts);

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
        pinAttemptLimit: attemptLimit,
        pinAttemptNumber: newFailedAttempts.length,
      },
      responseId: this.config.gvaGoals.invalidPin,
    });
  }

  private calculateExpiresIn(expiresIn: number): number {
    if (expiresIn <= 3600) {
      return Date.now() + expiresIn * 1000;
    }
    return expiresIn;
  }

  private createContextSpecificAnswer(name: string, matchedText: string): AnswerOption {
    const answer = new AnswerOption(name, []);
    answer.matchedText = matchedText;
    answer.patternType = 'regexp';
    answer.source = 'text';
    return answer;
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

  private async fetchEngagementDetails(token: string, engagementId: string) {
    try {
      const engagementDetails = await this.gliaEngagementApi.fetchEngagementDetails(token, engagementId);
      if (engagementDetails && engagementDetails.ok) {
        return engagementDetails;
      }
      return null;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error in fetchEngagementDetails';
      await this.logger.error(`Error fetching engagement details: ${message}`);
      return null;
    }
  }

  private getCustomJourneyContext(context: HandlerPayload) {
    let customJourneyContext: Record<string, unknown> = {};
    if (context.customJourneyContext) {
      const parseResult = this.safeJSONParse(context.customJourneyContext);
      if (
        parseResult.status &&
        typeof parseResult.output === 'object' &&
        parseResult.output !== null &&
        !Array.isArray(parseResult.output)
      ) {
        // Only assign if output is a plain object
        customJourneyContext = parseResult.output;
      }
    }
    // Type guard: ensure customJourneyContext is a plain object
    if (typeof customJourneyContext === 'object' && customJourneyContext !== null && !Array.isArray(customJourneyContext)) {
      return customJourneyContext;
    }
    return {};
  }

  private async getEngagementMediaType(token: string, engagementId: string): Promise<string | null> {
    try {
      const engagementResponse = await this.fetchEngagementDetails(token, engagementId);
      if (!engagementResponse || !engagementResponse.ok) {
        await this.logger.error(`EngagementId: ${engagementId}, Unable to fetch engagement details`);
        return null;
      }
      const parseResult = validateSchema(EngagementLegMediaTypeSchema, engagementResponse.payload, 'getEngagementMediaType');
      if (!parseResult.status || !parseResult.output) {
        await this.logger.error(`EngagementId: ${engagementId}, Engagement details schema validation failed`);
        return null;
      }
      const legs = Array.isArray(parseResult.output.legs) ? parseResult.output.legs : [];
      if (legs.length === 0) {
        await this.logger.error(`EngagementId: ${engagementId}, No engagement legs found`);
        return null;
      }

      const activeLeg = legs.find((leg) => leg.ended_at === null);
      if (!activeLeg) {
        await this.logger.error(`EngagementId: ${engagementId}, No active engagement leg found`);
        return null;
      }

      return activeLeg.accepted_media_type;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error in getEngagementMediaType';
      await this.logger.error(`EngagementId: ${engagementId}, Error fetching engagement media type: ${message}`);
      return null;
    }
  }

  private async getFailedIdentifierVerifyAttempts(identifierValue: string): Promise<number[]> {
    const history = await this.getValueFromKV<IdentifierFailedAttemptsHistory>(identifierValue);
    const recent = this.reviseFailedAttemptsHistory(history?.failedAttempts ?? []);
    return recent;
  }

  private getIdentifierFromContext(customJourneyContext: Record<string, unknown>): string | null {
    return typeof customJourneyContext.otpIdentifier === 'string' ? customJourneyContext.otpIdentifier : null;
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

  private async handleMemberExitOption(
    context: HandlerPayload,
    detectedAnswer: { matchedText?: string | null; name?: string } | null,
  ): Promise<HandlerResult | null> {
    const isEscalation =
      !!detectedAnswer &&
      (detectedAnswer.name === AnswerOptionsList.MEMBER_EXIT_OPTION || detectedAnswer.name === AnswerOptionsList.TALK_TO_AGENT_OPTION);

    if (!isEscalation) {
      return null;
    }

    await this.logger.info(`EngagementId: ${context.engagementId}, Escalation requested (${detectedAnswer?.matchedText ?? ''})`);
    await this.tryToTransferToQueue(context.engagementId);

    return this.buildHandlerResultPayload({
      isFinalStep: true,
      responseId: this.config.gvaGoals.transferToLiveOperator,
    });
  }

  private async initOtpAuthentication(identifier: string) {
    try {
      return await this.lynktekApi.initOtpAuthentication(identifier);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error in setValueToKV';
      await this.logger.error(`Error initiating OTP authentication: ${message}`);
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

  private async saveIdentifierFailedAttempt(memberNumber: string, failedAttempts: number[]): Promise<number[]> {
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

    const engagementMediaType = await this.getEngagementMediaType(token, engagementId);
    if (!engagementMediaType) {
      await this.logger.error(`EngagementId: ${engagementId}, Unable to fetch engagement media type for transferToQueue`);
      return;
    }

    try {
      const result = await this.gliaTransferApi.transferToQueue(token, engagementId, engagementMediaType);
      await this.logger.info(`EngagementId: ${engagementId}, Transfer to queue result: ${result.statusCode}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error in tryToTransferToQueue';
      await this.logger.error(`EngagementId: ${engagementId}, Error transferring to queue: ${message}`);
    }

    return;
  }

  private async verifyIsMemberExists(memberNumber: string) {
    try {
      return await this.lynktekApi.verifyMemberExists(memberNumber);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error in verifyIsMemberExists';
      await this.logger.error(`Error verifying member existence: ${message}`);
      return false;
    }
  }

  private async verifyMemberPin(memberNumber: string, pin: string) {
    try {
      return await this.lynktekApi.verifyMemberPin(memberNumber, pin);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error in verifyMemberPin';
      await this.logger.error(`Error verifying member PIN: ${message}`);
      return null;
    }
  }

  private async verifyOtpCode(identifier: string, code: string) {
    try {
      return await this.lynktekApi.verifyOtpCode(identifier, code);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error in verifyOtpCode';
      await this.logger.error(`Error initiating OTP authentication: ${message}`);
      return null;
    }
  }
}
