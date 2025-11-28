/**
 * Data validation utility for KV to D1 migration
 * Validates that migrated data maintains integrity and consistency
 */

import type { KVNamespace, D1Database } from '@cloudflare/workers-types';
import { KV_KEYS, watchlistKey, executionHistoryKey, activePositionKey } from '../core/constants/index.js';
import type { SignalExecution, ActivePosition } from '../core/types/index.js';

/**
 * Discrepancy found during validation
 */
export interface ValidationDiscrepancy {
  type: string;
  description: string;
  kvValue?: unknown;
  d1Value?: unknown;
}

/**
 * Validation result for a single table
 */
export interface TableValidationResult {
  table: string;
  kvCount: number;
  d1Count: number;
  match: boolean;
  discrepancies: ValidationDiscrepancy[];
}

/**
 * Overall validation report
 */
export interface ValidationReport {
  timestamp: number;
  overallSuccess: boolean;
  tables: TableValidationResult[];
  summary: string;
}

/**
 * Data validator class
 */
export class DataValidator {
  constructor(
    private kv: KVNamespace,
    private db: D1Database
  ) {}

  /**
   * Validate that all KV chat IDs exist in D1 users table
   * @returns Validation result for users table
   */
  async validateChatIds(): Promise<TableValidationResult> {
    const result: TableValidationResult = {
      table: 'users',
      kvCount: 0,
      d1Count: 0,
      match: false,
      discrepancies: []
    };

    try {
      // Get chat IDs from KV
      const chatIdsString = await this.kv.get(KV_KEYS.CHAT_IDS);
      const kvChatIds = chatIdsString ? (JSON.parse(chatIdsString) as (number | string)[]) : [];
      result.kvCount = kvChatIds.length;

      // Get chat IDs from D1
      const d1Result = await this.db
        .prepare('SELECT chat_id FROM users WHERE subscription_status = 1')
        .all<{ chat_id: string }>();
      const d1ChatIds = d1Result.results.map(row => row.chat_id);
      result.d1Count = d1ChatIds.length;

      // Check if counts match
      if (result.kvCount !== result.d1Count) {
        result.discrepancies.push({
          type: 'count_mismatch',
          description: `Chat ID count mismatch: KV has ${result.kvCount}, D1 has ${result.d1Count}`,
          kvValue: result.kvCount,
          d1Value: result.d1Count
        });
      }

      // Check if all KV chat IDs exist in D1
      const d1ChatIdSet = new Set(d1ChatIds);
      for (const kvChatId of kvChatIds) {
        const chatIdStr = String(kvChatId);
        if (!d1ChatIdSet.has(chatIdStr)) {
          result.discrepancies.push({
            type: 'missing_chat_id',
            description: `Chat ID ${chatIdStr} exists in KV but not in D1`,
            kvValue: chatIdStr,
            d1Value: null
          });
        }
      }

      // Check for extra chat IDs in D1 (shouldn't happen, but good to check)
      const kvChatIdSet = new Set(kvChatIds.map(id => String(id)));
      for (const d1ChatId of d1ChatIds) {
        if (!kvChatIdSet.has(d1ChatId)) {
          result.discrepancies.push({
            type: 'extra_chat_id',
            description: `Chat ID ${d1ChatId} exists in D1 but not in KV`,
            kvValue: null,
            d1Value: d1ChatId
          });
        }
      }

      result.match = result.discrepancies.length === 0;
    } catch (error) {
      result.discrepancies.push({
        type: 'validation_error',
        description: `Error validating chat IDs: ${error instanceof Error ? error.message : String(error)}`
      });
    }

    return result;
  }

