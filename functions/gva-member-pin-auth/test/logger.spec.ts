import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { LoggerWithDD } from '../src/logger';
import { dataDogLog } from '../src/apis';
import type { DataDogConfig } from '../src/types';

vi.mock('../src/apis', () => ({
  dataDogLog: vi.fn().mockResolvedValue(undefined),
}));

const baseConfig: DataDogConfig & { isDevMode: boolean } = {
  callRetries: 3,
  customer: 'testCustomer',
  ddApiKey: 'testApiKey',
  functionName: 'testFunction',
  isDevMode: false,
  requestTimeout: 5000,
  retryDelay: 100,
  siteId: 'site123',
  version: '1.0.0',
};

let errorSpy: ReturnType<typeof vi.spyOn>;
let infoSpy: ReturnType<typeof vi.spyOn>;
let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.clearAllMocks();
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  errorSpy.mockRestore();
  infoSpy.mockRestore();
  warnSpy.mockRestore();
});

describe('LoggerWithDD', () => {
  it('logs error and forwards to dataDogLog', async () => {
    const logger = new LoggerWithDD(baseConfig);
    const err = new Error('Some error');

    await logger.error('Error happened', err);

    expect(errorSpy).toHaveBeenCalledWith('ERROR: Error happened', err);
    expect(dataDogLog).toHaveBeenCalledWith(expect.objectContaining({ ddApiKey: 'testApiKey', customer: 'testCustomer' }), {
      message: 'Error happened',
      status: 'error',
    });
  });

  it('logs info and forwards to dataDogLog', async () => {
    const logger = new LoggerWithDD(baseConfig);

    await logger.info('Information here');

    expect(infoSpy).toHaveBeenCalledWith('INFO: Information here');
    expect(dataDogLog).toHaveBeenCalledWith(expect.objectContaining({ functionName: 'testFunction', siteId: 'site123' }), {
      message: 'Information here',
      status: 'info',
    });
  });

  it('logs warn and forwards to dataDogLog', async () => {
    const logger = new LoggerWithDD(baseConfig);

    await logger.warn('Warning issued');

    expect(warnSpy).toHaveBeenCalledWith('WARN: Warning issued');
    expect(dataDogLog).toHaveBeenCalledWith(expect.objectContaining({ version: '1.0.0' }), { message: 'Warning issued', status: 'warn' });
  });

  it('skips dataDogLog in dev mode', async () => {
    const logger = new LoggerWithDD({ ...baseConfig, isDevMode: true });

    await logger.info('Dev message');

    expect(infoSpy).toHaveBeenCalledWith('INFO: Dev message');
    expect(dataDogLog).not.toHaveBeenCalled();
  });

  it('default branch: unknown status uses console.info and still forwards to DD (when not dev)', async () => {
    const logger = new LoggerWithDD(baseConfig);

    await (logger as any).log('debug', 'Debug message');

    expect(infoSpy).toHaveBeenCalledWith('DEBUG: Debug message');
    expect(dataDogLog).toHaveBeenCalledWith(
      expect.any(Object),
      { message: 'Debug message', status: 'debug' as any }, // runtime path
    );
  });

  it('constructor defaults isDevMode to false when undefined (and forwards to DD)', async () => {
    const cfg = { ...baseConfig, isDevMode: undefined as unknown as boolean };
    const logger = new LoggerWithDD(cfg);

    await logger.info('Msg');

    expect(infoSpy).toHaveBeenCalledWith('INFO: Msg');
    expect(dataDogLog).toHaveBeenCalled();
  });
});
