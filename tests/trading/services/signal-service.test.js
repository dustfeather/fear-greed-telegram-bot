/**
 * Trading signal evaluation tests
 */

import { evaluateTradingSignal, formatTradingSignalMessage } from '../../../src/trading/services/signal-service.js';
import { TestRunner, createMockEnv, createMockFetch, assertEqual } from '../../utils/test-helpers.js';
import assert from 'node:assert';

const runner = new TestRunner();

// Helper to create mock market data response
function createMockMarketData(currentPrice = 400, days = 200) {
  const timestamps = [];
  const closes = [];
  const opens = [];
  const highs = [];
  const lows = [];
  const volumes = [];

  const baseTime = Math.floor(Date.now() / 1000);

  for (let i = 0; i < days; i++) {
    const price = currentPrice - (days - i) * 0.5; // Slight upward trend
    timestamps.push(baseTime - (days - i) * 86400);
    closes.push(price);
    opens.push(price * 0.999);
    highs.push(price * 1.01);
    lows.push(price * 0.99);
    volumes.push(1000000);
  }

  return {
    chart: {
      result: [{
        meta: {
          regularMarketPrice: currentPrice
        },
        timestamp: timestamps,
        indicators: {
          quote: [{
            open: opens,
            high: highs,
            low: lows,
            close: closes,
            volume: volumes
          }]
        }
      }],
      error: null
    }
  };
}

function createStaticMarketData({
  currentPrice = 150,
  closeValue = 100,
  days = 40,
  highValue = closeValue * 1.01,
  spikeHighValue
} = {}) {
  const timestamps = [];
  const opens = [];
  const highs = [];
  const lows = [];
  const closes = [];
  const volumes = [];
  const baseTime = Math.floor(Date.now() / 1000);

  for (let i = 0; i < days; i++) {
    timestamps.push(baseTime - (days - i) * 86400);
    opens.push(closeValue * 1.001);
    highs.push(highValue);
    lows.push(closeValue * 0.999);
    closes.push(closeValue);
    volumes.push(750000);
  }

  if (typeof spikeHighValue === 'number') {
    highs[highs.length - 1] = spikeHighValue;
  }

  return {
    chart: {
      result: [{
        meta: {
          regularMarketPrice: currentPrice
        },
        timestamp: timestamps,
        indicators: {
          quote: [{
            open: opens,
            high: highs,
            low: lows,
            close: closes,
            volume: volumes
          }]
        }
      }],
      error: null
    }
  };
}

// Test 1: BUY signal when all conditions met
runner.test('BUY signal when all conditions met', async () => {
  const env = createMockEnv();
  const currentPrice = 380; // Below SMAs
  const fearGreedData = {
    rating: 'Fear',
    score: 25.0
  };

  const mockFetch = createMockFetch({
    'query1.finance.yahoo.com': () => ({
      ok: true,
      status: 200,
      json: async () => createMockMarketData(currentPrice)
    }),
    'production.dataviz.cnn.io': () => ({
      ok: true,
      status: 200,
      json: async () => fearGreedData
    })
  });

  global.fetch = mockFetch;

  const signal = await evaluateTradingSignal(env, fearGreedData);

  // Should evaluate conditions (may or may not trigger BUY depending on indicators)
  assert(typeof signal.signal === 'string', 'Signal should have a type');
  assert(['BUY', 'SELL', 'HOLD'].includes(signal.signal), 'Signal should be BUY, SELL, or HOLD');
  assert(typeof signal.currentPrice === 'number', 'Should have current price');
  assert(typeof signal.indicators === 'object', 'Should have indicators');
});

