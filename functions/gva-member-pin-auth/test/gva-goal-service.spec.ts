import { describe, it, expect, vi, beforeEach } from 'vitest';

const verifyMemberExistsMock = vi.fn();
const verifyMemberPinMock = vi.fn();
const verifyOtpCodeMock = vi.fn();
const initOtpAuthMock = vi.fn();

const transferToQueueMock = vi.fn().mockResolvedValue({ statusCode: 200 });

vi.mock('../src/apis', async (importOriginal) => {
  const GliaAuthApi = vi.fn().mockImplementation(() => ({
    fetchUserBearerToken: vi.fn().mockResolvedValue({
      ok: true,
      payload: { token: 'bearer-token' },
    }),
  }));

  const GliaEngagementApi = vi.fn().mockImplementation(() => ({
    fetchEngagementDetails: vi.fn().mockResolvedValue({
      ok: true,
      payload: { legs: [{ accepted_media_type: 'text', ended_at: null }] },
    }),
  }));

  const GliaTransferApi = vi.fn().mockImplementation(() => ({
    transferToQueue: transferToQueueMock,
  }));

  const LynktekApi = vi.fn().mockImplementation(() => ({
    verifyMemberExists: verifyMemberExistsMock,
    verifyMemberPin: verifyMemberPinMock,
    verifyOtpCode: verifyOtpCodeMock,
    initOtpAuthentication: initOtpAuthMock,
  }));

  return {
    GliaAuthApi,
    GliaEngagementApi,
    GliaTransferApi,
    LynktekApi,
  };
});

const detectMock = vi.fn();
vi.mock('../src/services/answer-detector-service', () => ({
  AnswerDetectorService: vi.fn().mockImplementation(() => ({
    detect: detectMock,
  })),
}));

const kvGetMock = vi.fn();
const kvSetMock = vi.fn().mockResolvedValue(undefined);
const kvFactory = {
  initializeKvStore: vi.fn(() => ({
    get: kvGetMock,
    set: kvSetMock,
  })),
};

import { GVAGoalService } from '../src/services/gva-goal-service';
import type { HandlerPayload, LoggerInterface } from '../src/types';
import { expectedValidConfig } from './mock-data';
import { AnswerOptionsList, GVAGoalSteps } from '../src/constants';

const logger: LoggerInterface = {
  info: vi.fn().mockResolvedValue(undefined),
  warn: vi.fn().mockResolvedValue(undefined),
  error: vi.fn().mockResolvedValue(undefined),
};

const makeService = () => new GVAGoalService(expectedValidConfig as any, logger, kvFactory as any);

beforeEach(() => {
  vi.clearAllMocks();

  verifyMemberExistsMock.mockResolvedValue({ ok: true });
  verifyMemberPinMock.mockResolvedValue({
    ok: true,
    payload: { token: 'tok', expiresIn: '3600' },
  });
  verifyOtpCodeMock.mockResolvedValue({
    ok: true,
    payload: { token: 'tok', expiresIn: '3600' },
  });
  initOtpAuthMock.mockResolvedValue({ ok: true });

  kvGetMock.mockResolvedValue(null);
});

