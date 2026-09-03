import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';

/**
 * SignatureBridgeService — the ONLY path from the Stamp Engine to the
 * independent Digital Signature Service. Communication uses the internal
 * service contract (POST /internal/signatures/*) authenticated with a
 * dedicated service credential (x-service-key), never user JWTs.
 *
 * Graceful degradation: when SIGNATURE_SERVICE_URL / SIGNATURE_SERVICE_KEY are
 * not configured, stamp-only issuance continues to work (a document may carry
 * stamp only, signature only, or both). When configured but unreachable, the
 * failure is loud — the pipeline marks the record FAILED for auditability.
 */
@Injectable()
export class SignatureBridgeService {
  private readonly logger = new Logger(SignatureBridgeService.name);

  get configured(): boolean {
    return Boolean(process.env.SIGNATURE_SERVICE_URL && process.env.SIGNATURE_SERVICE_KEY);
  }

  private get baseUrl(): string {
    return (process.env.SIGNATURE_SERVICE_URL || '').replace(/\/+$/, '');
  }

  private headers(correlationId?: string): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'x-service-key': process.env.SIGNATURE_SERVICE_KEY || '',
      ...(correlationId ? { 'x-correlation-id': correlationId } : {}),
    };
  }

  async sign(input: {
    organizationId: string;
    documentId: string;
    documentName?: string;
    documentType?: string;
    canonicalHash: string;
    signerId?: string;
    signerRole?: string;
    metadata?: Record<string, unknown>;
    correlationId?: string;
  }): Promise<{
    signatureId: string;
    algorithm: string;
    keyId: string;
    keyFingerprint?: string;
    signature: string;
    canonicalHash: string;
    signedAt: string;
    signedBy: string;
  }> {
    if (!this.configured) throw new ServiceUnavailableException('Signature service not configured');
    const { canonicalHash, ...rest } = input;
    const res = await this.request<any>('POST', '/internal/signatures/sign', {
      ...rest,
      documentHash: canonicalHash,
    });
    if (!res?.signatureId) {
      throw new ServiceUnavailableException(`Signature service rejected signing request: ${res?.message || 'unknown error'}`);
    }
    return res;
  }

  async verify(input: {
    documentHash: string;
    signature: string;
    keyId?: string;
    correlationId?: string;
  }): Promise<{
    valid: boolean;
    status?: string;
    reason?: string;
    keyId?: string | null;
    keyStatus?: string;
    algorithm?: string;
    signedAt?: string | null;
    signer?: string | null;
    organisation?: string | null;
  } | null> {
    if (!this.configured) return null; // cannot verify without the authority
    try {
      return await this.request('POST', '/internal/signatures/verify', input);
    } catch (err: any) {
      this.logger.warn(`Signature verify bridge failed: ${err?.message}`);
      return null; // verification portal must not hard-fail when bridge is down
    }
  }

  /** Health probe used before issuing to fail fast with a clear audit trail. */
  async healthy(): Promise<boolean> {
    if (!this.configured) return false;
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 3000);
      const res = await fetch(`${this.baseUrl}/internal/signatures/public-key/probe`, {
        method: 'GET',
        headers: this.headers(),
        signal: ctrl.signal,
      });
      clearTimeout(t);
      // 400/404 on a bogus key id still proves auth+availability.
      return [200, 400, 401, 404].includes(res.status);
    } catch {
      return false;
    }
  }

  private async request<T>(method: 'POST' | 'GET', path: string, body?: unknown): Promise<T> {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), Number(process.env.SIGNATURE_SERVICE_TIMEOUT_MS) || 15000);
    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: this.headers((body as any)?.correlationId),
        body: method === 'POST' ? JSON.stringify(body) : undefined,
        signal: ctrl.signal,
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        this.logger.error(`Signature service ${path} → ${res.status}: ${JSON.stringify(json)?.slice(0, 300)}`);
        throw new ServiceUnavailableException(`Signature service returned ${res.status}`);
      }
      return json as T;
    } catch (err: any) {
      if (err instanceof ServiceUnavailableException) throw err;
      this.logger.error(`Signature service ${path} failed: ${err?.message}`);
      throw new ServiceUnavailableException('Signature service unreachable');
    } finally {
      clearTimeout(timeout);
    }
  }
}
