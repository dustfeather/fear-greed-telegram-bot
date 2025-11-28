/**
 * Watchlist management tests
 */

import { getWatchlist, setWatchlist, addTickerToWatchlist, removeTickerFromWatchlist, ensureTickerInWatchlist } from '../../../src/user-management/services/watchlist-service.js';
import { TestRunner, createMockEnv, assertEqual, assertIncludes, assertNotIncludes } from '../../utils/test-helpers.js';
import assert from 'node:assert';

const runner = new TestRunner();

// Test 1: Get default watchlist (should return SPY)
runner.test('Get default watchlist returns SPY', async () => {
  const env = createMockEnv();
  const chatId = 123456789;

  const watchlist = await getWatchlist(env.FEAR_GREED_KV, chatId);

  assertEqual(watchlist.length, 1, 'Watchlist should have 1 ticker');
  assertEqual(watchlist[0], 'SPY', 'Default watchlist should contain SPY');
});

// Test 2: Set watchlist
runner.test('Set watchlist with multiple tickers', async () => {
  const env = createMockEnv();
  const chatId = 123456789;
  const tickers = ['SPY', 'AAPL', 'MSFT'];

  await setWatchlist(env.FEAR_GREED_KV, chatId, tickers);

  const watchlist = await getWatchlist(env.FEAR_GREED_KV, chatId);
  assertEqual(watchlist.length, 3, 'Watchlist should have 3 tickers');
  assertIncludes(watchlist, 'SPY', 'Should contain SPY');
  assertIncludes(watchlist, 'AAPL', 'Should contain AAPL');
  assertIncludes(watchlist, 'MSFT', 'Should contain MSFT');
});

// Test 3: Add ticker to watchlist
runner.test('Add ticker to watchlist', async () => {
  const env = createMockEnv();
  const chatId = 123456789;

  // Start with default watchlist
  const initialWatchlist = await getWatchlist(env.FEAR_GREED_KV, chatId);
  assertEqual(initialWatchlist.length, 1, 'Initial watchlist should have 1 ticker');

  // Add AAPL
  const result = await addTickerToWatchlist(env.FEAR_GREED_KV, chatId, 'AAPL');

  assert(result.success, 'Add should succeed');
  assertEqual(result.wasAlreadyAdded, false, 'Ticker should not be already added');

  const watchlist = await getWatchlist(env.FEAR_GREED_KV, chatId);
  assertEqual(watchlist.length, 2, 'Watchlist should have 2 tickers');
  assertIncludes(watchlist, 'SPY', 'Should still contain SPY');
  assertIncludes(watchlist, 'AAPL', 'Should contain AAPL');
});

// Test 4: Add duplicate ticker (case-insensitive)
runner.test('Add duplicate ticker should fail', async () => {
  const env = createMockEnv();
  const chatId = 123456789;

  // Add SPY (already in default watchlist)
  const result = await addTickerToWatchlist(env.FEAR_GREED_KV, chatId, 'SPY');

  assert(!result.success, 'Add should fail for duplicate');
  assertEqual(result.wasAlreadyAdded, true, 'Ticker should be marked as already added');

  // Try with lowercase
  const result2 = await addTickerToWatchlist(env.FEAR_GREED_KV, chatId, 'spy');

  assert(!result2.success, 'Add should fail for duplicate (case-insensitive)');
  assertEqual(result2.wasAlreadyAdded, true, 'Ticker should be marked as already added');

  const watchlist = await getWatchlist(env.FEAR_GREED_KV, chatId);
  assertEqual(watchlist.length, 1, 'Watchlist should still have 1 ticker');
});

// Test 5: Add invalid ticker
runner.test('Add invalid ticker should fail', async () => {
  const env = createMockEnv();
  const chatId = 123456789;

  // Try to add invalid ticker
  const result = await addTickerToWatchlist(env.FEAR_GREED_KV, chatId, 'INVALID-TICKER');

  assert(!result.success, 'Add should fail for invalid ticker');
  assert(result.message.includes('Invalid ticker'), 'Error message should mention invalid ticker');
});

// Test 6: Remove ticker from watchlist
runner.test('Remove ticker from watchlist', async () => {
  const env = createMockEnv();
  const chatId = 123456789;

  // Set watchlist with multiple tickers
  await setWatchlist(env.FEAR_GREED_KV, chatId, ['SPY', 'AAPL', 'MSFT']);

  // Remove AAPL
  const result = await removeTickerFromWatchlist(env.FEAR_GREED_KV, chatId, 'AAPL');

  assert(result.success, 'Remove should succeed');
  assertEqual(result.wasRemoved, true, 'Ticker should be marked as removed');

  const watchlist = await getWatchlist(env.FEAR_GREED_KV, chatId);
  assertEqual(watchlist.length, 2, 'Watchlist should have 2 tickers');
  assertIncludes(watchlist, 'SPY', 'Should still contain SPY');
  assertIncludes(watchlist, 'MSFT', 'Should still contain MSFT');
  assertNotIncludes(watchlist, 'AAPL', 'Should not contain AAPL');
});

