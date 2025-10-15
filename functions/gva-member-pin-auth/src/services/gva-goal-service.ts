import { GliaAuthApi, QuorumApi } from '../apis';
import { GliaTransferApi } from '../apis/glia-transfer-api';
import { IDENTIFIER_REGEX, INITIAL_STEP, MEMBER_PIN_REGEX, OTP_CODE_REGEX, ZERO_NUMBER } from '../constants';
import { GliaKVValueSchema } from '../schemas';
import { FunctionConfig, HandlerPayload, HandlerResult, IdentifierFailedAttemptsHistory, KvStoreFactory, LoggerInterface } from '../types';
import { validateSchema } from '../validator';

import { AnswerDetectorService } from './answer-detector-service';
import { BaseGVAGoalService } from './base-gva-goal-service';
import { GliaKVService } from './glia-kv-service';
import { AnswerOption } from './possible-answer';

export enum GVAGoalSteps {
  VALIDATE_MEMBER_NUMBER = 'VALIDATE_MEMBER_NUMBER',
  VALIDATE_OTP_CODE = 'VALIDATE_OTP_CODE',
  // NEW (OTP)
  VALIDATE_OTP_IDENTIFIER = 'VALIDATE_OTP_IDENTIFIER',
  VALIDATE_PIN = 'VALIDATE_PIN',
}

