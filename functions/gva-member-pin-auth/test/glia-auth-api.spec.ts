import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GliaAuthApi } from '../src/apis/glia-auth-api';
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

// Replace HttpRequest so that fetchWithRetry = mockedFetch
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

describe('GliaAuthApi', () => {
  let api: GliaAuthApi;

  beforeEach(() => {
    vi.resetAllMocks();
    api = new GliaAuthApi(expectedValidConfig as any, mockedLogger as any);
  });

  it('fetchUserBearerToken → POSTs to /operator_authentication/tokens and returns payload', async () => {
    const responsePayload = { ok: true, payload: { token: 'user-token-xyz' } };
    mockedFetch.mockResolvedValueOnce(responsePayload);

    const result = await api.fetchUserBearerToken();

    expect(result).toEqual(responsePayload);

    expect(mockedFetch).toHaveBeenCalledTimes(1);
    const [calledUrl, calledOptions, methodName] = mockedFetch.mock.calls[0];

    expect(calledUrl).toBe(`${expectedValidConfig.glia.apiDomain}/operator_authentication/tokens`);
    expect(methodName).toBe('fetchUserBearerToken');
    expect(calledOptions.method).toBe('POST');
    expect(calledOptions.headers.get('Content-Type')).toBe('application/json');
    expect(calledOptions.headers.get('Accept')).toBe('application/vnd.salemove.v1+json');

    const body = JSON.parse(calledOptions.body);
    expect(body.api_key_id).toBe(expectedValidConfig.glia.userApiKey);
    expect(body.api_key_secret).toBe(expectedValidConfig.glia.userApiKeySecret);
  });

  it('fetchUserBearerToken → throws if fetchWithRetry rejects', async () => {
    mockedFetch.mockRejectedValueOnce(new Error('Unauthorized'));
    await expect(api.fetchUserBearerToken()).rejects.toThrow('Unauthorized');
    expect(mockedFetch).toHaveBeenCalledTimes(1);
  });
});
