/**
 * Data migration utility for KV to D1 migration
 * Handles automatic migration of all data from KV to D1
 */

import type { KVNamespace, D1Database } from '@cloudflare/workers-types';
import { KV_KEYS, watchlistKey, executionHistoryKey, activePositionKey } from '../core/constants/index.js';
import type { SignalExecution, ActivePosition } from '../core/types/index.js';

/**
 * Result of migrating a single table
 */
export interface MigrationResult {
  table: string;
  recordsMigrated: number;
  errors: MigrationError[];
  duration: number;
}

/**
 * Error encountered during migration
 */
export interface MigrationError {
  key: string;
  error: string;
  data?: unknown;
}

/**
 * Overall migration status
 */
export interface MigrationStatus {
  completed: boolean;
  timestamp: number;
  results: MigrationResult[];
}

/**
 * Data migrator class
 */
export class DataMigrator {
  constructor(
    private kv: KVNamespace,
    private db: D1Database
  ) {}

  /**
   * Check if migration is needed
   * @returns true if migration should run, false if already completed
   */
  async needsMigration(): Promise<boolean> {
    try {
      const status = await this.db
        .prepare('SELECT completed FROM _migration_status WHERE id = 1')
        .first<{ completed: number }>();

      return !status || status.completed === 0;
    } catch (error) {
      console.error('Error checking migration status:', error);
      // If we can't check status, assume migration is needed
      return true;
    }
  }

  /**
   * Migrate subscription data (chat_ids array → users table)
   */
  async migrateSubscriptions(): Promise<MigrationResult> {
    const result: MigrationResult = {
      table: 'users',
      recordsMigrated: 0,
      errors: [],
      duration: 0
    };

    const startTime = Date.now();

    try {
      // Get all chat IDs from KV
      const chatIdsString = await this.kv.get(KV_KEYS.CHAT_IDS);
      if (!chatIdsString) {
        result.duration = Date.now() - startTime;
        return result;
      }

      const chatIds = JSON.parse(chatIdsString) as (number | string)[];
      const now = Date.now();

      // Batch insert in groups of 100
      const batchSize = 100;
      for (let i = 0; i < chatIds.length; i += batchSize) {
        const batch = chatIds.slice(i, i + batchSize);
        const statements = batch.map(chatId => {
          const chatIdStr = String(chatId);
          return this.db
            .prepare('INSERT OR IGNORE INTO users (chat_id, subscription_status, created_at, updated_at) VALUES (?, 1, ?, ?)')
            .bind(chatIdStr, now, now);
        });

        try {
          await this.db.batch(statements);
          result.recordsMigrated += batch.length;
        } catch (error) {
          result.errors.push({
            key: KV_KEYS.CHAT_IDS,
            error: error instanceof Error ? error.message : String(error),
            data: { batch: i / batchSize }
          });
        }
      }
    } catch (error) {
      result.errors.push({
        key: KV_KEYS.CHAT_IDS,
        error: error instanceof Error ? error.message : String(error)
      });
    }

    result.duration = Date.now() - startTime;
    return result;
  }

  /**
   * Migrate watchlist data (watchlist:{chatId} → watchlists table)
   */
  async migrateWatchlists(): Promise<MigrationResult> {
    const result: MigrationResult = {
      table: 'watchlists',
      recordsMigrated: 0,
      errors: [],
      duration: 0
    };

    const startTime = Date.now();

    try {
      // Get all chat IDs first
      const chatIdsString = await this.kv.get(KV_KEYS.CHAT_IDS);
      if (!chatIdsString) {
        result.duration = Date.now() - startTime;
        return result;
      }

      const chatIds = JSON.parse(chatIdsString) as (number | string)[];
      const now = Date.now();

      for (const chatId of chatIds) {
        try {
          const key = watchlistKey(chatId);
          const watchlistJson = await this.kv.get(key);

          if (!watchlistJson) continue;

          const watchlist = JSON.parse(watchlistJson) as string[];

          // Batch insert all tickers for this user
          const statements = watchlist.map(ticker =>
            this.db
              .prepare('INSERT OR IGNORE INTO watchlists (chat_id, ticker, created_at) VALUES (?, ?, ?)')
              .bind(String(chatId), ticker.toUpperCase(), now)
          );

          if (statements.length > 0) {
            await this.db.batch(statements);
            result.recordsMigrated += watchlist.length;
          }
        } catch (error) {
          result.errors.push({
            key: watchlistKey(chatId),
            error: error instanceof Error ? error.message : String(error),
            data: { chatId }
          });
        }
      }
    } catch (error) {
      result.errors.push({
        key: 'watchlists',
        error: error instanceof Error ? error.message : String(error)
      });
    }

    result.duration = Date.now() - startTime;
    return result;
  }

