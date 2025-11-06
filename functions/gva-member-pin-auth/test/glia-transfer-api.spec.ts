import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GliaTransferApi } from '../src/apis/glia-transfer-api';
import { expectedValidConfig } from './mock-data';

const mockedFetch = vi.fn();
const mockedLogger = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
};

vi.mock('../src/apis/data-dog-api.ts', () => ({
  dataDogMetric: vi.fn(),
}));

vi.mock('../src/apis/http-request', async (importOriginal) => {
  const { HttpRequest } = (await importOriginal()) as any;
  return {
    HttpRequest: class extends HttpRequest {
      constructor() {
        super(expectedValidConfig, mockedLogger);
      }
      fetchWithRetry = mockedFetch;
    },
  };
});

describe('GliaTransferApi', () => {
  let api: GliaTransferApi;

  beforeEach(() => {
    vi.resetAllMocks();
    api = new GliaTransferApi(expectedValidConfig as any, mockedLogger as any);
  });

  it('transferToQueue → POSTs to /transfer_tickets with correct headers/body and returns payload', async () => {
    const responsePayload = { ok: true, payload: { ticket_id: 't-123' } };
    mockedFetch.mockResolvedValueOnce(responsePayload);

    const token = 'token-abc';
    const engagementId = 'eng-1';
    const media = 'text';

    const result = await api.transferToQueue(token, engagementId, media);

    expect(result).toEqual(responsePayload);

    expect(mockedFetch).toHaveBeenCalledTimes(1);
    const [calledUrl, calledOptions, methodName] = mockedFetch.mock.calls[0];

    expect(calledUrl).toBe(`${expectedValidConfig.glia.apiDomain}/transfer_tickets`);
    expect(methodName).toBe('transferToQueue');

    expect(calledOptions.method).toBe('POST');
    expect(calledOptions.headers.get('Content-Type')).toBe('application/json');
    expect(calledOptions.headers.get('authorization')).toBe(`Bearer ${token}`);

    const body = JSON.parse(calledOptions.body);
    expect(body).toEqual({
      engagement_id: engagementId,
      media,
      queue_id: expectedValidConfig.glia.liveOperatorQueueID,
    });
  });

  it('transferToQueue → throws if fetchWithRetry rejects', async () => {
    mockedFetch.mockRejectedValueOnce(new Error('network down'));

    await expect(api.transferToQueue('tok', 'eng-2', 'audio')).rejects.toThrow('network down');

    expect(mockedFetch).toHaveBeenCalledTimes(1);
  });
});
