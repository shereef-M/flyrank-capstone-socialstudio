/**
 * In-memory counters for adapter-level retry behavior. Deliberately
 * simple — not persisted, resets on restart — this is operational
 * visibility for a running process, not an audit trail (the database
 * already is one, via SocialPostEntry.status and WebhookEvent).
 */
const counters = {
  rateLimitRetries: 0,
  networkErrorRetries: 0,
};

export function recordRateLimitRetry(): void {
  counters.rateLimitRetries++;
}

export function recordNetworkErrorRetry(): void {
  counters.networkErrorRetries++;
}

export function getRetryMetrics() {
  return { ...counters };
}
