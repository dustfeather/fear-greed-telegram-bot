/**
 * D1 execution repository
 * Manages signal execution history in D1 database
 */

import type { D1Database } from '@cloudflare/workers-types';
import type { SignalExecution } from '../../core/types/index.js';
import { wrapD1Error, logD1Error } from '../../core/utils/d1-errors.js';

/**
 * Record a signal execution for a user
 * @param db - D1 database instance
 * @param chatId - User's chat ID
 * @param signalType - Type of signal executed ('BUY' or 'SELL')
 * @param ticker - Ticker symbol
 * @param executionPrice - Price at which the signal was executed
 * @param signalPrice - Optional price when signal was generated
 * @param executionDate - Optional execution date timestamp (defaults to current time)
 */
export async function recordExecution(
  db: D1Database,
  chatId: number | string,
  signalType: 'BUY' | 'SELL',
  ticker: string,
  executionPrice: number,
  signalPrice?: number,
  executionDate?: number
): Promise<void> {
  try {
    const chatIdStr = String(chatId);
    const execDate = executionDate ?? Date.now();
    const now = Date.now();

    await db
      .prepare(
        'INSERT INTO executions (chat_id, signal_type, ticker, execution_price, signal_price, execution_date, created_at) ' +
        'VALUES (?, ?, ?, ?, ?, ?, ?)'
      )
      .bind(chatIdStr, signalType, ticker.toUpperCase(), executionPrice, signalPrice ?? null, execDate, now)
      .run();
  } catch (error) {
    const d1Error = wrapD1Error('recordExecution', error);
    logD1Error(d1Error);
    throw d1Error;
  }
}

/**
 * Get execution history for a user, optionally filtered by ticker
 * @param db - D1 database instance
 * @param chatId - User's chat ID
 * @param ticker - Optional ticker to filter by
 * @returns Array of executions, sorted by date (newest first)
 */
export async function getExecutionHistory(
  db: D1Database,
  chatId: number | string,
  ticker?: string
): Promise<SignalExecution[]> {
  try {
    const chatIdStr = String(chatId);

    let query = 'SELECT signal_type, ticker, execution_price, signal_price, execution_date FROM executions WHERE chat_id = ?';
    const params: (string | number)[] = [chatIdStr];

    if (ticker) {
      query += ' AND ticker = ?';
      params.push(ticker.toUpperCase());
    }

    query += ' ORDER BY execution_date DESC';

    const stmt = db.prepare(query);
    const result = await stmt.bind(...params).all<{
      signal_type: 'BUY' | 'SELL';
      ticker: string;
      execution_price: number;
      signal_price: number | null;
      execution_date: number;
    }>();

    return result.results.map(row => ({
      signalType: row.signal_type,
      ticker: row.ticker,
      executionPrice: row.execution_price,
      executionDate: row.execution_date,
      signalPrice: row.signal_price ?? undefined
    }));
  } catch (error) {
    const d1Error = wrapD1Error('getExecutionHistory', error);
    logD1Error(d1Error);
    throw d1Error;
  }
}

/**
 * Get the most recent execution for a user, optionally filtered by ticker
 * @param db - D1 database instance
 * @param chatId - User's chat ID
 * @param ticker - Optional ticker to filter by
 * @returns Most recent execution or null if none exists
 */
export async function getLatestExecution(
  db: D1Database,
  chatId: number | string,
  ticker?: string
): Promise<SignalExecution | null> {
  try {
    const chatIdStr = String(chatId);

    let query = 'SELECT signal_type, ticker, execution_price, signal_price, execution_date FROM executions WHERE chat_id = ?';
    const params: (string | number)[] = [chatIdStr];

    if (ticker) {
      query += ' AND ticker = ?';
      params.push(ticker.toUpperCase());
    }

    query += ' ORDER BY execution_date DESC LIMIT 1';

    const stmt = db.prepare(query);
    const row = await stmt.bind(...params).first<{
      signal_type: 'BUY' | 'SELL';
      ticker: string;
      execution_price: number;
      signal_price: number | null;
      execution_date: number;
    }>();

    if (!row) {
      return null;
    }

    return {
      signalType: row.signal_type,
      ticker: row.ticker,
      executionPrice: row.execution_price,
      executionDate: row.execution_date,
      signalPrice: row.signal_price ?? undefined
    };
  } catch (error) {
    const d1Error = wrapD1Error('getLatestExecution', error);
    logD1Error(d1Error);
    throw d1Error;
  }
}
