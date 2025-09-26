import type { DataDogConfig, FunctionConfig, LoggerInterface } from '../types';

import { dataDogMetric } from './data-dog-api';

export interface FetchReTryConfig {
  callRetries: number;
  requestTimeout: number;
  retryDelay: number;
}

export class HttpRequest {
  private dataDogConfig: DataDogConfig;
  private fetchReTryConfig: FetchReTryConfig;

  constructor(
    config: FunctionConfig,
    private logger: LoggerInterface,
    private fetchEngine: typeof fetch = fetch,
  ) {
    this.fetchReTryConfig = {
      callRetries: config.callRetries,
      requestTimeout: config.requestTimeout,
      retryDelay: config.retryDelay,
    };
    this.dataDogConfig = config.dataDog;
    this.fetchEngine = fetchEngine.bind(globalThis);
  }

  async fetchWithRetry<T = unknown>(url: string, options: RequestInit, functionName: string): Promise<T> {
    for (let attempt = 0; attempt < this.fetchReTryConfig.callRetries; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.fetchReTryConfig.requestTimeout);
      let responseStatus: number | undefined;
      try {
        const fetchOptions = { ...options, signal: controller.signal };
        const response = await this.fetchEngine(url, fetchOptions);
        responseStatus = response.status;

        await dataDogMetric(this.dataDogConfig, { metricName: functionName, statusCode: responseStatus });

        const contentType = response.headers.get('content-type') ?? '';
        const contentLength = response.headers.get('content-length');
        const rawText = await response.text();

        // Success response
        if (response.ok) {
          const isEmpty = !rawText || rawText.trim() === '';
          const hasNoDeclaredContent = !contentLength || contentLength === '0' || !contentType;
          if (isEmpty || hasNoDeclaredContent) {
            clearTimeout(timeoutId);
            return true as T;
          }
          if (contentType.includes('application/json')) {
            clearTimeout(timeoutId);
            return JSON.parse(rawText) as T;
          }
          clearTimeout(timeoutId);
          return rawText as unknown as T;
        }

        if (response.status >= 400 && response.status < 500 && response.status !== 429) {
          await this.logger.error(`Error! Status: ${functionName}, Response: ${rawText}`);
          responseStatus = response.status;
          clearTimeout(timeoutId);
          const error = new Error(`${functionName} error! Status: ${response.status}`) as Error & { isHttpError400?: boolean };
          error.isHttpError400 = true;
          throw error;
        }

        await this.logger.error(`Error! Status: ${functionName}, Response: ${rawText}`);
        if (attempt === this.fetchReTryConfig.callRetries - 1) {
          await this.logger.error(`Max retry attempts reached for function ${functionName}. Operation failed.`);
          clearTimeout(timeoutId);
          throw new Error('Max retry attempts reached. Operation failed.');
        }
        await this.delay(this.fetchReTryConfig.retryDelay);
      } catch (error: any) {
        if (error && 'isHttpError400' in error) {
          clearTimeout(timeoutId);
          throw error;
        }

        const errorMessage = error instanceof Error ? error.message : String(error);
        await this.logger.error(`Error with: ${functionName}, Attempt ${attempt + 1} failed: ${errorMessage}`);
        await dataDogMetric(this.dataDogConfig, { metricName: functionName, statusCode: responseStatus ?? 500 });
        if (attempt === this.fetchReTryConfig.callRetries - 1) {
          clearTimeout(timeoutId);
          throw error instanceof Error ? error : new Error(String(error));
        }
        await this.delay(this.fetchReTryConfig.retryDelay);
      } finally {
        clearTimeout(timeoutId);
      }
    }
    throw new Error('Unexpected error: retry loop exited without return');
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
