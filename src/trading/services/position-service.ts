/**
 * Position management service
 */

import type { KVNamespace } from '@cloudflare/workers-types';
import type { Env, TradeRecord, ActivePosition } from '../../core/types/index.js';
import * as KVPositionRepo from '../repositories/position-repository.js';
import * as D1PositionRepo from '../repositories/d1-position-repository.js';
import { getLatestExecution } from './execution-service.js';

/**
 * Get the last trade record from KV (deprecated - use getLatestExecution instead)
 * @param _env - Environment variables (unused)
 * @param _chatId - User's chat ID (unused)
 * @returns Last trade record or null if none exists
 */
export async function getLastTrade(_env: Env | KVNamespace, _chatId?: number | string): Promise<TradeRecord | null> {
  // This function is kept for backward compatibility but is deprecated
  // New code should use getLatestExecution from execution-service.ts
  return null;
}

/**
 * Get active position for a user
 * @param env - Environment variables (or KV namespace for backward compatibility)
 * @param chatId - User's chat ID
 * @returns Active position (ticker and entry price) or null if no active position
 */
export async function getActivePosition(env: Env | KVNamespace, chatId: number | string): Promise<ActivePosition | null> {
  // Check if env is Env object or KVNamespace
  const isEnvObject = 'FEAR_GREED_D1' in env || 'FEAR_GREED_KV' in env;

  if (isEnvObject) {
    const envObj = env as Env;
    return envObj.FEAR_GREED_D1
      ? await D1PositionRepo.getActivePosition(envObj.FEAR_GREED_D1, chatId)
      : await KVPositionRepo.getActivePosition(envObj.FEAR_GREED_KV, chatId);
  } else {
    return await KVPositionRepo.getActivePosition(env as KVNamespace, chatId);
  }
}

/**
 * Set active position for a user (when BUY is executed)
 * @param env - Environment variables (or KV namespace for backward compatibility)
 * @param chatId - User's chat ID
 * @param ticker - Ticker symbol
 * @param entryPrice - Entry price
 * @returns Promise resolving to void
 */
export async function setActivePosition(
  env: Env | KVNamespace,
  chatId: number | string,
  ticker: string,
  entryPrice: number
): Promise<void> {
  // Check if env is Env object or KVNamespace
  const isEnvObject = 'FEAR_GREED_D1' in env || 'FEAR_GREED_KV' in env;

  if (isEnvObject) {
    const envObj = env as Env;
    if (envObj.FEAR_GREED_D1) {
      await D1PositionRepo.setActivePosition(envObj.FEAR_GREED_D1, chatId, ticker, entryPrice);
    } else {
      await KVPositionRepo.setActivePosition(envObj.FEAR_GREED_KV, chatId, ticker, entryPrice);
    }
  } else {
    await KVPositionRepo.setActivePosition(env as KVNamespace, chatId, ticker, entryPrice);
  }
}

/**
 * Check if a new execution is allowed (enforce once per calendar month limit)
 * @param env - Environment variables (or KV namespace for backward compatibility)
 * @param chatId - User's chat ID
 * @returns true if execution is allowed, false otherwise
 */
export async function canTrade(env: Env | KVNamespace, chatId: number | string): Promise<boolean> {
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
  return KVPositionRepo.getMonthName(date);
}

/**
 * Record a new trade (BUY signal executed)
 * @deprecated This function is deprecated. Use recordExecution from execution-service.ts instead.
 * @param _env - Environment variables (unused)
 * @param _entryPrice - Entry price for the trade (unused)
 * @returns Promise resolving to void
 */
export async function recordTrade(_env: Env | KVNamespace, _entryPrice: number): Promise<void> {
  // This function is deprecated and should not be used
  // New code should use recordExecution from execution-service.ts
  console.warn('recordTrade() is deprecated. Use recordExecution() instead.');
}

/**
 * Clear active position for a user (when SELL signal is executed)
 * This closes ALL open positions for the ticker associated with the active position.
 * @param env - Environment variables (or KV namespace for backward compatibility)
 * @param chatId - User's chat ID
 * @returns Promise resolving to void
 */
export async function clearActivePosition(env: Env | KVNamespace, chatId: number | string): Promise<void> {
  // Check if env is Env object or KVNamespace
  const isEnvObject = 'FEAR_GREED_D1' in env || 'FEAR_GREED_KV' in env;

  if (isEnvObject) {
    const envObj = env as Env;
    if (envObj.FEAR_GREED_D1) {
      await D1PositionRepo.clearActivePosition(envObj.FEAR_GREED_D1, chatId);
    } else {
      await KVPositionRepo.clearActivePosition(envObj.FEAR_GREED_KV, chatId);
    }
  } else {
    await KVPositionRepo.clearActivePosition(env as KVNamespace, chatId);
  }
}
