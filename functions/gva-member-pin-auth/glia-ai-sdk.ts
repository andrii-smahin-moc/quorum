import credentials from './glia-ai-sdk.json';

interface GliaAIMessage {
  role: 'user' | 'assistant';
  content: { text: string }[];
}

interface GliaAIOptions {
  temperature?: number;
  max_tokens?: number;
  topP?: number;
  stop_sequences?: string[];
}

interface GliaInvokeParams {
  messages: GliaAIMessage[];
  options?: GliaAIOptions;
}

interface GliaAIResponse {
  message: GliaAIMessage;
  usage: {
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
  };
  system?: {
    content: { text: string }[];
  };
}

export class aiClient {
  private modelName!: string;

  static initialize(modelName: string) {
    const client = new aiClient();
    client.modelName = modelName;
    return client;
  }

  async invokeModel(params: GliaInvokeParams) {
    const authToken = await this.fetchAuthToken();
    const response = await this.invokeTheFunction(authToken, params);
    return response as GliaAIResponse;
  }

  private async invokeTheFunction(authToken: string, params: GliaInvokeParams): Promise<GliaAIResponse> {
    const headers = new Headers();
    headers.append('Content-Type', 'application/json');
    headers.append('Authorization', `Bearer ${authToken}`);

    const body = JSON.stringify({ ...params, modelName: this.modelName });

    const requestOptions = {
      body,
      headers,
      method: 'POST',
    };

    try {
      const result = await fetch(credentials.GLIA_AI_FUNCTION_URL, requestOptions);
      const data: any = await result.json();
      if ('status' in data && data.status === false) {
        throw new Error(data.message);
      }
      return data;
    } catch (error) {
      console.error('Error invoking function:', error);
      throw new Error('Failed to invoke function');
    }
  }

  private async fetchAuthToken(): Promise<string> {
    const headers = new Headers();
    headers.append('Content-Type', 'application/json');
    headers.append('Accept', 'application/vnd.salemove.v1+json');

    const body = JSON.stringify({
      api_key_id: credentials.GLIA_AI_API_KEY,
      api_key_secret: credentials.GLIA_AI_API_KEY_SECRET,
    });

    const requestOptions = {
      body,
      headers,
      method: 'POST',
    };

    const url = `${credentials.GLIA_AI_DOMAIN}/operator_authentication/tokens`;

    try {
      const result = await fetch(url, requestOptions);
      const data = (await result.json()) as { token: string };
      return data.token;
    } catch (error) {
      console.error('Error fetching auth token:', error);
      throw new Error('Failed to fetch auth token');
    }
  }
}