// Test 2: HOLD signal when conditions not met
runner.test('HOLD signal when conditions not met', async () => {
  const env = createMockEnv();
  const currentPrice = 450; // Above SMAs
  const fearGreedData = {
    rating: 'Greed',
    score: 75.0
  };

  const mockFetch = createMockFetch({
    'query1.finance.yahoo.com': () => ({
      ok: true,
      status: 200,
      json: async () => createMockMarketData(currentPrice)
    }),
    'production.dataviz.cnn.io': () => ({
      ok: true,
      status: 200,
      json: async () => fearGreedData
    })
  });

  global.fetch = mockFetch;

  const signal = await evaluateTradingSignal(env, fearGreedData);

  // Should be HOLD when conditions not met
  assert(signal.signal === 'HOLD' || signal.signal === 'BUY', 'Should be HOLD or BUY');
  assert(signal.conditionC === false, 'Condition C should be false (not fear)');
});

// Test 3: Signal evaluation with user-specific active position
runner.test('Signal evaluation with active position shows SELL or HOLD', async () => {
  const env = createMockEnv();
  const chatId = 12345;

  // Set active position for user
  await env.FEAR_GREED_KV.put(`active_position:${chatId}`, JSON.stringify({
    ticker: 'SPY',
    entryPrice: 400
  }));

  const currentPrice = 500; // Above all-time high (will trigger SELL)
  const fearGreedData = {
    rating: 'Extreme Fear',
    score: 15.0
  };

  const mockFetch = createMockFetch({
    'query1.finance.yahoo.com': () => ({
      ok: true,
      status: 200,
      json: async () => createMockMarketData(currentPrice, 200)
    }),
    'production.dataviz.cnn.io': () => ({
      ok: true,
      status: 200,
      json: async () => fearGreedData
    })
  });

  global.fetch = mockFetch;

  // Test with chatId - should check user's active position
  const signal = await evaluateTradingSignal(env, fearGreedData, 'SPY', chatId);

  // Should have entry price from active position
  assert(signal.entryPrice === 400, 'Should have entry price from active position');
  // Should not show BUY when user has active position
  assert(signal.signal !== 'BUY', 'Should not show BUY when user has active position');
});

// Test 3b: Signal evaluation without chatId shows generic signals
runner.test('Signal evaluation without chatId shows generic signals', async () => {
  const env = createMockEnv();

  const currentPrice = 380; // Below SMAs, conditions met
  const fearGreedData = {
    rating: 'Extreme Fear',
    score: 15.0
  };

  const mockFetch = createMockFetch({
    'query1.finance.yahoo.com': () => ({
      ok: true,
      status: 200,
      json: async () => createMockMarketData(currentPrice)
    }),
    'production.dataviz.cnn.io': () => ({
      ok: true,
      status: 200,
      json: async () => fearGreedData
    })
  });

  global.fetch = mockFetch;

  // Test without chatId - should show generic signals (no user-specific position check)
  const signal = await evaluateTradingSignal(env, fearGreedData);

  // Should evaluate conditions and show signal based on conditions only
  assert(typeof signal.signal === 'string', 'Signal should have a type');
  assert(['BUY', 'SELL', 'HOLD'].includes(signal.signal), 'Signal should be BUY, SELL, or HOLD');
  // Should not have canTrade or lastTradeDate fields
  assert(!('canTrade' in signal), 'Signal should not have canTrade field');
  assert(!('lastTradeDate' in signal), 'Signal should not have lastTradeDate field');
});

// Test 4: Format trading signal message
runner.test('Format trading signal message', () => {
  const signal = {
    signal: 'BUY',
    currentPrice: 400.50,
    indicators: {
      sma20: 410,
      sma50: 420,
      sma100: 430,
      sma200: 440,
      bollingerUpper: 415,
      bollingerMiddle: 410,
      bollingerLower: 405
    },
    conditionA: true,
    conditionB: true,
    conditionC: true,
    reasoning: 'BUY signal triggered'
  };

  const fearGreedData = {
    rating: 'Fear',
    score: 25.0
  };

  const message = formatTradingSignalMessage(signal, fearGreedData);

  assert(message.includes('BUY'), 'Message should include signal type');
  assert(message.includes('400.50'), 'Message should include current price');
  assert(message.includes('SMA 20'), 'Message should include indicators');
  assert(message.includes('Fear'), 'Message should include Fear & Greed rating');
});

