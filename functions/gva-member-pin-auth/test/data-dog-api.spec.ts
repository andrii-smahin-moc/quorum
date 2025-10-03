import { beforeEach, describe, expect, it, vi } from 'vitest';
import { dataDogLog, dataDogMetric, parseResponse, postRequest } from '../src/apis/data-dog-api';

const jsonHeaders = new Headers({ 'content-type': 'application/json' });
const textHeaders = new Headers({ 'content-type': 'text/plain' });

const makeResp = (status: number, ok: boolean, body: any, headers: Headers) => ({
  status,
  ok,
  statusText: ok ? 'OK' : 'Bad',
  headers,
  json: async () => (typeof body === 'string' ? JSON.parse(body) : body),
  text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
});

let errorSpy: any;
const mockedFetch = vi.fn();

beforeEach(() => {
  globalThis.fetch = mockedFetch;
  mockedFetch.mockReset();
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('parseResponse', () => {
  it('returns JSON when content-type is application/json', async () => {
    const res: any = makeResp(200, true, { a: 1 }, jsonHeaders);
    await expect(parseResponse(res)).resolves.toEqual({ a: 1 });
  });

  it('returns text when content-type is not JSON', async () => {
    const res: any = makeResp(200, true, 'ok', textHeaders);
    await expect(parseResponse(res)).resolves.toBe('ok');
  });
});
describe('postRequest', () => {
  const url = 'https://example.test/hit';
  const headers = new Headers({ 'content-type': 'application/json' });
  const fastOpts = { callRetries: 3, requestTimeout: 0, retryDelay: 0 };

  it('returns parsed response on first success', async () => {
    mockedFetch.mockResolvedValueOnce(makeResp(200, true, { ok: true }, jsonHeaders));

    const out = await postRequest(fastOpts, { data: { x: 1 }, headers, url });
    expect(out).toEqual({ ok: true });
    expect(mockedFetch).toHaveBeenCalledTimes(1);
  });

  it('stops immediately on 4xx (400..428) and throws final error', async () => {
    mockedFetch.mockResolvedValueOnce(makeResp(400, false, { msg: 'bad' }, jsonHeaders));

    await expect(postRequest({ ...fastOpts, callRetries: 1 }, { data: {}, headers, url })).rejects.toMatchObject({
      message: 'Max retry attempts reached. Operation failed.',
    });
    expect(errorSpy).toHaveBeenCalled();
  });

  it('retries on network Error then throws original error message when max reached', async () => {
    mockedFetch.mockRejectedValueOnce(new Error('boom')).mockRejectedValueOnce(new Error('boom'));

    await expect(postRequest({ ...fastOpts, callRetries: 2 }, { data: {}, headers, url })).rejects.toMatchObject({ message: 'boom' });
  });

  it('retries on non-Error rejection and throws Unknown error', async () => {
    mockedFetch.mockRejectedValueOnce('oops').mockRejectedValueOnce('oops');

    await expect(postRequest({ ...fastOpts, callRetries: 2 }, { data: {}, headers, url })).rejects.toMatchObject({
      message: 'Unknown error',
    });
  });

  it('keeps retrying on 5xx and ultimately throws Unexpected failure from loop end', async () => {
    mockedFetch.mockResolvedValue(makeResp(500, false, { err: true }, jsonHeaders));

    await expect(postRequest({ ...fastOpts, callRetries: 2 }, { data: {}, headers, url })).rejects.toThrow(
      'Unexpected failure in postRequest retry loop.',
    );
  });
});

describe('dataDog wrappers', () => {
  const cfg: any = {
    ddApiKey: 'k',
    customer: 'cust',
    siteId: 'site',
    functionName: 'fn',
    version: 'v1',
    callRetries: 1,
    requestTimeout: 0,
    retryDelay: 0,
  };

  it('dataDogLog posts payload with correct headers and url', async () => {
    mockedFetch.mockResolvedValueOnce(makeResp(202, true, {}, jsonHeaders));

    await expect(dataDogLog(cfg, { message: 'hello', status: 'info' })).resolves.not.toThrow();

    expect(mockedFetch).toHaveBeenCalledTimes(1);
    const [calledUrl, init] = mockedFetch.mock.calls[0];
    expect(calledUrl).toBe('https://http-intake.logs.datadoghq.com/api/v2/logs');
    expect(init.method).toBe('POST');
    expect(init.headers.get('DD-API-KEY')).toBe('k');
    const body = JSON.parse(init.body);
    expect(body.message).toBe('hello');
    expect(body.ddtags).toContain('customer:cust');
    expect(body.ddtags).toContain('site_id:site');
    expect(body.ddtags).toContain('function:fn');
    expect(body.ddtags).toContain('version:v1');
  });

  it('dataDogLog logs error on failure (no throw)', async () => {
    mockedFetch.mockRejectedValueOnce(new Error('down'));
    await expect(dataDogLog(cfg, { message: 'x', status: 'error' })).resolves.not.toThrow();
    expect(errorSpy).toHaveBeenCalledWith('DATADOG Log Error:', expect.any(Error));
  });

  it('dataDogMetric posts metric series with tags', async () => {
    mockedFetch.mockResolvedValueOnce(makeResp(202, true, {}, jsonHeaders));

    await expect(dataDogMetric(cfg, { metricName: 'test.metric', statusCode: 201 })).resolves.not.toThrow();

    const [calledUrl, init] = mockedFetch.mock.calls[0];
    expect(calledUrl).toBe('https://api.datadoghq.com/api/v2/series');
    const body = JSON.parse(init.body);
    expect(body.series[0].metric).toBe('cust.test.metric.invocations');
    const tags: string[] = body.series[0].tags;
    expect(tags).toEqual(expect.arrayContaining(['customer:cust', 'site_id:site', 'function:fn', 'version:v1', 'status_code:201']));
  });

  it('dataDogMetric logs error on failure (no throw)', async () => {
    mockedFetch.mockRejectedValueOnce('kaput');
    await expect(dataDogMetric(cfg, { metricName: 'm', statusCode: 500 })).resolves.not.toThrow();
    expect(errorSpy).toHaveBeenCalledWith('DATADOG REQUEST Error (Attempt 1):', 'kaput');
  });
});
