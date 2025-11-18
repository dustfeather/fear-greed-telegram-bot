/**
 * Watchlist management utilities
 */

import type { KVNamespace } from '@cloudflare/workers-types';
import type { Watchlist } from '../types.js';
import { watchlistKey } from '../constants.js';
import { createKVError } from './errors.js';
import { isValidTicker } from './validation.js';

const DEFAULT_WATCHLIST: Watchlist = ['SPY'];

/**
 * Normalize ticker to uppercase and ensure uniqueness in array
 * @param tickers - Array of tickers
 * @returns Array of unique uppercase tickers
 */
function normalizeAndDeduplicate(tickers: string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];
  
  for (const ticker of tickers) {
    const upper = ticker.toUpperCase().trim();
    if (upper && !seen.has(upper)) {
      seen.add(upper);
      normalized.push(upper);
    }
  }
  
  return normalized;
}

/**
 * Initialize watchlist for a user if it doesn't exist
 * @param kv - KV namespace
 * @param chatId - User's chat ID
 * @returns true if watchlist was initialized, false if it already existed
 */
export async function initializeWatchlistIfMissing(
  kv: KVNamespace,
  chatId: number | string
): Promise<boolean> {
  try {
    const key = watchlistKey(chatId);
    const watchlistString = await kv.get(key);
    
    if (!watchlistString) {
      // Initialize watchlist with default
      const defaultWatchlist = [...DEFAULT_WATCHLIST];
      await kv.put(key, JSON.stringify(defaultWatchlist));
      return true;
    }
    
    // Validate existing watchlist
    try {
      const watchlist = JSON.parse(watchlistString) as Watchlist;
      if (!Array.isArray(watchlist) || watchlist.length === 0) {
        // Initialize with default if invalid
        const defaultWatchlist = [...DEFAULT_WATCHLIST];
        await kv.put(key, JSON.stringify(defaultWatchlist));
        return true;
      }
    } catch {
      // Invalid JSON, initialize with default
      const defaultWatchlist = [...DEFAULT_WATCHLIST];
      await kv.put(key, JSON.stringify(defaultWatchlist));
      return true;
    }
    
    return false; // Watchlist already exists
  } catch (error) {
    throw createKVError('Failed to initialize watchlist', error);
  }
}

/**
 * Get user's watchlist, defaulting to ['SPY'] if empty
 * Automatically initializes watchlist if missing (on first scheduled job or first /now command)
 * @param kv - KV namespace
 * @param chatId - User's chat ID
 * @returns User's watchlist
 */
export async function getWatchlist(kv: KVNamespace, chatId: number | string): Promise<Watchlist> {
  try {
    const key = watchlistKey(chatId);
    const watchlistString = await kv.get(key);
    
    if (!watchlistString) {
      // Initialize watchlist for existing users who don't have one
      // This happens on first scheduled job run or first /now command
      const defaultWatchlist = [...DEFAULT_WATCHLIST];
      await kv.put(key, JSON.stringify(defaultWatchlist));
      return defaultWatchlist;
    }
    
    const watchlist = JSON.parse(watchlistString) as Watchlist;
    
    // Validate and normalize the watchlist
    if (!Array.isArray(watchlist) || watchlist.length === 0) {
      // Initialize with default if invalid
      const defaultWatchlist = [...DEFAULT_WATCHLIST];
      await kv.put(key, JSON.stringify(defaultWatchlist));
      return defaultWatchlist;
    }
    
    const normalized = normalizeAndDeduplicate(watchlist);
    
    // If normalization resulted in empty array, initialize with default
    if (normalized.length === 0) {
      const defaultWatchlist = [...DEFAULT_WATCHLIST];
      await kv.put(key, JSON.stringify(defaultWatchlist));
      return defaultWatchlist;
    }
    
    // If normalized watchlist differs from stored, update it
    if (JSON.stringify(normalized) !== watchlistString) {
      await kv.put(key, JSON.stringify(normalized));
    }
    
    return normalized;
  } catch (error) {
    throw createKVError('Failed to get watchlist', error);
  }
}

/**
 * Save watchlist to KV (ensures unique tickers, case-insensitive)
 * @param kv - KV namespace
 * @param chatId - User's chat ID
 * @param tickers - Array of ticker symbols
 * @returns Promise resolving to void
 */
export async function setWatchlist(
  kv: KVNamespace,
  chatId: number | string,
  tickers: string[]
): Promise<void> {
  try {
    const key = watchlistKey(chatId);
    const normalized = normalizeAndDeduplicate(tickers);
    
    // If watchlist becomes empty, automatically add SPY
    if (normalized.length === 0) {
      normalized.push(...DEFAULT_WATCHLIST);
    }
    
    await kv.put(key, JSON.stringify(normalized));
  } catch (error) {
    throw createKVError('Failed to set watchlist', error);
  }
}

