import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HttpRequest } from '../src/apis/http-request';
import { expectedValidConfig } from './mock-data';
import type { LoggerInterface } from '../src/types';

vi.mock('../src/apis/data-dog-api', () => ({ dataDogMetric: vi.fn() }));

const mockedFetch = vi.fn();
const mockedLogger: LoggerInterface = {
  info: vi.fn().mockResolvedValue(undefined),
  error: vi.fn().mockResolvedValue(undefined),
  warn: vi.fn().mockResolvedValue(undefined),
};

describe('HttpRequest (optimized, type-safe)', () => {
  beforeEach(() => vi.clearAllMocks());

  const base = new HttpRequest(expectedValidConfig, mockedLogger, {}, mockedFetch);

  const jsonResponse = (body: any, ok = true, status = 200) => ({
    ok,
    status,
    headers: new Headers({ 'content-type': 'application/json' }),
    text: async () => JSON.stringify(body),
  });

  it('should handle success, empty, and text responses', async () => {
    mockedFetch.mockResolvedValueOnce(jsonResponse({ status: 'ok' }));
    const ok = await base.fetchWithRetry('ok', {}, 'fn');
    expect(ok.ok).toBe(true);
    expect(ok.statusCode).toBe(200);
    expect(ok.payload).toEqual({ status: 'ok' });

    mockedFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json', 'content-length': '0' }),
      text: async () => '',
    });
    const empty = await base.fetchWithRetry('empty', {}, 'fn');
    expect(empty.ok).toBe(true);
    expect(empty.payload).toBeNull();

    mockedFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({}),
      text: async () => 'plain text',
    });
    const text = await base.fetchWithRetry('text', {}, 'fn');
    expect(text.ok).toBe(true);
    expect(text.payload).toBe('plain text');
  });

  it('should handle client (400) and server (5xx) errors properly', async () => {
    mockedFetch.mockResolvedValueOnce(jsonResponse({ status: 'error' }, false, 400));
    const bad = await base.fetchWithRetry('bad', {}, 'fn');
    expect(bad.ok).toBe(false);
    expect(bad.statusCode).toBe(400);
    expect(bad.payload).toBeNull();

    mockedFetch.mockResolvedValue(jsonResponse({ error: 'server down' }, false, 503));
    const srv = await base.fetchWithRetry('srv', {}, 'fn');
    expect(srv.ok).toBe(false);
    expect(srv.statusCode).toBe(503);
    expect(srv.payload).toBeNull();
  });

  it('should retry once on 429 and then succeed', async () => {
    const fail = { status: 'busy' };
    const ok = { status: 'ok' };

    mockedFetch.mockResolvedValueOnce(jsonResponse(fail, false, 429)).mockResolvedValueOnce(jsonResponse(ok, true, 200));

    const res = await base.fetchWithRetry('retry', {}, 'fn');
    expect(res.ok).toBe(true);
    expect(res.statusCode).toBe(200);
    expect(mockedFetch).toHaveBeenCalledTimes(2);
  });

  it('should stop retry early for non-retirable status code', async () => {
    const fail = { status: 'service unavailable' };
    const inst = new HttpRequest(expectedValidConfig, mockedLogger, { nonRetirableStatusCodes: [503] }, mockedFetch);

    mockedFetch.mockResolvedValueOnce(jsonResponse(fail, false, 503));

    const res = await inst.fetchWithRetry('no-retry', {}, 'fn');
    expect(res.ok).toBe(false);
    expect(res.statusCode).toBe(503);
    expect(mockedFetch).toHaveBeenCalledTimes(1);
  });

  it('should handle thrown network errors and final retry fallback', async () => {
    mockedFetch.mockRejectedValue(new Error('ECONNRESET'));
    const res = await base.fetchWithRetry('net', {}, 'fn');
    expect(res.ok).toBe(false);
    expect(res.payload).toBeNull();
    expect(res.statusCode).toBe(500);
    expect(mockedLogger.error).toHaveBeenCalled();
  });

  it('should handle aborted request gracefully', async () => {
    const abortErr = new Error('aborted manually');
    abortErr.name = 'AbortError';
    mockedFetch.mockRejectedValueOnce(abortErr);

    const res = await base.fetchWithRetry('abort', {}, 'fn');
    expect(res.ok).toBe(false);
    expect(res.statusCode).toBe(500);
    expect(res.payload).toBeNull();
  });

  it('should handle immediate sync throw (undefined lastError fallback)', async () => {
    const singleRetryConfig = { ...expectedValidConfig, callRetries: 1 };
    const req = new HttpRequest(singleRetryConfig, mockedLogger, {}, mockedFetch);

    mockedFetch.mockImplementationOnce(() => {
      throw new Error('Immediate failure');
    });

    const res = await req.fetchWithRetry('sync', {}, 'fn');
    expect(res.ok).toBe(false);
    expect(res.payload).toBeNull();
    expect(res.statusCode).toBe(500);
  });
});
