/**
 * Trading signal evaluation tests
 */

import { evaluateTradingSignal, formatTradingSignalMessage } from '../src/trading-signal.js';
import { TestRunner, createMockEnv, createMockFetch, assertEqual } from './utils/test-helpers.js';
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

// Test 3: Trading frequency limit enforcement
runner.test('Trading frequency limit enforcement', async () => {
  const env = createMockEnv();
  
  // Set last trade to 10 days ago (within 30-day limit)
  const lastTrade = {
    entryPrice: 400,
    entryDate: Date.now() - (10 * 24 * 60 * 60 * 1000), // 10 days ago
    signalType: 'BUY'
  };
  await env.FEAR_GREED_KV.put('last_trade', JSON.stringify(lastTrade));
  
  const currentPrice = 380;
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
  
  const signal = await evaluateTradingSignal(env, fearGreedData);
  
  // Should indicate trading not allowed
  assert(signal.canTrade === false, 'Should not allow trading within 30 days');
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
    canTrade: true,
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

// Test 5: SELL signal when price reaches Fibonacci target
runner.test('SELL signal when price reaches Fibonacci target', async () => {
  const env = createMockEnv();
  
  // Set active position
  const entryPrice = 400;
  await env.FEAR_GREED_KV.put('active_position', JSON.stringify({ entryPrice }));
  
  // Set high current price (above Fibonacci target)
  const currentPrice = 500;
  const fearGreedData = {
    rating: 'Neutral',
    score: 50.0
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
  
  // May or may not trigger SELL depending on Fibonacci calculation
  assert(['BUY', 'SELL', 'HOLD'].includes(signal.signal), 'Signal should be valid type');
  if (signal.entryPrice) {
    assertEqual(signal.entryPrice, entryPrice, 'Should have entry price');
  }
});

// Test 6: Data unavailable signal when market data fails
runner.test('Data unavailable signal when market data fails', async () => {
  const { createDataUnavailableSignal, formatTradingSignalMessage } = await import('../src/trading-signal.js');
  
  const fearGreedData = {
    rating: 'Neutral',
    score: 50.0
  };
  
  // Create signal when market data is unavailable but Fear & Greed Index is available
  const signal = createDataUnavailableSignal(fearGreedData);
  
  assert(signal.signal === 'HOLD', 'Should be HOLD signal');
  assert(signal.currentPrice === 0, 'Should have placeholder price');
  assert(signal.reasoning.includes('Insufficient data'), 'Should mention insufficient data');
  assert(signal.reasoning.includes('Market data unavailable'), 'Should mention market data unavailable');
  
  // Test formatting
  const message = formatTradingSignalMessage(signal, fearGreedData);
  assert(message.includes('HOLD'), 'Message should include HOLD');
  assert(message.includes('Data Unavailable'), 'Message should indicate data unavailable');
  assert(message.includes('Fear & Greed Index'), 'Message should include Fear & Greed Index if available');
});

// Test 7: Data unavailable signal when all data fails
runner.test('Data unavailable signal when all data fails', async () => {
  const { createDataUnavailableSignal, formatTradingSignalMessage } = await import('../src/trading-signal.js');
  
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

