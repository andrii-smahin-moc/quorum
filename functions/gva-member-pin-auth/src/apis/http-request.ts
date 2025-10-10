import type { DataDogConfig, ExtraReTryConfig, FetchReTryConfig, FunctionConfig, HttpResponse, LoggerInterface } from '../types';

import { dataDogMetric } from './data-dog-api';

export class HttpError<T = unknown> extends Error {
  attempt?: number;
  functionName: string;
  headers: Record<string, string>;
  payload: T | null;
  statusCode: number;

  constructor(
    message: string,
    functionName: string,
    statusCode: number,
    headers: Record<string, string>,
    payload: T | null,
    attempt?: number,
  ) {
    super(message);
    this.name = 'HttpError';
    this.statusCode = statusCode;
    this.headers = headers;
    this.payload = payload;
    this.functionName = functionName;
    this.attempt = attempt;
  }
}

export class HttpRequest {
  private dataDogConfig: DataDogConfig;
  private fetchReTryConfig: FetchReTryConfig;

  constructor(
    config: FunctionConfig,
    private logger: LoggerInterface,
    private extraRetryConfig: ExtraReTryConfig = {},
    private fetchEngine: typeof fetch = globalThis.fetch,
  ) {
    this.fetchReTryConfig = {
      callRetries: config.callRetries,
      requestTimeout: config.requestTimeout,
      retryDelay: config.retryDelay,
    };
    this.dataDogConfig = config.dataDog;
    this.fetchEngine = fetchEngine.bind(globalThis);
  }

  async fetchWithRetry<T = unknown>(url: string, options: RequestInit, functionName: string): Promise<HttpResponse<T>> {
    let lastError: HttpError<T> | undefined;

    for (let attempt = 0; attempt < this.fetchReTryConfig.callRetries; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.fetchReTryConfig.requestTimeout);

      try {
        const fetchOptions = { ...options, signal: controller.signal };
        const response = await this.fetchEngine(url, fetchOptions);

        const headers = Object.fromEntries(response.headers.entries());
        const contentType = headers['content-type'] ?? '';
        const rawText = await response.text();
        const isJson = contentType.includes('application/json');
        const parsedPayload = rawText ? (isJson ? (JSON.parse(rawText) as T) : (rawText as unknown as T)) : null;

        await dataDogMetric(this.dataDogConfig, { metricName: functionName, statusCode: response.status });

        if (response.ok) {
          clearTimeout(timeoutId);
          return {
            headers,
            ok: true,
            payload: parsedPayload as T,
            statusCode: response.status,
          };
        }

        if (response.status >= 400 && response.status < 500 && response.status !== 429) {
          await this.logger.error(`Error [${functionName}] status=${response.status}: ${rawText}`);
          clearTimeout(timeoutId);
          return {
            headers,
            ok: false,
            payload: null,
            statusCode: response.status,
          };
        }

        const isNonRetirable = this.extraRetryConfig.nonRetirableStatusCodes?.includes(response.status) ?? false;
        await this.logger.error(`Retryable error [${functionName}] status=${response.status}: ${rawText}`);

        if (isNonRetirable || attempt === this.fetchReTryConfig.callRetries - 1) {
          lastError = new HttpError<T>(
            `${functionName} failed with status ${response.status}`,
            functionName,
            response.status,
            headers,
            null,
            attempt + 1,
          );
          break;
        }

        await this.delay(this.fetchReTryConfig.retryDelay);
      } catch (error: any) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        await this.logger.error(`Attempt ${attempt + 1} failed for ${functionName}: ${errorMessage}`);
        await dataDogMetric(this.dataDogConfig, {
          metricName: functionName,
          statusCode: 500,
        });

        lastError = new HttpError<T>(`${functionName} failed after retries: ${errorMessage}`, functionName, 500, {}, null, attempt + 1);

        if (attempt === this.fetchReTryConfig.callRetries - 1) {
          break;
        }

        await this.delay(this.fetchReTryConfig.retryDelay);
      } finally {
        clearTimeout(timeoutId);
      }
    }

    return {
      headers: lastError?.headers ?? {},
      ok: false,
      payload: null,
      statusCode: lastError?.statusCode ?? 500,
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
