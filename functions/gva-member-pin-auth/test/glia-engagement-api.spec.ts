import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { LoggerInterface } from '../src/types';
import { expectedValidConfig } from './mock-data';
import { GliaEngagementApi } from '../src/apis/glia-engagement-api';

const fetchWithRetrySpy = vi.fn();

const mockLogger: LoggerInterface = {
  info: vi.fn().mockResolvedValue(undefined),
  error: vi.fn().mockResolvedValue(undefined),
  warn: vi.fn().mockResolvedValue(undefined),
};

vi.mock('../src/apis/http-request', () => ({
  HttpRequest: vi.fn().mockImplementation(() => ({
    fetchWithRetry: fetchWithRetrySpy,
  })),
}));

describe('GliaEngagementApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetchEngagementDetails: calls fetchWithRetry with correct URL, headers, and functionName', async () => {
    const api = new GliaEngagementApi(expectedValidConfig as any, mockLogger);

    const mockResponse = { status: true, data: { id: 'abc123', engagement_type: 'reactive' } };
    fetchWithRetrySpy.mockResolvedValueOnce(mockResponse);

    const token = 'test-token-123';
    const engagementId = 'abc12121-e888-43ae-99e0-07a676e9a111';

    const res = await api.fetchEngagementDetails(token, engagementId);

    expect(res).toEqual(mockResponse);

    expect(fetchWithRetrySpy).toHaveBeenCalledTimes(1);

    const [url, requestOptions, functionName] = fetchWithRetrySpy.mock.calls[0];
    expect(url).toBe(`${expectedValidConfig.glia.apiDomain}/engagements/${engagementId}`);
    expect(functionName).toBe('fetchEngagementDetails');

    const { headers, method } = requestOptions as RequestInit;
    expect(method).toBe('GET');
    expect(headers).toBeInstanceOf(Headers);
    expect((headers as Headers).get('Content-Type')).toBe('application/json');
    expect((headers as Headers).get('authorization')).toBe(`Bearer ${token}`);
  });

  it('propagates errors from HttpRequest.fetchWithRetry', async () => {
    const api = new GliaEngagementApi(expectedValidConfig as any, mockLogger);
    fetchWithRetrySpy.mockRejectedValueOnce(new Error('network failure'));

    await expect(api.fetchEngagementDetails('bad-token', 'id123')).rejects.toThrow('network failure');
    expect(fetchWithRetrySpy).toHaveBeenCalledTimes(1);
  });
});