// Test 7: Remove last ticker (should auto-add SPY)
runner.test('Remove last ticker auto-adds SPY', async () => {
  const env = createMockEnv();
  const chatId = 123456789;

  // Start with default watchlist (SPY)
  const initialWatchlist = await getWatchlist(env.FEAR_GREED_KV, chatId);
  assertEqual(initialWatchlist.length, 1, 'Initial watchlist should have 1 ticker');

  // Remove SPY (last ticker)
  const result = await removeTickerFromWatchlist(env.FEAR_GREED_KV, chatId, 'SPY');

  assert(result.success, 'Remove should succeed');
  assertEqual(result.wasRemoved, true, 'Ticker should be marked as removed');
  assertEqual(result.spyReAdded, true, 'SPY should be auto-added back');

  const watchlist = await getWatchlist(env.FEAR_GREED_KV, chatId);
  assertEqual(watchlist.length, 1, 'Watchlist should have 1 ticker');
  assertEqual(watchlist[0], 'SPY', 'Watchlist should contain SPY');
});

// Test 8: Remove non-existent ticker
runner.test('Remove non-existent ticker should fail', async () => {
  const env = createMockEnv();
  const chatId = 123456789;

  // Try to remove ticker not in watchlist
  const result = await removeTickerFromWatchlist(env.FEAR_GREED_KV, chatId, 'AAPL');

  assert(!result.success, 'Remove should fail for non-existent ticker');
  assertEqual(result.wasRemoved, false, 'Ticker should be marked as not removed');
});

// Test 9: Remove ticker case-insensitive
runner.test('Remove ticker case-insensitive', async () => {
  const env = createMockEnv();
  const chatId = 123456789;

  // Set watchlist with multiple tickers
  await setWatchlist(env.FEAR_GREED_KV, chatId, ['SPY', 'AAPL']);

  // Remove using lowercase
  const result = await removeTickerFromWatchlist(env.FEAR_GREED_KV, chatId, 'aapl');

  assert(result.success, 'Remove should succeed (case-insensitive)');

  const watchlist = await getWatchlist(env.FEAR_GREED_KV, chatId);
  assertNotIncludes(watchlist, 'AAPL', 'Should not contain AAPL');
  assertIncludes(watchlist, 'SPY', 'Should still contain SPY');
});

// Test 10: Ensure ticker in watchlist (adds if not exists)
runner.test('Ensure ticker in watchlist adds if not exists', async () => {
  const env = createMockEnv();
  const chatId = 123456789;

  // Start with default watchlist
  const initialWatchlist = await getWatchlist(env.FEAR_GREED_KV, chatId);
  assertEqual(initialWatchlist.length, 1, 'Initial watchlist should have 1 ticker');

  // Ensure AAPL is in watchlist
  await ensureTickerInWatchlist(env.FEAR_GREED_KV, chatId, 'AAPL');

  const watchlist = await getWatchlist(env.FEAR_GREED_KV, chatId);
  assertEqual(watchlist.length, 2, 'Watchlist should have 2 tickers');
  assertIncludes(watchlist, 'SPY', 'Should contain SPY');
  assertIncludes(watchlist, 'AAPL', 'Should contain AAPL');
});

// Test 11: Ensure ticker in watchlist (does not duplicate)
runner.test('Ensure ticker in watchlist does not duplicate', async () => {
  const env = createMockEnv();
  const chatId = 123456789;

  // Start with default watchlist (SPY)
  const initialWatchlist = await getWatchlist(env.FEAR_GREED_KV, chatId);
  assertEqual(initialWatchlist.length, 1, 'Initial watchlist should have 1 ticker');

  // Ensure SPY is in watchlist (already there)
  await ensureTickerInWatchlist(env.FEAR_GREED_KV, chatId, 'SPY');

  const watchlist = await getWatchlist(env.FEAR_GREED_KV, chatId);
  assertEqual(watchlist.length, 1, 'Watchlist should still have 1 ticker');
  assertEqual(watchlist[0], 'SPY', 'Should contain SPY');
});

// Test 12: Set watchlist with duplicates (should deduplicate)
runner.test('Set watchlist deduplicates tickers', async () => {
  const env = createMockEnv();
  const chatId = 123456789;
  const tickers = ['SPY', 'AAPL', 'spy', 'MSFT', 'aapl']; // Duplicates with different case

  await setWatchlist(env.FEAR_GREED_KV, chatId, tickers);

  const watchlist = await getWatchlist(env.FEAR_GREED_KV, chatId);
  assertEqual(watchlist.length, 3, 'Watchlist should have 3 unique tickers');
  assertIncludes(watchlist, 'SPY', 'Should contain SPY (uppercase)');
  assertIncludes(watchlist, 'AAPL', 'Should contain AAPL (uppercase)');
  assertIncludes(watchlist, 'MSFT', 'Should contain MSFT');
});

