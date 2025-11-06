import { dataDogLog } from './apis';
import type { DataDogConfig, LoggerInterface, LogStatus } from './types';

export class LoggerWithDD implements LoggerInterface {
  constructor(private readonly CONFIG: DataDogConfig & { isDevMode: boolean }) {
    this.CONFIG.isDevMode ??= false;
  }

  async error(message: string, error?: unknown): Promise<void> {
    return this.log('error', message, error);
  }

  async info(message: string): Promise<void> {
    return this.log('info', message);
  }

  async warn(message: string): Promise<void> {
    return this.log('warn', message);
  }

  private getDDConfig(): DataDogConfig {
    const { callRetries, customer, ddApiKey, functionName, isDevMode, requestTimeout, retryDelay, siteId, version } = this.CONFIG;

    return {
      callRetries,
      customer,
      ddApiKey,
      functionName,
      isDevMode,
      requestTimeout,
      retryDelay,
      siteId,
      version,
    };
  }

  private async log(status: LogStatus, message: string, error?: unknown): Promise<void> {
    const prefix = status.toUpperCase();
    switch (status) {
      case 'error': {
        console.error(`${prefix}: ${message}`, error);
        break;
      }
      case 'info': {
        console.info(`${prefix}: ${message}`);
        break;
      }
      case 'warn': {
        console.warn(`${prefix}: ${message}`);
        break;
      }
      default: {
        console.info(`${prefix}: ${message}`);
        break;
      }
    }

    if (this.CONFIG.isDevMode) {
      return;
    }
    await dataDogLog(this.getDDConfig(), { message, status });
  }
}
