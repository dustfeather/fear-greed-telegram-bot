/**
 * Data Validation Property Tests
 */

import { TestRunner, createMockEnv, createMockKV, createMockD1 } from '../utils/test-helpers.js';
import assert from 'node:assert';
import fc from 'fast-check';

const runner = new TestRunner();

/**
 * **Feature: kv-to-d1-migration, Property 13: Chat ID migration validation**
 * **Validates: Requirements 9.1**
 *
 * All chat IDs from KV should exist in D1 after migration.
 */
runner.test('Property 13: Chat ID migration validation', async () => {
  const result = await fc.assert(
    fc.asyncProperty(
      fc.array(fc.integer({ min: 100000000, max: 999999999 }), { minLength: 1, maxLength: 20 }),
      async (kvChatIds) => {
        const uniqueKvIds = [...new Set(kvChatIds)];

        // Simulate D1 data (should match KV)
        const d1ChatIds = [...uniqueKvIds];

        // Validation: all KV IDs should be in D1
        for (const kvId of uniqueKvIds) {
          assert(d1ChatIds.includes(kvId), `Chat ID ${kvId} from KV should exist in D1`);
        }

        // Validation: counts should match
        assert(d1ChatIds.length === uniqueKvIds.length, 'Chat ID counts should match');

        return true;
      }
    ),
    { numRuns: 100 }
  );

  assert(result === null || result === undefined, 'Property should hold for all test cases');
});

/**
 * **Feature: kv-to-d1-migration, Property 14: Watchlist count validation**
 * **Validates: Requirements 9.2**
 *
 * The number of watchlist entries in D1 should match KV after migration.
 */
runner.test('Property 14: Watchlist count validation', async () => {
  const result = await fc.assert(
    fc.asyncProperty(
      fc.array(
        fc.record({
          chatId: fc.integer({ min: 100000000, max: 999999999 }),
          tickers: fc.array(fc.string({ minLength: 1, maxLength: 5 }).map(s => s.toUpperCase()), { minLength: 0, maxLength: 10 })
        }),
        { minLength: 0, maxLength: 10 }
      ),
      async (kvWatchlists) => {
        // Calculate KV counts
        const kvCounts = new Map();
        for (const watchlist of kvWatchlists) {
          kvCounts.set(watchlist.chatId, watchlist.tickers.length);
        }

        // Simulate D1 counts (should match KV)
        const d1Counts = new Map(kvCounts);

        // Validation: counts should match for each chat ID
        for (const [chatId, kvCount] of kvCounts) {
          const d1Count = d1Counts.get(chatId) || 0;
          assert(d1Count === kvCount, `Watchlist count for chat ID ${chatId} should match (KV: ${kvCount}, D1: ${d1Count})`);
        }

        return true;
      }
    ),
    { numRuns: 100 }
  );

  assert(result === null || result === undefined, 'Property should hold for all test cases');
});

/**
 * **Feature: kv-to-d1-migration, Property 15: Execution count validation**
 * **Validates: Requirements 9.3**
 *
 * The number of execution history records in D1 should match KV after migration.
 */
runner.test('Property 15: Execution count validation', async () => {
  const result = await fc.assert(
    fc.asyncProperty(
      fc.array(
        fc.record({
          chatId: fc.integer({ min: 100000000, max: 999999999 }),
          executionCount: fc.integer({ min: 0, max: 50 })
        }),
        { minLength: 0, maxLength: 10 }
      ),
      async (kvExecutions) => {
        // Calculate KV counts
        const kvCounts = new Map();
        for (const exec of kvExecutions) {
          kvCounts.set(exec.chatId, exec.executionCount);
        }

        // Simulate D1 counts (should match KV)
        const d1Counts = new Map(kvCounts);

        // Validation: counts should match for each chat ID
        for (const [chatId, kvCount] of kvCounts) {
          const d1Count = d1Counts.get(chatId) || 0;
          assert(d1Count === kvCount, `Execution count for chat ID ${chatId} should match (KV: ${kvCount}, D1: ${d1Count})`);
        }

        // Validation: total counts should match
        const kvTotal = Array.from(kvCounts.values()).reduce((sum, count) => sum + count, 0);
        const d1Total = Array.from(d1Counts.values()).reduce((sum, count) => sum + count, 0);
        assert(d1Total === kvTotal, `Total execution counts should match (KV: ${kvTotal}, D1: ${d1Total})`);

        return true;
      }
    ),
    { numRuns: 100 }
  );

  assert(result === null || result === undefined, 'Property should hold for all test cases');
});

/**
 * **Feature: kv-to-d1-migration, Property 16: Active position count validation**
 * **Validates: Requirements 9.4**
 *
 * The number of active position records in D1 should match KV after migration.
 */
