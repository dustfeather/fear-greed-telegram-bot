/**
 * Execution tracking tests
 */

import { recordExecution, getExecutionHistory, getLatestExecution, formatExecutionHistory } from '../../../src/trading/services/execution-service.js';
import { getActivePosition, setActivePosition, clearActivePosition, canTrade } from '../../../src/trading/services/position-service.js';
import { createMockEnv } from '../../utils/test-helpers.js';

describe('Execution Service', () => {
  let env;

  beforeEach(() => {
    env = createMockEnv();
  });

  describe('Record Execution', () => {
    test('should record execution', async () => {
      const chatId = 12345;

      await recordExecution(env, chatId, 'BUY', 'SPY', 400.50);

      const history = await getExecutionHistory(env, chatId);
      expect(history).toHaveLength(1);
      expect(history[0].signalType).toBe('BUY');
      expect(history[0].ticker).toBe('SPY');
      expect(history[0].executionPrice).toBe(400.50);
    });

    test('should record execution with custom date', async () => {
      const chatId = 12345;

      // Record execution with a specific date (2024-01-15, start of day UTC)
      const customDate = new Date(Date.UTC(2024, 0, 15)); // January 15, 2024
      const customTimestamp = customDate.getTime();

      await recordExecution(env, chatId, 'BUY', 'SPY', 400.50, undefined, customTimestamp);

      const history = await getExecutionHistory(env, chatId);
      expect(history).toHaveLength(1);
      expect(history[0].executionDate).toBe(customTimestamp);

      // Verify the date is correct (start of day UTC)
      const executionDate = new Date(history[0].executionDate);
      expect(executionDate.getUTCFullYear()).toBe(2024);
      expect(executionDate.getUTCMonth()).toBe(0); // January = 0
      expect(executionDate.getUTCDate()).toBe(15);
      expect(executionDate.getUTCHours()).toBe(0);
      expect(executionDate.getUTCMinutes()).toBe(0);
    });

    test('should record execution without custom date using current time', async () => {
      const chatId = 12345;

      const beforeTime = Date.now();
      await recordExecution(env, chatId, 'BUY', 'SPY', 400.50);
      const afterTime = Date.now();

      const history = await getExecutionHistory(env, chatId);
      expect(history).toHaveLength(1);
      expect(history[0].executionDate).toBeGreaterThanOrEqual(beforeTime);
      expect(history[0].executionDate).toBeLessThanOrEqual(afterTime);
    });
  });

  describe('Execution History', () => {
    test('should get execution history', async () => {
      const chatId = 12345;

      await recordExecution(env, chatId, 'BUY', 'SPY', 400.50);
      // Add small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10));
      await recordExecution(env, chatId, 'SELL', 'SPY', 450.00);

      const history = await getExecutionHistory(env, chatId);
      expect(history).toHaveLength(2);
      expect(history[0].signalType).toBe('SELL'); // Sorted newest first
      expect(history[1].signalType).toBe('BUY');
    });

    test('should get execution history filtered by ticker', async () => {
      const chatId = 12345;

      await recordExecution(env, chatId, 'BUY', 'SPY', 400.50);
      await recordExecution(env, chatId, 'BUY', 'AAPL', 150.00);

      const spyHistory = await getExecutionHistory(env, chatId, 'SPY');
      expect(spyHistory).toHaveLength(1);
      expect(spyHistory[0].ticker).toBe('SPY');

      const aaplHistory = await getExecutionHistory(env, chatId, 'AAPL');
      expect(aaplHistory).toHaveLength(1);
      expect(aaplHistory[0].ticker).toBe('AAPL');
    });

    test('should return empty execution history', async () => {
      const chatId = 12345;

      const history = await getExecutionHistory(env, chatId);
      expect(history).toHaveLength(0);

      const formatted = formatExecutionHistory([]);
      expect(formatted).toContain('No executions');
    });

    test('should get latest execution', async () => {
      const chatId = 12345;

      await recordExecution(env, chatId, 'BUY', 'SPY', 400.50);
      // Add small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10));
      await recordExecution(env, chatId, 'SELL', 'SPY', 450.00);

      const latest = await getLatestExecution(env, chatId);
      expect(latest).not.toBeNull();
      expect(latest.signalType).toBe('SELL'); // Most recent
    });

    test('should format execution history', () => {
      const executions = [
        {
          signalType: 'BUY',
          ticker: 'SPY',
          executionPrice: 400.50,
          executionDate: Date.now(),
          signalPrice: 400.00
        },
        {
          signalType: 'SELL',
          ticker: 'SPY',
          executionPrice: 450.00,
          executionDate: Date.now() - 86400000
        }
      ];

      const formatted = formatExecutionHistory(executions);
      expect(formatted).toContain('BUY');
      expect(formatted).toContain('SELL');
      expect(formatted).toContain('SPY');
      expect(formatted).toContain('400.50');
    });
  });

  describe('Per-User Tracking', () => {
    test('should track executions per user', async () => {
      const chatId1 = 11111;
      const chatId2 = 22222;

      await recordExecution(env, chatId1, 'BUY', 'SPY', 400.50);
      await recordExecution(env, chatId2, 'BUY', 'AAPL', 150.00);

      const history1 = await getExecutionHistory(env, chatId1);
      const history2 = await getExecutionHistory(env, chatId2);

      expect(history1).toHaveLength(1);
      expect(history2).toHaveLength(1);
      expect(history1[0].ticker).toBe('SPY');
      expect(history2[0].ticker).toBe('AAPL');
    });
  });

  describe('Active Position Management', () => {
    test('should manage active position', async () => {
      const chatId = 12345;

      // Set active position
      await setActivePosition(env, chatId, 'SPY', 400.50);

      const position = await getActivePosition(env, chatId);
      expect(position).not.toBeNull();
      expect(position.ticker).toBe('SPY');
      expect(position.entryPrice).toBe(400.50);

      // Clear active position
      await clearActivePosition(env, chatId);

      const clearedPosition = await getActivePosition(env, chatId);
      expect(clearedPosition).toBeNull();
    });
  });

  describe('Trading Frequency Limit', () => {
    test('should enforce calendar month trading limit', async () => {
      const chatId = 12345;

      // No executions - should allow
      const canTrade1 = await canTrade(env, chatId);
      expect(canTrade1).toBe(true);

      // Record execution in current month
      await recordExecution(env, chatId, 'BUY', 'SPY', 400.50);

      // Should not allow (same calendar month)
      const canTrade2 = await canTrade(env, chatId);
      expect(canTrade2).toBe(false);
    });

    test('should allow trading in different calendar month', async () => {
      const chatId = 12345;
      const env2 = createMockEnv();
      const lastMonth = new Date();
      lastMonth.setUTCMonth(lastMonth.getUTCMonth() - 1);

      // Record execution from last month
      await recordExecution(env2, chatId, 'BUY', 'SPY', 400.50, undefined, lastMonth.getTime());

      // Should allow (different calendar month)
      const canTrade3 = await canTrade(env2, chatId);
      expect(canTrade3).toBe(true);
    });
  });
});
