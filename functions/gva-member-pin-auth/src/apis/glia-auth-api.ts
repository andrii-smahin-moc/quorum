import type { FunctionConfig, GliaConfig, HttpResponse, LoggerInterface } from '../types';

import { HttpRequest } from './http-request';

interface UserTokenResponse {
  token: string;
}

export class GliaAuthApi {
  private gliaConfig: GliaConfig;

  private httpRequest: HttpRequest;

  constructor(config: FunctionConfig, logger: LoggerInterface) {
    this.gliaConfig = config.glia;
    this.httpRequest = new HttpRequest(config, logger);
  }

  async fetchUserBearerToken(): Promise<HttpResponse<UserTokenResponse>> {
    const headers = new Headers();
    headers.append('Content-Type', 'application/json');
    headers.append('Accept', 'application/vnd.salemove.v1+json');

    const body = JSON.stringify({
      api_key_id: this.gliaConfig.userApiKey,
      api_key_secret: this.gliaConfig.userApiKeySecret,
    });

    const requestOptions = {
      body,
      headers,
      method: 'POST',
    };

    const url = `${this.gliaConfig.apiDomain}/operator_authentication/tokens`;
    return this.httpRequest.fetchWithRetry<UserTokenResponse>(url, requestOptions, 'fetchUserBearerToken');
  }
}
