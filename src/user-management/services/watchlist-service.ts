/**
 * Watchlist management utilities
 */

import type { KVNamespace } from '@cloudflare/workers-types';
import type { Env, Watchlist } from '../../core/types/index.js';
import { createKVError } from '../../core/utils/errors.js';
import { isValidTicker } from '../../core/utils/validation.js';
import * as KVWatchlistRepo from '../repositories/watchlist-repository.js';
import * as D1WatchlistRepo from '../repositories/d1-watchlist-repository.js';

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
 * @param env - Environment variables (or KV namespace for backward compatibility)
 * @param chatId - User's chat ID
 * @returns true if watchlist was initialized, false if it already existed
 */
export async function initializeWatchlistIfMissing(
  env: Env | KVNamespace,
  chatId: number | string
): Promise<boolean> {
  try {
    // Check if env is Env object or KVNamespace
    const isEnvObject = 'FEAR_GREED_D1' in env || 'FEAR_GREED_KV' in env;

    let watchlist: Watchlist | null;

    if (isEnvObject) {
      const envObj = env as Env;
      watchlist = envObj.FEAR_GREED_D1
        ? await D1WatchlistRepo.getWatchlist(envObj.FEAR_GREED_D1, chatId)
        : await KVWatchlistRepo.getWatchlistData(envObj.FEAR_GREED_KV, chatId);
    } else {
      watchlist = await KVWatchlistRepo.getWatchlistData(env as KVNamespace, chatId);
    }

    if (!watchlist || watchlist.length === 0) {
      // Initialize watchlist with default
      const defaultWatchlist = [...DEFAULT_WATCHLIST];

      if (isEnvObject) {
        const envObj = env as Env;
        if (envObj.FEAR_GREED_D1) {
          for (const ticker of defaultWatchlist) {
            await D1WatchlistRepo.addTicker(envObj.FEAR_GREED_D1, chatId, ticker);
          }
        } else {
          await KVWatchlistRepo.saveWatchlistData(envObj.FEAR_GREED_KV, chatId, defaultWatchlist);
        }
      } else {
        await KVWatchlistRepo.saveWatchlistData(env as KVNamespace, chatId, defaultWatchlist);
      }

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
 * @param env - Environment variables (or KV namespace for backward compatibility)
 * @param chatId - User's chat ID
 * @returns User's watchlist
 */
export async function getWatchlist(env: Env | KVNamespace, chatId: number | string): Promise<Watchlist> {
  try {
    // Check if env is Env object or KVNamespace
    const isEnvObject = 'FEAR_GREED_D1' in env || 'FEAR_GREED_KV' in env;

    let watchlist: Watchlist | null;

    if (isEnvObject) {
      const envObj = env as Env;
      watchlist = envObj.FEAR_GREED_D1
        ? await D1WatchlistRepo.getWatchlist(envObj.FEAR_GREED_D1, chatId)
        : await KVWatchlistRepo.getWatchlistData(envObj.FEAR_GREED_KV, chatId);
    } else {
      watchlist = await KVWatchlistRepo.getWatchlistData(env as KVNamespace, chatId);
    }

    if (!watchlist || watchlist.length === 0) {
      // Initialize watchlist for existing users who don't have one
      const defaultWatchlist = [...DEFAULT_WATCHLIST];

      if (isEnvObject) {
        const envObj = env as Env;
        if (envObj.FEAR_GREED_D1) {
          for (const ticker of defaultWatchlist) {
            await D1WatchlistRepo.addTicker(envObj.FEAR_GREED_D1, chatId, ticker);
          }
        } else {
          await KVWatchlistRepo.saveWatchlistData(envObj.FEAR_GREED_KV, chatId, defaultWatchlist);
        }
      } else {
        await KVWatchlistRepo.saveWatchlistData(env as KVNamespace, chatId, defaultWatchlist);
      }

      return defaultWatchlist;
    }

    const normalized = normalizeAndDeduplicate(watchlist);

    // If normalization resulted in empty array, initialize with default
    if (normalized.length === 0) {
      const defaultWatchlist = [...DEFAULT_WATCHLIST];

      if (isEnvObject) {
        const envObj = env as Env;
        if (envObj.FEAR_GREED_D1) {
          // Clear existing and add default
          await D1WatchlistRepo.clearWatchlist(envObj.FEAR_GREED_D1, chatId);
          for (const ticker of defaultWatchlist) {
            await D1WatchlistRepo.addTicker(envObj.FEAR_GREED_D1, chatId, ticker);
          }
        } else {
          await KVWatchlistRepo.saveWatchlistData(envObj.FEAR_GREED_KV, chatId, defaultWatchlist);
        }
      } else {
        await KVWatchlistRepo.saveWatchlistData(env as KVNamespace, chatId, defaultWatchlist);
      }

      return defaultWatchlist;
    }

    // For D1, normalization is already handled by the repository (uppercase)
    // For KV, update if normalized differs
    if (!isEnvObject || !(env as Env).FEAR_GREED_D1) {
      if (JSON.stringify(normalized) !== JSON.stringify(watchlist)) {
        if (isEnvObject) {
          await KVWatchlistRepo.saveWatchlistData((env as Env).FEAR_GREED_KV, chatId, normalized);
        } else {
          await KVWatchlistRepo.saveWatchlistData(env as KVNamespace, chatId, normalized);
        }
      }
    }

    return normalized;
  } catch (error) {
    throw createKVError('Failed to get watchlist', error);
  }
}

/**
 * Save watchlist (ensures unique tickers, case-insensitive)
 * @param env - Environment variables (or KV namespace for backward compatibility)
 * @param chatId - User's chat ID
 * @param tickers - Array of ticker symbols
 * @returns Promise resolving to void
 */
export async function setWatchlist(
  env: Env | KVNamespace,
  chatId: number | string,
  tickers: string[]
): Promise<void> {
  try {
    const normalized = normalizeAndDeduplicate(tickers);

    // If watchlist becomes empty, automatically add SPY
    if (normalized.length === 0) {
      normalized.push(...DEFAULT_WATCHLIST);
    }

    // Check if env is Env object or KVNamespace
    const isEnvObject = 'FEAR_GREED_D1' in env || 'FEAR_GREED_KV' in env;

    if (isEnvObject) {
      const envObj = env as Env;
      if (envObj.FEAR_GREED_D1) {
        // Clear and rebuild watchlist in D1
        await D1WatchlistRepo.clearWatchlist(envObj.FEAR_GREED_D1, chatId);
        for (const ticker of normalized) {
          await D1WatchlistRepo.addTicker(envObj.FEAR_GREED_D1, chatId, ticker);
        }
      } else {
        await KVWatchlistRepo.saveWatchlistData(envObj.FEAR_GREED_KV, chatId, normalized);
      }
    } else {
      await KVWatchlistRepo.saveWatchlistData(env as KVNamespace, chatId, normalized);
    }
  } catch (error) {
    throw createKVError('Failed to set watchlist', error);
  }
}

/**
 * Add ticker to watchlist (case-insensitive, prevents duplicates)
 * @param env - Environment variables (or KV namespace for backward compatibility)
 * @param chatId - User's chat ID
 * @param ticker - Ticker symbol to add
 * @returns Object with success flag and message
 */
export async function addTickerToWatchlist(
  env: Env | KVNamespace,
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
    const watchlist = await getWatchlist(env, chatId);

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
    await setWatchlist(env, chatId, watchlist);

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
 * @param env - Environment variables (or KV namespace for backward compatibility)
 * @param chatId - User's chat ID
 * @param ticker - Ticker symbol to remove
 * @returns Object with success flag and message
 */
export async function removeTickerFromWatchlist(
  env: Env | KVNamespace,
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
    const watchlist = await getWatchlist(env, chatId);

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

    await setWatchlist(env, chatId, watchlist);

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
 * @param env - Environment variables (or KV namespace for backward compatibility)
 * @param chatId - User's chat ID
 * @param ticker - Ticker symbol to ensure exists
 * @returns Promise resolving to void
 */
export async function ensureTickerInWatchlist(
  env: Env | KVNamespace,
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
    const watchlist = await getWatchlist(env, chatId);

    // Check if ticker already exists (case-insensitive)
    const exists = watchlist.some(t => t.toUpperCase() === normalizedTicker);

    if (!exists) {
      // Add ticker and save
      watchlist.push(normalizedTicker);
      await setWatchlist(env, chatId, watchlist);
    }
  } catch (error) {
    // Log error but don't throw - this is a convenience function
    console.error('Failed to ensure ticker in watchlist:', error);
  }
}

