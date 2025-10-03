import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HttpRequest } from '../src/apis/http-request';
import { expectedValidConfig } from './mock-data';
import type { LoggerInterface } from '../src/types';

vi.mock('../src/data-dog-api', () => ({
  dataDogMetric: vi.fn(),
}));

const mockedFetch = vi.fn();

const mockedLogger: LoggerInterface = {
  info: vi.fn().mockResolvedValue(undefined),
  error: vi.fn().mockResolvedValue(undefined),
  warn: vi.fn().mockResolvedValue(undefined),
};

describe('HttpRequest.fetchWithRetry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const httpRequest = new HttpRequest(expectedValidConfig, mockedLogger, mockedFetch);

  it('returns JSON on success (application/json)', async () => {
    const body = JSON.stringify({ status: 'ok' });

    mockedFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({
        'content-type': 'application/json',
        'content-length': `${body.length}`,
      }),
      text: async () => body,
    });

    const result = await httpRequest.fetchWithRetry(
      'https://api.example/success-json',
      { headers: new Headers({ 'content-type': 'application/json' }) },
      'testFunction',
    );

    expect(result).toEqual({ status: 'ok' });
    expect(mockedFetch).toHaveBeenCalledTimes(1);
  });

  it('returns true on success with empty body / no declared content', async () => {
    mockedFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({
        'content-type': 'application/json',
        'content-length': '0',
      }),
      text: async () => '',
    });

    const result = await httpRequest.fetchWithRetry(
      'https://api.example/success-empty',
      { headers: new Headers({ 'content-type': 'application/json' }) },
      'testFunction',
    );

    expect(result).toBe(true);
    expect(mockedFetch).toHaveBeenCalledTimes(1);
  });

  it('returns raw text on success when content-type is text/plain', async () => {
    const body = 'hello world';
    mockedFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({
        'content-type': 'text/plain; charset=utf-8',
        'content-length': `${body.length}`,
      }),
      text: async () => body,
    });

    const result = await httpRequest.fetchWithRetry('https://api.example/success-text', { headers: new Headers() }, 'testFunction');

    expect(result).toBe('hello world');
    expect(mockedFetch).toHaveBeenCalledTimes(1);
  });

  it('throws for 4xx (except 429) without retries and logs error', async () => {
    const body = JSON.stringify({ error: 'bad' });
    mockedFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      headers: new Headers({
        'content-type': 'application/json',
        'content-length': `${body.length}`,
      }),
      text: async () => body,
    });

    await expect(httpRequest.fetchWithRetry('https://api.example/fail-400', { headers: new Headers() }, 'testFunction')).rejects.toThrow(
      'testFunction error! Status: 400',
    );

    expect(mockedFetch).toHaveBeenCalledTimes(1);
    expect(mockedLogger.error).toHaveBeenCalled();
  });

  it('retries on 429 and eventually succeeds', async () => {
    const failBody = JSON.stringify({ status: 'busy' });
    const okBody = JSON.stringify({ status: 'ok' });

    mockedFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      headers: new Headers({
        'content-type': 'application/json',
        'content-length': `${failBody.length}`,
      }),
      text: async () => failBody,
    });

    mockedFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({
        'content-type': 'application/json',
        'content-length': `${okBody.length}`,
      }),
      text: async () => okBody,
    });

    const result = await httpRequest.fetchWithRetry(
      'https://api.example/retry-then-ok',
      { headers: new Headers({ 'content-type': 'application/json' }) },
      'testFunction',
    );

    expect(result).toEqual({ status: 'ok' });
    expect(mockedFetch).toHaveBeenCalledTimes(2);
  });

  it('throws after max retries on 429 and logs final failure', async () => {
    const failBody = JSON.stringify({ status: 'fail' });

    mockedFetch.mockResolvedValue({
      ok: false,
      status: 429,
      headers: new Headers({
        'content-type': 'application/json',
        'content-length': `${failBody.length}`,
      }),
      text: async () => failBody,
    });

    await expect(httpRequest.fetchWithRetry('https://api.example/always-429', {}, 'testFunction')).rejects.toThrow(
      'Max retry attempts reached. Operation failed.',
    );

    expect(mockedFetch).toHaveBeenCalledTimes(expectedValidConfig.callRetries);
    expect(mockedLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('Max retry attempts reached for function testFunction. Operation failed.'),
    );
  });
});
