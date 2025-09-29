import type { FunctionConfig, LoggerInterface, UnknownResponse } from '../types';

import { HttpRequest } from './http-request';

export class QuorumApi {
  private httpRequest: HttpRequest;

  constructor(
    private config: FunctionConfig,
    logger: LoggerInterface,
  ) {
    this.httpRequest = new HttpRequest(config, logger);
  }

  verifyMemberExists(idValue: string): Promise<UnknownResponse> {
    const headers = new Headers();
    headers.append('Content-Type', 'application/json');
    headers.append('X-GVA-API-Key', this.config.quorumConfig.quorumApiHeader);

    const body = JSON.stringify({
      identifiers: [
        {
          idType: 'MEMBER_NUMBER',
          idValue,
        },
      ],
    });

    const requestOptions = {
      body,
      headers,
      method: 'POST',
    };

    const url = `${this.config.quorumConfig.quorumApiDomain}/auth/pin`;
    return this.httpRequest.fetchWithRetry<UnknownResponse>(url, requestOptions, 'verifyMemberExists');
  }
  verifyMemberPin(idValue: string, pin: string): Promise<UnknownResponse> {
    const headers = new Headers();
    headers.append('Content-Type', 'application/json');
    headers.append('X-GVA-API-Key', this.config.quorumConfig.quorumApiHeader);

    const body = JSON.stringify({
      identifiers: [
        {
          idType: 'MEMBER_NUMBER',
          idValue,
        },
      ],
      pin,
    });

    const requestOptions = {
      body,
      headers,
      method: 'POST',
    };

    const url = `${this.config.quorumConfig.quorumApiDomain}/auth/pin/verify`;
    return this.httpRequest.fetchWithRetry<UnknownResponse>(url, requestOptions, 'verifyMemberPin');
  }
}
