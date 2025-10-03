import { describe, it, expect, vi, beforeEach } from 'vitest';

const { validateSchemaMock } = vi.hoisted(() => ({
  validateSchemaMock: vi.fn(),
}));

vi.mock('../src/validator', () => ({
  validateSchema: validateSchemaMock,
}));

vi.mock('../src/schemas', () => ({
  GVAFunctionPayloadSchema: { __mock: 'GVAFunctionPayloadSchema' },
}));

import { BaseGVAGoalService } from '../src/services/base-gva-goal-service';
import type { HandlerPayload, GoalStepHandler, HandlerResult } from '../src/types';

describe('BaseGVAGoalService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('buildHandlerResultPayload', () => {
    it('merges overrides over defaults (shallow merge)', () => {
      const svc = new BaseGVAGoalService();

      const overrides: Partial<HandlerResult> = {
        isFinalStep: true,
        responseId: 'id-123',
        customPayload: { a: 1 },
      };

      const res = svc.buildHandlerResultPayload(overrides);

      expect(res.transferToHuman).toBe(false);
      expect(res.responseData).toEqual({});
      expect(res.customJourneyContext).toEqual({});
      expect(res.isFinalStep).toBe(true);
      expect(res.responseId).toBe('id-123');
      expect(res.customPayload).toEqual({ a: 1 });

      const res2 = svc.buildHandlerResultPayload({ customPayload: { b: 2 } });
      expect(res2.customPayload).toEqual({ b: 2 });
    });
  });

  describe('register / resolve / execute', () => {
    it('resolves previously registered handler and executes it', async () => {
      const svc = new BaseGVAGoalService();

      const handler: GoalStepHandler = vi.fn(async (ctx: HandlerPayload) => {
        return svc.buildHandlerResultPayload({
          isFinalStep: true,
          responseId: `ok-${(ctx as any)?.text ?? 'no-text'}`,
        });
      });

      svc.register('stepA', handler);

      const resolved = svc.resolve('stepA');
      expect(resolved).toBe(handler);

      const payload = { text: 'hello' } as any as HandlerPayload;
      const result = await svc.execute('stepA', payload);

      expect(handler).toHaveBeenCalledWith(payload);
      expect(result.isFinalStep).toBe(true);
      expect(result.responseId).toBe('ok-hello');
    });

    it('throws when resolving unknown step', () => {
      const svc = new BaseGVAGoalService();
      expect(() => svc.resolve('unknown')).toThrow('No handler registered for step "unknown"');
    });
  });

  describe('safeJSONParse', () => {
    it('returns parsed object on valid JSON', () => {
      const svc = new BaseGVAGoalService();
      const json = '{"a":1,"b":"x"}';
      const res = svc.safeJSONParse(json);
      expect(res.status).toBe(true);
      if (res.status) {
        expect(res.output).toEqual({ a: 1, b: 'x' });
      }
    });

    it('returns status=false and message on invalid JSON', () => {
      const svc = new BaseGVAGoalService();
      const res = svc.safeJSONParse('not-json');
      expect(res.status).toBe(false);
      if (!res.status) {
        expect(res.message).toContain('Failed to parse JSON.');
      }
    });
  });

  describe('parsePayload', () => {
    it('fails early and prefixes message when raw payload is invalid JSON', () => {
      const svc = new BaseGVAGoalService();
      const res = svc.parsePayload('not-json');

      expect(res.status).toBe(false);
      if (!res.status) {
        expect(res.message).toContain('Parse GVA Payload: Failed to parse JSON.');
      }
      expect(validateSchemaMock).not.toHaveBeenCalled();
    });

    it('delegates to validateSchema with correct schema, data and log prefix', () => {
      const svc = new BaseGVAGoalService();

      const raw = JSON.stringify({ foo: 'bar', engagementId: 'e1', gvaId: 'g1', messageType: 'text' });

      validateSchemaMock.mockReturnValueOnce({
        status: true,
        output: { parsed: true },
      });

      const res = svc.parsePayload(raw);

      expect(validateSchemaMock).toHaveBeenCalledTimes(1);
      const [schemaArg, dataArg, prefixArg] = validateSchemaMock.mock.calls[0];

      expect(schemaArg).toEqual({ __mock: 'GVAFunctionPayloadSchema' });
      expect(dataArg).toEqual(JSON.parse(raw));
      expect(prefixArg).toBe('Parse GVA Payload');

      expect(res.status).toBe(true);
      if (res.status) {
        expect(res.output).toEqual({ parsed: true });
      }
    });

    it('returns validator error when validateSchema fails', () => {
      const svc = new BaseGVAGoalService();

      const raw = JSON.stringify({ foo: 'bar' });
      validateSchemaMock.mockReturnValueOnce({
        status: false,
        message: 'Validation failed',
      });

      const res = svc.parsePayload(raw);

      expect(validateSchemaMock).toHaveBeenCalledTimes(1);
      expect(res.status).toBe(false);
      if (!res.status) {
        expect(res.message).toBe('Validation failed');
      }
    });
  });
});