  /**
   * Validate watchlist counts between KV and D1
   * @returns Validation result for watchlists table
   */
  async validateWatchlistCounts(): Promise<TableValidationResult> {
    const result: TableValidationResult = {
      table: 'watchlists',
      kvCount: 0,
      d1Count: 0,
      match: false,
      discrepancies: []
    };

    try {
      // Get all chat IDs
      const chatIdsString = await this.kv.get(KV_KEYS.CHAT_IDS);
      const chatIds = chatIdsString ? (JSON.parse(chatIdsString) as (number | string)[]) : [];

      let totalKvTickers = 0;
      const kvWatchlistCounts = new Map<string, number>();

      // Count tickers in KV for each user
      for (const chatId of chatIds) {
        const key = watchlistKey(chatId);
        const watchlistJson = await this.kv.get(key);

        if (watchlistJson) {
          const watchlist = JSON.parse(watchlistJson) as string[];
          totalKvTickers += watchlist.length;
          kvWatchlistCounts.set(String(chatId), watchlist.length);
        } else {
          kvWatchlistCounts.set(String(chatId), 0);
        }
      }

      result.kvCount = totalKvTickers;

      // Count tickers in D1
      const d1CountResult = await this.db
        .prepare('SELECT COUNT(*) as count FROM watchlists')
        .first<{ count: number }>();
      result.d1Count = d1CountResult?.count ?? 0;

      // Check overall count
      if (result.kvCount !== result.d1Count) {
        result.discrepancies.push({
          type: 'count_mismatch',
          description: `Watchlist count mismatch: KV has ${result.kvCount}, D1 has ${result.d1Count}`,
          kvValue: result.kvCount,
          d1Value: result.d1Count
        });
      }

      // Check per-user counts
      for (const [chatId, kvCount] of kvWatchlistCounts) {
        const d1UserResult = await this.db
          .prepare('SELECT COUNT(*) as count FROM watchlists WHERE chat_id = ?')
          .bind(chatId)
          .first<{ count: number }>();
        const d1Count = d1UserResult?.count ?? 0;

        if (kvCount !== d1Count) {
          result.discrepancies.push({
            type: 'user_count_mismatch',
            description: `Watchlist count mismatch for user ${chatId}: KV has ${kvCount}, D1 has ${d1Count}`,
            kvValue: kvCount,
            d1Value: d1Count
          });
        }
      }

      result.match = result.discrepancies.length === 0;
    } catch (error) {
      result.discrepancies.push({
        type: 'validation_error',
        description: `Error validating watchlist counts: ${error instanceof Error ? error.message : String(error)}`
      });
    }

    return result;
  }

  /**
   * Validate execution counts between KV and D1
   * @returns Validation result for executions table
   */
  async validateExecutionCounts(): Promise<TableValidationResult> {
    const result: TableValidationResult = {
      table: 'executions',
      kvCount: 0,
      d1Count: 0,
      match: false,
      discrepancies: []
    };

    try {
      // Get all chat IDs
      const chatIdsString = await this.kv.get(KV_KEYS.CHAT_IDS);
      const chatIds = chatIdsString ? (JSON.parse(chatIdsString) as (number | string)[]) : [];

      let totalKvExecutions = 0;
      const kvExecutionCounts = new Map<string, number>();

      // Count executions in KV for each user
      for (const chatId of chatIds) {
        const key = executionHistoryKey(chatId);
        const historyJson = await this.kv.get(key);

        if (historyJson) {
          const history = JSON.parse(historyJson) as SignalExecution[];
          totalKvExecutions += history.length;
          kvExecutionCounts.set(String(chatId), history.length);
        } else {
          kvExecutionCounts.set(String(chatId), 0);
        }
      }

      result.kvCount = totalKvExecutions;

      // Count executions in D1
      const d1CountResult = await this.db
        .prepare('SELECT COUNT(*) as count FROM executions')
        .first<{ count: number }>();
      result.d1Count = d1CountResult?.count ?? 0;

      // Check overall count
      if (result.kvCount !== result.d1Count) {
        result.discrepancies.push({
          type: 'count_mismatch',
          description: `Execution count mismatch: KV has ${result.kvCount}, D1 has ${result.d1Count}`,
          kvValue: result.kvCount,
          d1Value: result.d1Count
        });
      }

      // Check per-user counts
      for (const [chatId, kvCount] of kvExecutionCounts) {
        const d1UserResult = await this.db
          .prepare('SELECT COUNT(*) as count FROM executions WHERE chat_id = ?')
          .bind(chatId)
          .first<{ count: number }>();
        const d1Count = d1UserResult?.count ?? 0;

        if (kvCount !== d1Count) {
          result.discrepancies.push({
            type: 'user_count_mismatch',
            description: `Execution count mismatch for user ${chatId}: KV has ${kvCount}, D1 has ${d1Count}`,
            kvValue: kvCount,
            d1Value: d1Count
          });
        }
      }

      result.match = result.discrepancies.length === 0;
    } catch (error) {
      result.discrepancies.push({
        type: 'validation_error',
        description: `Error validating execution counts: ${error instanceof Error ? error.message : String(error)}`
      });
    }

    return result;
  }

