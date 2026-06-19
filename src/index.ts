import { createHmac, timingSafeEqual } from "node:crypto";

/** Options for constructing a {@link Jomabee} client. */
export interface JomabeeOptions {
  apiKey: string;
  /** Required for createPayment / verifyPayment. */
  secretKey?: string;
  /** API base URL, e.g. https://pay.kodbee.com */
  baseUrl?: string;
  /** Request timeout in milliseconds (default 30000). */
  timeoutMs?: number;
}

export interface CreatePaymentParams {
  amount: number;
  product_name: string;
  customer_name?: string;
  customer_email?: string;
  redirect_url?: string;
  callback_url?: string;
  gateway?: "bkash" | "nagad" | "rocket" | "upay";
  expiry_minutes?: number;
}

export interface PaymentCreated {
  invoice_id: string;
  payment_url: string;
  qr_code: string;
  amount: number;
  expires_at: string | null;
}

export interface WebhookEvent {
  event: string;
  invoice_id: string | null;
  trx_id: string | null;
  amount: number;
  gateway: string | null;
  from_number: string | null;
  customer: { name: string | null; email: string | null };
  timestamp: string | null;
}

/** Base error for all client failures. */
export class JomabeeError extends Error {}

/** Thrown when the API returns an error response. */
export class JomabeeApiError extends JomabeeError {
  constructor(
    message: string,
    public readonly code: string = "error",
    public readonly statusCode: number = 0,
  ) {
    super(message);
    this.name = "JomabeeApiError";
  }
}

/** Official JavaScript/TypeScript client for the Jomabee payment API by Kodbee. */
export class Jomabee {
  static readonly VERSION = "1.0.0";

  private readonly apiKey: string;
  private readonly secretKey?: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(opts: JomabeeOptions) {
    if (!opts.apiKey) {
      throw new JomabeeError("apiKey is required.");
    }
    this.apiKey = opts.apiKey;
    this.secretKey = opts.secretKey || undefined;
    this.baseUrl = (opts.baseUrl ?? "https://pay.kodbee.com").replace(/\/+$/, "");
    this.timeoutMs = opts.timeoutMs ?? 30_000;
  }

  /** Create a payment invoice and get a hosted payment URL + QR. */
  createPayment(params: CreatePaymentParams): Promise<PaymentCreated> {
    this.requireSecret("createPayment");
    return this.request<PaymentCreated>(
      "POST",
      "/api/v1/payment/create",
      params as unknown as Record<string, unknown>,
      true,
    );
  }

  /** Verify a payment by TrxID against an invoice. */
  verifyPayment(
    invoiceId: string,
    trxId: string,
    gateway?: string,
  ): Promise<Record<string, unknown>> {
    this.requireSecret("verifyPayment");
    const body: Record<string, unknown> = { invoice_id: invoiceId, trx_id: trxId };
    if (gateway) body.gateway = gateway;
    return this.request("POST", "/api/v1/payment/verify", body, true);
  }

  /** Get the current status of an invoice. */
  paymentStatus(invoiceId: string): Promise<Record<string, unknown>> {
    return this.request("GET", `/api/v1/payment/status/${encodeURIComponent(invoiceId)}`);
  }

  /** List transactions. */
  transactions(query: Record<string, string | number> = {}): Promise<Record<string, unknown>> {
    const qs = new URLSearchParams(
      Object.entries(query).map(([k, v]) => [k, String(v)]),
    ).toString();
    return this.request("GET", `/api/v1/transactions${qs ? `?${qs}` : ""}`);
  }

  /** Get the merchant balance. */
  balance(): Promise<Record<string, unknown>> {
    return this.request("GET", "/api/v1/balance");
  }

  private requireSecret(method: string): void {
    if (!this.secretKey) {
      throw new JomabeeError(`Jomabee.${method}() requires a secretKey.`);
    }
  }

  private async request<T = Record<string, unknown>>(
    method: string,
    path: string,
    body?: Record<string, unknown>,
    withSecret = false,
  ): Promise<T> {
    const headers: Record<string, string> = {
      Accept: "application/json",
      "X-API-Key": this.apiKey,
      "User-Agent": `jomabee-js/${Jomabee.VERSION}`,
    };
    if (withSecret && this.secretKey) headers["X-Secret-Key"] = this.secretKey;

    const init: RequestInit = { method, headers };
    if (method !== "GET" && body) {
      headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(body);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    init.signal = controller.signal;

    let res: Response;
    try {
      res = await fetch(this.baseUrl + path, init);
    } catch (err) {
      throw new JomabeeError(`HTTP request failed: ${(err as Error).message}`);
    } finally {
      clearTimeout(timer);
    }

    const json = (await res.json().catch(() => null)) as
      | { success?: boolean; data?: T; error?: { code?: string; message?: string } }
      | null;

    if (!json) {
      throw new JomabeeApiError("Unexpected non-JSON response.", "invalid_response", res.status);
    }
    if (!res.ok || json.success === false) {
      throw new JomabeeApiError(
        json.error?.message ?? "Request failed.",
        json.error?.code ?? "error",
        res.status,
      );
    }
    return (json.data ?? {}) as T;
  }
}

/** Header carrying the webhook HMAC signature. */
export const SIGNATURE_HEADER = "X-Jomabee-Signature";

/**
 * Verify a Jomabee webhook by recomputing the HMAC-SHA256 of the raw request
 * body. Pass the exact raw body string received (do not re-serialize).
 */
export function verifyWebhookSignature(
  rawBody: string,
  signature: string,
  secret: string,
): boolean {
  if (!signature || !secret) return false;
  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Verify and parse a webhook. Throws on invalid signature or body.
 */
export function parseWebhook(rawBody: string, signature: string, secret: string): WebhookEvent {
  if (!verifyWebhookSignature(rawBody, signature, secret)) {
    throw new JomabeeError("Webhook signature verification failed.");
  }
  return JSON.parse(rawBody) as WebhookEvent;
}
