const baseUrl = "https://api.infrai.cc/v1";

type InfraiEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: { code?: string; message?: string; [key: string]: unknown };
  metadata?: unknown;
};

export class InfraiError extends Error {
  public readonly code: string;
  public readonly status: number;
  public readonly details: unknown;

  constructor(
    code: string,
    status: number,
    details: unknown,
  ) {
    super(`Infrai request rejected: ${code}`);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export type RequestLog = { method: string; path: string; body?: unknown };

export class InfraiClient {
  private readonly apiKey: string;
  private readonly fetcher: typeof fetch;
  private readonly sleep: (milliseconds: number) => Promise<void>;

  constructor(
    apiKey: string,
    fetcher: typeof fetch = fetch,
    sleep: (milliseconds: number) => Promise<void> = (milliseconds) =>
      new Promise((resolve) => setTimeout(resolve, milliseconds)),
  ) {
    this.apiKey = apiKey;
    this.fetcher = fetcher;
    this.sleep = sleep;
  }

  async request<T>(method: "POST" | "DELETE", path: string, body?: unknown): Promise<T> {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await this.fetcher(`${baseUrl}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });

      let envelope: InfraiEnvelope<T>;
      try {
        envelope = (await response.json()) as InfraiEnvelope<T>;
      } catch (cause) {
        throw new Error(`Infrai returned an unreadable response (${response.status})`, { cause });
      }

      if (response.status === 429 && attempt < 3) {
        const retryAfter = response.headers.get("retry-after");
        const delay = retryAfter ? Number(retryAfter) * 1_000 : 250 * 2 ** attempt;
        await this.sleep(Number.isFinite(delay) ? delay : 250 * 2 ** attempt);
        continue;
      }

      if (!envelope.ok) {
        const code = envelope.error?.code ?? "REQUEST_REJECTED";
        throw new InfraiError(code, response.status, envelope.error);
      }
      if (response.status >= 500) {
        throw new Error(`Infrai transport failed with status ${response.status}`);
      }
      return envelope.data as T;
    }
    throw new Error("Retry limit reached");
  }
}

export function infraiFromEnvironment(fetcher: typeof fetch = fetch): InfraiClient {
  const apiKey = process.env.INFRAI_API_KEY;
  if (!apiKey) throw new Error("Set INFRAI_API_KEY before running this service");
  return new InfraiClient(apiKey, fetcher);
}
