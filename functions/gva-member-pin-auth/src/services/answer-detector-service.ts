import { FunctionConfig, HandlerPayload, LoggerInterface } from '../types';

import { GliaAIService } from './glia-ai-service';
import { AnswerOption } from './possible-answer';

export class AnswerDetectorService {
  private gliaAiService: GliaAIService;
  constructor(
    private config: FunctionConfig,
    private logger: LoggerInterface,
    private possibleAnswers: AnswerOption[],
  ) {
    this.gliaAiService = new GliaAIService(this.config);
  }

  async detect(context: HandlerPayload): Promise<AnswerOption[]> {
    const localAnswers = this.possibleAnswers.filter((anAnswer) => (anAnswer.match(context).isMatched ? anAnswer : null));
    if (localAnswers.length > 0) {
      return localAnswers;
    }

    if (context.text) {
      await this.logger.info(`No local match found, invoking AI detection`);
      return this.detectWithAI(context.text);
    }

    return [];
  }

  private async detectWithAI(text: string): Promise<AnswerOption[]> {
    const prompt = this.config.gliaAI.detectOptionPrompt
      .replace('{userText}', text)
      .replace('{possibleOptions}', this.possibleAnswers.map((r) => r.name).join(', '));

    try {
      const ai = await this.gliaAiService.invokeModel(this.config.gliaAI.detectSystemMessage, prompt);

      const parsedResponse = this.safeParseAIResponse(ai);
      if (!parsedResponse) {
        await this.logger.warn(`Glia AI response could not be parsed as JSON: ${ai}`);
        return [];
      }

      await this.logger.info(`AI detected option: ${parsedResponse.option} with confidence: ${parsedResponse.confidence}`);

      if (parsedResponse.option && parsedResponse.confidence >= this.config.gliaAI.detectConfidence) {
        const options = this.possibleAnswers.filter((r) => r.name === parsedResponse.option);
        if (options.length > 0) {
          return options;
        }
        return [];
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.logger.error(`Error invoking Glia AI: ${errorMessage}`);
    }
    return [];
  }

  private safeParseAIResponse(aiResponse: string): { confidence: number; option: string | null } | null {
    try {
      const parsed: unknown = JSON.parse(aiResponse);
      if (
        typeof parsed === 'object' &&
        parsed !== null &&
        'optionName' in parsed &&
        'confidence' in parsed &&
        (typeof parsed.optionName === 'string' || parsed.optionName === null) &&
        typeof parsed.confidence === 'number'
      ) {
        return { confidence: parsed.confidence, option: parsed.optionName };
      }
      return null;
    } catch {
      return null;
    }
  }
}
