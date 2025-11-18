/**
 * Execution tracking tests
 */

import { recordExecution, getExecutionHistory, getLatestExecution, formatExecutionHistory } from '../src/utils/executions.js';
import { getActivePosition, setActivePosition, clearActivePosition, canTrade } from '../src/utils/trades.js';
import { TestRunner, createMockEnv } from './utils/test-helpers.js';
import assert from 'node:assert';

const runner = new TestRunner();

// Test 1: Record execution
runner.test('Record execution', async () => {
  const env = createMockEnv();
  const chatId = 12345;
  
  await recordExecution(env.FEAR_GREED_KV, chatId, 'BUY', 'SPY', 400.50);
  
  const history = await getExecutionHistory(env.FEAR_GREED_KV, chatId);
  assert(history.length === 1, 'Should have one execution');
  assert(history[0].signalType === 'BUY', 'Should be BUY signal');
  assert(history[0].ticker === 'SPY', 'Should have correct ticker');
  assert(history[0].executionPrice === 400.50, 'Should have correct price');
});

// Test 2: Get execution history
runner.test('Get execution history', async () => {
  const env = createMockEnv();
  const chatId = 12345;
  
  await recordExecution(env.FEAR_GREED_KV, chatId, 'BUY', 'SPY', 400.50);
  await recordExecution(env.FEAR_GREED_KV, chatId, 'SELL', 'SPY', 450.00);
  
  const history = await getExecutionHistory(env.FEAR_GREED_KV, chatId);
  assert(history.length === 2, 'Should have two executions');
  assert(history[0].signalType === 'SELL', 'Should be sorted newest first');
  assert(history[1].signalType === 'BUY', 'Should have BUY as second');
});

// Test 3: Get execution history filtered by ticker
runner.test('Get execution history filtered by ticker', async () => {
  const env = createMockEnv();
  const chatId = 12345;
  
  await recordExecution(env.FEAR_GREED_KV, chatId, 'BUY', 'SPY', 400.50);
  await recordExecution(env.FEAR_GREED_KV, chatId, 'BUY', 'AAPL', 150.00);
  
  const spyHistory = await getExecutionHistory(env.FEAR_GREED_KV, chatId, 'SPY');
  assert(spyHistory.length === 1, 'Should have one SPY execution');
  assert(spyHistory[0].ticker === 'SPY', 'Should be SPY');
  
  const aaplHistory = await getExecutionHistory(env.FEAR_GREED_KV, chatId, 'AAPL');
  assert(aaplHistory.length === 1, 'Should have one AAPL execution');
  assert(aaplHistory[0].ticker === 'AAPL', 'Should be AAPL');
});

// Test 4: Get latest execution
runner.test('Get latest execution', async () => {
  const env = createMockEnv();
  const chatId = 12345;
  
  await recordExecution(env.FEAR_GREED_KV, chatId, 'BUY', 'SPY', 400.50);
  await recordExecution(env.FEAR_GREED_KV, chatId, 'SELL', 'SPY', 450.00);
  
  const latest = await getLatestExecution(env.FEAR_GREED_KV, chatId);
  assert(latest !== null, 'Should have latest execution');
  assert(latest.signalType === 'SELL', 'Should be most recent (SELL)');
});

// Test 5: Format execution history
runner.test('Format execution history', () => {
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
  assert(formatted.includes('BUY'), 'Should include BUY');
  assert(formatted.includes('SELL'), 'Should include SELL');
  assert(formatted.includes('SPY'), 'Should include ticker');
  assert(formatted.includes('400.50'), 'Should include price');
});

// Test 6: Per-user execution tracking
runner.test('Per-user execution tracking', async () => {
  const env = createMockEnv();
  const chatId1 = 11111;
  const chatId2 = 22222;
  
  await recordExecution(env.FEAR_GREED_KV, chatId1, 'BUY', 'SPY', 400.50);
  await recordExecution(env.FEAR_GREED_KV, chatId2, 'BUY', 'AAPL', 150.00);
  
  const history1 = await getExecutionHistory(env.FEAR_GREED_KV, chatId1);
  const history2 = await getExecutionHistory(env.FEAR_GREED_KV, chatId2);
  
  assert(history1.length === 1, 'User 1 should have one execution');
  assert(history2.length === 1, 'User 2 should have one execution');
  assert(history1[0].ticker === 'SPY', 'User 1 should have SPY');
  assert(history2[0].ticker === 'AAPL', 'User 2 should have AAPL');
});

