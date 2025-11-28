/**
 * Execution history management utilities
 */

import type { KVNamespace } from '@cloudflare/workers-types';
import type { SignalExecution } from '../../core/types/index.js';
import { executionHistoryKey } from '../../core/constants/index.js';
import { createKVError } from '../../core/utils/errors.js';

/**
 * Record a signal execution for a user
 * @param kv - KV namespace
 * @param chatId - User's chat ID
 * @param signalType - Type of signal executed ('BUY' or 'SELL')
 * @param ticker - Ticker symbol
 * @param executionPrice - Price at which the signal was executed
 * @param signalPrice - Optional price when signal was generated
 * @param executionDate - Optional execution date timestamp (defaults to current time)
 * @returns Promise resolving to void
 */
export async function recordExecution(
  kv: KVNamespace,
  chatId: number | string,
  signalType: 'BUY' | 'SELL',
  ticker: string,
  executionPrice: number,
  signalPrice?: number,
  executionDate?: number
): Promise<void> {
  try {
    const key = executionHistoryKey(chatId);
    const historyString = await kv.get(key);

    let history: SignalExecution[] = [];
    if (historyString) {
      history = JSON.parse(historyString) as SignalExecution[];
    }

    const execution: SignalExecution = {
      signalType,
      ticker,
      executionPrice,
      executionDate: executionDate ?? Date.now(),
      signalPrice
    };

    history.push(execution);

    // Store updated history
    await kv.put(key, JSON.stringify(history));
  } catch (error) {
    throw createKVError('Failed to record execution', error);
  }
}

/**
 * Get execution history for a user, optionally filtered by ticker
 * @param kv - KV namespace
 * @param chatId - User's chat ID
 * @param ticker - Optional ticker to filter by
 * @returns Array of executions, sorted by date (newest first)
 */
export async function getExecutionHistory(
  kv: KVNamespace,
  chatId: number | string,
  ticker?: string
): Promise<SignalExecution[]> {
  try {
    const key = executionHistoryKey(chatId);
    const historyString = await kv.get(key);

    if (!historyString) {
      return [];
    }

    let history = JSON.parse(historyString) as SignalExecution[];

    // Filter by ticker if provided
    if (ticker) {
      history = history.filter(exec => exec.ticker.toUpperCase() === ticker.toUpperCase());
    }

    // Sort by date (newest first)
    history.sort((a, b) => b.executionDate - a.executionDate);

    return history;
  } catch (error) {
    throw createKVError('Failed to get execution history', error);
  }
}

/**
 * Get the most recent execution for a user, optionally filtered by ticker
 * @param kv - KV namespace
 * @param chatId - User's chat ID
 * @param ticker - Optional ticker to filter by
 * @returns Most recent execution or null if none exists
 */
export async function getLatestExecution(
  kv: KVNamespace,
  chatId: number | string,
  ticker?: string
): Promise<SignalExecution | null> {
  try {
    const history = await getExecutionHistory(kv, chatId, ticker);
    return history.length > 0 ? history[0] : null;
  } catch (error) {
    throw createKVError('Failed to get latest execution', error);
  }
}

/**
 * Format execution history for display
 * @param executions - Array of executions to format
 * @returns Formatted string
 */
export function formatExecutionHistory(executions: SignalExecution[]): string {
  if (executions.length === 0) {
    return 'No executions recorded.';
  }

  const lines: string[] = [];
  lines.push(`*Execution History (${executions.length} ${executions.length === 1 ? 'entry' : 'entries'}):*\n`);

  for (const exec of executions) {
    const date = new Date(exec.executionDate);
    const dateStr = date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const signalEmoji = exec.signalType === 'BUY' ? '🟢' : '🔴';
    let line = `${signalEmoji} *${exec.signalType}* ${exec.ticker} at $${exec.executionPrice.toFixed(2)}`;

    if (exec.signalPrice && exec.signalPrice !== exec.executionPrice) {
      const diff = exec.executionPrice - exec.signalPrice;
      const diffPercent = (diff / exec.signalPrice) * 100;
      const diffSign = diff >= 0 ? '+' : '';
      line += ` (signal: $${exec.signalPrice.toFixed(2)}, ${diffSign}${diffPercent.toFixed(2)}%)`;
    }

    line += `\n   📅 ${dateStr}`;
    lines.push(line);
  }

  return lines.join('\n\n');
}