export const AnswerOptionsList = {
  FORGET_THE_PIN: 'forget_the_pin',
  MEMBER_EXIT_OPTION: 'member_exit',
  MEMBER_NUMBER: 'member_number',
  MEMBER_PIN: 'member_pin',
  OTP_CODE: 'otp_code',
  // NEW (OTP)
  OTP_IDENTIFIER: 'otp_identifier',
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
    // NEW (OTP)
    this.register(GVAGoalSteps.VALIDATE_OTP_IDENTIFIER, this.validateOtpIdentifier.bind(this));
    this.register(GVAGoalSteps.VALIDATE_OTP_CODE, this.validateOtpCode.bind(this));

    this.answerDetectorService = new AnswerDetectorService(this.config, this.logger, [
      new AnswerOption(AnswerOptionsList.FORGET_THE_PIN, ['I forgot', 'forgot', 'forget', 'lost', 'no', 'not', 'don']),
      new AnswerOption(AnswerOptionsList.MEMBER_NUMBER, [IDENTIFIER_REGEX]),
      new AnswerOption(AnswerOptionsList.MEMBER_PIN, [MEMBER_PIN_REGEX]),
      new AnswerOption(AnswerOptionsList.ZERO_NUMBER, [ZERO_NUMBER, 'zero']),
      // NEW (OTP) — performing detection but validate with straight regex text below
      new AnswerOption(AnswerOptionsList.OTP_IDENTIFIER, [IDENTIFIER_REGEX]),
      new AnswerOption(AnswerOptionsList.OTP_CODE, [OTP_CODE_REGEX]),
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
    const exitHandled = await this.handleMemberExitOption(context, detectedAnswer ?? undefined);
    if (exitHandled) {
      return exitHandled;
    }

    const customJourneyContext = this.getCustomJourneyContext(context);

    let memberNumberFailedAttempts = Number(customJourneyContext.memberNumberFailedAttempts ?? 0);

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
            identifierType: this.config.quorumConfig.otpIdentifierType,
          },
          responseId: this.config.gvaGoals.otpflowstart, // GOAL_OTP_FLOW_START
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

  // // NEW — VALIDATE_OTP_CODE step
  // async validateOtpCode(context: HandlerPayload): Promise<HandlerResult> {
  //   await this.logger.info(`EngagementId: ${context.engagementId}, Validating OTP code`);

  //   const detectedAnswer = await this.answerDetectorService.detect(context);
  //   const exitHandled = await this.handleMemberExitOption(context, detectedAnswer ?? undefined);
  //   if (exitHandled) {
  //     return exitHandled;
  //   }

  //   const customJourneyContext = this.getCustomJourneyContext(context);

  //   const attemptLimit = this.config.inputValidationFailedAttemptsLimit;
  //   const previousAttempts = await this.getFailedIdentifierVerifyAttempts(otpAttemptsKey);

  //   // Invalid OTP > Increment atempt and show the invalidotp
  //   const newAttempts = await this.saveFailedAttempt(otpAttemptsKey, previousAttempts);

  //   if (newAttempts.length >= attemptLimit) {
  //     await this.logger.info(
  //       `EngagementId: ${context.engagementId}, Exceeded allowed OTP attempts (${newAttempts.length}/${attemptLimit}), escalating`,
  //     );
  //     await this.tryToTransferToQueue(context.engagementId);
  //     return this.buildHandlerResultPayload({
  //       isFinalStep: true,
  //       responseId: this.config.gvaGoals.transferToLiveOperator,
  //     });
  //   }

  //   customJourneyContext.STEP = GVAGoalSteps.VALIDATE_OTP_CODE;
  //   customJourneyContext.otpAttemptNumber = newAttempts.length;
  //   customJourneyContext.otpAttemptLimit = attemptLimit;

  //   return this.buildHandlerResultPayload({
  //     customJourneyContext,
  //     responseData: {
  //       otpAttemptLimit: attemptLimit,
  //       otpAttemptNumber: newAttempts.length,
  //     },
  //     responseId: this.config.gvaGoals.invalidotp, // GOAL_INVALID_OTP
  //   });
  // }
  // NEW — VALIDATE_OTP_CODE step (PIN-like, but without FORGET option)
  async validateOtpCode(context: HandlerPayload): Promise<HandlerResult> {
    await this.logger.info(`EngagementId: ${context.engagementId}, Validating OTP code`);

    const detectedAnswer = await this.answerDetectorService.detect(context);
    const exitHandled = await this.handleMemberExitOption(context, detectedAnswer ?? undefined);
    if (exitHandled) {
      return exitHandled;
    }

    const customJourneyContext = this.getCustomJourneyContext(context);

    // 1) should have an otpIdentifier from prev step (VALIDATE_OTP_IDENTIFIER)
    const otpIdentifier = typeof customJourneyContext.otpIdentifier === 'string' ? customJourneyContext.otpIdentifier : null;
    if (!otpIdentifier) {
      await this.logger.error(`EngagementId: ${context.engagementId}, otpIdentifier is missing before OTP code validation`);
      // getting back visitor to the step to enter OTP identifier
      customJourneyContext.STEP = GVAGoalSteps.VALIDATE_OTP_IDENTIFIER;
      return this.buildHandlerResultPayload({
        customJourneyContext,
        responseData: {
          identifierType: this.config.quorumConfig.otpIdentifierType,
        },
        responseId: this.config.gvaGoals.invalidotpidentifier, // "Your answer is wrong, enter valid {{identifierType}}"
      });
    }

    // 2) Limit + story of attempts for OTP code (separate key for KV, do not mess with PIN)
    const attemptLimit = this.config.inputValidationFailedAttemptsLimit;
    const previousFailedAttempts = await this.getFailedIdentifierVerifyAttempts(otpIdentifier);

    // 3) IF we get the valid 6th digits code — check on a backend
    if (detectedAnswer && detectedAnswer.name === AnswerOptionsList.OTP_CODE && detectedAnswer.matchedText) {
      const verifyResponse = await this.verifyOtpCode(otpIdentifier, detectedAnswer.matchedText);

      // 3) IF we get the valid 6th digits code — check on a backend
      if (
        verifyResponse &&
        verifyResponse.ok &&
        typeof verifyResponse.payload.token === 'string' &&
        typeof verifyResponse.payload.expiresIn === 'string'
      ) {
        // success > reset attempts and show the success goal
        await this.resetFailedAttemptsHistory(detectedAnswer.matchedText);

        const expiresIn =
          Number(verifyResponse.payload.expiresIn) <= 3600 * 24 ? Date.now() + Number(verifyResponse.payload.expiresIn) * 1000 : Date.now();

        await this.gliaKVService.setValue(context.engagementId, JSON.stringify({ expiresIn, token: verifyResponse.payload.token }));

        return this.buildHandlerResultPayload({
          auth: {
            expiresIn: Number(verifyResponse.payload.expiresIn),
            token: verifyResponse.payload.token,
          },
          isFinalStep: true,
          responseId: this.config.gvaGoals.successfullyVerifiesMemberNumberAndPin,
        });
      }
    }

    // 4) Invalid format or not success of backend check increment attempt
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

    // 5) Ask to repeat and show the attempt {{otpAttemptNumber}} of {{otpAttemptLimit}}
    customJourneyContext.STEP = GVAGoalSteps.VALIDATE_OTP_CODE;

    return this.buildHandlerResultPayload({
      customJourneyContext,
      responseData: {
        otpAttemptLimit: attemptLimit,
        otpAttemptNumber: newAttempts.length,
      },
      responseId: this.config.gvaGoals.invalidotp, // GOAL_INVALID_OTP
    });
  }

  // NEW — VALIDATE_OTP_IDENTIFIER step
  // async validateOtpIdentifier(context: HandlerPayload): Promise<HandlerResult> {
  //   await this.logger.info(`DBG[${context.engagementId}] enter VALIDATE_OTP_IDENTIFIER`); // NEW LOG
  //   await this.logger.info(`EngagementId: ${context.engagementId}, Validating OTP identifier`);
  //   const detectedAnswer = await this.answerDetectorService.detect(context);
  //   const isIdentifier = IDENTIFIER_REGEX.test((detectedAnswer?.matchedText ?? '').trim());
  //   await this.logger.info(`DBG[${context.engagementId}] IDENTIFIER_REGEX=${isIdentifier}`);

  //   await this.logger.info(
  //     `DBG[${context.engagementId}] detect name=${detectedAnswer?.name ?? '∅'} text="${detectedAnswer?.matchedText ?? ''}"`,
  //   ); // NEW LOG
  //   const exitHandled = await this.handleMemberExitOption(context, detectedAnswer ?? undefined);
  //   if (exitHandled) {
  //     return exitHandled;
  //   }

  //   const customJourneyContext = this.getCustomJourneyContext(context);

  //   if (detectedAnswer && detectedAnswer.name === AnswerOptionsList.OTP_IDENTIFIER && detectedAnswer.matchedText) {
  //     await this.logger.info(`EngagementId: ${context.engagementId}, Valid OTP identifier received: ${detectedAnswer.matchedText}`);

  //     const failedAttempts = await this.getFailedIdentifierVerifyAttempts(detectedAnswer.matchedText);
  //     if (failedAttempts.length >= this.config.inputValidationFailedAttemptsLimit) {
  //       await this.logger.info(
  //         `EngagementId: ${context.engagementId}, Member number ${detectedAnswer.matchedText} has too many failed attempts`,
  //       );
  //       await this.tryToTransferToQueue(context.engagementId);
  //       return this.buildHandlerResultPayload({
  //         isFinalStep: true,
  //         responseId: this.config.gvaGoals.transferToLiveOperator,
  //       });
  //     }

  //     const initAuthResponse = await this.initOtpAuthentication(detectedAnswer.matchedText);

  //     if (initAuthResponse && initAuthResponse.ok) {
  //       // on identifier owner device - OTP was sent

  //       customJourneyContext.otpIdentifier = detectedAnswer.matchedText;
  //       customJourneyContext.STEP = GVAGoalSteps.VALIDATE_OTP_CODE;

  //       return this.buildHandlerResultPayload({
  //         customJourneyContext,
  //         responseId: this.config.gvaGoals.enterOTPCode, // GOAL_ENTER_OTP_CODE
  //       });
  //     }
  //   }

  //   let identifierFailedAttempts = Number(customJourneyContext.identifierFailedAttempts ?? 0);

  //   const attemptLimit = this.config.inputValidationFailedAttemptsLimit;

  //   identifierFailedAttempts += 1;

  //   if (identifierFailedAttempts >= attemptLimit) {
  //     await this.logger.info(
  //       `EngagementId: ${context.engagementId},` +
  //         ` Exceeded allowed OTP identifier attempts (${identifierFailedAttempts}/${attemptLimit}), escalating`,
  //     );
  //     await this.tryToTransferToQueue(context.engagementId);
  //     return this.buildHandlerResultPayload({
  //       isFinalStep: true,
  //       responseId: this.config.gvaGoals.transferToLiveOperator,
  //     });
  //   }

  //   customJourneyContext.STEP = GVAGoalSteps.VALIDATE_OTP_IDENTIFIER;
  //   customJourneyContext.identifierFailedAttempts = identifierFailedAttempts;

  //   return this.buildHandlerResultPayload({
  //     customJourneyContext,
  //     responseData: {
  //       identifierType: this.config.quorumConfig.otpIdentifierType,
  //     },
  //     responseId: this.config.gvaGoals.invalidotpidentifier,
  //   });
  // }
  // NEW — VALIDATE_OTP_IDENTIFIER (мінімальний і надійний)
  async validateOtpIdentifier(context: HandlerPayload): Promise<HandlerResult> {
    await this.logger.info(`DBG[${context.engagementId}] enter VALIDATE_OTP_IDENTIFIER`);
    await this.logger.info(`EngagementId: ${context.engagementId}, Validating OTP identifier`);

    const detectedAnswer = await this.answerDetectorService.detect(context);
    await this.logger.info(
      `DBG[${context.engagementId}] detect name=${detectedAnswer?.name ?? '∅'} text="${detectedAnswer?.matchedText ?? ''}"`,
    );

    const customJourneyContext = this.getCustomJourneyContext(context);

    // ---- ЄДИНА УМОВА ВАЛІДАЦІЇ: 9 цифр по REGEX, БЕЗ перевірки detectedAnswer.name
    const text = (detectedAnswer?.matchedText ?? '').trim();
    const isIdentifier = IDENTIFIER_REGEX.test(text);
    await this.logger.info(`DBG[${context.engagementId}] IDENTIFIER_REGEX=${isIdentifier}`);

    if (isIdentifier) {
      // (опційно) ліміт за 24h по самому значенню
      const failedAttempts = await this.getFailedIdentifierVerifyAttempts(text);
      if (failedAttempts.length >= this.config.inputValidationFailedAttemptsLimit) {
        await this.logger.info(`EngagementId: ${context.engagementId}, OTP identifier ${text} has too many failed attempts`);
        await this.tryToTransferToQueue(context.engagementId);
        return this.buildHandlerResultPayload({
          isFinalStep: true,
          responseId: this.config.gvaGoals.transferToLiveOperator,
        });
      }

      // ініціюємо OTP надсилання
      const initAuthResponse = await this.initOtpAuthentication(text);
      if (initAuthResponse && initAuthResponse.ok) {
        customJourneyContext.otpIdentifier = text;
        customJourneyContext.STEP = GVAGoalSteps.VALIDATE_OTP_CODE;

        return this.buildHandlerResultPayload({
          customJourneyContext,
          responseId: this.config.gvaGoals.enterOTPCode, // GOAL_ENTER_OTP_CODE
        });
      }
      // якщо бекенд не ок — падаємо в “невдалу спробу” нижче
    }

    // ---- НЕВАЛІДНО / БЕКЕНД НЕ ПІДТВЕРДИВ → інкрементуємо локальний лічильник і просимо ще раз
    let identifierFailedAttempts = Number(customJourneyContext.identifierFailedAttempts ?? 0);
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
        identifierType: this.config.quorumConfig.otpIdentifierType, // підстановка в картку
      },
      responseId: this.config.gvaGoals.invalidotpidentifier, // 1196653
    });
  }

  async validatePin(context: HandlerPayload): Promise<HandlerResult> {
    await this.logger.info(`EngagementId: ${context.engagementId}, Validating PIN`);

    const detectedAnswer = await this.answerDetectorService.detect(context);
    const candidate = (detectedAnswer?.matchedText ?? '').trim();
    const isIdentifier = IDENTIFIER_REGEX.test(candidate);
    await this.logger.info(`DBG[${context.engagementId}] candidate="${candidate}" IDENTIFIER_REGEX=${isIdentifier}`);

    const exitHandled = await this.handleMemberExitOption(context, detectedAnswer ?? undefined);
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

    const failedAttempts = await this.getFailedIdentifierVerifyAttempts(memberNumber); // by 24h
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

        const expiresIn =
          Number(authResultResponse.payload.expiresIn) <= 3600 * 24
            ? Date.now() + Number(authResultResponse.payload.expiresIn) * 1000
            : Date.now();

        await this.gliaKVService.setValue(context.engagementId, JSON.stringify({ expiresIn, token: authResultResponse.payload.token }));

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

  private async getFailedIdentifierVerifyAttempts(identifierValue: string): Promise<number[]> {
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

  private async handleMemberExitOption(
    context: HandlerPayload,
    detectedAnswer?: { matchedText?: string | null; name?: string },
  ): Promise<HandlerResult | null> {
    if (!detectedAnswer || detectedAnswer.name !== AnswerOptionsList.MEMBER_EXIT_OPTION) {
      return null;
    }

    await this.logger.info(`EngagementId: ${context.engagementId}, Exit option detected (${detectedAnswer.matchedText ?? ''})`);
    await this.tryToTransferToQueue(context.engagementId);

    return this.buildHandlerResultPayload({
      isFinalStep: true,
      responseId: this.config.gvaGoals.transferToLiveOperator,
    });
  }

  private async initOtpAuthentication(identifier: string) {
    try {
      return await this.quorumApi.initOtpAuthentication(identifier);
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

  private async verifyOtpCode(identifier: string, code: string) {
    try {
      return await this.quorumApi.verifyOtpCode(identifier, code);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error in setValueToKV';
      await this.logger.error(`Error initiating OTP authentication: ${message}`);
      return null;
    }
  }
}