/**
 * Add ticker to watchlist (case-insensitive, prevents duplicates)
 * @param kv - KV namespace
 * @param chatId - User's chat ID
 * @param ticker - Ticker symbol to add
 * @returns Object with success flag and message
 */
export async function addTickerToWatchlist(
  kv: KVNamespace,
  chatId: number | string,
  ticker: string
): Promise<{ success: boolean; message: string; wasAlreadyAdded?: boolean }> {
  try {
    const validation = isValidTicker(ticker);
    if (!validation.isValid) {
      return {
        success: false,
        message: `Invalid ticker symbol: "${ticker}". Please use a valid ticker (1-10 alphanumeric characters).`
      };
    }
    
    const normalizedTicker = validation.ticker;
    const watchlist = await getWatchlist(kv, chatId);
    
    // Check if ticker already exists (case-insensitive)
    const exists = watchlist.some(t => t.toUpperCase() === normalizedTicker);
    
    if (exists) {
      return {
        success: false,
        message: `Ticker ${normalizedTicker} is already in your watchlist.`,
        wasAlreadyAdded: true
      };
    }
    
    // Add ticker and save
    watchlist.push(normalizedTicker);
    await setWatchlist(kv, chatId, watchlist);
    
    return {
      success: true,
      message: `Added ${normalizedTicker} to your watchlist.`,
      wasAlreadyAdded: false
    };
  } catch (error) {
    throw createKVError('Failed to add ticker to watchlist', error);
  }
}

/**
 * Remove ticker from watchlist (case-insensitive, auto-adds SPY if watchlist becomes empty)
 * @param kv - KV namespace
 * @param chatId - User's chat ID
 * @param ticker - Ticker symbol to remove
 * @returns Object with success flag and message
 */
export async function removeTickerFromWatchlist(
  kv: KVNamespace,
  chatId: number | string,
  ticker: string
): Promise<{ success: boolean; message: string; wasRemoved?: boolean; spyReAdded?: boolean }> {
  try {
    const validation = isValidTicker(ticker);
    if (!validation.isValid) {
      return {
        success: false,
        message: `Invalid ticker symbol: "${ticker}". Please use a valid ticker (1-10 alphanumeric characters).`
      };
    }
    
    const normalizedTicker = validation.ticker;
    const watchlist = await getWatchlist(kv, chatId);
    
    // Find and remove ticker (case-insensitive)
    const index = watchlist.findIndex(t => t.toUpperCase() === normalizedTicker);
    
    if (index === -1) {
      return {
        success: false,
        message: `Ticker ${normalizedTicker} is not in your watchlist.`,
        wasRemoved: false
      };
    }
    
    // Remove ticker
    watchlist.splice(index, 1);
    
    // If watchlist becomes empty, automatically add SPY back
    let spyReAdded = false;
    if (watchlist.length === 0) {
      watchlist.push(...DEFAULT_WATCHLIST);
      spyReAdded = true;
    }
    
    await setWatchlist(kv, chatId, watchlist);
    
    let message = `Removed ${normalizedTicker} from your watchlist.`;
    if (spyReAdded) {
      message += ` SPY has been automatically added back to ensure you always have at least one ticker.`;
    }
    
    return {
      success: true,
      message,
      wasRemoved: true,
      spyReAdded
    };
  } catch (error) {
    throw createKVError('Failed to remove ticker from watchlist', error);
  }
}

/**
 * Ensure ticker exists in watchlist (used when opening position, prevents duplicates)
 * @param kv - KV namespace
 * @param chatId - User's chat ID
 * @param ticker - Ticker symbol to ensure exists
 * @returns Promise resolving to void
 */
export async function ensureTickerInWatchlist(
  kv: KVNamespace,
  chatId: number | string,
  ticker: string
): Promise<void> {
  try {
    const validation = isValidTicker(ticker);
    if (!validation.isValid) {
      // Invalid ticker, skip adding
      return;
    }
    
    const normalizedTicker = validation.ticker;
    const watchlist = await getWatchlist(kv, chatId);
    
    // Check if ticker already exists (case-insensitive)
    const exists = watchlist.some(t => t.toUpperCase() === normalizedTicker);
    
    if (!exists) {
      // Add ticker and save
      watchlist.push(normalizedTicker);
      await setWatchlist(kv, chatId, watchlist);
    }
  } catch (error) {
    // Log error but don't throw - this is a convenience function
    console.error('Failed to ensure ticker in watchlist:', error);
  }
}

