import type { DataDogConfig, FunctionConfig, LoggerInterface } from '../types';

import { dataDogMetric } from './data-dog-api';

export class HttpError extends Error {
  readonly body: unknown;
  readonly message: string;
  readonly method?: string;
  readonly status: number;
  constructor(parameters: { body: unknown; message: string; method?: string; status: number }) {
    super(parameters.message);
    Object.setPrototypeOf(this, new.target.prototype);

    this.body = parameters.body;
    this.message = parameters.message;
    this.method = parameters.method;
    this.status = parameters.status;
  }
}

export const isHttpError = (error: unknown): error is HttpError => error instanceof HttpError;

export class HttpRequest {
  private dataDogConfig: DataDogConfig;
  private fetchEngine: typeof fetch;
  private requestTimeout: number;

  constructor(
    config: FunctionConfig,
    private logger: LoggerInterface,
    fetchEngine: typeof fetch = fetch,
  ) {
    this.requestTimeout = config.requestTimeout;
    this.dataDogConfig = config.dataDog;
    this.fetchEngine = fetchEngine.bind(globalThis);
  }

  async fetchOnce<T>(url: string, options: RequestInit, functionName: string): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.requestTimeout);
    const method = (options.method ?? 'GET').toUpperCase();

    try {
      const response = await this.fetchEngine(url, { ...options, signal: controller.signal });
      const status = response.status;
      await dataDogMetric(this.dataDogConfig, { metricName: functionName, statusCode: status });

      const rawText = await response.text();

      const parsedBody = this.safeParseJson(rawText);
      if (response.ok) {
        return parsedBody as T;
      }

      const message = `Request failed with status ${status}`;

      await this.logger.error(`[${functionName}] ${method} ${url} failed: ${status}. Body: ${rawText}`);

      throw new HttpError({
        message,
        body: parsedBody ?? rawText,
        method,
        status,
      });
    } catch (error: any) {
      if (error instanceof AbortController) {
        const status = 408;
        await dataDogMetric(this.dataDogConfig, { metricName: functionName, statusCode: status });
        throw new HttpError({
          message: `${functionName} timeout after ${this.requestTimeout}ms`,
          body: null,
          method,
          status,
        });
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private safeParseJson(text: string) {
    try {
      return JSON.parse(text) as unknown;
    } catch {
      return null;
    }
  }
}
