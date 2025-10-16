import { describe, it, expect } from 'vitest';
import { validateConfig } from '../src/config';

const makeValidEnv = () => ({
  DD_API_KEY: 'dd_key',
  SITE_ID: 'site_123',
  FDMS_VERSION: '1.0.0',

  CALL_RETRIES: '7',
  REQUEST_TIMEOUT: '12000',
  RETRY_DELAY: '4500',
  IS_DEV_MOD: 'true',

  GLIA_API_DOMAIN: 'https://api.glia.com',
  GLIA_KV_STORAGE_REPOSITORY: 'kvRepo',
  GLIA_LIVE_OPERATOR_QUEUE: 'queue-42',
  GLIA_USER_API_KEY: 'glia_key',
  GLIA_USER_API_KEY_SECRET: 'glia_secret',

  PROMPT_DETECT_CONFIDENCE: '0.78',
  PROMPT_OPTION_DETECTOR: 'Detect options here',
  GLIA_AI_MAX_TOKENS: '500',
  GLIA_AI_STOP_SEQUENCES: 'END, STOP',
  GLIA_AI_TEMPERATURE: '0.4',

  GOAL_ALREADY_AUTHENTICATED: 'already-auth',
  GOAL_ENTER_A_PIN: 'enter-pin',
  GOAL_ENTER_OTP_CODE: 'enter-otp',
  GOAL_FORGOT_PIN: 'forgot-pin',
  GOAL_INVALID_MEMBER_NUMBER: 'invalid-member-number',
  GOAL_INVALID_OTP: 'invalid-otp',
  GOAL_INVALID_OTP_IDENTIFIER: 'invalid-otp-identifier',
  GOAL_INVALID_PIN: 'invalid-pin',
  GOAL_NEED_TO_AUTHENTICATION: 'need-auth',
  GOAL_OTP_FLOW_START: 'otp-flow-start',
  GOAL_PIN_ATTEMPTS_EXCEEDED: 'pin-attempts-exceeded',
  GOAL_SUCCESSFULLY_VERIFIES_MEMBER_NUMBER_AND_PIN: 'auth-success',
  GOAL_TRANSFER_TO_LIVE_OPERATOR: 'transfer',
  GOAL_ZERO_PRESS: 'zero-press',

  INPUT_VALIDATION_FAILED_ATTEMPTS: '5',

  QUORUM_DEFAULT_PIN: '0000',
  VALIDATE_OTP_IDENTIFIER: 'ACCOUNT_NUMBER',
  QUORUM_API_DOMAIN: 'https://quorum.api',
  QUORUM_API_HEADER: 'x-gva-quorum-key',
});

const makeExpectedConfig = (env: ReturnType<typeof makeValidEnv>) => ({
  callRetries: Number(env.CALL_RETRIES),
  dataDog: {
    callRetries: Number(env.CALL_RETRIES),
    customer: 'quorum',
    ddApiKey: env.DD_API_KEY,
    functionName: 'gva-member-pin-auth-function',
    isDevMode: env.IS_DEV_MOD === 'true',
    requestTimeout: Number(env.REQUEST_TIMEOUT),
    retryDelay: Number(env.RETRY_DELAY),
    siteId: env.SITE_ID,
    version: env.FDMS_VERSION,
  },
  glia: {
    apiDomain: env.GLIA_API_DOMAIN,
    kvStorageRepository: env.GLIA_KV_STORAGE_REPOSITORY,
    liveOperatorQueueID: env.GLIA_LIVE_OPERATOR_QUEUE,
    siteId: env.SITE_ID,
    userApiKey: env.GLIA_USER_API_KEY,
    userApiKeySecret: env.GLIA_USER_API_KEY_SECRET,
  },
  gliaAI: {
    detectConfidence: Number(env.PROMPT_DETECT_CONFIDENCE),
    detectOptionPrompt: env.PROMPT_OPTION_DETECTOR,
    maxTokens: Number(env.GLIA_AI_MAX_TOKENS),
    stopSequences: ['END', 'STOP'],
    temperature: Number(env.GLIA_AI_TEMPERATURE),
  },
  gvaGoals: {
    alreadyAuthenticated: env.GOAL_ALREADY_AUTHENTICATED,
    enterAPin: env.GOAL_ENTER_A_PIN,
    enterOTPCode: env.GOAL_ENTER_OTP_CODE,
    forgotPin: env.GOAL_FORGOT_PIN,
    invalidMemberNumber: env.GOAL_INVALID_MEMBER_NUMBER,
    invalidotp: env.GOAL_INVALID_OTP,
    invalidotpidentifier: env.GOAL_INVALID_OTP_IDENTIFIER,
    invalidPin: env.GOAL_INVALID_PIN,
    needToAuthentication: env.GOAL_NEED_TO_AUTHENTICATION,
    otpflowstart: env.GOAL_OTP_FLOW_START,
    pinAttemptExceeded: env.GOAL_PIN_ATTEMPTS_EXCEEDED,
    successfullyVerifiesMemberNumberAndPin: env.GOAL_SUCCESSFULLY_VERIFIES_MEMBER_NUMBER_AND_PIN,
    transferToLiveOperator: env.GOAL_TRANSFER_TO_LIVE_OPERATOR,
    zeroPress: env.GOAL_ZERO_PRESS,
  },
  inputValidationFailedAttemptsLimit: Number(env.INPUT_VALIDATION_FAILED_ATTEMPTS),
  quorumConfig: {
    defaultPin: env.QUORUM_DEFAULT_PIN,
    otpIdentifierType: env.VALIDATE_OTP_IDENTIFIER,
    quorumApiDomain: env.QUORUM_API_DOMAIN,
    quorumApiHeader: env.QUORUM_API_HEADER,
  },
  requestTimeout: Number(env.REQUEST_TIMEOUT),
  retryDelay: Number(env.RETRY_DELAY),
});

