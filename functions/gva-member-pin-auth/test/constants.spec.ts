import { describe, it, expect } from 'vitest';
import {
  IDENTIFIER_REGEX,
  OTP_CODE_REGEX,
  MEMBER_PIN_REGEX,
  MEMBER_PIN_4_8_REGEX,
  ZERO_NUMBER,
  NON_DIGITS_REGEX,
  looksLikeMemberId,
  looksLikePin,
  STEPS,
  INITIAL_STEP,
  AI_CLASSIFICATION,
  AI_NEXT_STEP_MAP,
  STEP_ORDER,
  IdentifierTitles,
  type Step,
  type AiClassification,
} from '../src/constants';

describe('constants.ts — regex', () => {
  it('IDENTIFIER_REGEX (6–12 digits with lookarounds)', () => {
    expect('123456'.match(IDENTIFIER_REGEX)?.[0]).toBe('123456');
    expect('abc 123456 def'.match(IDENTIFIER_REGEX)?.[0]).toBe('123456');
    expect('123456789012'.match(IDENTIFIER_REGEX)?.[0]).toBe('123456789012');

    expect('12345'.match(IDENTIFIER_REGEX)).toBeNull();
    expect('1234567890123'.match(IDENTIFIER_REGEX)).toBeNull();

    expect('9012345678901'.match(IDENTIFIER_REGEX)).toBeNull();
  });

  it('OTP_CODE_REGEX (exactly 6 digits)', () => {
    expect('654321'.match(OTP_CODE_REGEX)?.[0]).toBe('654321');
    expect('code:654321!'.match(OTP_CODE_REGEX)?.[0]).toBe('654321');

    expect('12345'.match(OTP_CODE_REGEX)).toBeNull();
    expect('1234567'.match(OTP_CODE_REGEX)).toBeNull();
  });

  it('MEMBER_PIN_REGEX (exactly 4) vs MEMBER_PIN_4_8_REGEX', () => {
    expect('0000'.match(MEMBER_PIN_REGEX)?.[0]).toBe('0000');
    expect('9876'.match(MEMBER_PIN_REGEX)?.[0]).toBe('9876');
    expect('abc1234xyz'.match(MEMBER_PIN_REGEX)?.[0]).toBe('1234');

    expect('123'.match(MEMBER_PIN_REGEX)).toBeNull();
    expect('12345'.match(MEMBER_PIN_REGEX)).toBeNull();

    // ширший 4–8
    expect('1234'.match(MEMBER_PIN_4_8_REGEX)?.[0]).toBe('1234');
    expect('12345678'.match(MEMBER_PIN_4_8_REGEX)?.[0]).toBe('12345678');
    expect('123456789'.match(MEMBER_PIN_4_8_REGEX)).toBeNull();
  });

  it('ZERO_NUMBER (single zero only)', () => {
    expect('0'.match(ZERO_NUMBER)?.[0]).toBe('0');
    expect('a0b'.match(ZERO_NUMBER)?.[0]).toBe('0');

    expect('10'.match(ZERO_NUMBER)).toBeNull();
    expect('100'.match(ZERO_NUMBER)).toBeNull();
  });

  it('NON_DIGITS_REGEX strips non-digits', () => {
    expect('12-34-56'.replace(NON_DIGITS_REGEX, '')).toBe('123456');
    expect('abc99xyz'.replace(NON_DIGITS_REGEX, '')).toBe('99');
  });
});

describe('constants.ts — helpers', () => {
  it('looksLikeMemberId', () => {
    expect(looksLikeMemberId('My ID is 123456')).toBe(true);
    expect(looksLikeMemberId('id: 12345')).toBe(false);
  });

  it('looksLikePin', () => {
    expect(looksLikePin('pin 4321')).toBe(true); // 4-digit
    expect(looksLikePin('pin 43210')).toBe(true); // 5-digit (4–8)
    expect(looksLikePin('pin 432')).toBe(false); // short
    expect(looksLikePin('pin 432109876')).toBe(false); // >8
  });
});

describe('constants.ts — steps & classification', () => {
  it('INITIAL_STEP and STEP_ORDER', () => {
    expect(INITIAL_STEP).toBe(STEPS.INITIAL);
    expect(STEP_ORDER[0]).toBe(STEPS.INITIAL);

    expect(Object.values(STEPS)).toEqual(
      expect.arrayContaining([
        'ask_member_id',
        'verify_member_id',
        'ask_pin',
        'verify_pin',
        'forgot_pin',
        'transfer_to_human',
        'cancel',
        'text_input',
      ]),
    );
  });

  it('IdentifierTitles contains MEMBER_ID and PIN', () => {
    expect(IdentifierTitles.MEMBER_ID).toBe('Member ID');
    expect(IdentifierTitles.PIN).toBe('PIN');
  });

  it('AI_NEXT_STEP_MAP — VALID_ENTRY routing', () => {
    const c: AiClassification = AI_CLASSIFICATION.VALID_ENTRY;
    expect(AI_NEXT_STEP_MAP[c][STEPS.ASK_MEMBER_ID]).toBe(STEPS.VERIFY_MEMBER_ID);
    expect(AI_NEXT_STEP_MAP[c][STEPS.ASK_PIN]).toBe(STEPS.VERIFY_PIN);
    expect(AI_NEXT_STEP_MAP[c]['*']).toBe(STEPS.ASK_MEMBER_ID);
  });

  it('AI_NEXT_STEP_MAP — other categories', () => {
    expect(AI_NEXT_STEP_MAP[AI_CLASSIFICATION.FORGOT_CREDENTIALS]['*']).toBe(STEPS.FORGOT_PIN);
    expect(AI_NEXT_STEP_MAP[AI_CLASSIFICATION.REQUEST_HUMAN]['*']).toBe(STEPS.TRANSFER_TO_HUMAN);
    expect(AI_NEXT_STEP_MAP[AI_CLASSIFICATION.CANCEL]['*']).toBe(STEPS.CANCEL);
    expect(AI_NEXT_STEP_MAP[AI_CLASSIFICATION.UNCLEAR]['*']).toBe(STEPS.TEXT_INPUT);
  });
});
