import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { validateSchemaMock } = vi.hoisted(() => ({
  validateSchemaMock: vi.fn(),
}));

vi.mock('../src/validator', () => ({
  validateSchema: validateSchemaMock,
}));

vi.mock('../src/schemas', () => ({
  BaseRequestPayloadSchema: { __mock: 'BaseRequestPayloadSchema' },
}));

import { validatePayload } from '../src/request-validator';

describe('validatePayload (current implementation)', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('delegates to validateSchema with correct schema, body and prefix', async () => {
    const body = { foo: 'bar', num: 1 };
    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

    const validatorResult = { status: true, output: { ok: true } } as const;
    validateSchemaMock.mockReturnValueOnce(validatorResult);

    const res = await validatePayload(req);

    expect(validateSchemaMock).toHaveBeenCalledTimes(1);
    const [schemaArg, dataArg, prefixArg] = validateSchemaMock.mock.calls[0];
    expect(schemaArg).toEqual({ __mock: 'BaseRequestPayloadSchema' });
    expect(dataArg).toEqual(body);
    expect(prefixArg).toBe('Request Payload validation');

    expect(res).toBe(validatorResult);
  });

  it('returns validator error as-is when validateSchema fails', async () => {
    const body = { a: 1 };
    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

    const validatorError = { status: false, message: 'Validation failed' } as const;
    validateSchemaMock.mockReturnValueOnce(validatorError);

    const res = await validatePayload(req);

    expect(validateSchemaMock).toHaveBeenCalledTimes(1);
    expect(res).toEqual(validatorError);
  });

  it('returns status=false and logs when request.json throws (invalid JSON)', async () => {
    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'not-json',
    });

    const res = await validatePayload(req);

    expect(validateSchemaMock).not.toHaveBeenCalled();

    expect(res.status).toBe(false);
    if (!res.status) {
      expect(res.message).toMatch(/^Invalid payload:/);
    }
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringMatching(/^Invalid payload:/));
  });
});
