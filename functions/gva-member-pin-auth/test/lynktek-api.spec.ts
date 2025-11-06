import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { LoggerInterface } from '../src/types';
import { expectedValidConfig } from './mock-data';

import { LynktekApi } from '../src/apis/lynktek-api';

const mockLogger: LoggerInterface = {
  info: vi.fn().mockResolvedValue(undefined),
  error: vi.fn().mockResolvedValue(undefined),
  warn: vi.fn().mockResolvedValue(undefined),
};

const fetchWithRetrySpy = vi.fn();

vi.mock('../src/apis/http-request', () => {
  return {
    HttpRequest: vi.fn().mockImplementation(() => {
      return {
        fetchWithRetry: fetchWithRetrySpy,
      };
    }),
  };
});

vi.mock('../src/apis/data-dog-api', () => ({
  dataDogMetric: vi.fn(),
}));

describe('LynktekApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('verifyMemberExists: calls fetchWithRetry with correct URL, headers, body and functionName', async () => {
    const api = new LynktekApi(expectedValidConfig, mockLogger);

    fetchWithRetrySpy.mockResolvedValueOnce({ status: true, data: { exists: true } });

    const idValue = '615958709';
    const res = await api.verifyMemberExists(idValue);

    expect(res).toEqual({ status: true, data: { exists: true } });

    expect(fetchWithRetrySpy).toHaveBeenCalledTimes(1);
    const [url, requestOptions, functionName] = fetchWithRetrySpy.mock.calls[0];

    expect(url).toBe(`${expectedValidConfig.lynktekConfig.lynktekApiDomain}/auth/pin`);
    expect(functionName).toBe('verifyMemberExists');

    const { headers, method, body } = requestOptions as RequestInit & { body: string };
    expect(method).toBe('POST');
    expect(headers).toBeInstanceOf(Headers);
    expect((headers as Headers).get('Content-Type')).toBe('application/json');
    expect((headers as Headers).get('X-GVA-API-Key')).toBe(expectedValidConfig.lynktekConfig.lynktekApiHeader);

    const parsed = JSON.parse(body);
    expect(parsed).toEqual({
      identifiers: [
        {
          idType: 'MEMBER_NUMBER',
          idValue,
        },
      ],
    });
  });

  it('verifyMemberPin: calls fetchWithRetry with correct URL, headers, body and functionName', async () => {
    const api = new LynktekApi(expectedValidConfig, mockLogger);

    fetchWithRetrySpy.mockResolvedValueOnce({ status: true, data: { pinValid: true } });

    const idValue = '615958709';
    const pin = '1234';
    const res = await api.verifyMemberPin(idValue, pin);

    expect(res).toEqual({ status: true, data: { pinValid: true } });

    expect(fetchWithRetrySpy).toHaveBeenCalledTimes(1);
    const [url, requestOptions, functionName] = fetchWithRetrySpy.mock.calls[0];

    expect(url).toBe(`${expectedValidConfig.lynktekConfig.lynktekApiDomain}/auth/pin/verify`);
    expect(functionName).toBe('verifyMemberPin');

    const { headers, method, body } = requestOptions as RequestInit & { body: string };
    expect(method).toBe('POST');
    expect(headers).toBeInstanceOf(Headers);
    expect((headers as Headers).get('Content-Type')).toBe('application/json');
    expect((headers as Headers).get('X-GVA-API-Key')).toBe(expectedValidConfig.lynktekConfig.lynktekApiHeader);

    const parsed = JSON.parse(body);
    expect(parsed).toEqual({
      identifiers: [
        {
          idType: 'MEMBER_NUMBER',
          idValue,
        },
      ],
      pin: Number(pin),
    });
  });

  it('propagates errors from HttpRequest.fetchWithRetry', async () => {
    const api = new LynktekApi(expectedValidConfig, mockLogger);

    fetchWithRetrySpy.mockRejectedValueOnce(new Error('network fail'));

    await expect(api.verifyMemberExists('111222333')).rejects.toThrow('network fail');
    expect(fetchWithRetrySpy).toHaveBeenCalledTimes(1);
  });
});
