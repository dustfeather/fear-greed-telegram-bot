/**
 * Watchlist management tests
 */

import { getWatchlist, setWatchlist, addTickerToWatchlist, removeTickerFromWatchlist, ensureTickerInWatchlist, initializeWatchlistIfMissing } from '../../../src/user-management/services/watchlist-service.js';
import { createMockEnv } from '../../utils/test-helpers.js';

describe('Watchlist Service', () => {
  let env;

  beforeEach(() => {
    env = createMockEnv();
  });

  describe('Get Watchlist', () => {
    test('should return default watchlist with SPY', async () => {
      const chatId = 123456789;

      const watchlist = await getWatchlist(env, chatId);

      expect(watchlist).toHaveLength(1);
      expect(watchlist[0]).toBe('SPY');
    });

    test('should auto-initialize on first access', async () => {
      const chatId = 999999999;

      // User doesn't have a watchlist
      const watchlist = await getWatchlist(env, chatId);

      // Should return default watchlist
      expect(watchlist).toHaveLength(1);
      expect(watchlist[0]).toBe('SPY');

      // Should be persisted to D1 (initialization happens on first /now or scheduled job)
      const watchlist2 = await getWatchlist(env, chatId);
      expect(watchlist2).toHaveLength(1);
      expect(watchlist2[0]).toBe('SPY');
    });
  });

  describe('Set Watchlist', () => {
    test('should set watchlist with multiple tickers', async () => {
      const chatId = 123456789;
      const tickers = ['SPY', 'AAPL', 'MSFT'];

      await setWatchlist(env, chatId, tickers);

      const watchlist = await getWatchlist(env, chatId);
      expect(watchlist).toHaveLength(3);
      expect(watchlist).toContain('SPY');
      expect(watchlist).toContain('AAPL');
      expect(watchlist).toContain('MSFT');
    });

    test('should deduplicate tickers', async () => {
      const chatId = 123456789;
      const tickers = ['SPY', 'AAPL', 'spy', 'MSFT', 'aapl']; // Duplicates with different case

      await setWatchlist(env, chatId, tickers);

      const watchlist = await getWatchlist(env, chatId);
      expect(watchlist).toHaveLength(3);
      expect(watchlist).toContain('SPY');
      expect(watchlist).toContain('AAPL');
      expect(watchlist).toContain('MSFT');
    });

    test('should auto-add SPY when setting empty watchlist', async () => {
      const chatId = 123456789;

      // Set empty watchlist
      await setWatchlist(env, chatId, []);

      const watchlist = await getWatchlist(env, chatId);
      expect(watchlist).toHaveLength(1);
      expect(watchlist[0]).toBe('SPY');
    });
  });

  describe('Add Ticker', () => {
    test('should add ticker to watchlist', async () => {
      const chatId = 123456789;

      // Start with default watchlist
      const initialWatchlist = await getWatchlist(env, chatId);
      expect(initialWatchlist).toHaveLength(1);

      // Add AAPL
      const result = await addTickerToWatchlist(env, chatId, 'AAPL');

      expect(result.success).toBe(true);
      expect(result.wasAlreadyAdded).toBe(false);

      const watchlist = await getWatchlist(env, chatId);
      expect(watchlist).toHaveLength(2);
      expect(watchlist).toContain('SPY');
      expect(watchlist).toContain('AAPL');
    });

    test('should fail when adding duplicate ticker', async () => {
      const chatId = 123456789;

      // Add SPY (already in default watchlist)
      const result = await addTickerToWatchlist(env, chatId, 'SPY');

      expect(result.success).toBe(false);
      expect(result.wasAlreadyAdded).toBe(true);

      // Try with lowercase
      const result2 = await addTickerToWatchlist(env, chatId, 'spy');

      expect(result2.success).toBe(false);
      expect(result2.wasAlreadyAdded).toBe(true);

      const watchlist = await getWatchlist(env, chatId);
      expect(watchlist).toHaveLength(1);
    });

    test('should fail when adding invalid ticker', async () => {
      const chatId = 123456789;

      // Try to add invalid ticker
      const result = await addTickerToWatchlist(env, chatId, 'INVALID-TICKER');

      expect(result.success).toBe(false);
      expect(result.message).toContain('Invalid ticker');
    });

    test('should store tickers in uppercase', async () => {
      const chatId = 123456789;

      // Add ticker with lowercase
      await addTickerToWatchlist(env, chatId, 'aapl');

      const watchlist = await getWatchlist(env, chatId);

      // All tickers should be uppercase
      watchlist.forEach(ticker => {
        expect(ticker).toBe(ticker.toUpperCase());
      });

      expect(watchlist).toContain('AAPL');
      expect(watchlist).not.toContain('aapl');
    });
  });

  describe('Remove Ticker', () => {
    test('should remove ticker from watchlist', async () => {
      const chatId = 123456789;

      // Set watchlist with multiple tickers
      await setWatchlist(env, chatId, ['SPY', 'AAPL', 'MSFT']);

      // Remove AAPL
      const result = await removeTickerFromWatchlist(env, chatId, 'AAPL');

      expect(result.success).toBe(true);
      expect(result.wasRemoved).toBe(true);

      const watchlist = await getWatchlist(env, chatId);
      expect(watchlist).toHaveLength(2);
      expect(watchlist).toContain('SPY');
      expect(watchlist).toContain('MSFT');
      expect(watchlist).not.toContain('AAPL');
    });

    test('should auto-add SPY when removing last ticker', async () => {
      const chatId = 123456789;

      // Start with default watchlist (SPY)
      const initialWatchlist = await getWatchlist(env, chatId);
      expect(initialWatchlist).toHaveLength(1);

      // Remove SPY (last ticker)
      const result = await removeTickerFromWatchlist(env, chatId, 'SPY');

      expect(result.success).toBe(true);
      expect(result.wasRemoved).toBe(true);
      expect(result.spyReAdded).toBe(true);

      const watchlist = await getWatchlist(env, chatId);
      expect(watchlist).toHaveLength(1);
      expect(watchlist[0]).toBe('SPY');
    });

    test('should fail when removing non-existent ticker', async () => {
      const chatId = 123456789;

      // Try to remove ticker not in watchlist
      const result = await removeTickerFromWatchlist(env, chatId, 'AAPL');

      expect(result.success).toBe(false);
      expect(result.wasRemoved).toBe(false);
    });

    test('should remove ticker case-insensitively', async () => {
      const chatId = 123456789;

      // Set watchlist with multiple tickers
      await setWatchlist(env, chatId, ['SPY', 'AAPL']);

      // Remove using lowercase
      const result = await removeTickerFromWatchlist(env, chatId, 'aapl');

      expect(result.success).toBe(true);

      const watchlist = await getWatchlist(env, chatId);
      expect(watchlist).not.toContain('AAPL');
      expect(watchlist).toContain('SPY');
    });
  });

  describe('Ensure Ticker', () => {
    test('should add ticker if not exists', async () => {
      const chatId = 123456789;

      // Start with default watchlist
      const initialWatchlist = await getWatchlist(env, chatId);
      expect(initialWatchlist).toHaveLength(1);

      // Ensure AAPL is in watchlist
      await ensureTickerInWatchlist(env, chatId, 'AAPL');

      const watchlist = await getWatchlist(env, chatId);
      expect(watchlist).toHaveLength(2);
      expect(watchlist).toContain('SPY');
      expect(watchlist).toContain('AAPL');
    });

    test('should not duplicate existing ticker', async () => {
      const chatId = 123456789;

      // Start with default watchlist (SPY)
      const initialWatchlist = await getWatchlist(env, chatId);
      expect(initialWatchlist).toHaveLength(1);

      // Ensure SPY is in watchlist (already there)
      await ensureTickerInWatchlist(env, chatId, 'SPY');

      const watchlist = await getWatchlist(env, chatId);
      expect(watchlist).toHaveLength(1);
      expect(watchlist[0]).toBe('SPY');
    });
  });

  describe('Initialize Watchlist', () => {
    test('should initialize watchlist if missing', async () => {
      const chatId = 123456789;

      // Simulate existing user who doesn't have a watchlist yet
      // First call should initialize and persist the default watchlist
      const wasInitialized = await initializeWatchlistIfMissing(env, chatId);

      expect(wasInitialized).toBe(true);

      // Verify it was persisted to D1
      const watchlist = await getWatchlist(env, chatId);
      expect(watchlist).toHaveLength(1);
      expect(watchlist[0]).toBe('SPY');

      // Second call should return false (already exists)
      const wasInitialized2 = await initializeWatchlistIfMissing(env, chatId);
      expect(wasInitialized2).toBe(false);
    });
  });

  describe('Multiple Users', () => {
    test('should maintain separate watchlists for different users', async () => {
      const chatId1 = 111111111;
      const chatId2 = 222222222;

      // Set different watchlists for each user
      await setWatchlist(env, chatId1, ['SPY', 'AAPL']);
      await setWatchlist(env, chatId2, ['SPY', 'MSFT']);

      const watchlist1 = await getWatchlist(env, chatId1);
      const watchlist2 = await getWatchlist(env, chatId2);

      expect(watchlist1).toHaveLength(2);
      expect(watchlist2).toHaveLength(2);

      expect(watchlist1).toContain('AAPL');
      expect(watchlist1).not.toContain('MSFT');

      expect(watchlist2).toContain('MSFT');
      expect(watchlist2).not.toContain('AAPL');
    });
  });
});