  /**
   * Migrate execution history (execution_history:{chatId} → executions table)
   */
  async migrateExecutions(): Promise<MigrationResult> {
    const result: MigrationResult = {
      table: 'executions',
      recordsMigrated: 0,
      errors: [],
      duration: 0
    };

    const startTime = Date.now();

    try {
      // Get all chat IDs first
      const chatIdsString = await this.kv.get(KV_KEYS.CHAT_IDS);
      if (!chatIdsString) {
        result.duration = Date.now() - startTime;
        return result;
      }

      const chatIds = JSON.parse(chatIdsString) as (number | string)[];
      const now = Date.now();

      for (const chatId of chatIds) {
        try {
          const key = executionHistoryKey(chatId);
          const historyJson = await this.kv.get(key);

          if (!historyJson) continue;

          const history = JSON.parse(historyJson) as SignalExecution[];

          // Batch insert all executions for this user
          const statements = history.map(exec =>
            this.db
              .prepare(
                'INSERT OR IGNORE INTO executions (chat_id, signal_type, ticker, execution_price, signal_price, execution_date, created_at) ' +
                'VALUES (?, ?, ?, ?, ?, ?, ?)'
              )
              .bind(
                String(chatId),
                exec.signalType,
                exec.ticker.toUpperCase(),
                exec.executionPrice,
                exec.signalPrice ?? null,
                exec.executionDate,
                now
              )
          );

          if (statements.length > 0) {
            await this.db.batch(statements);
            result.recordsMigrated += history.length;
          }
        } catch (error) {
          result.errors.push({
            key: executionHistoryKey(chatId),
            error: error instanceof Error ? error.message : String(error),
            data: { chatId }
          });
        }
      }
    } catch (error) {
      result.errors.push({
        key: 'executions',
        error: error instanceof Error ? error.message : String(error)
      });
    }

    result.duration = Date.now() - startTime;
    return result;
  }

  /**
   * Migrate active positions (active_position:{chatId} → active_positions table)
   */
  async migrateActivePositions(): Promise<MigrationResult> {
    const result: MigrationResult = {
      table: 'active_positions',
      recordsMigrated: 0,
      errors: [],
      duration: 0
    };

    const startTime = Date.now();

    try {
      // Get all chat IDs first
      const chatIdsString = await this.kv.get(KV_KEYS.CHAT_IDS);
      if (!chatIdsString) {
        result.duration = Date.now() - startTime;
        return result;
      }

      const chatIds = JSON.parse(chatIdsString) as (number | string)[];
      const now = Date.now();

      for (const chatId of chatIds) {
        try {
          const key = activePositionKey(chatId);
          const positionJson = await this.kv.get(key);

          if (!positionJson) continue;

          const position = JSON.parse(positionJson) as ActivePosition;

          await this.db
            .prepare(
              'INSERT OR IGNORE INTO active_positions (chat_id, ticker, entry_price, created_at, updated_at) ' +
              'VALUES (?, ?, ?, ?, ?)'
            )
            .bind(String(chatId), position.ticker.toUpperCase(), position.entryPrice, now, now)
            .run();

          result.recordsMigrated++;
        } catch (error) {
          result.errors.push({
            key: activePositionKey(chatId),
            error: error instanceof Error ? error.message : String(error),
            data: { chatId }
          });
        }
      }
    } catch (error) {
      result.errors.push({
        key: 'active_positions',
        error: error instanceof Error ? error.message : String(error)
      });
    }

    result.duration = Date.now() - startTime;
    return result;
  }

  /**
   * Migrate cache data (fear_greed_cache → cache table)
   */
  async migrateCache(): Promise<MigrationResult> {
    const result: MigrationResult = {
      table: 'cache',
      recordsMigrated: 0,
      errors: [],
      duration: 0
    };

    const startTime = Date.now();

    try {
      const cacheJson = await this.kv.get(KV_KEYS.FEAR_GREED_CACHE);
      if (!cacheJson) {
        result.duration = Date.now() - startTime;
        return result;
      }

      const cacheData = JSON.parse(cacheJson) as { data: unknown; timestamp: number };
      const now = Date.now();

      // Calculate expiration (24 hours from timestamp)
      const ttlMs = 24 * 60 * 60 * 1000;
      const expiresAt = cacheData.timestamp + ttlMs;

      await this.db
        .prepare(
          'INSERT OR REPLACE INTO cache (cache_key, cache_value, expires_at, updated_at) ' +
          'VALUES (?, ?, ?, ?)'
        )
        .bind(KV_KEYS.FEAR_GREED_CACHE, JSON.stringify(cacheData.data), expiresAt, now)
        .run();

      result.recordsMigrated = 1;
    } catch (error) {
      result.errors.push({
        key: KV_KEYS.FEAR_GREED_CACHE,
        error: error instanceof Error ? error.message : String(error)
      });
    }

    result.duration = Date.now() - startTime;
    return result;
  }

  /**
   * Mark migration as complete
   */
  async markMigrationComplete(): Promise<void> {
    const now = Date.now();
    await this.db
      .prepare('UPDATE _migration_status SET completed = 1, completed_at = ? WHERE id = 1')
      .bind(now)
      .run();
  }

  /**
   * Run full migration
   * @returns Migration status with results for all tables
   */
  async runMigration(): Promise<MigrationStatus> {
    console.log('Starting KV to D1 migration...');

    const results: MigrationResult[] = [];

    // Migrate each table
    results.push(await this.migrateSubscriptions());
    results.push(await this.migrateWatchlists());
    results.push(await this.migrateExecutions());
    results.push(await this.migrateActivePositions());
    results.push(await this.migrateCache());

    // Mark migration as complete
    await this.markMigrationComplete();

    const status: MigrationStatus = {
      completed: true,
      timestamp: Date.now(),
      results
    };

    // Log summary
    console.log('Migration completed:');
    for (const result of results) {
      console.log(`  ${result.table}: ${result.recordsMigrated} records (${result.duration}ms)`);
      if (result.errors.length > 0) {
        console.log(`    Errors: ${result.errors.length}`);
      }
    }

    return status;
  }
}
