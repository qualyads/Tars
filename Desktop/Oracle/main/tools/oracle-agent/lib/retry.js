/**
 * Retry - Exponential Backoff with Jitter จาก OpenClaw Pattern
 *
 * Features:
 * - Exponential backoff (delay = min × 2^attempt)
 * - Jitter to avoid thundering herd
 * - Respect Retry-After headers
 * - Custom shouldRetry function
 * - onRetry callback for logging
 *
 * @module retry
 */

// ============================================================
// Constants
// ============================================================

/**
 * Default retry configuration
 */
export const DEFAULT_RETRY_CONFIG = {
  attempts: 3,
  minDelayMs: 300,
  maxDelayMs: 30000,
  jitter: 0.1,
};

/**
 * Transient network error codes (safe to retry)
 */
export const TRANSIENT_ERROR_CODES = new Set([
  'ECONNRESET',
  'ECONNREFUSED',
  'ENOTFOUND',
  'ETIMEDOUT',
  'ESOCKETTIMEDOUT',
  'EPIPE',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'EAI_AGAIN',
]);

/**
 * Fatal error codes (do not retry)
 */
export const FATAL_ERROR_CODES = new Set([
  'ERR_OUT_OF_MEMORY',
  'ERR_SCRIPT_EXECUTION_TIMEOUT',
  'ERR_WORKER_OUT_OF_MEMORY',
]);

/**
 * Config error codes (do not retry)
 */
export const CONFIG_ERROR_CODES = new Set([
  'INVALID_CONFIG',
  'MISSING_API_KEY',
  'MISSING_CREDENTIALS',
]);

// ============================================================
// Error Classification
// ============================================================

/**
 * Extract error code from error object
 * @param {Error} err - Error object
 * @returns {string|undefined} Error code
 */
export function extractErrorCode(err) {
  if (!err) return undefined;
  return err.code || err.errno || err.name;
}

/**
 * Check if error is transient (safe to retry)
 * @param {Error} err - Error object
 * @returns {boolean}
 */
export function isTransientError(err) {
  const code = extractErrorCode(err);
  if (code && TRANSIENT_ERROR_CODES.has(code)) {
    return true;
  }

  // Check HTTP status codes
  const status = err.status || err.statusCode;
  if (status === 429 || status === 503 || status === 502 || status === 504) {
    return true;
  }

  // Check error message
  const message = err.message || '';
  if (/timeout|connect|reset|closed|unavailable|temporarily/i.test(message)) {
    return true;
  }

  return false;
}

/**
 * Check if error is fatal (do not retry)
 * @param {Error} err - Error object
 * @returns {boolean}
 */
export function isFatalError(err) {
  const code = extractErrorCode(err);
  return code && FATAL_ERROR_CODES.has(code);
}

/**
 * Check if error is config error (do not retry)
 * @param {Error} err - Error object
 * @returns {boolean}
 */
export function isConfigError(err) {
  const code = extractErrorCode(err);
  return code && CONFIG_ERROR_CODES.has(code);
}

/**
 * Check if error is abort error (intentional cancellation)
 * @param {Error} err - Error object
 * @returns {boolean}
 */
export function isAbortError(err) {
  if (!err) return false;
  return err.name === 'AbortError' || err.code === 'ABORT_ERR';
}

// ============================================================
// Backoff Calculation
// ============================================================

/**
 * Calculate base delay with exponential backoff
 * @param {number} attempt - Current attempt (1-based)
 * @param {number} minDelayMs - Minimum delay
 * @returns {number} Base delay in ms
 */
export function calculateBaseDelay(attempt, minDelayMs) {
  return minDelayMs * Math.pow(2, attempt - 1);
}

/**
 * Apply jitter to delay
 * @param {number} delay - Base delay
 * @param {number} jitter - Jitter factor (0-1)
 * @returns {number} Delay with jitter
 */
export function applyJitter(delay, jitter) {
  if (jitter <= 0) return delay;

  const jitterRange = delay * jitter;
  const randomJitter = (Math.random() * 2 - 1) * jitterRange;
  return Math.max(0, delay + randomJitter);
}