describe('validateConfig (config.ts)', () => {
  it('returns status true and correct data for valid env', () => {
    const env = makeValidEnv();
    const result = validateConfig(env);
    expect(result.status).toBe(true);
    if (result.status) {
      expect(result.output).toEqual(makeExpectedConfig(env));
      expect(result.output.glia.apiDomain).toBe(env.GLIA_API_DOMAIN);
      expect(result.output.dataDog.isDevMode).toBe(true);
      expect(result.output.gliaAI.stopSequences).toEqual(['END', 'STOP']);
    }
  });

  it('returns status false if required field missing (DD_API_KEY)', () => {
    const { DD_API_KEY, ...env } = makeValidEnv();
    const result = validateConfig(env as any);
    expect(result.status).toBe(false);
    if (!result.status) {
      expect(result.message).toMatch(/DD_API_KEY/i);
    }
  });

  it('returns status false if VALIDATE_OTP_IDENTIFIER has invalid value', () => {
    const env = { ...makeValidEnv(), VALIDATE_OTP_IDENTIFIER: 'MEMBER_NUMBER' };
    const result = validateConfig(env);
    expect(result.status).toBe(false);
    if (!result.status) {
      expect(result.message).toMatch(/Invalid type/i);
      expect(result.message).toMatch(/received "MEMBER_NUMBER"/);

      expect(result.message).toMatch(/Invalid type: Expected .*CARD_NUMBER.* but received "MEMBER_NUMBER"/i);
    }
  });

  it('returns status true and applies defaults when optional fields are missing', () => {
    const { CALL_RETRIES, IS_DEV_MOD, REQUEST_TIMEOUT, RETRY_DELAY, ...rest } = makeValidEnv();
    const env = rest as ReturnType<typeof makeValidEnv>;
    const result = validateConfig(env);
    expect(result.status).toBe(true);
    if (result.status) {
      expect(result.output.callRetries).toBe(3);
      expect(result.output.requestTimeout).toBe(5000);
      expect(result.output.retryDelay).toBe(3000);
      expect(result.output.dataDog.callRetries).toBe(3);
      expect(result.output.dataDog.requestTimeout).toBe(5000);
      expect(result.output.dataDog.retryDelay).toBe(3000);
      expect(result.output.dataDog.isDevMode).toBe(false);
    }
  });

  it('parses gliaAI.stopSequences correctly: empty → [], messy → ["A","B","C"]', () => {
    {
      const env = { ...makeValidEnv(), GLIA_AI_STOP_SEQUENCES: '' };
      const res = validateConfig(env);
      expect(res.status).toBe(true);
      if (res.status) {
        expect(res.output.gliaAI.stopSequences).toEqual([]);
      }
    }
    {
      const env = { ...makeValidEnv(), GLIA_AI_STOP_SEQUENCES: ' A ,  ,B,  C ' };
      const res = validateConfig(env);
      expect(res.status).toBe(true);
      if (res.status) {
        expect(res.output.gliaAI.stopSequences).toEqual(['A', 'B', 'C']);
      }
    }
  });

  it('maps quorumConfig and numeric fields correctly', () => {
    const env = makeValidEnv();
    const res = validateConfig(env);
    expect(res.status).toBe(true);
    if (res.status) {
      expect(res.output.quorumConfig).toEqual({
        defaultPin: env.QUORUM_DEFAULT_PIN,
        otpIdentifierType: env.VALIDATE_OTP_IDENTIFIER,
        quorumApiDomain: env.QUORUM_API_DOMAIN,
        quorumApiHeader: env.QUORUM_API_HEADER,
      });
      expect(res.output.gliaAI.detectConfidence).toBeCloseTo(0.78, 5);
      expect(res.output.gliaAI.maxTokens).toBe(500);
      expect(res.output.gliaAI.temperature).toBeCloseTo(0.4, 5);
      expect(res.output.inputValidationFailedAttemptsLimit).toBe(5);
    }
  });
});
