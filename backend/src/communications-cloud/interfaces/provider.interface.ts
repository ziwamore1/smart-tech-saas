import type {
  SendSmsOptions,
  SendEmailOptions,
  SendWhatsAppOptions,
  SendPushOptions,
  SendInAppOptions,
  SendResult,
} from './message.interface';

// ---------------------------------------------------------------------------
// Provider Configuration Types
// ---------------------------------------------------------------------------

/**
 * Generic provider configuration base.
 * Specific providers extend this with their own credential fields.
 */
export interface BaseProviderConfig {
  /** Provider type identifier (e.g. "beem", "twilio", "zoho", "firebase"). */
  providerType: string;
  /** Whether this configuration is active. */
  isActive?: boolean;
  /** Optional notes or description. */
  notes?: string;
}

/**
 * SMS provider configuration.
 */
export interface SmsProviderConfig extends BaseProviderConfig {
  /** API key or SID for authentication. */
  apiKey?: string;
  /** API secret or auth token. */
  apiSecret?: string;
  /** Default sender ID (e.g. "SMARTTECH"). */
  senderId?: string;
  /** Webhook URL for delivery receipts. */
  webhookUrl?: string;
}

/**
 * Email provider configuration.
 */
export interface EmailProviderConfig extends BaseProviderConfig {
  /** SMTP host or API endpoint. */
  host?: string;
  /** SMTP port. */
  port?: number;
  /** SMTP/API username. */
  username?: string;
  /** SMTP/API password. */
  password?: string;
  /** Default from-email address. */
  fromEmail?: string;
  /** Default from-name. */
  fromName?: string;
  /** Whether to use TLS/SSL. */
  secure?: boolean;
}

/**
 * WhatsApp Business API provider configuration.
 */
export interface WhatsAppProviderConfig extends BaseProviderConfig {
  /** WhatsApp Business Account ID. */
  businessAccountId?: string;
  /** Phone number ID assigned to the WhatsApp Business Account. */
  phoneNumberId?: string;
  /** Permanent or temporary access token. */
  accessToken?: string;
  /** Webhook verification token. */
  webhookVerifyToken?: string;
  /** Default message template namespace. */
  templateNamespace?: string;
}

/**
 * Push notification provider configuration.
 */
export interface PushProviderConfig extends BaseProviderConfig {
  /** FCM server key (legacy). */
  serverKey?: string;
  /** FCM service account JSON (for HTTP v1 API). */
  serviceAccountJson?: Record<string, unknown>;
  /** APNs key ID (Apple Push Notification). */
  apnsKeyId?: string;
  /** APNs team ID. */
  apnsTeamId?: string;
  /** APNs private key. */
  apnsPrivateKey?: string;
  /** APNs topic (bundle identifier). */
  apnsTopic?: string;
  /** Firebase project ID. */
  projectId?: string;
}

/**
 * In-app notification provider configuration.
 */
export interface InAppProviderConfig extends BaseProviderConfig {
  /** WebSocket or SSE endpoint for real-time delivery. */
  endpointUrl?: string;
  /** API key for the in-app notification service. */
  apiKey?: string;
  /** Connection timeout in milliseconds. */
  connectionTimeoutMs?: number;
  /** Maximum concurrent connections. */
  maxConnections?: number;
}

// ---------------------------------------------------------------------------
// Provider Interfaces
// ---------------------------------------------------------------------------

/**
 * Contract for an SMS provider implementation.
 *
 * @typeParam TOptions - Provider-specific SMS send options.
 * @typeParam TResult - Provider-specific send result.
 */
export interface SmsProvider<
  TOptions extends SendSmsOptions = SendSmsOptions,
  TResult extends SendResult = SendResult,
> {
  /**
   * Send an SMS message through this provider.
   * @param options - SMS message options.
   * @returns Send result indicating success or failure.
   */
  send(options: TOptions): Promise<TResult>;

  /**
   * Retrieve the current account balance from the provider.
   * @returns Object containing the balance and currency.
   */
  getBalance(): Promise<{ balance: number; currency: string }>;

  /**
   * Perform a health check against the provider's API.
   * @returns Health status with latency measurement.
   */
  healthCheck(): Promise<{ status: string; latencyMs: number; details?: string }>;
}

/**
 * Contract for an Email provider implementation.
 *
 * @typeParam TOptions - Provider-specific email send options.
 * @typeParam TResult - Provider-specific send result.
 */
export interface EmailProvider<
  TOptions extends SendEmailOptions = SendEmailOptions,
  TResult extends SendResult = SendResult,
> {
  /**
   * Send an email message through this provider.
   * @param options - Email message options.
   * @returns Send result indicating success or failure.
   */
  send(options: TOptions): Promise<TResult>;

  /**
   * Retrieve the current account balance from the provider.
   * @returns Object containing the balance and currency.
   */
  getBalance(): Promise<{ balance: number; currency: string }>;

  /**
   * Perform a health check against the provider's API.
   * @returns Health status with latency measurement.
   */
  healthCheck(): Promise<{ status: string; latencyMs: number; details?: string }>;
}

/**
 * Contract for a WhatsApp Business provider implementation.
 *
 * @typeParam TOptions - Provider-specific WhatsApp send options.
 * @typeParam TResult - Provider-specific send result.
 */
export interface WhatsAppProvider<
  TOptions extends SendWhatsAppOptions = SendWhatsAppOptions,
  TResult extends SendResult = SendResult,
> {
  /**
   * Send a WhatsApp message through this provider.
   * @param options - WhatsApp message options.
   * @returns Send result indicating success or failure.
   */
  send(options: TOptions): Promise<TResult>;

  /**
   * Retrieve the current WhatsApp Business account balance.
   * @returns Object containing the balance and currency.
   */
  getBalance(): Promise<{ balance: number; currency: string }>;

  /**
   * Perform a health check against the WhatsApp Business API.
   * @returns Health status with latency measurement.
   */
  healthCheck(): Promise<{ status: string; latencyMs: number; details?: string }>;
}

/**
 * Contract for a Push notification provider implementation.
 *
 * @typeParam TOptions - Provider-specific push send options.
 * @typeParam TResult - Provider-specific send result.
 */
export interface PushProvider<
  TOptions extends SendPushOptions = SendPushOptions,
  TResult extends SendResult = SendResult,
> {
  /**
   * Send a push notification through this provider.
   * @param options - Push notification options.
   * @returns Send result indicating success or failure.
   */
  send(options: TOptions): Promise<TResult>;

  /**
   * Perform a health check against the push notification service.
   * @returns Health status with latency measurement.
   */
  healthCheck(): Promise<{ status: string; latencyMs: number; details?: string }>;
}

/**
 * Contract for an In-App notification provider implementation.
 *
 * @typeParam TOptions - Provider-specific in-app send options.
 * @typeParam TResult - Provider-specific send result.
 */
export interface InAppProvider<
  TOptions extends SendInAppOptions = SendInAppOptions,
  TResult extends SendResult = SendResult,
> {
  /**
   * Send an in-app notification through this provider.
   * @param options - In-app notification options.
   * @returns Send result indicating success or failure.
   */
  send(options: TOptions): Promise<TResult>;
}
