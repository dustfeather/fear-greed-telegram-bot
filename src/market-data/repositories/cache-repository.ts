/**
 * Cache utilities for Fear & Greed Index data
 */

import type { KVNamespace } from '@cloudflare/workers-types';
import { KV_KEYS, CACHE_CONFIG } from '../../core/constants/index.js';
import type { FearGreedIndexResponse } from '../../core/types/index.js';

/**
 * Cached Fear & Greed Index data
 */
interface CachedData {
  data: FearGreedIndexResponse;
  timestamp: number;
}

/**
 * Get cached Fear & Greed Index data if still valid
 */
export async function getCachedFearGreedIndex(
  kv: KVNamespace
): Promise<FearGreedIndexResponse | null> {
  try {
    const cached = await kv.get(KV_KEYS.FEAR_GREED_CACHE, 'json');

    if (!cached) {
      return null;
    }

    const cachedData = cached as CachedData;
    const now = Date.now();
    const age = now - cachedData.timestamp;

    // Check if cache is still valid (within TTL)
    if (age < CACHE_CONFIG.FEAR_GREED_TTL_MS) {
      return cachedData.data;
    }

    // Cache expired, return null to trigger fresh fetch
    return null;
  } catch (error) {
    // Log error but don't fail - allow fresh fetch
    console.error('Error reading cache:', error);
    return null;
  }
}

/**
 * Cache Fear & Greed Index data
 */
export async function cacheFearGreedIndex(
  kv: KVNamespace,
  data: FearGreedIndexResponse
): Promise<void> {
  try {
    const cachedData: CachedData = {
      data,
      timestamp: Date.now()
    };

    await kv.put(KV_KEYS.FEAR_GREED_CACHE, JSON.stringify(cachedData));
  } catch (error) {
    // Log error but don't fail - caching is not critical
    console.error('Error writing cache:', error);
    // Don't throw - caching failure should not break the flow
  }
}

