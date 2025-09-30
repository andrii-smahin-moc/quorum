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

  async detect(context: HandlerPayload): Promise<AnswerOption | null> {
    const local = this.possibleAnswers.find((r) => (r.match(context).isMatched ? r : null));
    if (local) {
      return local;
    }

    if (context.text) {
      await this.logger.info(`No local match found, invoking AI detection`);
      return this.detectWithAI(context.text);
    }

    return null;
  }

  private async detectWithAI(text: string): Promise<AnswerOption | null> {
    const prompt = this.config.gliaAI.detectOptionPrompt
      .replace('{userText}', text)
      .replace('{possibleOptions}', this.possibleAnswers.map((r) => r.name).join(', '));

    try {
      const ai = await this.gliaAiService.invokeModel(prompt);

      const parsedResponse = this.safeParseAIResponse(ai);
      if (!parsedResponse) {
        await this.logger.warn(`Glia AI response could not be parsed as JSON: ${ai}`);
        return null;
      }

      await this.logger.info(`AI detected option: ${parsedResponse.option} with confidence: ${parsedResponse.confidence}`);

      if (parsedResponse.option && parsedResponse.confidence >= this.config.gliaAI.detectConfidence) {
        const option = this.possibleAnswers.find((r) => r.name === parsedResponse.option);
        if (option) {
          return option;
        }
        return null;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.logger.error(`Error invoking Glia AI: ${errorMessage}`);
    }
    return null;
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
