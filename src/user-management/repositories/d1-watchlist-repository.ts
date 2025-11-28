/**
 * D1 watchlist repository
 * Manages user watchlists in D1 database
 */

import type { D1Database } from '@cloudflare/workers-types';
import type { Watchlist } from '../../core/types/index.js';
import { wrapD1Error, logD1Error } from '../../core/utils/d1-errors.js';

/**
 * Get watchlist for a user
 * @param db - D1 database instance
 * @param chatId - User's chat ID
 * @returns Array of ticker symbols
 */
export async function getWatchlist(
  db: D1Database,
  chatId: number | string
): Promise<Watchlist> {
  try {
    const chatIdStr = String(chatId);

    const result = await db
      .prepare('SELECT ticker FROM watchlists WHERE chat_id = ? ORDER BY created_at ASC')
      .bind(chatIdStr)
      .all<{ ticker: string }>();

    return result.results.map(row => row.ticker);
  } catch (error) {
    const d1Error = wrapD1Error('getWatchlist', error);
    logD1Error(d1Error);
    throw d1Error;
  }
}

/**
 * Add a ticker to user's watchlist
 * @param db - D1 database instance
 * @param chatId - User's chat ID
 * @param ticker - Ticker symbol to add
 */
export async function addTicker(
  db: D1Database,
  chatId: number | string,
  ticker: string
): Promise<void> {
  try {
    const chatIdStr = String(chatId);
    const now = Date.now();

    await db
      .prepare('INSERT INTO watchlists (chat_id, ticker, created_at) VALUES (?, ?, ?)')
      .bind(chatIdStr, ticker.toUpperCase(), now)
      .run();
  } catch (error) {
    const d1Error = wrapD1Error('addTicker', error);
    logD1Error(d1Error);
    throw d1Error;
  }
}

/**
 * Remove a ticker from user's watchlist
 * @param db - D1 database instance
 * @param chatId - User's chat ID
 * @param ticker - Ticker symbol to remove
 */
export async function removeTicker(
  db: D1Database,
  chatId: number | string,
  ticker: string
): Promise<void> {
  try {
    const chatIdStr = String(chatId);

    await db
      .prepare('DELETE FROM watchlists WHERE chat_id = ? AND ticker = ?')
      .bind(chatIdStr, ticker.toUpperCase())
      .run();
  } catch (error) {
    const d1Error = wrapD1Error('removeTicker', error);
    logD1Error(d1Error);
    throw d1Error;
  }
}

/**
 * Clear all tickers from user's watchlist
 * @param db - D1 database instance
 * @param chatId - User's chat ID
 */
export async function clearWatchlist(
  db: D1Database,
  chatId: number | string
): Promise<void> {
  try {
    const chatIdStr = String(chatId);

    await db
      .prepare('DELETE FROM watchlists WHERE chat_id = ?')
      .bind(chatIdStr)
      .run();
  } catch (error) {
    const d1Error = wrapD1Error('clearWatchlist', error);
    logD1Error(d1Error);
    throw d1Error;
  }
}
