/**
 * Trade history management utilities
 */

import type { KVNamespace } from '@cloudflare/workers-types';
import type { TradeRecord, ActivePosition } from '../types.js';
import { activePositionKey, TRADING_CONFIG } from '../constants.js';
import { getLatestExecution } from './executions.js';
import { createKVError } from './errors.js';

/**
 * Get the last trade record from KV (deprecated - use getLatestExecution instead)
 * @param kv - KV namespace
 * @param chatId - User's chat ID
 * @returns Last trade record or null if none exists
 */
export async function getLastTrade(kv: KVNamespace, chatId?: number | string): Promise<TradeRecord | null> {
  // This function is kept for backward compatibility but is deprecated
  // New code should use getLatestExecution from executions.ts
  return null;
}

/**
 * Get active position for a user
 * @param kv - KV namespace
 * @param chatId - User's chat ID
 * @returns Active position (ticker and entry price) or null if no active position
 */
export async function getActivePosition(kv: KVNamespace, chatId: number | string): Promise<ActivePosition | null> {
  try {
    const key = activePositionKey(chatId);
    const positionString = await kv.get(key);
    if (!positionString) {
      return null;
    }
    return JSON.parse(positionString) as ActivePosition;
  } catch (error) {
    throw createKVError('Failed to get active position', error);
  }
}

/**
 * Set active position for a user (when BUY is executed)
 * @param kv - KV namespace
 * @param chatId - User's chat ID
 * @param ticker - Ticker symbol
 * @param entryPrice - Entry price
 * @returns Promise resolving to void
 */
export async function setActivePosition(
  kv: KVNamespace,
  chatId: number | string,
  ticker: string,
  entryPrice: number
): Promise<void> {
  try {
    const key = activePositionKey(chatId);
    const position: ActivePosition = { ticker, entryPrice };
    await kv.put(key, JSON.stringify(position));
  } catch (error) {
    throw createKVError('Failed to set active position', error);
  }
}

/**
 * Check if a new execution is allowed (enforce once per calendar month limit)
 * @param kv - KV namespace
 * @param chatId - User's chat ID
 * @returns true if execution is allowed, false otherwise
 */
export async function canTrade(kv: KVNamespace, chatId: number | string): Promise<boolean> {
  try {
    const latestExecution = await getLatestExecution(kv, chatId);
    if (!latestExecution) {
      return true; // No previous executions, execution allowed
    }

    const now = new Date();
    const lastExecutionDate = new Date(latestExecution.executionDate);
    
    // Check if last execution was in a different calendar month
    // Users can execute once per calendar month
    const sameMonth = now.getUTCFullYear() === lastExecutionDate.getUTCFullYear() &&
                      now.getUTCMonth() === lastExecutionDate.getUTCMonth();
    
    return !sameMonth; // Allow if different month
  } catch (error) {
    // If there's an error checking, allow execution (fail open)
    console.error('Error checking execution frequency limit:', error);
    return true;
  }
}

/**
 * Get the calendar month name from a date
 * @param date - Date object or timestamp
 * @returns Month name (e.g., "January", "February")
 */
export function getMonthName(date: Date | number): string {
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleDateString('en-US', { month: 'long' });
}

/**
 * Record a new trade (BUY signal executed)
 * @deprecated This function is deprecated. Use recordExecution from executions.ts instead.
 * @param kv - KV namespace
 * @param entryPrice - Entry price for the trade
 * @returns Promise resolving to void
 */
export async function recordTrade(kv: KVNamespace, entryPrice: number): Promise<void> {
  // This function is deprecated and should not be used
  // New code should use recordExecution from executions.ts
  console.warn('recordTrade() is deprecated. Use recordExecution() instead.');
}

/**
 * Clear active position for a user (when SELL signal is executed)
 * @param kv - KV namespace
 * @param chatId - User's chat ID
 * @returns Promise resolving to void
 */
export async function clearActivePosition(kv: KVNamespace, chatId: number | string): Promise<void> {
  try {
    const key = activePositionKey(chatId);
    await kv.delete(key);
  } catch (error) {
    throw createKVError('Failed to clear active position', error);
  }
}

