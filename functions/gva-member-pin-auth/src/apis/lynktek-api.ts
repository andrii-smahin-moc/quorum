import type { FunctionConfig, HttpResponse, LoggerInterface, UnknownResponse } from '../types';

import { HttpRequest } from './http-request';

export class LynktekApi {
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
    headers.append('x-gva-api-key', this.config.lynktekConfig.lynktekApiHeader);

    const body = JSON.stringify({
      identifiers: [
        {
          idType: this.config.lynktekConfig.otpIdentifierType,
          idValue,
        },
      ],
    });

    const requestOptions = {
      body,
      headers,
      method: 'POST',
    };

    const url = `${this.config.lynktekConfig.lynktekApiDomain}/auth/otp`;
    return this.httpRequest.fetchWithRetry<UnknownResponse>(url, requestOptions, 'initOtpAuthentication');
  }

  verifyMemberExists(idValue: string): Promise<HttpResponse<UnknownResponse>> {
    const headers = new Headers();
    headers.append('Content-Type', 'application/json');
    headers.append('x-gva-api-key', this.config.lynktekConfig.lynktekApiHeader);

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

    const url = `${this.config.lynktekConfig.lynktekApiDomain}/auth/pin`;
    return this.httpRequest.fetchWithRetry<UnknownResponse>(url, requestOptions, 'verifyMemberExists');
  }

  verifyMemberPin(idValue: string, pin: string): Promise<HttpResponse<UnknownResponse>> {
    const headers = new Headers();
    headers.append('Content-Type', 'application/json');
    headers.append('x-gva-api-key', this.config.lynktekConfig.lynktekApiHeader);

    const body = JSON.stringify({
      identifiers: [
        {
          idType: 'MEMBER_NUMBER',
          idValue,
        },
      ],
      pin: Number(pin),
    });

    const requestOptions = {
      body,
      headers,
      method: 'POST',
    };

    const url = `${this.config.lynktekConfig.lynktekApiDomain}/auth/pin/verify`;
    return this.httpRequest.fetchWithRetry<UnknownResponse>(url, requestOptions, 'verifyMemberPin');
  }
  verifyOtpCode(idValue: string, otp: string): Promise<HttpResponse<UnknownResponse>> {
    const headers = new Headers();
    headers.append('Content-Type', 'application/json');
    headers.append('x-gva-api-key', this.config.lynktekConfig.lynktekApiHeader);

    const body = JSON.stringify({
      identifiers: [
        {
          idType: this.config.lynktekConfig.otpIdentifierType,
          idValue,
        },
      ],
      otp: Number(otp),
    });

    const requestOptions = {
      body,
      headers,
      method: 'POST',
    };

    const url = `${this.config.lynktekConfig.lynktekApiDomain}/auth/otp/verify`;
    return this.httpRequest.fetchWithRetry<UnknownResponse>(url, requestOptions, 'verifyOtpCode');
  }
}
