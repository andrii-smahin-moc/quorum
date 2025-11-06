export interface ErrorResponse {
  status: false;
  error: string;
}

export type ServiceResponse<T> = ErrorResponse | T;

export type UnknownResponse = Record<string, unknown>;