// Test 13: Set empty watchlist (should auto-add SPY)
runner.test('Set empty watchlist auto-adds SPY', async () => {
  const env = createMockEnv();
  const chatId = 123456789;

  // Set empty watchlist
  await setWatchlist(env.FEAR_GREED_KV, chatId, []);

  const watchlist = await getWatchlist(env.FEAR_GREED_KV, chatId);
  assertEqual(watchlist.length, 1, 'Watchlist should have 1 ticker');
  assertEqual(watchlist[0], 'SPY', 'Watchlist should contain SPY');
});

// Test 14: Multiple users have separate watchlists
runner.test('Multiple users have separate watchlists', async () => {
  const env = createMockEnv();
  const chatId1 = 111111111;
  const chatId2 = 222222222;

  // Set different watchlists for each user
  await setWatchlist(env.FEAR_GREED_KV, chatId1, ['SPY', 'AAPL']);
  await setWatchlist(env.FEAR_GREED_KV, chatId2, ['SPY', 'MSFT']);

  const watchlist1 = await getWatchlist(env.FEAR_GREED_KV, chatId1);
  const watchlist2 = await getWatchlist(env.FEAR_GREED_KV, chatId2);

  assertEqual(watchlist1.length, 2, 'User 1 watchlist should have 2 tickers');
  assertEqual(watchlist2.length, 2, 'User 2 watchlist should have 2 tickers');

  assertIncludes(watchlist1, 'AAPL', 'User 1 should have AAPL');
  assertNotIncludes(watchlist1, 'MSFT', 'User 1 should not have MSFT');

  assertIncludes(watchlist2, 'MSFT', 'User 2 should have MSFT');
  assertNotIncludes(watchlist2, 'AAPL', 'User 2 should not have AAPL');
});

// Test 15: Tickers are stored in uppercase
runner.test('Tickers are stored in uppercase', async () => {
  const env = createMockEnv();
  const chatId = 123456789;

  // Add ticker with lowercase
  await addTickerToWatchlist(env.FEAR_GREED_KV, chatId, 'aapl');

  const watchlist = await getWatchlist(env.FEAR_GREED_KV, chatId);

  // All tickers should be uppercase
  watchlist.forEach(ticker => {
    assertEqual(ticker, ticker.toUpperCase(), `Ticker ${ticker} should be uppercase`);
  });

  assertIncludes(watchlist, 'AAPL', 'Should contain AAPL (uppercase)');
  assertNotIncludes(watchlist, 'aapl', 'Should not contain lowercase aapl');
});

// Test 16: Initialize watchlist if missing (for scheduled job)
runner.test('Initialize watchlist if missing', async () => {
  const env = createMockEnv();
  const chatId = 123456789;

  const { initializeWatchlistIfMissing } = await import('../../../src/user-management/services/watchlist-service.js');

  // Simulate existing user who doesn't have a watchlist yet
  // First call should initialize and persist the default watchlist
  const wasInitialized = await initializeWatchlistIfMissing(env.FEAR_GREED_KV, chatId);

  assert(wasInitialized, 'Watchlist should be initialized');

  // Verify it was persisted to KV
  const key = `watchlist:${chatId}`;
  const watchlistString = await env.FEAR_GREED_KV.get(key);
  assert(watchlistString, 'Watchlist should be persisted to KV');

  const persistedWatchlist = JSON.parse(watchlistString);
  assertEqual(persistedWatchlist.length, 1, 'Persisted watchlist should have 1 ticker');
  assertEqual(persistedWatchlist[0], 'SPY', 'Persisted watchlist should contain SPY');

  // Second call should return false (already exists)
  const wasInitialized2 = await initializeWatchlistIfMissing(env.FEAR_GREED_KV, chatId);
  assert(!wasInitialized2, 'Watchlist should not be initialized again');
});

// Test 17: getWatchlist auto-initializes on first access
runner.test('getWatchlist auto-initializes on first access', async () => {
  const env = createMockEnv();
  const chatId = 999999999;

  // User doesn't have a watchlist
  const watchlist = await getWatchlist(env.FEAR_GREED_KV, chatId);

  // Should return default watchlist
  assertEqual(watchlist.length, 1, 'Watchlist should have 1 ticker');
  assertEqual(watchlist[0], 'SPY', 'Should contain SPY');

  // Should be persisted to KV (initialization happens on first /now or scheduled job)
  const key = `watchlist:${chatId}`;
  const watchlistString = await env.FEAR_GREED_KV.get(key);
  assert(watchlistString, 'Watchlist should be persisted on getWatchlist call');

  const persistedWatchlist = JSON.parse(watchlistString);
  assertEqual(persistedWatchlist.length, 1, 'Persisted watchlist should have 1 ticker');
  assertEqual(persistedWatchlist[0], 'SPY', 'Persisted watchlist should contain SPY');
});

// Run tests
runner.run().catch(console.error);

