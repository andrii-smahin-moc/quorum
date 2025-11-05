import { BaseEnvironmentSchema } from './schemas';
import { FunctionConfig, ValidationResult } from './types';
import { validateSchema } from './validator';

export function validateConfig(environment: Record<string, unknown>): ValidationResult<FunctionConfig> {
  const validationResult = validateSchema(BaseEnvironmentSchema, environment, 'Environment validation');

  if (!validationResult.status) {
    return validationResult;
  }

  return {
    output: {
      callRetries: Number(validationResult.output.CALL_RETRIES) || 3,
      dataDog: {
        callRetries: Number(validationResult.output.CALL_RETRIES) || 3,
        customer: 'quorum',
        ddApiKey: validationResult.output.DD_API_KEY,
        functionName: 'gva-member-pin-auth-function',
        isDevMode: validationResult.output.IS_DEV_MOD === 'true',
        requestTimeout: Number(validationResult.output.REQUEST_TIMEOUT) || 5000,
        retryDelay: Number(validationResult.output.RETRY_DELAY) || 3000,
        siteId: validationResult.output.SITE_ID,
        version: validationResult.output.FDMS_VERSION,
      },
      glia: {
        apiDomain: validationResult.output.GLIA_API_DOMAIN,
        kvStorageRepository: validationResult.output.GLIA_KV_STORAGE_REPOSITORY,
        liveOperatorQueueID: validationResult.output.GLIA_LIVE_OPERATOR_QUEUE,
        siteId: validationResult.output.SITE_ID,
        userApiKey: validationResult.output.GLIA_USER_API_KEY,
        userApiKeySecret: validationResult.output.GLIA_USER_API_KEY_SECRET,
      },
      gliaAI: {
        detectConfidence: Number(validationResult.output.PROMPT_DETECT_CONFIDENCE),
        detectOptionPrompt: validationResult.output.PROMPT_OPTION_DETECTOR,
        maxTokens: Number(validationResult.output.GLIA_AI_MAX_TOKENS),
        stopSequences: (() => {
          const raw = validationResult.output.GLIA_AI_STOP_SEQUENCES;
          if (!raw) {
            return [];
          }
          return raw
            .split(',')
            .map((s) => s.trim())
            .filter((s) => s.length > 0);
        })(),
        temperature: Number(validationResult.output.GLIA_AI_TEMPERATURE),
      },
      gvaGoals: {
        alreadyAuthenticated: validationResult.output.GOAL_ALREADY_AUTHENTICATED,
        enterAPin: validationResult.output.GOAL_ENTER_A_PIN,
        enterOTPCode: validationResult.output.GOAL_ENTER_OTP_CODE,
        forgotPin: validationResult.output.GOAL_FORGOT_PIN,
        invalidMemberNumber: validationResult.output.GOAL_INVALID_MEMBER_NUMBER,
        invalidOtp: validationResult.output.GOAL_INVALID_OTP,
        invalidOtpIdentifier: validationResult.output.GOAL_INVALID_OTP_IDENTIFIER,
        invalidPin: validationResult.output.GOAL_INVALID_PIN,
        needToAuthentication: validationResult.output.GOAL_NEED_TO_AUTHENTICATION,
        otpFlowStart: validationResult.output.GOAL_OTP_FLOW_START,
        pinAttemptExceeded: validationResult.output.GOAL_PIN_ATTEMPTS_EXCEEDED,
        successfullyVerifiesMemberNumberAndPin: validationResult.output.GOAL_SUCCESSFULLY_VERIFIES_MEMBER_NUMBER_AND_PIN,
        transferToLiveOperator: validationResult.output.GOAL_TRANSFER_TO_LIVE_OPERATOR,
        zeroPress: validationResult.output.GOAL_ZERO_PRESS,
      },

      inputValidationFailedAttemptsLimit: Number(validationResult.output.INPUT_VALIDATION_FAILED_ATTEMPTS) || 5, // changed 3 to 5

      lynktekConfig: {
        defaultPin: validationResult.output.LYNKTEK_DEFAULT_PIN ?? '',
        lynktekApiDomain: validationResult.output.LYNKTEK_API_DOMAIN,
        lynktekApiHeader: validationResult.output.LYNKTEK_API_HEADER,
        otpIdentifierType: validationResult.output.VALIDATE_OTP_IDENTIFIER,
      },

      requestTimeout: Number(validationResult.output.REQUEST_TIMEOUT) || 5000,
      retryDelay: Number(validationResult.output.RETRY_DELAY) || 3000,
    },
    status: true,
  };
}