describe('GVAGoalService', () => {
  it('initialStep → set STEP=VALIDATE_MEMBER_NUMBER and return needToAuthentication', async () => {
    const service = makeService();
    const ctx: HandlerPayload = {
      engagementId: 'e1',
      gvaId: 'g1',
      messageType: 'text',
      text: 'hello',
    } as any;

    const res = await service.initialStep(ctx);

    expect(res.isFinalStep).toBe(false);
    expect(res.responseId).toBe(expectedValidConfig.gvaGoals.needToAuthentication);

    const cjc = res.customJourneyContext as Record<string, unknown>;
    expect(cjc.STEP).toBe(GVAGoalSteps.VALIDATE_MEMBER_NUMBER);
  });

  it('validateMemberNumber → success: detect number + Lynktek ok → STEP=VALIDATE_PIN', async () => {
    const service = makeService();
    detectMock.mockResolvedValueOnce({
      name: AnswerOptionsList.MEMBER_NUMBER,
      matchedText: '12345678',
    });

    const ctx: HandlerPayload = {
      engagementId: 'e2',
      gvaId: 'g2',
      messageType: 'text',
      text: 'my number is 12345678',
      customJourneyContext: JSON.stringify({ memberNumberFailedAttempts: 1 }),
    } as any;

    const res = await service.validateMemberNumber(ctx);

    expect(verifyMemberExistsMock).toHaveBeenCalledWith('12345678');
    expect(res.responseId).toBe(expectedValidConfig.gvaGoals.enterAPin);

    const cjc = res.customJourneyContext as any;
    expect(cjc.memberNumber).toBe('12345678');
    expect(cjc.STEP).toBe(GVAGoalSteps.VALIDATE_PIN);
  });

  it('validateMemberNumber → ZERO_NUMBER → final zeroPress + transfer', async () => {
    const service = makeService();
    detectMock.mockResolvedValueOnce({
      name: AnswerOptionsList.ZERO_NUMBER,
      matchedText: '0',
    });

    const ctx: HandlerPayload = {
      engagementId: 'e3',
      gvaId: 'g3',
      messageType: 'quickReplyTap',
      buttonText: '0',
    } as any;

    const res = await service.validateMemberNumber(ctx);

    expect(res.isFinalStep).toBe(true);
    expect(res.responseId).toBe(expectedValidConfig.gvaGoals.zeroPress);
    expect(transferToQueueMock).toHaveBeenCalled();
  });

  it('validateMemberNumber → invalid < limit → increment + invalidMemberNumber', async () => {
    const service = makeService();
    detectMock.mockResolvedValueOnce(null);

    const ctx: HandlerPayload = {
      engagementId: 'e4',
      gvaId: 'g4',
      messageType: 'text',
      text: 'blah',
      customJourneyContext: JSON.stringify({ memberNumberFailedAttempts: 1 }),
    } as any;

    const res = await service.validateMemberNumber(ctx);

    expect(res.isFinalStep).toBe(false);
    expect(res.responseId).toBe(expectedValidConfig.gvaGoals.invalidMemberNumber);

    const cjc = res.customJourneyContext as any;
    expect(cjc.memberNumberFailedAttempts).toBe(2);
    expect(cjc.STEP).toBe(GVAGoalSteps.VALIDATE_MEMBER_NUMBER);
  });

  it('validateMemberNumber → invalid with exceeded limit → final transferToLiveOperator', async () => {
    const service = makeService();
    detectMock.mockResolvedValueOnce(null);

    const limit = expectedValidConfig.inputValidationFailedAttemptsLimit;
    const ctx: HandlerPayload = {
      engagementId: 'e5',
      gvaId: 'g5',
      messageType: 'text',
      text: 'meh',
      customJourneyContext: JSON.stringify({
        memberNumberFailedAttempts: limit - 1,
      }),
    } as any;

    const res = await service.validateMemberNumber(ctx);

    expect(res.isFinalStep).toBe(true);
    expect(res.responseId).toBe(expectedValidConfig.gvaGoals.transferToLiveOperator);
    expect(transferToQueueMock).toHaveBeenCalled();
  });

  it('validatePin → success: detect PIN + Lynktek ok → final success', async () => {
    const service = makeService();
    detectMock.mockResolvedValueOnce({
      name: AnswerOptionsList.MEMBER_PIN,
      matchedText: '1234',
    });
    verifyMemberPinMock.mockResolvedValueOnce({
      ok: true,
      payload: { token: 'tok', expiresIn: '3600' },
    });

    const ctx: HandlerPayload = {
      engagementId: 'e6',
      gvaId: 'g6',
      messageType: 'text',
      text: 'pin 1234',
      customJourneyContext: JSON.stringify({
        STEP: GVAGoalSteps.VALIDATE_PIN,
        memberNumber: '12345678',
      }),
    } as any;

    const res = await service.validatePin(ctx);

    expect(verifyMemberPinMock).toHaveBeenCalledWith('12345678', '1234');
    expect(res.isFinalStep).toBe(true);
    expect(res.responseId).toBe(expectedValidConfig.gvaGoals.successfullyVerifiesMemberNumberAndPin);
  });

  it('validatePin → memberNumber missing → final invalidMemberNumber', async () => {
    const service = makeService();
    detectMock.mockResolvedValueOnce({
      name: AnswerOptionsList.MEMBER_PIN,
      matchedText: '9876',
    });

    const ctx: HandlerPayload = {
      engagementId: 'e7',
      gvaId: 'g7',
      messageType: 'text',
      text: '9876',
      customJourneyContext: JSON.stringify({ STEP: GVAGoalSteps.VALIDATE_PIN }),
    } as any;

    const res = await service.validatePin(ctx);

    expect(res.isFinalStep).toBe(true);
    expect(res.responseId).toBe(expectedValidConfig.gvaGoals.invalidMemberNumber);
    expect(transferToQueueMock).toHaveBeenCalled();
  });

  it('validatePin → "forgot PIN" → final forgotPin', async () => {
    const service = makeService();
    detectMock.mockResolvedValueOnce({
      name: AnswerOptionsList.FORGET_THE_PIN,
      matchedText: 'forgot',
    });

    const ctx: HandlerPayload = {
      engagementId: 'e8',
      gvaId: 'g8',
      messageType: 'text',
      text: 'forgot pin',
      customJourneyContext: JSON.stringify({
        STEP: GVAGoalSteps.VALIDATE_PIN,
        memberNumber: '111222',
      }),
    } as any;

    const res = await service.validatePin(ctx);

    expect(res.isFinalStep).toBe(true);
    expect(res.responseId).toBe(expectedValidConfig.gvaGoals.forgotPin);
    expect(transferToQueueMock).toHaveBeenCalled();
  });

  it('validatePin → invalid < limit → response=invalidPin', async () => {
    const service = makeService();
    detectMock.mockResolvedValueOnce(null);

    const ctx: HandlerPayload = {
      engagementId: 'e9',
      gvaId: 'g9',
      messageType: 'text',
      text: 'abcd',
      customJourneyContext: JSON.stringify({
        STEP: GVAGoalSteps.VALIDATE_PIN,
        memberNumber: '111222',
      }),
    } as any;

    const res = await service.validatePin(ctx);

    expect(res.isFinalStep).toBe(false);
    expect(res.responseId).toBe(expectedValidConfig.gvaGoals.invalidPin);

    const cjc = res.customJourneyContext as any;
    expect(cjc.STEP).toBe(GVAGoalSteps.VALIDATE_PIN);

    expect(res.responseData).toEqual({
      pinAttemptLimit: expectedValidConfig.inputValidationFailedAttemptsLimit,
      pinAttemptNumber: expect.any(Number),
    });
  });

  it('validatePin → invalid with exceeded limit → final pinAttemptExceeded', async () => {
    const service = makeService();
    detectMock.mockResolvedValueOnce(null);

    const limit = expectedValidConfig.inputValidationFailedAttemptsLimit;

    (service as any).getFailedIdentifierVerifyAttempts = vi
      .fn()
      .mockResolvedValue(Array.from({ length: limit - 1 }, () => Date.now() - 1000));

    const ctx: HandlerPayload = {
      engagementId: 'e10',
      gvaId: 'g10',
      messageType: 'text',
      text: 'nope',
      customJourneyContext: JSON.stringify({
        STEP: GVAGoalSteps.VALIDATE_PIN,
        memberNumber: '111222',
      }),
    } as any;

    const res = await service.validatePin(ctx);

    expect(res.isFinalStep).toBe(true);
    expect(res.responseId).toBe(expectedValidConfig.gvaGoals.pinAttemptExceeded);
    expect(transferToQueueMock).toHaveBeenCalled();
  });
});
