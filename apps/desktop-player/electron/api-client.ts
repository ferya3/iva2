import type { EventBatch, EventBatchAck } from '@cognitest/shared-types';
import type { BatchTransport, TransportResult } from '@cognitest/event-recorder';
import type { CalibrationPayload, PlayerSession } from './ipc-contract';

export class ApiFailure extends Error {
  constructor(
    readonly kind: 'network' | 'http',
    message: string,
    readonly status?: number,
    readonly code?: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
  }

  get retryable(): boolean {
    return this.kind === 'network' || this.status === 429 || (this.status ?? 0) >= 500;
  }
}

type Fetch = typeof fetch;

/**
 * HTTP client of the player API. Lives in the main process: the renderer
 * has no network access at all (CSP connect-src 'none').
 */
export class PlayerApiClient implements BatchTransport {
  private token: string | null = null;

  constructor(
    private readonly baseUrl: string,
    private readonly fetchImpl: Fetch = fetch,
    private readonly timeoutMs = 20_000,
    private readonly userAgent = 'CognitestPlayer',
  ) {}

  setToken(token: string | null): void {
    this.token = token;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<{ status: number; body: T }> {
    let res: Response;
    try {
      res = await this.fetchImpl(this.baseUrl + path, {
        method,
        headers: {
          Accept: 'application/json',
          'Accept-Language': 'fa',
          'User-Agent': this.userAgent,
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      throw new ApiFailure('network', error instanceof Error ? error.message : String(error));
    }
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      const failure = new ApiFailure('http', String(json.message ?? res.statusText), res.status, json.code as string | undefined, json.details as Record<string, unknown> | undefined);
      if (res.status === 429) {
        const retryAfter = Number(res.headers.get('Retry-After'));
        Object.assign(failure, { retryAfterMs: Number.isFinite(retryAfter) ? retryAfter * 1000 : undefined });
      }
      throw failure;
    }
    return { status: res.status, body: json as T };
  }

  async join(code: string, deviceId: string): Promise<{ token: string; session: PlayerSession }> {
    return (await this.request<{ token: string; session: PlayerSession }>('POST', '/player/join', { code, device_id: deviceId })).body;
  }

  async session(): Promise<PlayerSession> {
    return (await this.request<{ session: PlayerSession }>('GET', '/player/session')).body.session;
  }

  async deviceCheck(sessionId: string, info: Record<string, unknown>): Promise<{ status: string }> {
    return (await this.request<{ status: string }>('POST', `/sessions/${sessionId}/device-check`, info)).body;
  }

  async calibration(sessionId: string, result: CalibrationPayload) {
    return (
      await this.request<{ verdict: 'pass' | 'warn' | 'fail'; reasons: Array<{ code: string; message: string }>; status: string }>(
        'POST',
        `/sessions/${sessionId}/calibration`,
        result,
      )
    ).body;
  }

  async start(sessionId: string, offline?: { seed: number; startedAt: string }): Promise<{ seed: number }> {
    const body = offline ? { offline_seed: offline.seed, offline_started_at: offline.startedAt } : {};
    return (await this.request<{ seed: number }>('POST', `/sessions/${sessionId}/start`, body)).body;
  }

  async complete(sessionId: string, finalSequence: number): Promise<{ status: string; missing_from: number | null }> {
    return (await this.request<{ status: string; missing_from: number | null }>('POST', `/sessions/${sessionId}/complete`, { final_sequence: finalSequence })).body;
  }

  /** BatchTransport: maps HTTP outcomes onto the sync worker's vocabulary. */
  async send(batch: EventBatch): Promise<TransportResult> {
    try {
      const { body } = await this.request<EventBatchAck>('POST', `/sessions/${batch.session_id}/events/batch`, batch);
      return { kind: 'acked', ack: body };
    } catch (error) {
      if (!(error instanceof ApiFailure)) throw error;
      if (error.retryable) {
        return { kind: 'retryable', error: error.message, retryAfterMs: (error as ApiFailure & { retryAfterMs?: number }).retryAfterMs };
      }
      if (error.status === 409 && error.code === 'sequence_conflict') {
        return { kind: 'sequence_conflict', expectedSequence: Number(error.details?.expected_sequence) };
      }
      return { kind: 'rejected', status: error.status ?? 0, message: `${error.code ?? 'error'}: ${error.message}` };
    }
  }
}
