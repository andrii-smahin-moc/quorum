import { describe, it, expect } from 'vitest';
import { validateConfig } from '../src/config';
import { expectedValidConfig, validEnv } from './mock-data';

describe('validateConfig (config.ts)', () => {
  it('returns status true and correct data for valid env', () => {
    const result = validateConfig(validEnv);
    expect(result.status).toBe(true);
    if (result.status) {
      expect(result.output).toEqual(expectedValidConfig);
      expect(result.output.glia.apiDomain).toBe(validEnv.GLIA_API_DOMAIN);
      expect(result.output.dataDog.isDevMode).toBe(true);
      expect(result.output.gliaAI.stopSequences).toEqual(['END', 'STOP']);
    }
  });

  it('returns status false if required field missing (DD_API_KEY)', () => {
    const { DD_API_KEY, ...env } = validEnv;
    const result = validateConfig(env as any);
    expect(result.status).toBe(false);
    if (!result.status) {
      expect(result.message).toMatch(/DD_API_KEY/i);
    }
  });

  it('returns status false if VALIDATE_OTP_IDENTIFIER has invalid value', () => {
    const env = { ...validEnv, VALIDATE_OTP_IDENTIFIER: 'MEMBER_NUMBER' };
    const result = validateConfig(env);
    expect(result.status).toBe(false);
    if (!result.status) {
      expect(result.message).toMatch(/Invalid type/i);
      expect(result.message).toMatch(/received "MEMBER_NUMBER"/);

      expect(result.message).toMatch(/Invalid type: Expected .*CARD_NUMBER.* but received "MEMBER_NUMBER"/i);
    }
  });

  it('parses gliaAI.stopSequences correctly: empty → [], messy → ["A","B","C"]', () => {
    {
      const env = { ...validEnv, GLIA_AI_STOP_SEQUENCES: '' };
      const res = validateConfig(env);
      expect(res.status).toBe(true);
      if (res.status) {
        expect(res.output.gliaAI.stopSequences).toEqual([]);
      }
    }
    {
      const env = { ...validEnv, GLIA_AI_STOP_SEQUENCES: ' A ,  ,B,  C ' };
      const res = validateConfig(env);
      expect(res.status).toBe(true);
      if (res.status) {
        expect(res.output.gliaAI.stopSequences).toEqual(['A', 'B', 'C']);
      }
    }
  });
});
