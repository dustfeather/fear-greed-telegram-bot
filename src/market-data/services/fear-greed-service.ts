/**
 * Fear & Greed Index service
 */

import type { KVNamespace } from '@cloudflare/workers-types';
import type { Env, FearGreedIndexResponse } from '../../core/types/index.js';
import { API_URLS, HTTP_HEADERS } from '../../core/constants/index.js';
import { enhancedFetch } from '../../core/utils/fetch.js';
import { createApiError } from '../../core/utils/errors.js';
import { isValidFearGreedIndexResponse } from '../../core/utils/validation.js';
import * as KVCacheRepo from '../repositories/cache-repository.js';
import * as D1CacheRepo from '../repositories/d1-cache-repository.js';

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
 * @param env - Environment variables (or KV namespace for backward compatibility)
 * @returns Fear & Greed Index data
 */
export async function getFearGreedIndex(env: Env | KVNamespace): Promise<FearGreedIndexResponse> {
  // Check if env is Env object or KVNamespace
  const isEnvObject = 'FEAR_GREED_D1' in env || 'FEAR_GREED_KV' in env;

  let data: FearGreedIndexResponse | null = null;

  // Try to get cached data first
  if (isEnvObject) {
    const envObj = env as Env;
    data = envObj.FEAR_GREED_D1
      ? await D1CacheRepo.get<FearGreedIndexResponse>(envObj.FEAR_GREED_D1, 'fear_greed_index')
      : await KVCacheRepo.getCachedFearGreedIndex(envObj.FEAR_GREED_KV);
  } else {
    data = await KVCacheRepo.getCachedFearGreedIndex(env as KVNamespace);
  }

  // If no cache or cache expired, fetch fresh data
  if (!data) {
    data = await fetchFearGreedIndex();

    // Cache the fresh data (non-blocking)
    if (isEnvObject) {
      const envObj = env as Env;
      if (envObj.FEAR_GREED_D1) {
        // Cache for 24 hours (86400000 ms)
        D1CacheRepo.set(envObj.FEAR_GREED_D1, 'fear_greed_index', data, 86400000).catch(err => {
          console.error('Failed to cache Fear & Greed Index in D1:', err);
        });
      } else {
        KVCacheRepo.cacheFearGreedIndex(envObj.FEAR_GREED_KV, data).catch(err => {
          console.error('Failed to cache Fear & Greed Index in KV:', err);
        });
      }
    } else {
      KVCacheRepo.cacheFearGreedIndex(env as KVNamespace, data).catch(err => {
        console.error('Failed to cache Fear & Greed Index:', err);
      });
    }
  }

  return data;
}
