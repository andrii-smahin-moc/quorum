import { describe, it, expect } from 'vitest';
import * as v from 'valibot';
import { validateSchema } from '../src/validator';

describe('validateSchema', () => {
  const schema = v.object({
    a: v.string(),
  });

  it('returns status=true and parsed output on valid input', () => {
    const input = { a: 'ok' };
    const res = validateSchema(schema, input, 'TEST');

    expect(res.status).toBe(true);
    if (res.status) {
      expect(res.output).toEqual(input);
    }
  });

  it('returns status=false with prefixed error message on invalid input', () => {
    const input = { a: 123 }; // має бути string
    const res = validateSchema(schema, input, 'TEST');

    expect(res.status).toBe(false);
    if (!res.status) {
      expect(res.message).toMatch(/^TEST: Invalid payload:/);
    }
  });
});
