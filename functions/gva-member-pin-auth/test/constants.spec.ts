import { describe, it, expect } from 'vitest';
import { GVAGoalSteps, AnswerOptionsList, AnswerSynonyms, IdentifierTitles } from '../src/constants';

describe('constants', () => {
  it('GVAGoalSteps should be defined and contain expected keys', () => {
    expect(GVAGoalSteps).toBeDefined();
  });

  it('AnswerOptionsList should be defined and contain expected keys', () => {
    expect(AnswerOptionsList).toBeDefined();
  });

  it('AnswerSynonyms should be defined and contain expected keys', () => {
    expect(AnswerSynonyms).toBeDefined();
  });

  it('IdentifierTitles should be defined and contain expected keys', () => {
    expect(IdentifierTitles).toBeDefined();
  });
});