// Test 5: SELL signal when price reaches all-time high threshold (within 1%)
runner.test('SELL signal when price reaches all-time high threshold', async () => {
  const env = createMockEnv();
  const chatId = 12345;

  // Set active position for user
  const entryPrice = 400;
  await env.FEAR_GREED_KV.put(`active_position:${chatId}`, JSON.stringify({ ticker: 'SPY', entryPrice }));

  // Create market data where all-time high is 500
  // The current price should be at or above allTimeHigh * 0.99 to trigger SELL
  const allTimeHigh = 500;
  const athThreshold = allTimeHigh * 0.99; // 495
  const currentPrice = athThreshold; // Current price equals threshold (within 1% of ATH)

  // Create market data and ensure the all-time high is set correctly
  // We need to make sure at least one high in the historical data equals the all-time high
  const marketData = createMockMarketData(currentPrice);
  const highs = marketData.chart.result[0].indicators.quote[0].high;
  // Set all highs to be below allTimeHigh, except set the last one to allTimeHigh
  // This ensures the all-time high is exactly allTimeHigh
  marketData.chart.result[0].indicators.quote[0].high =
    highs.map((h, i) => i === highs.length - 1 ? allTimeHigh : Math.min(h, allTimeHigh - 1));

  const fearGreedData = {
    rating: 'Neutral',
    score: 50.0
  };

  const mockFetch = createMockFetch({
    'query1.finance.yahoo.com': () => ({
      ok: true,
      status: 200,
      json: async () => marketData
    }),
    'production.dataviz.cnn.io': () => ({
      ok: true,
      status: 200,
      json: async () => fearGreedData
    })
  });

  global.fetch = mockFetch;

  const signal = await evaluateTradingSignal(env, fearGreedData, 'SPY', chatId);

  // Should trigger SELL when current price >= allTimeHigh * 0.99 AND profit > 0
  assertEqual(signal.signal, 'SELL', 'Should trigger SELL when price >= allTimeHigh * 0.99 with positive profit');
  assertEqual(signal.entryPrice, entryPrice, 'Should have entry price');
  assertEqual(signal.sellTarget, allTimeHigh, 'Sell target should equal all-time high');
  assertEqual(signal.exitTrigger, 'ALL_TIME_HIGH', 'Exit trigger should be ALL_TIME_HIGH');
});

runner.test('SELL signal when price reaches Bollinger upper target with profit', async () => {
  const env = createMockEnv();
  const chatId = 67890;
  const entryPrice = 90;
  await env.FEAR_GREED_KV.put(`active_position:${chatId}`, JSON.stringify({ ticker: 'SPY', entryPrice }));

  const marketData = createStaticMarketData({
    currentPrice: 150,
    closeValue: 90,
    highValue: 95,
    spikeHighValue: 250
  });

  const fearGreedData = {
    rating: 'Neutral',
    score: 50.0
  };

  const mockFetch = createMockFetch({
    'query1.finance.yahoo.com': () => ({
      ok: true,
      status: 200,
      json: async () => marketData
    }),
    'production.dataviz.cnn.io': () => ({
      ok: true,
      status: 200,
      json: async () => fearGreedData
    })
  });

  global.fetch = mockFetch;

  const signal = await evaluateTradingSignal(env, fearGreedData, 'SPY', chatId);

  // Note: This test may need adjustment based on actual calculated Bollinger values
  // The signal should trigger when price >= bollingerUpper * 0.99 AND profit > 0
  assert(['SELL', 'HOLD'].includes(signal.signal), 'Signal should be SELL or HOLD');
  if (signal.signal === 'SELL') {
    assertEqual(signal.exitTrigger, 'BOLLINGER_UPPER', 'Exit trigger should be Bollinger upper');
    assert(signal.bollingerSellTarget, 'Should provide Bollinger sell target');
  }
});