  /**
   * Validate active position counts between KV and D1
   * @returns Validation result for active_positions table
   */
  async validatePositionCounts(): Promise<TableValidationResult> {
    const result: TableValidationResult = {
      table: 'active_positions',
      kvCount: 0,
      d1Count: 0,
      match: false,
      discrepancies: []
    };

    try {
      // Get all chat IDs
      const chatIdsString = await this.kv.get(KV_KEYS.CHAT_IDS);
      const chatIds = chatIdsString ? (JSON.parse(chatIdsString) as (number | string)[]) : [];

      let totalKvPositions = 0;
      const kvPositions = new Map<string, ActivePosition | null>();

      // Count positions in KV for each user
      for (const chatId of chatIds) {
        const key = activePositionKey(chatId);
        const positionJson = await this.kv.get(key);

        if (positionJson) {
          const position = JSON.parse(positionJson) as ActivePosition;
          totalKvPositions++;
          kvPositions.set(String(chatId), position);
        } else {
          kvPositions.set(String(chatId), null);
        }
      }

      result.kvCount = totalKvPositions;

      // Count positions in D1
      const d1CountResult = await this.db
        .prepare('SELECT COUNT(*) as count FROM active_positions')
        .first<{ count: number }>();
      result.d1Count = d1CountResult?.count ?? 0;

      // Check overall count
      if (result.kvCount !== result.d1Count) {
        result.discrepancies.push({
          type: 'count_mismatch',
          description: `Active position count mismatch: KV has ${result.kvCount}, D1 has ${result.d1Count}`,
          kvValue: result.kvCount,
          d1Value: result.d1Count
        });
      }

      // Check per-user positions
      for (const [chatId, kvPosition] of kvPositions) {
        const d1PositionResult = await this.db
          .prepare('SELECT ticker, entry_price FROM active_positions WHERE chat_id = ?')
          .bind(chatId)
          .first<{ ticker: string; entry_price: number }>();

        const hasKvPosition = kvPosition !== null;
        const hasD1Position = d1PositionResult !== null;

        if (hasKvPosition !== hasD1Position) {
          result.discrepancies.push({
            type: 'position_existence_mismatch',
            description: `Position existence mismatch for user ${chatId}: KV has ${hasKvPosition ? 'position' : 'no position'}, D1 has ${hasD1Position ? 'position' : 'no position'}`,
            kvValue: kvPosition,
            d1Value: d1PositionResult
          });
        } else if (hasKvPosition && hasD1Position && kvPosition && d1PositionResult) {
          // Both have positions, check if they match
          if (kvPosition.ticker.toUpperCase() !== d1PositionResult.ticker.toUpperCase()) {
            result.discrepancies.push({
              type: 'position_ticker_mismatch',
              description: `Position ticker mismatch for user ${chatId}: KV has ${kvPosition.ticker}, D1 has ${d1PositionResult.ticker}`,
              kvValue: kvPosition.ticker,
              d1Value: d1PositionResult.ticker
            });
          }

          if (Math.abs(kvPosition.entryPrice - d1PositionResult.entry_price) > 0.01) {
            result.discrepancies.push({
              type: 'position_price_mismatch',
              description: `Position entry price mismatch for user ${chatId}: KV has ${kvPosition.entryPrice}, D1 has ${d1PositionResult.entry_price}`,
              kvValue: kvPosition.entryPrice,
              d1Value: d1PositionResult.entry_price
            });
          }
        }
      }

      result.match = result.discrepancies.length === 0;
    } catch (error) {
      result.discrepancies.push({
        type: 'validation_error',
        description: `Error validating position counts: ${error instanceof Error ? error.message : String(error)}`
      });
    }

    return result;
  }

  /**
   * Run full validation and generate detailed report
   * @returns Validation report with results for all tables
   */
  async validateMigration(): Promise<ValidationReport> {
    console.log('Starting migration validation...');

    const tables: TableValidationResult[] = [];

    // Validate each table
    tables.push(await this.validateChatIds());
    tables.push(await this.validateWatchlistCounts());
    tables.push(await this.validateExecutionCounts());
    tables.push(await this.validatePositionCounts());

    // Determine overall success
    const overallSuccess = tables.every(table => table.match);

    // Generate summary
    let summary = 'Migration Validation Report\n';
    summary += '==========================\n\n';

    for (const table of tables) {
      summary += `${table.table}:\n`;
      summary += `  KV Count: ${table.kvCount}\n`;
      summary += `  D1 Count: ${table.d1Count}\n`;
      summary += `  Match: ${table.match ? '✓' : '✗'}\n`;

      if (table.discrepancies.length > 0) {
        summary += `  Discrepancies (${table.discrepancies.length}):\n`;
        for (const disc of table.discrepancies) {
          summary += `    - ${disc.description}\n`;
        }
      }

      summary += '\n';
    }

    summary += `Overall Status: ${overallSuccess ? 'SUCCESS ✓' : 'FAILED ✗'}\n`;

    const report: ValidationReport = {
      timestamp: Date.now(),
      overallSuccess,
      tables,
      summary
    };

    console.log(summary);

    return report;
  }
}