/**
 * Calculate retry delay
 * @param {number} attempt - Current attempt
 * @param {object} config - Retry config
 * @returns {number} Delay in ms
 */
export function calculateRetryDelay(attempt, config) {
  const { minDelayMs, maxDelayMs, jitter } = { ...DEFAULT_RETRY_CONFIG, ...config };

  let delay = calculateBaseDelay(attempt, minDelayMs);
  delay = applyJitter(delay, jitter);
  delay = Math.min(delay, maxDelayMs);

  return Math.round(delay);
}

// ============================================================
// Retry-After Parsing
// ============================================================

/**
 * Extract Retry-After value from error
 * @param {Error} err - Error object
 * @returns {number|undefined} Retry after in ms
 */
export function extractRetryAfter(err) {
  if (!err) return undefined;

  // Check response headers
  const retryAfter = err.headers?.['retry-after'] || err.retryAfter;
  if (!retryAfter) return undefined;

  // Parse as seconds or date
  const seconds = parseInt(retryAfter, 10);
  if (!isNaN(seconds)) {
    return seconds * 1000;
  }

  // Try parsing as date
  const date = new Date(retryAfter);
  if (!isNaN(date.getTime())) {
    return Math.max(0, date.getTime() - Date.now());
  }

  return undefined;
}

// ============================================================
// Main Retry Functions
// ============================================================

/**
 * Sleep for specified duration
 * @param {number} ms - Duration in ms
 * @returns {Promise<void>}
 */
export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry an async function with exponential backoff
 * @param {Function} fn - Async function to retry
 * @param {object} options - Retry options
 * @returns {Promise<*>} Result of fn
 */
export async function retryAsync(fn, options = {}) {
  const config = { ...DEFAULT_RETRY_CONFIG, ...options };
  const {
    attempts,
    shouldRetry = isTransientError,
    retryAfterMs = extractRetryAfter,
    onRetry,
    label,
  } = config;

  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      // Don't retry fatal or config errors
      if (isFatalError(err) || isConfigError(err) || isAbortError(err)) {
        throw err;
      }

      // Check if should retry
      if (attempt >= attempts || !shouldRetry(err, attempt)) {
        throw err;
      }

      // Calculate delay
      let delayMs = retryAfterMs(err);
      if (delayMs === undefined) {
        delayMs = calculateRetryDelay(attempt, config);
      }

      // Callback
      if (onRetry) {
        onRetry({
          attempt,
          maxAttempts: attempts,
          delayMs,
          err,
          label,
        });
      }

      // Wait before retry
      await sleep(delayMs);
    }
  }

  throw lastError;
}

/**
 * Create a retryable version of a function
 * @param {Function} fn - Function to wrap
 * @param {object} options - Retry options
 * @returns {Function} Wrapped function
 */
export function withRetry(fn, options = {}) {
  return async (...args) => {
    return retryAsync(() => fn(...args), options);
  };
}

// ============================================================
// Platform-Specific Configs
// ============================================================

/**
 * LINE API retry config
 */
export const LINE_RETRY_CONFIG = {
  attempts: 3,
  minDelayMs: 500,
  maxDelayMs: 30000,
  jitter: 0.1,
};

/**
 * Anthropic API retry config
 */
export const ANTHROPIC_RETRY_CONFIG = {
  attempts: 3,
  minDelayMs: 1000,
  maxDelayMs: 60000,
  jitter: 0.1,
};

/**
 * Beds24 API retry config
 */
export const BEDS24_RETRY_CONFIG = {
  attempts: 3,
  minDelayMs: 500,
  maxDelayMs: 15000,
  jitter: 0.1,
};

// ============================================================
// Exports
// ============================================================

export default {
  // Config
  DEFAULT_RETRY_CONFIG,
  LINE_RETRY_CONFIG,
  ANTHROPIC_RETRY_CONFIG,
  BEDS24_RETRY_CONFIG,

  // Error classification
  extractErrorCode,
  isTransientError,
  isFatalError,
  isConfigError,
  isAbortError,

  // Backoff
  calculateBaseDelay,
  applyJitter,
  calculateRetryDelay,
  extractRetryAfter,

  // Main functions
  sleep,
  retryAsync,
  withRetry,
};
