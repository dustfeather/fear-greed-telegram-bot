/**
 * Enhanced fetch utilities with timeout and retry logic
 */

import { REQUEST_CONFIG } from '../constants.js';
import { createNetworkError, toAppError } from './errors.js';

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetch with timeout
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = REQUEST_CONFIG.TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw createNetworkError(`Request timeout after ${timeoutMs}ms`, error);
    }
    throw toAppError(error);
  }
}

/**
 * Retry configuration
 */
export interface RetryConfig {
  maxRetries?: number;
  retryDelayMs?: number;
  backoffMultiplier?: number;
  retryableStatuses?: number[];
}

/**
 * Fetch with retry logic
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  config: RetryConfig = {}
): Promise<Response> {
  const {
    maxRetries = REQUEST_CONFIG.MAX_RETRIES,
    retryDelayMs = REQUEST_CONFIG.RETRY_DELAY_MS,
    backoffMultiplier = REQUEST_CONFIG.RETRY_BACKOFF_MULTIPLIER,
    retryableStatuses = [408, 429, 500, 502, 503, 504]
  } = config;

  let lastError: unknown;
  let currentDelay = retryDelayMs;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetchWithTimeout(url, options);
      
      // If status is not retryable or success, return immediately
      if (!retryableStatuses.includes(response.status) || response.ok) {
        return response;
      }

      // If this is the last attempt, return the response even if it failed
      if (attempt === maxRetries) {
        return response;
      }

      // Wait before retrying
      await sleep(currentDelay);
      currentDelay *= backoffMultiplier;
    } catch (error) {
      lastError = error;
      
      // If this is the last attempt, throw the error
      if (attempt === maxRetries) {
        throw toAppError(error);
      }

      // Wait before retrying
      await sleep(currentDelay);
      currentDelay *= backoffMultiplier;
    }
  }

  throw toAppError(lastError);
}

/**
 * Enhanced fetch that combines timeout and retry
 */
export async function enhancedFetch(
  url: string,
  options: RequestInit = {},
  retryConfig?: RetryConfig
): Promise<Response> {
  return fetchWithRetry(url, options, retryConfig);
}

