/**
 * D1 position repository
 * Manages active trading positions in D1 database
 */

import type { D1Database } from '@cloudflare/workers-types';
import type { ActivePosition } from '../../core/types/index.js';
import { wrapD1Error, logD1Error } from '../../core/utils/d1-errors.js';

/**
 * Get active position for a user
 * @param db - D1 database instance
 * @param chatId - User's chat ID
 * @returns Active position (ticker and entry price) or null if no active position
 */
export async function getActivePosition(
  db: D1Database,
  chatId: number | string
): Promise<ActivePosition | null> {
  try {
    const chatIdStr = String(chatId);

    const row = await db
      .prepare('SELECT ticker, entry_price FROM active_positions WHERE chat_id = ? LIMIT 1')
      .bind(chatIdStr)
      .first<{ ticker: string; entry_price: number }>();

    if (!row) {
      return null;
    }

    return {
      ticker: row.ticker,
      entryPrice: row.entry_price
    };
  } catch (error) {
    const d1Error = wrapD1Error('getActivePosition', error);
    logD1Error(d1Error);
    throw d1Error;
  }
}

/**
 * Set active position for a user (when BUY is executed)
 * @param db - D1 database instance
 * @param chatId - User's chat ID
 * @param ticker - Ticker symbol
 * @param entryPrice - Entry price
 */
export async function setActivePosition(
  db: D1Database,
  chatId: number | string,
  ticker: string,
  entryPrice: number
): Promise<void> {
  try {
    const chatIdStr = String(chatId);
    const now = Date.now();

    // Use INSERT OR REPLACE to handle both new and existing positions
    await db
      .prepare(
        'INSERT INTO active_positions (chat_id, ticker, entry_price, created_at, updated_at) ' +
        'VALUES (?, ?, ?, ?, ?) ' +
        'ON CONFLICT(chat_id, ticker) DO UPDATE SET entry_price = ?, updated_at = ?'
      )
      .bind(chatIdStr, ticker.toUpperCase(), entryPrice, now, now, entryPrice, now)
      .run();
  } catch (error) {
    const d1Error = wrapD1Error('setActivePosition', error);
    logD1Error(d1Error);
    throw d1Error;
  }
}

/**
 * Clear active position for a user (when SELL signal is executed)
 * @param db - D1 database instance
 * @param chatId - User's chat ID
 */
export async function clearActivePosition(
  db: D1Database,
  chatId: number | string
): Promise<void> {
  try {
    const chatIdStr = String(chatId);

    await db
      .prepare('DELETE FROM active_positions WHERE chat_id = ?')
      .bind(chatIdStr)
      .run();
  } catch (error) {
    const d1Error = wrapD1Error('clearActivePosition', error);
    logD1Error(d1Error);
    throw d1Error;
  }
}
