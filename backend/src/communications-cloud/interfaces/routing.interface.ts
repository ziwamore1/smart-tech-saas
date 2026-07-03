import type {
  CommCloudChannel,
  CommCloudMessageType,
  MessagePriority,
} from './message.interface';

/**
 * Routing strategy used to determine which provider handles a message.
 * Maps to the ruleType field in CommCloudRoutingRule.
 */
export enum RoutingStrategy {
  /** Always use the designated preferred provider. */
  PREFERRED = 'preferred',
  /** Route to the provider with the lowest cost per message. */
  CHEAPEST = 'cheapest',
  /** Route to the provider with the highest delivery success rate. */
  HIGHEST_DELIVERY = 'highest_delivery',
  /** Route based on the recipient's country or region. */
  COUNTRY_BASED = 'country_based',
  /** Route using the school's preferred provider configuration. */
  SCHOOL_PREFERRED = 'school_preferred',
  /** Route based on provider priority scores. */
  PRIORITY_BASED = 'priority_based',
  /** Fallback to an alternative provider if the primary fails. */
  FALLBACK = 'fallback',
}

/**
 * Backoff strategy for retry delays.
 */
export type RetryBackoffStrategy = 'exponential' | 'linear' | 'fixed';

/**
 * Routing rule model matching the CommCloudRoutingRule Prisma schema.
 */
export interface RoutingRule {
  /** Unique identifier. */
  id: string;
  /** Human-readable rule name. */
  name: string;
  /** Communication channel this rule applies to. */
  channel: CommCloudChannel;
  /** Routing strategy type. */
  ruleType: RoutingStrategy | string;
  /** Rule evaluation priority (lower = evaluated first). */
  priority: number;
  /** Whether this rule is currently active. */
  isActive: boolean;
  /** Conditions that trigger this rule (country, school, message type, etc.). */
  conditions?: Record<string, unknown>;
  /** Ordered list of provider IDs for primary routing and failover. */
  providerOrder: string[];
  /** The preferred provider ID for PREFERRED strategy. */
  preferredProviderId?: string;
  /** Ordered list of fallback provider IDs if the primary fails. */
  fallbackProviderIds?: string[];
  /** Maximum number of retry attempts. */
  maxRetries: number;
  /** Delay between retries in milliseconds. */
  retryDelayMs: number;
  /** Backoff algorithm for retry timing. */
  retryBackoff: RetryBackoffStrategy;
  /** Number of times this rule has been used. */
  timesUsed: number;
  /** Timestamp of the last use. */
  lastUsedAt?: Date;
  /** Timestamp when the rule was created. */
  createdAt: Date;
  /** Timestamp of the last update. */
  updatedAt: Date;
}

/**
 * Decision produced by the routing engine indicating which provider
 * should handle a given message and why.
 */
export interface RoutingDecision {
  /** The selected provider's ID. */
  providerId: string;
  /** The selected provider's display name. */
  providerName: string;
  /** The routing strategy that produced this decision. */
  strategy: RoutingStrategy;
  /** Human-readable explanation for the decision. */
  reason: string;
  /** Confidence score (0.0 - 1.0) of the decision. */
  confidence: number;
  /** Estimated cost of sending via this provider. */
  estimatedCost?: number;
  /** Estimated latency in milliseconds. */
  estimatedLatencyMs?: number;
}

/**
 * Contextual information used by the routing engine to make decisions.
 */
export interface RoutingContext {
  /** Communication channel of the message. */
  channel: CommCloudChannel;
  /** Type or category of the message. */
  messageType: CommCloudMessageType;
  /** Recipient address (phone, email, token, or user ID). */
  recipient: string;
  /** Recipient's country code (ISO 3166-1 alpha-2, e.g. "TZ", "KE"). */
  country?: string;
  /** School ID if the message is scoped to a specific school. */
  schoolId?: string;
  /** User ID of the recipient or sender. */
  userId?: string;
  /** Message priority level. */
  priority: MessagePriority;
}

/**
 * Retry configuration for failed message deliveries.
 */
export interface RetryConfig {
  /** Maximum number of retry attempts. */
  maxRetries: number;
  /** Base delay between retries in milliseconds. */
  retryDelayMs: number;
  /** Backoff strategy applied to successive retries. */
  retryBackoff: RetryBackoffStrategy;
  /** Maximum total time to keep retrying (in milliseconds). */
  maxRetryDurationMs?: number;
  /** Whether to retry on any error or only specific error types. */
  retryableErrors?: string[];
}

/**
 * Current health status of a message provider.
 */
export interface ProviderHealth {
  /** Provider's unique identifier. */
  providerId: string;
  /** Provider's display name. */
  providerName: string;
  /** Operational status. */
  status: 'active' | 'degraded' | 'down' | 'maintenance';
  /** Whether the provider is enabled in the system. */
  isActive: boolean;
  /** Recent delivery success rate (percentage 0-100). */
  successRate: number;
  /** Average API response latency in milliseconds. */
  avgLatencyMs: number;
  /** Timestamp of the last health check. */
  lastHealthCheckAt?: Date;
  /** Last error message encountered. */
  lastError?: string;
  /** Total messages sent through this provider. */
  totalSent: number;
  /** Total messages that failed. */
  totalFailed: number;
}