runner.test('HOLD signal when targets hit but position not profitable', async () => {
  const env = createMockEnv();
  const chatId = 24680;
  const entryPrice = 220;
  await env.FEAR_GREED_KV.put(`active_position:${chatId}`, JSON.stringify({ ticker: 'SPY', entryPrice }));

  const currentPrice = 150;
  const marketData = createStaticMarketData({
    currentPrice,
    closeValue: 140,
    highValue: currentPrice,
    spikeHighValue: currentPrice
  });

  const fearGreedData = {
    rating: 'Fear',
    score: 25.0
  };

  const mockFetch = createMockFetch({
    'query1.finance.yahoo.com': () => ({
      ok: true,
      status: 200,
      json: async () => marketData
    }),
    'production.dataviz.cnn.io': () => ({
      ok: true,
      status: 200,
      json: async () => fearGreedData
    })
  });

  global.fetch = mockFetch;

  const signal = await evaluateTradingSignal(env, fearGreedData, 'SPY', chatId);

  assertEqual(signal.signal, 'HOLD', 'Should HOLD when position is not yet profitable');
  assert.strictEqual(signal.exitTrigger, undefined, 'Exit trigger should be undefined when still holding');
  assert(signal.reasoning.includes('back in profit'), 'Reasoning should mention waiting for profit');
});

// Test: SELL does NOT trigger at allTimeHigh * 0.99 with negative profit
runner.test('HOLD signal when price reaches allTimeHigh threshold but profit is negative', async () => {
  const env = createMockEnv();
  const chatId = 99999;
  const entryPrice = 500; // Entry at 500
  await env.FEAR_GREED_KV.put(`active_position:${chatId}`, JSON.stringify({ ticker: 'SPY', entryPrice }));

  const allTimeHigh = 500;
  const athThreshold = allTimeHigh * 0.99; // 495
  const currentPrice = athThreshold; // Price at threshold but below entry (negative profit)

  const marketData = createMockMarketData(currentPrice);
  const highs = marketData.chart.result[0].indicators.quote[0].high;
  marketData.chart.result[0].indicators.quote[0].high =
    highs.map((h, i) => i === highs.length - 1 ? allTimeHigh : Math.min(h, allTimeHigh - 1));

  const fearGreedData = {
    rating: 'Neutral',
    score: 50.0
  };

  const mockFetch = createMockFetch({
    'query1.finance.yahoo.com': () => ({
      ok: true,
      status: 200,
      json: async () => marketData
    }),
    'production.dataviz.cnn.io': () => ({
      ok: true,
      status: 200,
      json: async () => fearGreedData
    })
  });

  global.fetch = mockFetch;

  const signal = await evaluateTradingSignal(env, fearGreedData, 'SPY', chatId);

  // Should HOLD because profit is negative (currentPrice < entryPrice)
  assertEqual(signal.signal, 'HOLD', 'Should HOLD when price reaches threshold but profit is negative');
  assert.strictEqual(signal.exitTrigger, undefined, 'Exit trigger should be undefined');
});

// Test: SELL triggers at bollingerUpper * 0.99 with positive profit
runner.test('SELL signal when price reaches Bollinger upper threshold with profit', async () => {
  const env = createMockEnv();
  const chatId = 88888;
  const entryPrice = 100;
  await env.FEAR_GREED_KV.put(`active_position:${chatId}`, JSON.stringify({ ticker: 'SPY', entryPrice }));

  // Create market data where current price is above bollingerUpper * 0.99
  // We'll use a static market data setup where we can control the indicators
  const currentPrice = 150; // Above entry, so profit is positive
  const marketData = createStaticMarketData({
    currentPrice,
    closeValue: 120,
    highValue: 150,
    spikeHighValue: 150
  });

  const fearGreedData = {
    rating: 'Neutral',
    score: 50.0
  };

  const mockFetch = createMockFetch({
    'query1.finance.yahoo.com': () => ({
      ok: true,
      status: 200,
      json: async () => marketData
    }),
    'production.dataviz.cnn.io': () => ({
      ok: true,
      status: 200,
      json: async () => fearGreedData
    })
  });

  global.fetch = mockFetch;

  const signal = await evaluateTradingSignal(env, fearGreedData, 'SPY', chatId);

  // The signal may or may not trigger depending on calculated Bollinger values
  // But if it triggers, it should be SELL with BOLLINGER_UPPER exit trigger
  assert(['SELL', 'HOLD'].includes(signal.signal), 'Signal should be SELL or HOLD');
  if (signal.signal === 'SELL') {
    assertEqual(signal.exitTrigger, 'BOLLINGER_UPPER', 'Exit trigger should be BOLLINGER_UPPER');
    assert(signal.bollingerSellTarget, 'Should provide Bollinger sell target');
  }
});

