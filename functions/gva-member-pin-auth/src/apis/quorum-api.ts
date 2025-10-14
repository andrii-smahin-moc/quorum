import type { FunctionConfig, HttpResponse, LoggerInterface, UnknownResponse } from '../types';

import { HttpRequest } from './http-request';

export class QuorumApi {
  private httpRequest: HttpRequest;

  constructor(
    private config: FunctionConfig,
    logger: LoggerInterface,
  ) {
    this.httpRequest = new HttpRequest(config, logger, { nonRetirableStatusCodes: [500, 503] });
  }

  initOtpAuthentication(idValue: string): Promise<HttpResponse<UnknownResponse>> {
    const headers = new Headers();
    headers.append('Content-Type', 'application/json');
    headers.append('X-GVA-API-Key', this.config.quorumConfig.quorumApiHeader);

    const body = JSON.stringify({
      identifiers: [
        {
          idType: this.config.quorumConfig.otpIdentifierType,
          idValue,
        },
      ],
    });

    const requestOptions = {
      body,
      headers,
      method: 'POST',
    };

    const url = `${this.config.quorumConfig.quorumApiDomain}/auth/otp`;
    return this.httpRequest.fetchWithRetry<UnknownResponse>(url, requestOptions, 'initOtpAuthentication');
  }

  verifyMemberExists(idValue: string): Promise<HttpResponse<UnknownResponse>> {
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

  verifyMemberPin(idValue: string, pin: string): Promise<HttpResponse<UnknownResponse>> {
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
  verifyOtpCode(idValue: string, code: string): Promise<HttpResponse<UnknownResponse>> {
    const headers = new Headers();
    headers.append('Content-Type', 'application/json');
    headers.append('X-GVA-API-Key', this.config.quorumConfig.quorumApiHeader);

    const body = JSON.stringify({
      code,
      identifiers: [
        {
          idType: this.config.quorumConfig.otpIdentifierType,
          idValue,
        },
      ],
    });

    const requestOptions = {
      body,
      headers,
      method: 'POST',
    };

    const url = `${this.config.quorumConfig.quorumApiDomain}/auth/otp/verify`;
    return this.httpRequest.fetchWithRetry<UnknownResponse>(url, requestOptions, 'verifyOtpCode');
  }
}
