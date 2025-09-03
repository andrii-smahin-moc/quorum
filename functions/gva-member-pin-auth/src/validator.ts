import * as vi from 'valibot';

import { ValidationResult } from './types';

export function validateSchema<T>(schema: vi.BaseSchema<any, T, any>, input: any, logPrefix: string): ValidationResult<T> {
  const result = vi.safeParse(schema, input);
  if (!result.success) {
    const invalidPayload = result.issues.map((issue: { message: string }) => issue.message).join('; ');
    const message = `${logPrefix}: Invalid payload: ${invalidPayload}`;
    return { message, status: false };
  }
  return { output: result.output, status: true };
}
