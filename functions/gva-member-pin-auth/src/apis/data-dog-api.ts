import type { DataDogConfig, LogPayload, MetricPayload, PostRequestOptions, RetryOptions } from '../types';

const DATA_DOG_LOG_URL = 'https://http-intake.logs.datadoghq.com/api/v2/logs';
const DATA_DOG_METRIC_URL = 'https://api.datadoghq.com/api/v2/series';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function shouldStopRetrying(status: number | undefined, attempt: number, max: number): boolean {
  if (!status) {
    return attempt >= max - 1;
  }
  if (status >= 400 && status < 429) {
    return attempt >= max - 1;
  }
  return false;
}

function toFinalError(error: unknown, status: number | undefined): Error {
  if (!status) {
    console.error('DATADOG REQUEST: No status and max retries reached.');
    return error instanceof Error ? error : new Error('Unknown error');
  }
  console.error('DATADOG REQUEST: Max retry attempts reached.');
  return new Error('Max retry attempts reached. Operation failed.');
}

function logRequestError(error: unknown, attempt: number): void {
  console.error(`DATADOG REQUEST Error (Attempt ${attempt + 1}):`, error);
}

export async function parseResponse(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') || '';
  return contentType.includes('application/json') ? response.json() : response.text();
}

export async function postRequest(retryOptions: RetryOptions, { data, headers, url }: PostRequestOptions): Promise<unknown> {
  const controller = new AbortController();

  for (let attempts = 0; attempts < retryOptions.callRetries; attempts += 1) {
    const timeout = setTimeout(() => controller.abort(), retryOptions.requestTimeout);
    let responseStatus: number | undefined;

    try {
      const response = await fetch(url, {
        body: JSON.stringify(data),
        headers,
        method: 'POST',
      });

      responseStatus = response.status;
      const responseValue = await parseResponse(response);

      if (response.ok) {
        return responseValue;
      }

      console.error(`DATADOG REQUEST Error: ${response.status} - ${response.statusText}`, responseValue);
      throw new Error(`DATADOG BAD REQUEST! Status: ${response.status}`);
    } catch (error) {
      logRequestError(error, attempts);

      if (shouldStopRetrying(responseStatus, attempts, retryOptions.callRetries)) {
        throw toFinalError(error, responseStatus);
      }

      await delay(retryOptions.retryDelay);
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new Error('Unexpected failure in postRequest retry loop.');
}

export async function dataDogLog(config: DataDogConfig, payload: LogPayload): Promise<void> {
  const headers = new Headers({
    'Content-Type': 'application/json',
    'DD-API-KEY': config.ddApiKey,
  });

  const data = {
    message: payload.message,
    ddsource: config.siteId,
    ddtags: `customer:${config.customer},site_id:${config.siteId},function:${config.functionName},version:${config.version}`,
    hostname: config.functionName,
    service: config.customer,
    status: payload.status,
  };

  try {
    await postRequest(
      { callRetries: config.callRetries, requestTimeout: config.requestTimeout, retryDelay: config.retryDelay },
      { data, headers, url: DATA_DOG_LOG_URL },
    );
  } catch (error) {
    console.error('DATADOG Log Error:', error);
  }
}

export async function dataDogMetric(config: DataDogConfig, payload: MetricPayload): Promise<void> {
  const timestamp = Math.floor(Date.now() / 1000);

  const series = {
    series: [
      {
        metric: `${config.customer}.${payload.metricName}.invocations`,
        points: [
          {
            timestamp,
            value: 1,
          },
        ],
        tags: [
          `customer:${config.customer}`,
          `site_id:${config.siteId}`,
          `function:${config.functionName}`,
          `version:${config.version}`,
          `status_code:${payload.statusCode}`,
        ],
        type: 1,
      },
    ],
  };

  const headers = new Headers({
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'DD-API-KEY': config.ddApiKey,
  });

  try {
    await postRequest(
      { callRetries: config.callRetries, requestTimeout: config.requestTimeout, retryDelay: config.retryDelay },
      { data: series, headers, url: DATA_DOG_METRIC_URL },
    );
  } catch (error) {
    console.error('DATADOG Metric Error:', error);
  }
}