// Test 7: Active position management
runner.test('Active position management', async () => {
  const env = createMockEnv();
  const chatId = 12345;
  
  // Set active position
  await setActivePosition(env.FEAR_GREED_KV, chatId, 'SPY', 400.50);
  
  const position = await getActivePosition(env.FEAR_GREED_KV, chatId);
  assert(position !== null, 'Should have active position');
  assert(position.ticker === 'SPY', 'Should have correct ticker');
  assert(position.entryPrice === 400.50, 'Should have correct entry price');
  
  // Clear active position
  await clearActivePosition(env.FEAR_GREED_KV, chatId);
  
  const clearedPosition = await getActivePosition(env.FEAR_GREED_KV, chatId);
  assert(clearedPosition === null, 'Should not have active position after clearing');
});

// Test 8: Trading frequency limit (calendar month)
runner.test('Trading frequency limit (calendar month)', async () => {
  const env = createMockEnv();
  const chatId = 12345;
  
  // No executions - should allow
  const canTrade1 = await canTrade(env.FEAR_GREED_KV, chatId);
  assert(canTrade1 === true, 'Should allow trading when no executions');
  
  // Record execution in current month
  await recordExecution(env.FEAR_GREED_KV, chatId, 'BUY', 'SPY', 400.50);
  
  // Should not allow (same calendar month)
  const canTrade2 = await canTrade(env.FEAR_GREED_KV, chatId);
  assert(canTrade2 === false, 'Should not allow trading in the same calendar month');
  
  // Record execution in previous month
  const lastMonth = new Date();
  lastMonth.setUTCMonth(lastMonth.getUTCMonth() - 1);
  const lastMonthExecution = {
    signalType: 'BUY',
    ticker: 'SPY',
    executionPrice: 400.50,
    executionDate: lastMonth.getTime()
  };
  const historyKey = `execution_history:${chatId}`;
  await env.FEAR_GREED_KV.put(historyKey, JSON.stringify([lastMonthExecution]));
  
  // Should allow (different calendar month)
  const canTrade3 = await canTrade(env.FEAR_GREED_KV, chatId);
  assert(canTrade3 === true, 'Should allow trading in a different calendar month');
});

// Test 9: Empty execution history
runner.test('Empty execution history', async () => {
  const env = createMockEnv();
  const chatId = 12345;
  
  const history = await getExecutionHistory(env.FEAR_GREED_KV, chatId);
  assert(history.length === 0, 'Should have no executions');
  
  const formatted = formatExecutionHistory([]);
  assert(formatted.includes('No executions'), 'Should indicate no executions');
});

// Test 10: Record execution with custom date
runner.test('Record execution with custom date', async () => {
  const env = createMockEnv();
  const chatId = 12345;
  
  // Record execution with a specific date (2024-01-15, start of day UTC)
  const customDate = new Date(Date.UTC(2024, 0, 15)); // January 15, 2024
  const customTimestamp = customDate.getTime();
  
  await recordExecution(env.FEAR_GREED_KV, chatId, 'BUY', 'SPY', 400.50, undefined, customTimestamp);
  
  const history = await getExecutionHistory(env.FEAR_GREED_KV, chatId);
  assert(history.length === 1, 'Should have one execution');
  assert(history[0].executionDate === customTimestamp, 'Should have custom execution date');
  
  // Verify the date is correct (start of day UTC)
  const executionDate = new Date(history[0].executionDate);
  assert(executionDate.getUTCFullYear() === 2024, 'Should have correct year');
  assert(executionDate.getUTCMonth() === 0, 'Should have correct month (January = 0)');
  assert(executionDate.getUTCDate() === 15, 'Should have correct day');
  assert(executionDate.getUTCHours() === 0, 'Should be start of day (0 hours)');
  assert(executionDate.getUTCMinutes() === 0, 'Should be start of day (0 minutes)');
});

// Test 11: Record execution without custom date (should use current time)
runner.test('Record execution without custom date', async () => {
  const env = createMockEnv();
  const chatId = 12345;
  
  const beforeTime = Date.now();
  await recordExecution(env.FEAR_GREED_KV, chatId, 'BUY', 'SPY', 400.50);
  const afterTime = Date.now();
  
  const history = await getExecutionHistory(env.FEAR_GREED_KV, chatId);
  assert(history.length === 1, 'Should have one execution');
  assert(history[0].executionDate >= beforeTime, 'Should have execution date after beforeTime');
  assert(history[0].executionDate <= afterTime, 'Should have execution date before afterTime');
});

// Run tests
runner.run().catch(console.error);

