/**
 * Communication channels supported by the SmartTech Communications Cloud.
 * Maps directly to the CommCloudChannel Prisma enum.
 */
export type CommCloudChannel = 'SMS' | 'EMAIL' | 'WHATSAPP' | 'PUSH' | 'IN_APP';

/**
 * Message type classification for routing, billing, and analytics.
 */
export type CommCloudMessageType =
  | 'transactional'
  | 'bulk'
  | 'OTP'
  | 'marketing'
  | 'emergency'
  | 'system';

/**
 * Message lifecycle statuses.
 * Maps directly to the CommCloudMessageStatus Prisma enum.
 */
export type CommCloudMessageStatus =
  | 'QUEUED'
  | 'PROCESSING'
  | 'SENT'
  | 'DELIVERED'
  | 'FAILED'
  | 'READ'
  | 'OPENED'
  | 'CLICKED'
  | 'CANCELLED'
  | 'SCHEDULED';

/**
 * Priority levels for message processing and routing.
 */
export enum MessagePriority {
  LOW = 'LOW',
  NORMAL = 'NORMAL',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

/**
 * File attachment metadata.
 */
export interface Attachment {
  filename: string;
  url: string;
  type: string;
  size?: number;
}

/**
 * Options for sending an SMS message.
 */
export interface SendSmsOptions {
  /** Recipient phone number (E.164 format recommended). */
  to: string;
  /** Plain-text SMS body content. */
  body: string;
  /** Sender ID or alphanumeric identifier (e.g. "SMARTTECH"). */
  senderId?: string;
  /** Optional template ID for pre-approved message templates. */
  templateId?: string;
  /** Template variable substitutions. */
  templateData?: Record<string, unknown>;
  /** Scheduled delivery time. */
  scheduledAt?: Date;
  /** Message priority for queue ordering. */
  priority?: MessagePriority;
  /** Custom metadata attached to the message. */
  metadata?: Record<string, unknown>;
}

/**
 * Options for sending an email message.
 */
export interface SendEmailOptions {
  /** Recipient email address(es). */
  to: string | string[];
  /** Email subject line. */
  subject: string;
  /** Plain-text email body. */
  body?: string;
  /** HTML email body. */
  htmlBody?: string;
  /** Carbon-copy recipients. */
  cc?: string | string[];
  /** Blind carbon-copy recipients. */
  bcc?: string | string[];
  /** Reply-to address. */
  replyTo?: string;
  /** Optional template ID. */
  templateId?: string;
  /** Template variable substitutions. */
  templateData?: Record<string, unknown>;
  /** File attachments. */
  attachments?: Attachment[];
  /** Scheduled delivery time. */
  scheduledAt?: Date;
  /** Message priority. */
  priority?: MessagePriority;
  /** Custom metadata. */
  metadata?: Record<string, unknown>;
}

/**
 * Options for sending a WhatsApp message.
 */
export interface SendWhatsAppOptions {
  /** Recipient phone number (E.164 format). */
  to: string;
  /** Message body text. */
  body: string;
  /** Media attachment URL (images, documents, video, audio). */
  mediaUrl?: string;
  /** Media MIME type. */
  mediaType?: string;
  /** WhatsApp template name (for template messages). */
  templateId?: string;
  /** Template body parameters. */
  templateData?: Record<string, unknown>;
  /** Header media URL for template messages. */
  headerMediaUrl?: string;
  /** Link preview preference. */
  previewUrl?: boolean;
  /** Scheduled delivery time. */
  scheduledAt?: Date;
  /** Message priority. */
  priority?: MessagePriority;
  /** Custom metadata. */
  metadata?: Record<string, unknown>;
}

/**
 * Options for sending a push notification.
 */
export interface SendPushOptions {
  /** Recipient device token(s) or FCM/APNS registration tokens. */
  to: string | string[];
  /** Notification title. */
  title: string;
  /** Notification body text. */
  body: string;
  /** Custom data payload sent with the notification. */
  data?: Record<string, unknown>;
  /** Notification channel ID (Android). */
  channelId?: string;
  /** Notification icon URL. */
  icon?: string;
  /** Notification click action. */
  clickAction?: string;
  /** Sound file to play. */
  sound?: string;
  /** Badge number to display. */
  badge?: number;
  /** Whether the notification is silent (data-only). */
  silent?: boolean;
  /** Scheduled delivery time. */
  scheduledAt?: Date;
  /** Message priority. */
  priority?: MessagePriority;
  /** Custom metadata. */
  metadata?: Record<string, unknown>;
}

/**
 * Options for sending an in-app notification.
 */
export interface SendInAppOptions {
  /** Recipient user ID(s). */
  to: string | string[];
  /** Notification title. */
  title: string;
  /** Notification body content. */
  body: string;
  /** Notification type for UI rendering. */
  type?: 'info' | 'success' | 'warning' | 'error';
  /** URL or deep link to open on click. */
  actionUrl?: string;
  /** Optional icon or image URL. */
  icon?: string;
  /** Notification category for grouping. */
  category?: string;
  /** Expiration time for the notification. */
  expiresAt?: Date;
  /** Message priority. */
  priority?: MessagePriority;
  /** Custom metadata. */
  metadata?: Record<string, unknown>;
}

/**
 * Result of a single message send operation across any channel.
 */
export interface SendResult {
  /** Whether the message was accepted by the provider. */
  success: boolean;
  /** Name of the provider that handled the message. */
  provider: string;
  /** Internal message ID (CommCloudMessage.id). */
  messageId: string;
  /** Provider's external message ID for tracking. */
  providerMessageId?: string;
  /** Current status of the message. */
  status: CommCloudMessageStatus;
  /** Monetary cost of sending the message. */
  cost?: number;
  /** Currency code (e.g. "USD", "TZS"). */
  currency?: string;
  /** Credits consumed from the wallet. */
  creditsUsed?: number;
  /** Error message if sending failed. */
  error?: string;
  /** Provider's raw response payload. */
  rawResponse?: unknown;
}

/**
 * Result of a batch message send operation.
 */
export interface BatchSendResult {
  /** Total number of messages in the batch. */
  total: number;
  /** Number of successfully sent messages. */
  successCount: number;
  /** Number of failed messages. */
  failureCount: number;
  /** Individual results per message. */
  results: SendResult[];
  /** Indexed errors for failed messages. */
  errors?: { index: number; error: string; recipient?: string }[];
}

/**
 * Delivery status update received from a provider callback or webhook.
 */
export interface DeliveryStatus {
  /** Internal message ID. */
  messageId: string;
  /** Provider's external message ID. */
  providerMessageId?: string;
  /** Updated message status. */
  status: CommCloudMessageStatus;
  /** Provider-specific status code. */
  statusCode?: string;
  /** Human-readable status description. */
  description?: string;
  /** Cost incurred at this stage. */
  cost?: number;
  /** Round-trip latency in milliseconds. */
  latencyMs?: number;
  /** Timestamp of the status event. */
  timestamp: Date;
  /** Provider's raw response payload. */
  rawResponse?: unknown;
}
