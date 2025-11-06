import { describe, it, expect, beforeEach, vi } from 'vitest';
import { onInvoke } from '../src/function';
import * as configFile from '../src/config';
import * as requestValidatorFile from '../src/request-validator';
import { expectedValidConfig } from './mock-data';
import { CatalogErrors } from '../src/catalog-errors';

const mockLogger = {
  info: vi.fn().mockResolvedValue(undefined),
  error: vi.fn().mockResolvedValue(undefined),
};

const mockHandleRequest = vi.fn().mockResolvedValue({ status: true, data: { ok: true } });

vi.mock('../src/logger', () => ({
  LoggerWithDD: vi.fn().mockImplementation(() => mockLogger),
}));

vi.mock('../src/request-handler', () => ({
  RequestHandler: vi.fn().mockImplementation(() => {
    return {
      handleRequest: mockHandleRequest,
    };
  }),
}));

const mockRequest = new Request('http://localhost', {
  method: 'POST',
  body: JSON.stringify({ any: 'payload' }),
});

describe('onInvoke', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns error if config is invalid', async () => {
    vi.spyOn(configFile, 'validateConfig').mockReturnValueOnce({
      status: false,
      message: 'config broken',
    } as any);

    const res = await onInvoke(mockRequest, {});
    const json = (await res.json()) as any;

    expect(json.status).toBe(false);
    expect(json.message).toContain(CatalogErrors.FAILED_CONFIG);
    expect(json.message).toContain('config broken');

    expect(json.message).toContain('Provided config(envs) is invalid');
    expect(json.message).toContain('config broken');
    expect((await import('../src/logger')).LoggerWithDD).not.toHaveBeenCalled();
  });

  it('returns error if payload is invalid', async () => {
    vi.spyOn(configFile, 'validateConfig').mockReturnValueOnce({
      status: true,
      output: expectedValidConfig,
    } as any);

    vi.spyOn(requestValidatorFile, 'validatePayload').mockResolvedValueOnce({
      status: false,
      message: 'invalid payload',
    } as any);

    const res = await onInvoke(mockRequest, {});
    const json = (await res.json()) as any;

    expect(mockLogger.info).toHaveBeenCalledWith('--------Received request---------');
    expect(mockLogger.error).toHaveBeenCalledWith(`${CatalogErrors.FAILED_PAYLOAD}: invalid payload`);

    expect(json.status).toBe(false);
    expect(json.error).toEqual(`${CatalogErrors.FAILED_PAYLOAD}: invalid payload`);
  });

  it('handles valid config and payload', async () => {
    vi.spyOn(configFile, 'validateConfig').mockReturnValueOnce({
      status: true,
      output: expectedValidConfig,
    } as any);

    const validatedPayload = { foo: 'bar' };
    vi.spyOn(requestValidatorFile, 'validatePayload').mockResolvedValueOnce({
      status: true,
      output: validatedPayload,
    } as any);

    mockHandleRequest.mockResolvedValueOnce({ status: true, data: { processed: true } });

    const res = await onInvoke(mockRequest, {});
    const json = await res.json();

    expect(json).toEqual({ status: true, data: { processed: true } });

    expect(mockLogger.info).toHaveBeenNthCalledWith(1, '--------Received request---------');
    expect(mockLogger.info).toHaveBeenNthCalledWith(2, '--------Request processed---------');

    expect(mockHandleRequest).toHaveBeenCalledWith(validatedPayload);
  });
});
