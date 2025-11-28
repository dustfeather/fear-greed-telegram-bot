/**
 * Position management service
 */

import type { Env, ActivePosition } from '../../core/types/index.js';
import * as D1PositionRepo from '../repositories/d1-position-repository.js';
import { getLatestExecution } from './execution-service.js';

/**
 * Get active position for a user
 * @param env - Environment variables
 * @param chatId - User's chat ID
 * @returns Active position (ticker and entry price) or null if no active position
 */
export async function getActivePosition(env: Env, chatId: number | string): Promise<ActivePosition | null> {
  return await D1PositionRepo.getActivePosition(env.FEAR_GREED_D1, chatId);
}

/**
 * Set active position for a user (when BUY is executed)
 * @param env - Environment variables
 * @param chatId - User's chat ID
 * @param ticker - Ticker symbol
 * @param entryPrice - Entry price
 * @returns Promise resolving to void
 */
export async function setActivePosition(
  env: Env,
  chatId: number | string,
  ticker: string,
  entryPrice: number
): Promise<void> {
  await D1PositionRepo.setActivePosition(env.FEAR_GREED_D1, chatId, ticker, entryPrice);
}

/**
 * Check if a new execution is allowed (enforce once per calendar month limit)
 * @param env - Environment variables
 * @param chatId - User's chat ID
 * @returns true if execution is allowed, false otherwise
 */
export async function canTrade(env: Env, chatId: number | string): Promise<boolean> {
  try {
    const latestExecution = await getLatestExecution(env, chatId);
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
  const d = typeof date === 'number' ? new Date(date) : date;
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return months[d.getUTCMonth()];
}

/**
 * Clear active position for a user (when SELL signal is executed)
 * This closes ALL open positions for the ticker associated with the active position.
 * @param env - Environment variables
 * @param chatId - User's chat ID
 * @returns Promise resolving to void
 */
export async function clearActivePosition(env: Env, chatId: number | string): Promise<void> {
  await D1PositionRepo.clearActivePosition(env.FEAR_GREED_D1, chatId);
}
