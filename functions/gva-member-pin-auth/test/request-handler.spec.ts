import { describe, it, expect, vi, beforeEach } from 'vitest';

const { parsePayloadMock, safeJSONParseMock, resolveMock, loggerMock } = vi.hoisted(() => ({
  parsePayloadMock: vi.fn(),
  safeJSONParseMock: vi.fn(),
  resolveMock: vi.fn(),
  loggerMock: {
    info: vi.fn().mockResolvedValue(undefined),
    error: vi.fn().mockResolvedValue(undefined),
    warn: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../src/constants', () => ({
  INITIAL_STEP: 'INIT_STEP',
}));

vi.mock('../src/services', () => {
  return {
    GVAGoalService: vi.fn().mockImplementation(() => ({
      parsePayload: parsePayloadMock,
      safeJSONParse: safeJSONParseMock,
      resolve: resolveMock,
    })),
  };
});

import { RequestHandler } from '../src/request-handler';
import { CatalogErrors } from '../src/catalog-errors';
import type { BaseRequestPayload, HandlerResult, HandlerPayload, KvStoreFactory } from '../src/types';
import { expectedValidConfig } from './mock-data';

// Provide a KvStoreFactory mock to satisfy constructor typing
const kvFactoryMock: KvStoreFactory = {
  initializeKvStore: vi.fn(() => ({
    get: vi.fn(async () => ({ value: '' })),
    set: vi.fn(async () => {}),
  })),
};

describe('RequestHandler.handleRequest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns error if parsePayload fails and logs it', async () => {
    const handler = new RequestHandler(expectedValidConfig, loggerMock, kvFactoryMock);

    parsePayloadMock.mockReturnValueOnce({ status: false, message: 'bad json' });

    const reqPayload: BaseRequestPayload = { payload: '{"oops": "}' } as any;
    const res = (await handler.handleRequest(reqPayload)) as any;

    expect(res.status).toBe(false);
    expect(res).toHaveProperty('error');
    expect(res.error).toContain(CatalogErrors.FAILED_GVA_PAYLOAD);
    expect(res.error).toContain('bad json');

    expect(loggerMock.error).toHaveBeenCalledWith(expect.stringContaining(CatalogErrors.FAILED_GVA_PAYLOAD));
  });

  it('parses customJourneyContext, selects STEP, resolves handler, logs, and stringifies customJourneyContext in response', async () => {
    const handler = new RequestHandler(expectedValidConfig, loggerMock, kvFactoryMock);

    const parsedPayload: HandlerPayload = {
      engagementId: 'e1',
      gvaId: 'gva1',
      messageType: 'text',
      text: 'hi',
      customJourneyContext: '{"STEP":"verifyPin","foo":1}',
    } as any;

    parsePayloadMock.mockReturnValueOnce({ status: true, output: parsedPayload });

    safeJSONParseMock.mockReturnValueOnce({
      status: true,
      output: { STEP: 'verifyPin', foo: 1 },
    });

    const stepResult: HandlerResult = {
      responseId: 'resp-123',
      isFinalStep: true,
      customJourneyContext: { bar: 2 },
      customPayload: {},
      responseData: {},
      transferToHuman: false,
    } as any;

    (stepResult as any).customJourneyContext = { bar: 2 };

    const stepHandler = vi.fn(async () => stepResult);
    resolveMock.mockReturnValueOnce(stepHandler);

    const reqPayload: BaseRequestPayload = { payload: '{"some":"json"}' } as any;
    const res = (await handler.handleRequest(reqPayload)) as any;

    expect(resolveMock).toHaveBeenCalledWith('verifyPin');
    expect(stepHandler).toHaveBeenCalledWith(parsedPayload);

    expect(loggerMock.info).toHaveBeenCalledWith('EngagementId: e1, GVA Step selected: verifyPin');
    expect(loggerMock.info).toHaveBeenCalledWith(expect.stringContaining('GVA Step result: responseId=resp-123'));

    expect(typeof res.customJourneyContext).toBe('string');
    expect(res.customJourneyContext).toBe(JSON.stringify({ bar: 2 }));
    expect(res.responseId).toBe('resp-123');
    expect(res.isFinalStep).toBe(true);
  });

  it('uses INITIAL_STEP when STEP is missing/non-string', async () => {
    const handler = new RequestHandler(expectedValidConfig, loggerMock, kvFactoryMock);

    const parsedPayload: HandlerPayload = {
      engagementId: 'e2',
      gvaId: 'gva2',
      messageType: 'text',
      text: 'hello',
      customJourneyContext: '{}',
    } as any;

    parsePayloadMock.mockReturnValueOnce({ status: true, output: parsedPayload });

    safeJSONParseMock.mockReturnValueOnce({ status: true, output: {} });

    const stepResult: HandlerResult = {
      responseId: 'r-init',
      isFinalStep: false,
      customJourneyContext: {},
      customPayload: {},
      responseData: {},
      transferToHuman: false,
    } as any;

    const stepHandler = vi.fn(async () => stepResult);
    resolveMock.mockReturnValueOnce(stepHandler);

    const reqPayload: BaseRequestPayload = { payload: '{"x":1}' } as any;
    const res = (await handler.handleRequest(reqPayload)) as any;

    expect(resolveMock).toHaveBeenCalledWith('INIT_STEP');
    expect(res.responseId).toBe('r-init');
  });

  it('returns error and logs when resolve/handler throws', async () => {
    const handler = new RequestHandler(expectedValidConfig, loggerMock, kvFactoryMock);

    const parsedPayload: HandlerPayload = {
      engagementId: 'e3',
      gvaId: 'gva3',
      messageType: 'text',
      text: 'go',
      customJourneyContext: '{"STEP":"boom"}',
    } as any;

    parsePayloadMock.mockReturnValueOnce({ status: true, output: parsedPayload });
    safeJSONParseMock.mockReturnValueOnce({ status: true, output: { STEP: 'boom' } });

    const stepHandler = vi.fn(async () => {
      throw new Error('handler broke');
    });
    resolveMock.mockReturnValueOnce(stepHandler);

    const reqPayload: BaseRequestPayload = { payload: '{"y":1}' } as any;
    const res = (await handler.handleRequest(reqPayload)) as any;

    expect(res.status).toBe(false);
    expect(res).toHaveProperty('error');
    expect(res.error).toContain(CatalogErrors.GOAL_PROCESSING_ERROR);
    expect(res.error).toContain('handler broke');

    expect(loggerMock.error).toHaveBeenCalledWith(expect.stringContaining(CatalogErrors.GOAL_PROCESSING_ERROR));
  });
});
