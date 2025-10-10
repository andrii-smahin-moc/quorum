import type { FunctionConfig, HttpResponse, LoggerInterface, UnknownResponse } from '../types';

import { HttpRequest } from './http-request';

export class GliaTransferApi {
  private httpRequest: HttpRequest;

  constructor(
    private config: FunctionConfig,
    logger: LoggerInterface,
  ) {
    this.httpRequest = new HttpRequest(config, logger);
  }

  transferToQueue(token: string, engagementId: string): Promise<HttpResponse<UnknownResponse>> {
    const headers = new Headers();
    headers.append('Content-Type', 'application/json');
    headers.append('authorization', `Bearer ${token}`);

    const body = JSON.stringify({
      engagement_id: engagementId,
      media: 'text',
      queue_id: this.config.glia.liveOperatorQueueID,
    });

    const requestOptions = {
      body,
      headers,
      method: 'POST',
    };

    const url = `${this.config.glia.apiDomain}/transfer_tickets`;
    return this.httpRequest.fetchWithRetry<UnknownResponse>(url, requestOptions, 'transferToQueue');
  }
}