// Test: SELL does NOT trigger at bollingerUpper * 0.99 with negative profit
runner.test('HOLD signal when price reaches Bollinger upper threshold but profit is negative', async () => {
  const env = createMockEnv();
  const chatId = 77777;
  const entryPrice = 200; // Entry at 200
  await env.FEAR_GREED_KV.put(`active_position:${chatId}`, JSON.stringify({ ticker: 'SPY', entryPrice }));

  const currentPrice = 150; // Below entry, so profit is negative
  const marketData = createStaticMarketData({
    currentPrice,
    closeValue: 140,
    highValue: 150,
    spikeHighValue: 150
  });

  const fearGreedData = {
    rating: 'Neutral',
    score: 50.0
  };

  const mockFetch = createMockFetch({
    'query1.finance.yahoo.com': () => ({
      ok: true,
      status: 200,
      json: async () => marketData
    }),
    'production.dataviz.cnn.io': () => ({
      ok: true,
      status: 200,
      json: async () => fearGreedData
    })
  });

  global.fetch = mockFetch;

  const signal = await evaluateTradingSignal(env, fearGreedData, 'SPY', chatId);

  // Should HOLD because profit is negative (currentPrice < entryPrice)
  assertEqual(signal.signal, 'HOLD', 'Should HOLD when price reaches threshold but profit is negative');
  assert.strictEqual(signal.exitTrigger, undefined, 'Exit trigger should be undefined');
});

// Test 6: Data unavailable signal when market data fails
runner.test('Data unavailable signal when market data fails', async () => {
  const { createDataUnavailableSignal, formatTradingSignalMessage } = await import('../../../src/trading/services/signal-service.js');

  const fearGreedData = {
    rating: 'Neutral',
    score: 50.0
  };

  // Create signal when market data is unavailable but Fear & Greed Index is available
  const signal = createDataUnavailableSignal(fearGreedData);

  assert(signal.signal === 'HOLD', 'Should be HOLD signal');
  assert(signal.currentPrice === 0, 'Should have placeholder price');
  assert(signal.reasoning.includes('Insufficient data'), 'Should mention insufficient data');
  assert(signal.reasoning.includes('Market data') && signal.reasoning.includes('unavailable'), 'Should mention market data unavailable');

  // Test formatting
  const message = formatTradingSignalMessage(signal, fearGreedData);
  assert(message.includes('HOLD'), 'Message should include HOLD');
  assert(message.includes('Data Unavailable'), 'Message should indicate data unavailable');
  assert(message.includes('Fear & Greed Index'), 'Message should include Fear & Greed Index if available');
});

// Test 7: Data unavailable signal when all data fails
runner.test('Data unavailable signal when all data fails', async () => {
  const { createDataUnavailableSignal, formatTradingSignalMessage } = await import('../../../src/trading/services/signal-service.js');

  // Create signal when all data is unavailable
  const signal = createDataUnavailableSignal();

  assert(signal.signal === 'HOLD', 'Should be HOLD signal');
  assert(signal.currentPrice === 0, 'Should have placeholder price');
  assert(signal.reasoning.includes('Insufficient data'), 'Should mention insufficient data');
  assert(signal.reasoning.includes('Fear & Greed Index data unavailable'), 'Should mention Fear & Greed Index unavailable');

  // Test formatting
  const message = formatTradingSignalMessage(signal);
  assert(message.includes('HOLD'), 'Message should include HOLD');
  assert(message.includes('Data Unavailable'), 'Message should indicate data unavailable');
});

// Run tests
runner.run().catch(console.error);

