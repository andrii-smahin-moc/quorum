import { FunctionConfig } from '../src/types';

export const validEnv = {
  CALL_RETRIES: '3',
  DD_API_KEY: 'test-dd-api-key-123456',
  FAIL_ATTEMPTS: '3',
  FDMS_VERSION: '1.0.0',
  GLIA_AI_MAX_TOKENS: '256',
  GLIA_AI_STOP_SEQUENCES: 'END,STOP',
  GLIA_AI_TEMPERATURE: '0.4',
  GLIA_AI_MODEL: 'glia.micro.v1',
  GLIA_API_DOMAIN: 'https://glia.example.com',
  GLIA_KV_STORAGE_REPOSITORY: 'kv-storage-example',
  GLIA_LIVE_OPERATOR_QUEUE: 'live-operator-queue-id',
  GLIA_USER_API_KEY: 'glia-user-api-key',
  GLIA_USER_API_KEY_SECRET: 'glia-user-api-secret',

  GOAL_ALREADY_AUTHENTICATED: 'GOAL_ALREADY_AUTHENTICATED',
  GOAL_ENTER_A_PIN: 'GOAL_ENTER_A_PIN',
  GOAL_ENTER_OTP_CODE: 'GOAL_ENTER_OTP_CODE',
  GOAL_FORGOT_PIN: 'GOAL_FORGOT_PIN',
  GOAL_INVALID_MEMBER_NUMBER: 'GOAL_INVALID_MEMBER_NUMBER',
  GOAL_INVALID_OTP: 'GOAL_INVALID_OTP',
  GOAL_INVALID_OTP_IDENTIFIER: 'GOAL_INVALID_OTP_IDENTIFIER',
  GOAL_INVALID_PIN: 'GOAL_INVALID_PIN',
  GOAL_NEED_TO_AUTHENTICATION: 'GOAL_NEED_TO_AUTHENTICATION',
  GOAL_OTP_FLOW_START: 'GOAL_OTP_FLOW_START',
  GOAL_PIN_ATTEMPTS_EXCEEDED: 'GOAL_PIN_ATTEMPTS_EXCEEDED',
  GOAL_SUCCESSFULLY_VERIFIES_MEMBER_NUMBER_AND_PIN: 'GOAL_SUCCESSFULLY_VERIFIES_MEMBER_NUMBER_AND_PIN',
  GOAL_TRANSFER_TO_LIVE_OPERATOR: 'GOAL_TRANSFER_TO_LIVE_OPERATOR',
  GOAL_ZERO_PRESS: 'GOAL_ZERO_PRESS',

  INPUT_VALIDATION_FAILED_ATTEMPTS: '0',
  INPUT_VALIDATION_FAILED_ATTEMPTS_LIMIT: '5',

  IS_DEV_MOD: 'true',

  LYNKTEK_API_DOMAIN: 'https://api.lynktek.example.com',
  LYNKTEK_API_HEADER: 'x-api-key-lynktek-123',
  LYNKTEK_DEFAULT_PIN: '0000',

  PROMPT_DETECT_CONFIDENCE: '0.7',
  PROMPT_OPTION_DETECTOR: 'Please choose the correct option below:',

  REQUEST_TIMEOUT: '10',
  RETRY_DELAY: '20',

  SITE_ID: 'site-001',

  VALIDATE_OTP_IDENTIFIER: 'ACCOUNT_NUMBER',
};

export const expectedValidConfig: FunctionConfig = {
  callRetries: 3,

  dataDog: {
    callRetries: 3,
    customer: 'quorum',
    ddApiKey: validEnv.DD_API_KEY,
    functionName: 'gva-member-pin-auth-function',
    isDevMode: true,
    requestTimeout: 10,
    retryDelay: 20,
    siteId: validEnv.SITE_ID,
    version: validEnv.FDMS_VERSION,
  },

  glia: {
    apiDomain: validEnv.GLIA_API_DOMAIN,
    siteId: validEnv.SITE_ID,
    userApiKey: validEnv.GLIA_USER_API_KEY,
    userApiKeySecret: validEnv.GLIA_USER_API_KEY_SECRET,
    liveOperatorQueueID: validEnv.GLIA_LIVE_OPERATOR_QUEUE,
    kvStorageRepository: validEnv.GLIA_KV_STORAGE_REPOSITORY,
  },

  gliaAI: {
    detectConfidence: parseFloat(validEnv.PROMPT_DETECT_CONFIDENCE),
    detectOptionPrompt: validEnv.PROMPT_OPTION_DETECTOR,
    maxTokens: parseInt(validEnv.GLIA_AI_MAX_TOKENS, 10),
    stopSequences: validEnv.GLIA_AI_STOP_SEQUENCES.split(',').map((s) => s.trim()),
    temperature: parseFloat(validEnv.GLIA_AI_TEMPERATURE),
    model: validEnv.GLIA_AI_MODEL,
  },

  gvaGoals: {
    alreadyAuthenticated: validEnv.GOAL_ALREADY_AUTHENTICATED,
    enterAPin: validEnv.GOAL_ENTER_A_PIN,
    forgotPin: validEnv.GOAL_FORGOT_PIN,
    invalidMemberNumber: validEnv.GOAL_INVALID_MEMBER_NUMBER,
    invalidPin: validEnv.GOAL_INVALID_PIN,
    needToAuthentication: validEnv.GOAL_NEED_TO_AUTHENTICATION,
    pinAttemptExceeded: validEnv.GOAL_PIN_ATTEMPTS_EXCEEDED,
    successfullyVerifiesMemberNumberAndPin: validEnv.GOAL_SUCCESSFULLY_VERIFIES_MEMBER_NUMBER_AND_PIN,
    transferToLiveOperator: validEnv.GOAL_TRANSFER_TO_LIVE_OPERATOR,
    zeroPress: validEnv.GOAL_ZERO_PRESS,
    enterOTPCode: validEnv.GOAL_ENTER_OTP_CODE,
    otpFlowStart: validEnv.GOAL_OTP_FLOW_START,
    invalidOtpIdentifier: validEnv.GOAL_INVALID_OTP_IDENTIFIER,
    invalidOtp: validEnv.GOAL_INVALID_OTP,
  },

  inputValidationFailedAttemptsLimit: parseInt(validEnv.INPUT_VALIDATION_FAILED_ATTEMPTS_LIMIT, 10),

  lynktekConfig: {
    lynktekApiDomain: validEnv.LYNKTEK_API_DOMAIN,
    lynktekApiHeader: validEnv.LYNKTEK_API_HEADER,
    defaultPin: validEnv.LYNKTEK_DEFAULT_PIN,
    otpIdentifierType: validEnv.VALIDATE_OTP_IDENTIFIER,
  },

  requestTimeout: parseInt(validEnv.REQUEST_TIMEOUT, 10),
  retryDelay: parseInt(validEnv.RETRY_DELAY, 10),
};
