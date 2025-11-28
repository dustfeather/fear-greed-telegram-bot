/**
 * Watchlist data access layer
 */

import type { KVNamespace } from '@cloudflare/workers-types';
import type { Watchlist } from '../../core/types/index.js';
import { watchlistKey } from '../../core/constants/index.js';
import { createKVError } from '../../core/utils/errors.js';

/**
 * Get watchlist data from KV storage
 * @param kv - KV namespace
 * @param chatId - User's chat ID
 * @returns Watchlist data or null if not found
 */
export async function getWatchlistData(
  kv: KVNamespace,
  chatId: number | string
): Promise<Watchlist | null> {
  try {
    const key = watchlistKey(chatId);
    const watchlistString = await kv.get(key);

    if (!watchlistString) {
      return null;
    }

    return JSON.parse(watchlistString) as Watchlist;
  } catch (error) {
    throw createKVError('Failed to get watchlist data', error);
  }
}

/**
 * Save watchlist data to KV storage
 * @param kv - KV namespace
 * @param chatId - User's chat ID
 * @param watchlist - Watchlist data to save
 */
export async function saveWatchlistData(
  kv: KVNamespace,
  chatId: number | string,
  watchlist: Watchlist
): Promise<void> {
  try {
    const key = watchlistKey(chatId);
    await kv.put(key, JSON.stringify(watchlist));
  } catch (error) {
    throw createKVError('Failed to save watchlist data', error);
  }
}
