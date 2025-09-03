export interface LoggerInterface {
  error(message: string, error?: unknown): Promise<void>;
  info(message: string): Promise<void>;
  warn(message: string): Promise<void>;
}

export interface MetricPayload {
  metricName: string;
  statusCode: number;
}

export interface RetryOptions {
  callRetries: number;
  requestTimeout: number;
  retryDelay: number;
}

export interface PostRequestOptions {
  data: unknown;
  headers: Headers;
  url: string;
}

export type LogStatus = 'error' | 'info' | 'warn';

export interface LogPayload {
  message: string;
  status: LogStatus;
}
