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
        siteId: validationResult.output.SITE_ID,
        userApiKey: validationResult.output.GLIA_USER_API_KEY,
        userApiKeySecret: validationResult.output.GLIA_USER_API_KEY_SECRET,
      },
      gvaGoals: {
        needToAuthentication: validationResult.output.GOAL_NEED_TO_AUTHENTICATION,
        transferToLiveOperator: validationResult.output.GOAL_TRANSFER_TO_LIVE_OPERATOR,
        alreadyAuthenticated: validationResult.output.GOAL_ALREADY_AUTHENTICATED,
        successfullyVerifiesMemberNumberAndPin: validationResult.output.GOAL_SUCCESSFULLY_VERIFIES_MEMBER_NUMBER_AND_PIN,
        enterAPin: validationResult.output.GOAL_ENTER_A_PIN,
        invalidMemberNumber: validationResult.output.GOAL_INVALID_MEMBER_NUMBER,
        forgotPin: validationResult.output.GOAL_FORGOT_PIN,
        invalidPin: validationResult.output.GOAL_INVALID_PIN,
      },
      requestTimeout: Number(validationResult.output.REQUEST_TIMEOUT) || 5000,
      retryDelay: Number(validationResult.output.RETRY_DELAY) || 3000,
    },
    status: true,
  };
}
