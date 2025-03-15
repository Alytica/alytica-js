import { ApiClientConfig } from "./types";

export class ApiClient {
  baseUrl: string;
  private headers: Record<string, string | Promise<string | null>>;
  private maxRetries: number;
  private initialRetryDelay: number;

  constructor(config: ApiClientConfig) {
    this.baseUrl = config.baseUrl;
    this.headers = {
      "Content-Type": "application/json",
      ...config.defaultHeaders,
    };
    this.maxRetries = config.maxRetries ?? 3;
    this.initialRetryDelay = config.initialRetryDelay ?? 500;
  }

  async resolveHeaders(): Promise<Record<string, string>> {
    const resolvedHeaders: Record<string, string> = {};
    for (const [key, value] of Object.entries(this.headers)) {
      const resolvedValue = await value;
      if (resolvedValue !== null) {
        resolvedHeaders[key] = resolvedValue;
      }
    }
    return resolvedHeaders;
  }

  addHeader(key: string, value: string | Promise<string | null>): void {
    this.headers[key] = value;
  }

  private async post(
    url: string,
    data: any,
    options: RequestInit = {},
    retryCount: number = 0
  ): Promise<any | null> {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: await this.resolveHeaders(),
        body: JSON.stringify(data ?? {}),
        keepalive: true,
        ...options,
      });

      if (response.status === 401) {
        return null;
      }

      if (response.status !== 200 && response.status !== 202) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const responseText = await response.text();
      return responseText ? JSON.parse(responseText) : null;
    } catch (error) {
      if (retryCount < this.maxRetries) {
        const delay = this.initialRetryDelay * Math.pow(2, retryCount);
        await new Promise((resolve) => setTimeout(resolve, delay));
        return this.post(url, data, options, retryCount + 1);
      }
      console.error("Max retries reached:", error);
      return null;
    }
  }

  async fetch(
    endpoint: string,
    data: any,
    options: RequestInit = {}
  ): Promise<any | null> {
    const fullUrl = `${this.baseUrl}${endpoint}`;
    return this.post(fullUrl, data, options, 0);
  }
}
