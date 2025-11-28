/**
 * Execution tracking service
 */

import type { KVNamespace } from '@cloudflare/workers-types';
import type { Env, SignalExecution } from '../../core/types/index.js';
import * as KVExecutionRepo from '../repositories/execution-repository.js';
import * as D1ExecutionRepo from '../repositories/d1-execution-repository.js';

/**
 * Record a signal execution for a user
 * @param env - Environment variables (or KV namespace for backward compatibility)
 * @param chatId - User's chat ID
 * @param signalType - Type of signal executed ('BUY' or 'SELL')
 * @param ticker - Ticker symbol
 * @param executionPrice - Price at which the signal was executed
 * @param signalPrice - Optional price when signal was generated
 * @param executionDate - Optional execution date timestamp (defaults to current time)
 * @returns Promise resolving to void
 */
export async function recordExecution(
  env: Env | KVNamespace,
  chatId: number | string,
  signalType: 'BUY' | 'SELL',
  ticker: string,
  executionPrice: number,
  signalPrice?: number,
  executionDate?: number
): Promise<void> {
  // Check if env is Env object or KVNamespace
  const isEnvObject = 'FEAR_GREED_D1' in env || 'FEAR_GREED_KV' in env;

  if (isEnvObject) {
    const envObj = env as Env;
    if (envObj.FEAR_GREED_D1) {
      await D1ExecutionRepo.recordExecution(
        envObj.FEAR_GREED_D1,
        chatId,
        signalType,
        ticker,
        executionPrice,
        signalPrice,
        executionDate
      );
    } else {
      await KVExecutionRepo.recordExecution(
        envObj.FEAR_GREED_KV,
        chatId,
        signalType,
        ticker,
        executionPrice,
        signalPrice,
        executionDate
      );
    }
  } else {
    await KVExecutionRepo.recordExecution(
      env as KVNamespace,
      chatId,
      signalType,
      ticker,
      executionPrice,
      signalPrice,
      executionDate
    );
  }
}

/**
 * Get execution history for a user, optionally filtered by ticker
 * @param env - Environment variables (or KV namespace for backward compatibility)
 * @param chatId - User's chat ID
 * @param ticker - Optional ticker to filter by
 * @returns Array of executions, sorted by date (newest first)
 */
export async function getExecutionHistory(
  env: Env | KVNamespace,
  chatId: number | string,
  ticker?: string
): Promise<SignalExecution[]> {
  // Check if env is Env object or KVNamespace
  const isEnvObject = 'FEAR_GREED_D1' in env || 'FEAR_GREED_KV' in env;

  if (isEnvObject) {
    const envObj = env as Env;
    return envObj.FEAR_GREED_D1
      ? await D1ExecutionRepo.getExecutionHistory(envObj.FEAR_GREED_D1, chatId, ticker)
      : await KVExecutionRepo.getExecutionHistory(envObj.FEAR_GREED_KV, chatId, ticker);
  } else {
    return await KVExecutionRepo.getExecutionHistory(env as KVNamespace, chatId, ticker);
  }
}

/**
 * Get the most recent execution for a user, optionally filtered by ticker
 * @param env - Environment variables (or KV namespace for backward compatibility)
 * @param chatId - User's chat ID
 * @param ticker - Optional ticker to filter by
 * @returns Most recent execution or null if none exists
 */
export async function getLatestExecution(
  env: Env | KVNamespace,
  chatId: number | string,
  ticker?: string
): Promise<SignalExecution | null> {
  // Check if env is Env object or KVNamespace
  const isEnvObject = 'FEAR_GREED_D1' in env || 'FEAR_GREED_KV' in env;

  if (isEnvObject) {
    const envObj = env as Env;
    return envObj.FEAR_GREED_D1
      ? await D1ExecutionRepo.getLatestExecution(envObj.FEAR_GREED_D1, chatId, ticker)
      : await KVExecutionRepo.getLatestExecution(envObj.FEAR_GREED_KV, chatId, ticker);
  } else {
    return await KVExecutionRepo.getLatestExecution(env as KVNamespace, chatId, ticker);
  }
}

/**
 * Format execution history for display
 * @param executions - Array of executions to format
 * @returns Formatted string
 */
export function formatExecutionHistory(executions: SignalExecution[]): string {
  return KVExecutionRepo.formatExecutionHistory(executions);
}
