/**
 * Execution tracking service
 */

import type { Env, SignalExecution } from '../../core/types/index.js';
import * as D1ExecutionRepo from '../repositories/d1-execution-repository.js';

/**
 * Record a signal execution for a user
 * @param env - Environment variables
 * @param chatId - User's chat ID
 * @param signalType - Type of signal executed ('BUY' or 'SELL')
 * @param ticker - Ticker symbol
 * @param executionPrice - Price at which the signal was executed
 * @param signalPrice - Optional price when signal was generated
 * @param executionDate - Optional execution date timestamp (defaults to current time)
 * @returns Promise resolving to void
 */
export async function recordExecution(
  env: Env,
  chatId: number | string,
  signalType: 'BUY' | 'SELL',
  ticker: string,
  executionPrice: number,
  signalPrice?: number,
  executionDate?: number
): Promise<void> {
  await D1ExecutionRepo.recordExecution(
    env.FEAR_GREED_D1,
    chatId,
    signalType,
    ticker,
    executionPrice,
    signalPrice,
    executionDate
  );
}

/**
 * Get execution history for a user, optionally filtered by ticker
 * @param env - Environment variables
 * @param chatId - User's chat ID
 * @param ticker - Optional ticker to filter by
 * @returns Array of executions, sorted by date (newest first)
 */
export async function getExecutionHistory(
  env: Env,
  chatId: number | string,
  ticker?: string
): Promise<SignalExecution[]> {
  return await D1ExecutionRepo.getExecutionHistory(env.FEAR_GREED_D1, chatId, ticker);
}

/**
 * Get the most recent execution for a user, optionally filtered by ticker
 * @param env - Environment variables
 * @param chatId - User's chat ID
 * @param ticker - Optional ticker to filter by
 * @returns Most recent execution or null if none exists
 */
export async function getLatestExecution(
  env: Env,
  chatId: number | string,
  ticker?: string
): Promise<SignalExecution | null> {
  return await D1ExecutionRepo.getLatestExecution(env.FEAR_GREED_D1, chatId, ticker);
}

/**
 * Format execution history for display
 * @param executions - Array of executions to format
 * @returns Formatted string
 */
export function formatExecutionHistory(executions: SignalExecution[]): string {
  if (executions.length === 0) {
    return 'No executions found.';
  }

  return executions
    .map(exec => {
      const date = new Date(exec.executionDate).toISOString().split('T')[0];
      const signalEmoji = exec.signalType === 'BUY' ? '🟢' : '🔴';
      return `${signalEmoji} ${exec.signalType} ${exec.ticker} @ $${exec.executionPrice.toFixed(2)} (${date})`;
    })
    .join('\n');
}
