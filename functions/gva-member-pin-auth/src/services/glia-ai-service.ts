import { aiClient } from 'ai';

import { FunctionConfig } from '../types';

export class GliaAIService {
  private aiClient: aiClient;

  constructor(private config: FunctionConfig) {
    this.aiClient = aiClient.initialize(this.config.gliaAI.model);
  }

  async invokeModel(system: string, prompt: string) {
    const invokeConfiguration = {
      messages: [
        {
          content: [{ text: prompt }],
          role: 'user' as const,
        },
      ],
      options: {
        max_tokens: this.config.gliaAI.maxTokens,
        stop_sequences: this.config.gliaAI.stopSequences,
        temperature: this.config.gliaAI.temperature,
      },
      system: [
        {
          text: system,
        },
      ],
    };

    const resultValue = await this.aiClient.invokeModel(invokeConfiguration);
    let resultContent = '';
    if (resultValue && resultValue.message && resultValue.message.content) {
      resultValue.message.content.forEach((aContent) => (resultContent += aContent.text));
      return resultContent;
    }

    throw new Error(`Glia AI response is empty: ${JSON.stringify(resultValue)}`);
  }
}
