import { describe, it, expect } from 'vitest';
import { validateConfig } from '../src/config';
import { expectedValidConfig, validEnv } from './mock-data';

describe('validateConfig', () => {
  it('returns status true and correct data for valid env', () => {
    const result = validateConfig(validEnv);
    expect(result.status).toBe(true);
    if (result.status) {
      expect(result.output).toEqual(expectedValidConfig);
      expect(result.output.glia.apiDomain).toBe(validEnv.GLIA_API_DOMAIN);
    }
  });

  it('returns status false if required field missing (DD_API_KEY)', () => {
    const { DD_API_KEY, ...env } = validEnv as Record<string, unknown>;
    const result = validateConfig(env);
    expect(result.status).toBe(false);
    if (!result.status) {
      expect(result.message || '').toMatch(/DD_API_KEY/i);
    }
  });

  it('treats empty DD_API_KEY as valid per schema (empty string passes through)', () => {
    const env = { ...validEnv, DD_API_KEY: '' } as Record<string, unknown>;
    const result = validateConfig(env);
    expect(result.status).toBe(true);
    if (result.status) {
      expect(result.output.dataDog.ddApiKey).toBe('');
    }
  });

  it('returns status true and applies defaults when optional fields are missing', () => {
    const { CALL_RETRIES, IS_DEV_MOD, REQUEST_TIMEOUT, RETRY_DELAY, ...env } = validEnv as Record<string, unknown>;

    const result = validateConfig(env);
    expect(result.status).toBe(true);

    if (result.status) {
      const expectedWithDefaults = {
        ...expectedValidConfig,
        callRetries: 3,
        requestTimeout: 5000,
        retryDelay: 3000,
        dataDog: {
          ...expectedValidConfig.dataDog,
          callRetries: 3,
          requestTimeout: 5000,
          retryDelay: 3000,
          isDevMode: false,
        },
      };

      expect(result.output).toEqual(expectedWithDefaults);
      expect(result.output.callRetries).toBe(3);
      expect(result.output.requestTimeout).toBe(5000);
      expect(result.output.retryDelay).toBe(3000);
      expect(result.output.dataDog.isDevMode).toBe(false);
      expect(result.output.dataDog.callRetries).toBe(3);
      expect(result.output.dataDog.requestTimeout).toBe(5000);
      expect(result.output.dataDog.retryDelay).toBe(3000);
    }
  });

  it('parses gliaAI.stopSequences correctly (missing → invalid, empty → [], trimming & filtering)', () => {
    const { GLIA_AI_STOP_SEQUENCES, ...envNoStops } = validEnv as Record<string, unknown>;
    const resMissing = validateConfig(envNoStops);
    expect(resMissing.status).toBe(false);
    if (!resMissing.status) {
      expect(resMissing.message || '').toMatch(/GLIA_AI_STOP_SEQUENCES/i);
    }

    const envEmptyStops = { ...validEnv, GLIA_AI_STOP_SEQUENCES: '' };
    const resEmpty = validateConfig(envEmptyStops);
    expect(resEmpty.status).toBe(true);
    if (resEmpty.status) {
      expect(resEmpty.output.gliaAI.stopSequences).toEqual([]);
    }

    const envMessyStops = { ...validEnv, GLIA_AI_STOP_SEQUENCES: ' A ,  B , ,  C  ' };
    const resMessy = validateConfig(envMessyStops);
    expect(resMessy.status).toBe(true);
    if (resMessy.status) {
      expect(resMessy.output.gliaAI.stopSequences).toEqual(['A', 'B', 'C']);
    }
  });
});
