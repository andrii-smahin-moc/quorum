import credentials from './glia-kv-sdk.json';
import { KvStoreFactory, KvStoreInterface } from './src/types/kv-storage-types';

export const kvStoreFactory: KvStoreFactory = {
  initializeKvStore: (repositoryName: string) => {
    return new kvStore(repositoryName);
  },
};

export class kvStore implements KvStoreInterface {
  private accessToken: string;
  private tokenExpiry: number;

  constructor(private repositoryName: string) {
    this.accessToken = '';
    this.tokenExpiry = 0;
  }

  public async get(key: string): Promise<{ value: string }> {
    await this.refreshTokenIfNeeded();
    const result = await this.makeRequest({ key, op: 'get' });
    return result;
  }
  public async set({ key, value }: { key: string; value: string }): Promise<void> {
    await this.refreshTokenIfNeeded();
    await this.makeRequest({ key, op: 'set', value });
  }

  private async makeRequest(operation: { key: string; op: 'get' | 'set'; value?: string }) {
    const headers = new Headers();
    headers.append('Authorization', `Bearer ${this.accessToken}`);
    headers.append('Accept', 'application/vnd.salemove.v1+json');
    headers.append('Content-Type', 'application/json');

    const body = JSON.stringify({ operations: [operation] });
    const requestOptions: RequestInit = { method: 'POST', headers, body };
    const url = `${credentials.GLIA_API_DOMAIN}/api/v2/functions/storage/kv/namespaces/${this.repositoryName}`;

    try {
      const response = await fetch(url, requestOptions);
      const rawText = await response.text();

      let parsed: any;
      try {
        parsed = rawText ? JSON.parse(rawText) : undefined;
      } catch (parseErr) {
        parsed = { raw: rawText };
      }

      if (!response.ok) {
        const message = parsed?.message || parsed?.error || rawText || 'Unknown error';
        throw new Error(`KV request failed (status=${response.status}) op=${operation.op} key=${operation.key}: ${message}`);
      }

      if (parsed && parsed.items && Array.isArray(parsed.items) && parsed.items.length > 0) {
        return parsed.items[0];
      }

      throw new Error(`No items in KV response for op=${operation.op} key=${operation.key}`);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      throw new Error(`Failed KV request op=${operation.op} key=${operation.key}: ${err.message}`);
    }
  }

  private async refreshTokenIfNeeded(): Promise<void> {
    const currentTime = Math.floor(Date.now() / 1000);
    if (this.tokenExpiry <= currentTime) {
      this.accessToken = await this.fetchAuthToken();
      this.tokenExpiry = currentTime + 3599;
    }
  }

  private async fetchAuthToken(): Promise<string> {
    const headers = new Headers();
    headers.append('Content-Type', 'application/json');
    headers.append('Accept', 'application/vnd.salemove.v1+json');

    const body = JSON.stringify({
      api_key_id: credentials.GLIA_API_KEY,
      api_key_secret: credentials.GLIA_API_KEY_SECRET,
    });

    const requestOptions = { body, headers, method: 'POST' };
    const url = `${credentials.GLIA_API_DOMAIN}/operator_authentication/tokens`;

    try {
      const result = await fetch(url, requestOptions);
      const data = (await result.json()) as { token: string };
      return data.token;
    } catch (error) {
      console.error('Error fetching auth token:', error);
      throw new Error('Failed to fetch auth token');
    }
  }
}
