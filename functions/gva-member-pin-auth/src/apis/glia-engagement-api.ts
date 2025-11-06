import type { FunctionConfig, HttpResponse, LoggerInterface, UnknownResponse } from '../types';

import { HttpRequest } from './http-request';

export class GliaEngagementApi {
  private httpRequest: HttpRequest;

  constructor(
    private config: FunctionConfig,
    logger: LoggerInterface,
  ) {
    this.httpRequest = new HttpRequest(config, logger);
  }

  fetchEngagementDetails(token: string, engagementId: string): Promise<HttpResponse<UnknownResponse>> {
    const headers = new Headers();
    headers.append('Content-Type', 'application/json');
    headers.append('authorization', `Bearer ${token}`);

    const requestOptions = {
      headers,
      method: 'GET',
    };

    const url = `${this.config.glia.apiDomain}/engagements/${engagementId}`;
    return this.httpRequest.fetchWithRetry<UnknownResponse>(url, requestOptions, 'fetchEngagementDetails');
  }
}
