/**
 * Fear & Greed Index service
 */

import type { KVNamespace } from '@cloudflare/workers-types';
import type { FearGreedIndexResponse } from '../../core/types/index.js';
import { API_URLS, HTTP_HEADERS } from '../../core/constants/index.js';
import { enhancedFetch } from '../../core/utils/fetch.js';
import { createApiError } from '../../core/utils/errors.js';
import { isValidFearGreedIndexResponse } from '../../core/utils/validation.js';
import { getCachedFearGreedIndex, cacheFearGreedIndex } from '../repositories/cache-repository.js';

/**
 * Fetch Fear & Greed Index from API
 */
export async function fetchFearGreedIndex(): Promise<FearGreedIndexResponse> {
  const response = await enhancedFetch(API_URLS.FEAR_GREED_INDEX, {
    method: 'GET',
    headers: HTTP_HEADERS.CHROME_HEADERS
  });

  if (!response.ok) {
    throw createApiError(
      `Failed to fetch Fear & Greed Index: ${response.status} ${response.statusText}`,
      undefined,
      response.status
    );
  }

  const data = await response.json();

  if (!isValidFearGreedIndexResponse(data)) {
    // Log the actual response structure for debugging
    console.error('Invalid Fear & Greed Index response structure. Received:', JSON.stringify(data, null, 2));
    throw createApiError('Invalid Fear & Greed Index response structure', data);
  }

  // Normalize the response (handle string scores and string timestamps)
  const obj = data as unknown as Record<string, unknown>;
  const normalized: FearGreedIndexResponse = {
    rating: obj.rating as string,
    score: typeof obj.score === 'string'
      ? parseFloat(obj.score)
      : obj.score as number,
    timestamp: obj.timestamp as number | string | undefined,
    // Include optional additional fields if present
    ...(obj.previous_close !== undefined && { previous_close: typeof obj.previous_close === 'string' ? parseFloat(obj.previous_close) : obj.previous_close as number }),
    ...(obj.previous_1_week !== undefined && { previous_1_week: typeof obj.previous_1_week === 'string' ? parseFloat(obj.previous_1_week) : obj.previous_1_week as number }),
    ...(obj.previous_1_month !== undefined && { previous_1_month: typeof obj.previous_1_month === 'string' ? parseFloat(obj.previous_1_month) : obj.previous_1_month as number }),
    ...(obj.previous_1_year !== undefined && { previous_1_year: typeof obj.previous_1_year === 'string' ? parseFloat(obj.previous_1_year) : obj.previous_1_year as number })
  };

  return normalized;
}

/**
 * Get Fear & Greed Index with caching
 * @param kv - KV namespace for caching
 * @returns Fear & Greed Index data
 */
export async function getFearGreedIndex(kv: KVNamespace): Promise<FearGreedIndexResponse> {
  // Try to get cached data first
  let data = await getCachedFearGreedIndex(kv);

  // If no cache or cache expired, fetch fresh data
  if (!data) {
    data = await fetchFearGreedIndex();
    // Cache the fresh data (non-blocking)
    cacheFearGreedIndex(kv, data).catch(err => {
      console.error('Failed to cache Fear & Greed Index:', err);
    });
  }

  return data;
}
