import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { LoggerInterface, HandlerPayload } from '../src/types';
import { expectedValidConfig } from './mock-data';

const mockLogger: LoggerInterface = {
  info: vi.fn().mockResolvedValue(undefined),
  warn: vi.fn().mockResolvedValue(undefined),
  error: vi.fn().mockResolvedValue(undefined),
};

const invokeModelSpy = vi.fn();

vi.mock('../src/services/glia-ai-service', () => {
  return {
    GliaAIService: vi.fn().mockImplementation(() => {
      return { invokeModel: invokeModelSpy };
    }),
  };
});

import { AnswerDetectorService } from '../src/services/answer-detector-service';

type MatchResult = { isMatched: boolean };
type AnswerOption = { name: string; match: (ctx: HandlerPayload) => MatchResult };

const possibleAnswers: AnswerOption[] = [
  {
    name: 'alreadyAuthenticated',
    match: (ctx) => ({ isMatched: !!ctx?.meta?.alreadyAuth }),
  },
  { name: 'enterAPin', match: () => ({ isMatched: false }) },
  { name: 'forgotPin', match: () => ({ isMatched: false }) },
];

describe('AnswerDetectorService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const makeService = (answers = possibleAnswers) => new AnswerDetectorService(expectedValidConfig as any, mockLogger, answers as any);

  it('returns local match when a possible answer matches (AI is not called)', async () => {
    const svc = makeService();
    const context: HandlerPayload = { text: 'blah', meta: { alreadyAuth: true } } as any;

    const res = await svc.detect(context);

    expect(res?.name).toBe('alreadyAuthenticated');
    expect(invokeModelSpy).not.toHaveBeenCalled();
    expect(mockLogger.info).not.toHaveBeenCalledWith('No local match found, invoking AI detection');
  });

  it.skip('invokes AI when no local match and returns option if confidence >= threshold and option exists', async () => {
    const svc = makeService();
    const context: HandlerPayload = { text: 'i forgot my pin', meta: {} } as any;

    invokeModelSpy.mockResolvedValueOnce(
      JSON.stringify({
        optionName: 'forgotPin',
        confidence: expectedValidConfig.gliaAI.detectConfidence + 0.1,
      }),
    );

    const res = await svc.detect(context);

    expect(mockLogger.info).toHaveBeenCalledWith('No local match found, invoking AI detection');
    expect(invokeModelSpy).toHaveBeenCalledTimes(1);

    const prompt = invokeModelSpy.mock.calls[0][0];
    expect(prompt).toContain('i forgot my pin');
    expect(prompt).toContain('alreadyAuthenticated');
    expect(prompt).toContain('enterAPin');
    expect(prompt).toContain('forgotPin');

    expect(res?.name).toBe('forgotPin');
    expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('AI detected option: forgotPin'));
  });

  it('returns null when AI confidence is below threshold', async () => {
    const svc = makeService();
    const context: HandlerPayload = { text: 'enter pin please', meta: {} } as any;

    invokeModelSpy.mockResolvedValueOnce(
      JSON.stringify({
        optionName: 'enterAPin',
        confidence: expectedValidConfig.gliaAI.detectConfidence - 0.01,
      }),
    );

    const res = await svc.detect(context);

    expect(res).toBeNull();
    expect(mockLogger.info).toHaveBeenCalledWith('No local match found, invoking AI detection');
    expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('AI detected option: enterAPin'));
  });

  it('returns null when AI returns option not in possibleAnswers', async () => {
    const svc = makeService();
    const context: HandlerPayload = { text: 'transfer me', meta: {} } as any;

    invokeModelSpy.mockResolvedValueOnce(
      JSON.stringify({
        optionName: 'transferToLiveOperator',
        confidence: expectedValidConfig.gliaAI.detectConfidence + 0.2,
      }),
    );

    const res = await svc.detect(context);

    expect(res).toBeNull();
    expect(mockLogger.info).toHaveBeenCalledWith('No local match found, invoking AI detection');
    expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('AI detected option: transferToLiveOperator'));
  });

  it('logs warn and returns null when AI returns invalid JSON', async () => {
    const svc = makeService();
    const context: HandlerPayload = { text: 'what now', meta: {} } as any;

    invokeModelSpy.mockResolvedValueOnce('this is not json');

    const res = await svc.detect(context);

    expect(res).toBeNull();
    expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Glia AI response could not be parsed as JSON'));
  });

  it('logs error and returns null when AI invocation throws', async () => {
    const svc = makeService();
    const context: HandlerPayload = { text: 'fail please', meta: {} } as any;

    invokeModelSpy.mockRejectedValueOnce(new Error('ai down'));

    const res = await svc.detect(context);

    expect(res).toBeNull();
    expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Error invoking Glia AI: ai down'));
  });

  it('returns null without calling AI when no local match and context.text is missing', async () => {
    const svc = makeService();
    const context: HandlerPayload = { text: '', meta: {} } as any;

    const res = await svc.detect(context);

    expect(res).toBeNull();
    expect(invokeModelSpy).not.toHaveBeenCalled();
    expect(mockLogger.info).not.toHaveBeenCalledWith('No local match found, invoking AI detection');
  });
});
