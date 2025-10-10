import { describe, it, expect, vi, beforeEach } from 'vitest';

const verifyMemberExistsMock = vi.fn();
const verifyMemberPinMock = vi.fn();
vi.mock('../src/apis', () => ({
  QuorumApi: vi.fn().mockImplementation(() => ({
    verifyMemberExists: verifyMemberExistsMock,
    verifyMemberPin: verifyMemberPinMock,
  })),
}));

const detectMock = vi.fn();
vi.mock('../src/services/answer-detector-service', () => ({
  AnswerDetectorService: vi.fn().mockImplementation(() => ({
    detect: detectMock,
  })),
}));

const kvFactory = {
  initializeKvStore: vi.fn(() => ({
    get: vi.fn(),
    set: vi.fn().mockResolvedValue(undefined),
  })),
};

import { GVAGoalService, GVAGoalSteps, AnswerOptionsList } from '../src/services/gva-goal-service';
import type { HandlerPayload, LoggerInterface } from '../src/types';
import { expectedValidConfig } from './mock-data';

const logger: LoggerInterface = {
  info: vi.fn().mockResolvedValue(undefined),
  warn: vi.fn().mockResolvedValue(undefined),
  error: vi.fn().mockResolvedValue(undefined),
};

const makeService = () => new GVAGoalService(expectedValidConfig as any, logger, kvFactory as any);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GVAGoalService', () => {
  it('initialStep → ставити STEP=VALIDATE_MEMBER_NUMBER і returns needToAuthentication', async () => {
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

  it('validateMemberNumber → sucsess: number detect + Quorum confirms that exists → STEP=VALIDATE_PIN, response=enterAPin', async () => {
    const service = makeService();
    detectMock.mockResolvedValueOnce({
      name: AnswerOptionsList.MEMBER_NUMBER,
      matchedText: '12345678',
    });
    verifyMemberExistsMock.mockResolvedValueOnce({ ok: true });

    const ctx: HandlerPayload = {
      engagementId: 'e2',
      gvaId: 'g2',
      messageType: 'text',
      text: 'my number is 12345678',
      customJourneyContext: JSON.stringify({ failedAttempts: 1 }),
    } as any;

    const res = await service.validateMemberNumber(ctx);

    expect(verifyMemberExistsMock).toHaveBeenCalledWith('12345678');
    expect(res.responseId).toBe(expectedValidConfig.gvaGoals.enterAPin);

    const cjc = res.customJourneyContext as any;
    expect(cjc.memberNumber).toBe('12345678');
    expect(cjc.failedAttempts).toBe(0);
    expect(cjc.STEP).toBe(GVAGoalSteps.VALIDATE_PIN);
  });

  it('validateMemberNumber → zero (ZERO_NUMBER) → final with the zeroPress', async () => {
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
  });

  it('validateMemberNumber → invalin num < limit → increment, response=invalidMemberNumber, STEP=VALIDATE_MEMBER_NUMBER', async () => {
    const service = makeService();
    detectMock.mockResolvedValueOnce(null);

    const ctx: HandlerPayload = {
      engagementId: 'e4',
      gvaId: 'g4',
      messageType: 'text',
      text: 'blah',
      customJourneyContext: JSON.stringify({ failedAttempts: 1 }),
    } as any;

    const res = await service.validateMemberNumber(ctx);

    expect(res.isFinalStep).toBe(false);
    expect(res.responseId).toBe(expectedValidConfig.gvaGoals.invalidMemberNumber);

    const cjc = res.customJourneyContext as any;
    expect(cjc.failedAttempts).toBe(2);
    expect(cjc.STEP).toBe(GVAGoalSteps.VALIDATE_MEMBER_NUMBER);
  });

  it('validateMemberNumber → invalid num with exiceeded limit → final transferToLiveOperator', async () => {
    const service = makeService();
    detectMock.mockResolvedValueOnce(null);

    const limit = expectedValidConfig.inputValidationFailedAttemptsLimit;
    const ctx: HandlerPayload = {
      engagementId: 'e5',
      gvaId: 'g5',
      messageType: 'text',
      text: 'meh',
      customJourneyContext: JSON.stringify({ failedAttempts: limit - 1 }),
    } as any;

    const res = await service.validateMemberNumber(ctx);

    expect(res.isFinalStep).toBe(true);
    expect(res.responseId).toBe(expectedValidConfig.gvaGoals.transferToLiveOperator);
  });

  it('validatePin → sucsess: detect PIN + Quorum returned token/expiresIn → final with success with auth', async () => {
    const service = makeService();
    detectMock.mockResolvedValueOnce({
      name: AnswerOptionsList.MEMBER_PIN,
      matchedText: '1234',
    });
    verifyMemberPinMock.mockResolvedValueOnce({ token: 'tok', expiresIn: '3600' });

    const ctx: HandlerPayload = {
      engagementId: 'e6',
      gvaId: 'g6',
      messageType: 'text',
      text: 'pin 1234',
      customJourneyContext: JSON.stringify({ STEP: GVAGoalSteps.VALIDATE_PIN, memberNumber: '12345678' }),
    } as any;

    const res = await service.validatePin(ctx);

    expect(verifyMemberPinMock).toHaveBeenCalledWith('12345678', '1234');
    expect(res.isFinalStep).toBe(true);
    expect(res.responseId).toBe(expectedValidConfig.gvaGoals.successfullyVerifiesMemberNumberAndPin);
    expect(res.auth).toEqual({ token: 'tok', expiresIn: 3600 });
  });

  it('validatePin → memberNumber missing → final with invalidMemberNumber', async () => {
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
  });

  it('validatePin → forgot the PIN” → final with forgotPin', async () => {
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
      customJourneyContext: JSON.stringify({ STEP: GVAGoalSteps.VALIDATE_PIN, memberNumber: '111222' }),
    } as any;

    const res = await service.validatePin(ctx);

    expect(res.isFinalStep).toBe(true);
    expect(res.responseId).toBe(expectedValidConfig.gvaGoals.forgotPin);
  });

  it('validatePin → invalid PIN < limit → increment, response=invalidPin, STEP=VALIDATE_PIN + responseData', async () => {
    const service = makeService();
    detectMock.mockResolvedValueOnce(null);

    const ctx: HandlerPayload = {
      engagementId: 'e9',
      gvaId: 'g9',
      messageType: 'text',
      text: 'abcd',
      customJourneyContext: JSON.stringify({
        STEP: GVAGoalSteps.VALIDATE_PIN,
        enterPinFailedAttempts: 1,
        memberNumber: '111222',
      }),
    } as any;

    const res = await service.validatePin(ctx);

    expect(res.isFinalStep).toBe(false);
    expect(res.responseId).toBe(expectedValidConfig.gvaGoals.invalidPin);

    const cjc = res.customJourneyContext as any;
    expect(cjc.enterPinFailedAttempts).toBe(2);
    expect(cjc.STEP).toBe(GVAGoalSteps.VALIDATE_PIN);

    expect(res.responseData).toEqual({
      pinAttemptLimit: expectedValidConfig.inputValidationFailedAttemptsLimit,
      pinAttemptNumber: 2,
    });
  });

  it('validatePin → invalid PIN with exided limit  → final pinAttemptExceeded', async () => {
    const service = makeService();
    detectMock.mockResolvedValueOnce(null);

    const limit = expectedValidConfig.inputValidationFailedAttemptsLimit;
    const ctx: HandlerPayload = {
      engagementId: 'e10',
      gvaId: 'g10',
      messageType: 'text',
      text: 'nope',
      customJourneyContext: JSON.stringify({
        STEP: GVAGoalSteps.VALIDATE_PIN,
        enterPinFailedAttempts: limit - 1,
        memberNumber: '111222',
      }),
    } as any;

    const res = await service.validatePin(ctx);

    expect(res.isFinalStep).toBe(true);
    expect(res.responseId).toBe(expectedValidConfig.gvaGoals.pinAttemptExceeded);
  });
});
