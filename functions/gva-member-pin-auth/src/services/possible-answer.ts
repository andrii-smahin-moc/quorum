import { HandlerPayload } from '../types';

export interface AnswerMatch {
  name: string;
  isMatched: boolean;
  matchedText: string | null;
  source: 'quickReplyTap' | 'text' | null;
  patternType: 'regexp' | 'string' | null;
}

export class AnswerOption {
  public matchedText: string | null = null;
  public patternType: 'regexp' | 'string' | null = null;
  public source: 'quickReplyTap' | 'text' | null = null;
  constructor(
    public name: string,
    private patterns: (RegExp | string)[],
  ) {}

  match(payload: HandlerPayload): AnswerMatch {
    if (payload.messageType === 'quickReplyTap' && payload.buttonText) {
      const buttonMatch = this.checkPatterns(payload.buttonText, 'quickReplyTap');
      if (buttonMatch.isMatched) {
        return buttonMatch;
      }
    }

    if (payload.messageType === 'text' && payload.text) {
      const textMatch = this.checkPatterns(payload.text, 'text');
      if (textMatch.isMatched) {
        return textMatch;
      }
    }

    return this.noMatch();
  }

  private buildMatch(pattern: RegExp | string, matchedText: string, source: 'quickReplyTap' | 'text'): AnswerMatch {
    const patternType: 'regexp' | 'string' = typeof pattern === 'string' ? 'string' : 'regexp';
    this.matchedText = matchedText;
    this.source = source;
    this.patternType = patternType;
    return {
      isMatched: true,
      matchedText,
      name: this.name,
      patternType,
      source,
    };
  }

  private checkPatterns(input: string, source: 'quickReplyTap' | 'text'): AnswerMatch {
    const normalizedInput = input.toLowerCase();

    for (const pattern of this.patterns) {
      if (typeof pattern === 'string') {
        const normalizedPattern = pattern.toLowerCase();
        const isExact = source === 'quickReplyTap' ? normalizedInput === normalizedPattern : normalizedInput.includes(normalizedPattern);

        if (isExact) {
          return this.buildMatch(pattern, pattern, source);
        }
      } else {
        const execResult = pattern.exec(input);
        if (execResult) {
          return this.buildMatch(pattern, execResult[0], source);
        }
      }
    }
    return this.noMatch();
  }

  private noMatch(): AnswerMatch {
    this.matchedText = null;
    this.source = null;
    this.patternType = null;
    return {
      isMatched: false,
      matchedText: null,
      name: this.name,
      patternType: null,
      source: null,
    };
  }
}
