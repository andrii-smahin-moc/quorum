import { describe, it, expect, beforeEach } from 'vitest';
import { AnswerOption } from '../src/services/possible-answer';
import type { HandlerPayload } from '../src/types';

describe('AnswerOption', () => {
  let option: AnswerOption;

  beforeEach(() => {
    option = new AnswerOption('forgotPin', ['Reset PIN', 'forgot pin', /pin\s*\d{4}/i]);
  });

  it('matches quickReplyTap by exact string (case-insensitive) and updates internal state', () => {
    const payload: HandlerPayload = {
      engagementId: 'e1',
      gvaId: 'g1',
      messageType: 'quickReplyTap',
      buttonText: 'reset pin',
    } as any;

    const res = option.match(payload);

    expect(res.isMatched).toBe(true);
    expect(res.name).toBe('forgotPin');
    expect(res.source).toBe('quickReplyTap');
    expect(res.patternType).toBe('string');
    expect(res.matchedText).toBe('Reset PIN');

    expect(option.matchedText).toBe('Reset PIN');
    expect(option.source).toBe('quickReplyTap');
    expect(option.patternType).toBe('string');
  });

  it('matches text by substring for string patterns (case-insensitive)', () => {
    const payload: HandlerPayload = {
      engagementId: 'e2',
      gvaId: 'g2',
      messageType: 'text',
      text: 'hi, I FORGOT pin yesterday',
    } as any;

    const res = option.match(payload);

    expect(res.isMatched).toBe(true);
    expect(res.source).toBe('text');
    expect(res.patternType).toBe('string');
    expect(res.matchedText).toBe('forgot pin');
  });

  it('matches text by RegExp and returns the matched fragment as matchedText', () => {
    const payload: HandlerPayload = {
      engagementId: 'e3',
      gvaId: 'g3',
      messageType: 'text',
      text: 'my pin 1234 does not work',
    } as any;

    const res = option.match(payload);

    expect(res.isMatched).toBe(true);
    expect(res.patternType).toBe('regexp');
    expect(res.source).toBe('text');
    expect(res.matchedText).toBe('pin 1234');
  });

  it('prioritizes quickReplyTap over text when both present', () => {
    const payload: HandlerPayload = {
      engagementId: 'e4',
      gvaId: 'g4',
      messageType: 'quickReplyTap',
      buttonText: 'Reset PIN',
      text: 'i forgot pin',
    } as any;

    const res = option.match(payload);

    expect(res.isMatched).toBe(true);
    expect(res.source).toBe('quickReplyTap');
    expect(res.matchedText).toBe('Reset PIN');
  });

  it('no match resets internal state after previous match', () => {
    const first: HandlerPayload = {
      engagementId: 'e6',
      gvaId: 'g6',
      messageType: 'text',
      text: 'please reset pin',
    } as any;
    const r1 = option.match(first);
    expect(r1.isMatched).toBe(true);
    expect(option.matchedText).not.toBeNull();

    const second: HandlerPayload = {
      engagementId: 'e7',
      gvaId: 'g7',
      messageType: 'text',
      text: 'hello there',
    } as any;
    const r2 = option.match(second);

    expect(r2.isMatched).toBe(false);
    expect(option.matchedText).toBeNull();
    expect(option.source).toBeNull();
    expect(option.patternType).toBeNull();
  });
});