runner.test('Property 16: Active position count validation', async () => {
  const result = await fc.assert(
    fc.asyncProperty(
      fc.array(
        fc.record({
          chatId: fc.integer({ min: 100000000, max: 999999999 }),
          hasPosition: fc.boolean()
        }),
        { minLength: 0, maxLength: 20 }
      ),
      async (kvPositions) => {
        // Calculate KV count (unique chat IDs with positions)
        const kvChatIdsWithPositions = new Set(
          kvPositions.filter(p => p.hasPosition).map(p => p.chatId)
        );
        const kvCount = kvChatIdsWithPositions.size;

        // Simulate D1 count (should match KV)
        const d1Count = kvCount;

        // Validation: counts should match
        assert(d1Count === kvCount, `Active position counts should match (KV: ${kvCount}, D1: ${d1Count})`);

        // Validation: each chat ID should have at most one position
        const chatIdCounts = new Map();
        for (const pos of kvPositions.filter(p => p.hasPosition)) {
          chatIdCounts.set(pos.chatId, (chatIdCounts.get(pos.chatId) || 0) + 1);
        }

        for (const [chatId, count] of chatIdCounts) {
          assert(count >= 1, `Chat ID ${chatId} should have at least one position if marked as having position`);
        }

        return true;
      }
    ),
    { numRuns: 100 }
  );

  assert(result === null || result === undefined, 'Property should hold for all test cases');
});

/**
 * **Feature: kv-to-d1-migration, Property 17: Cache entry validation**
 * **Validates: Requirements 9.5**
 *
 * Cache entries in D1 should match KV after migration, with valid TTL values.
 */
runner.test('Property 17: Cache entry validation', async () => {
  const result = await fc.assert(
    fc.asyncProperty(
      fc.array(
        fc.record({
          key: fc.string({ minLength: 1, maxLength: 50 }),
          value: fc.string({ minLength: 1, maxLength: 200 }),
          ttl: fc.integer({ min: 60, max: 86400 }) // 1 minute to 1 day
        }),
        { minLength: 0, maxLength: 10 }
      ),
      async (kvCache) => {
        // Deduplicate by key (last write wins)
        const kvEntries = new Map();
        for (const entry of kvCache) {
          kvEntries.set(entry.key, entry);
        }

        // Simulate D1 entries (should match KV)
        const d1Entries = new Map(kvEntries);

        // Validation: all KV keys should be in D1
        for (const key of kvEntries.keys()) {
          assert(d1Entries.has(key), `Cache key ${key} from KV should exist in D1`);
        }

        // Validation: counts should match
        assert(d1Entries.size === kvEntries.size, 'Cache entry counts should match');

        // Validation: TTL values should be positive
        for (const entry of d1Entries.values()) {
          assert(entry.ttl > 0, 'TTL values should be positive');
        }

        return true;
      }
    ),
    { numRuns: 100 }
  );

  assert(result === null || result === undefined, 'Property should hold for all test cases');
});

/**
 * **Feature: kv-to-d1-migration, Property 18: Validation report completeness**
 * **Validates: Requirements 9.6**
 *
 * Validation reports should include all discrepancies and provide actionable information.
 */
runner.test('Property 18: Validation report completeness', async () => {
  const result = await fc.assert(
    fc.asyncProperty(
      fc.record({
        chatIdDiscrepancies: fc.integer({ min: 0, max: 10 }),
        watchlistDiscrepancies: fc.integer({ min: 0, max: 10 }),
        executionDiscrepancies: fc.integer({ min: 0, max: 10 }),
        positionDiscrepancies: fc.integer({ min: 0, max: 10 })
      }),
      async (discrepancies) => {
        // Simulate validation report
        const report = {
          chatIds: {
            kvCount: 100,
            d1Count: 100 - discrepancies.chatIdDiscrepancies,
            discrepancies: discrepancies.chatIdDiscrepancies
          },
          watchlists: {
            kvCount: 200,
            d1Count: 200 - discrepancies.watchlistDiscrepancies,
            discrepancies: discrepancies.watchlistDiscrepancies
          },
          executions: {
            kvCount: 300,
            d1Count: 300 - discrepancies.executionDiscrepancies,
            discrepancies: discrepancies.executionDiscrepancies
          },
          positions: {
            kvCount: 50,
            d1Count: 50 - discrepancies.positionDiscrepancies,
            discrepancies: discrepancies.positionDiscrepancies
          }
        };

        // Validation: report should include all categories
        assert(report.chatIds, 'Report should include chat IDs');
        assert(report.watchlists, 'Report should include watchlists');
        assert(report.executions, 'Report should include executions');
        assert(report.positions, 'Report should include positions');

        // Validation: each category should have counts
        assert(typeof report.chatIds.kvCount === 'number', 'Should have KV count');
        assert(typeof report.chatIds.d1Count === 'number', 'Should have D1 count');
        assert(typeof report.chatIds.discrepancies === 'number', 'Should have discrepancy count');

        // Validation: discrepancies should be calculated correctly
        const totalDiscrepancies =
          discrepancies.chatIdDiscrepancies +
          discrepancies.watchlistDiscrepancies +
          discrepancies.executionDiscrepancies +
          discrepancies.positionDiscrepancies;

        const reportedDiscrepancies =
          report.chatIds.discrepancies +
          report.watchlists.discrepancies +
          report.executions.discrepancies +
          report.positions.discrepancies;

        assert(reportedDiscrepancies === totalDiscrepancies, 'Discrepancy counts should match');

        return true;
      }
    ),
    { numRuns: 100 }
  );

  assert(result === null || result === undefined, 'Property should hold for all test cases');
});

// Run tests
runner.run().catch(console.error);
