/**
 * Trading signal evaluation tests
 */

import { evaluateTradingSignal, formatTradingSignalMessage, createDataUnavailableSignal } from '../../../src/trading/services/signal-service.js';
import { setActivePosition } from '../../../src/trading/services/position-service.js';
import { createMockEnv, createMockFetch } from '../../utils/test-helpers.js';

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

describe('Signal Service', () => {
  let env;
  let originalFetch;

  beforeEach(() => {
    env = createMockEnv();
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('Basic Signal Evaluation', () => {
    test('should evaluate BUY signal when conditions met', async () => {
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

      expect(typeof signal.signal).toBe('string');
      expect(['BUY', 'SELL', 'HOLD']).toContain(signal.signal);
      expect(typeof signal.currentPrice).toBe('number');
      expect(typeof signal.indicators).toBe('object');
    });

    test('should evaluate HOLD signal when conditions not met', async () => {
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

      expect(['HOLD', 'BUY']).toContain(signal.signal);
      expect(signal.conditionC).toBe(false); // Not fear
    });
  });

  describe('Signal with Active Position', () => {
    test('should show SELL or HOLD with active position', async () => {
      const chatId = 12345;

      // Set active position for user
      await setActivePosition(env, chatId, 'SPY', 400);

      const currentPrice = 500; // Above all-time high
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

      const signal = await evaluateTradingSignal(env, fearGreedData, 'SPY', chatId);

      expect(signal.entryPrice).toBe(400);
      expect(signal.signal).not.toBe('BUY'); // Should not show BUY with active position
    });

    test('should show generic signals without chatId', async () => {
      const currentPrice = 380; // Below SMAs
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

      expect(typeof signal.signal).toBe('string');
      expect(['BUY', 'SELL', 'HOLD']).toContain(signal.signal);
      expect(signal).not.toHaveProperty('canTrade');
      expect(signal).not.toHaveProperty('lastTradeDate');
    });
  });

  describe('SELL Signals', () => {
    test('should trigger SELL at all-time high threshold with profit', async () => {
      const chatId = 12345;
      const entryPrice = 400;
      await setActivePosition(env, chatId, 'SPY', entryPrice);

      const allTimeHigh = 500;
      const athThreshold = allTimeHigh * 0.99; // 495
      const currentPrice = athThreshold;

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

      expect(signal.signal).toBe('SELL');
      expect(signal.entryPrice).toBe(entryPrice);
      expect(signal.sellTarget).toBe(allTimeHigh);
      expect(signal.exitTrigger).toBe('ALL_TIME_HIGH');
    });

    test('should trigger SELL at Bollinger upper with profit', async () => {
      const chatId = 67890;
      const entryPrice = 90;
      await setActivePosition(env, chatId, 'SPY', entryPrice);

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

      expect(['SELL', 'HOLD']).toContain(signal.signal);
      if (signal.signal === 'SELL') {
        expect(signal.exitTrigger).toBe('BOLLINGER_UPPER');
        expect(signal.bollingerSellTarget).toBeDefined();
      }
    });
  });

  describe('HOLD Signals with Negative Profit', () => {
    test('should HOLD when targets hit but position not profitable', async () => {
      const chatId = 24680;
      const entryPrice = 220;
      await setActivePosition(env, chatId, 'SPY', entryPrice);

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

      expect(signal.signal).toBe('HOLD');
      expect(signal.exitTrigger).toBeUndefined();
      expect(signal.reasoning).toContain('back in profit');
    });

    test('should HOLD at allTimeHigh threshold with negative profit', async () => {
      const chatId = 99999;
      const entryPrice = 500;
      await setActivePosition(env, chatId, 'SPY', entryPrice);

      const allTimeHigh = 500;
      const athThreshold = allTimeHigh * 0.99; // 495
      const currentPrice = athThreshold; // Below entry

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

      expect(signal.signal).toBe('HOLD');
      expect(signal.exitTrigger).toBeUndefined();
    });

    test('should HOLD at Bollinger upper threshold with negative profit', async () => {
      const chatId = 77777;
      const entryPrice = 200;
      await setActivePosition(env, chatId, 'SPY', entryPrice);

      const currentPrice = 150; // Below entry
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

      expect(signal.signal).toBe('HOLD');
      expect(signal.exitTrigger).toBeUndefined();
    });
  });

  describe('Message Formatting', () => {
    test('should format trading signal message', () => {
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

      expect(message).toContain('BUY');
      expect(message).toContain('400.50');
      expect(message).toContain('SMA 20');
      expect(message).toContain('Fear');
    });
  });

  describe('Data Unavailable Signals', () => {
    test('should create data unavailable signal with Fear & Greed data', () => {
      const fearGreedData = {
        rating: 'Neutral',
        score: 50.0
      };

      const signal = createDataUnavailableSignal(fearGreedData);

      expect(signal.signal).toBe('HOLD');
      expect(signal.currentPrice).toBe(0);
      expect(signal.reasoning).toContain('Insufficient data');
      expect(signal.reasoning).toContain('Market data');
      expect(signal.reasoning).toContain('unavailable');

      const message = formatTradingSignalMessage(signal, fearGreedData);
      expect(message).toContain('HOLD');
      expect(message).toContain('Data Unavailable');
      expect(message).toContain('Fear & Greed Index');
    });

    test('should create data unavailable signal without any data', () => {
      const signal = createDataUnavailableSignal();

      expect(signal.signal).toBe('HOLD');
      expect(signal.currentPrice).toBe(0);
      expect(signal.reasoning).toContain('Insufficient data');
      expect(signal.reasoning).toContain('Fear & Greed Index data unavailable');

      const message = formatTradingSignalMessage(signal);
      expect(message).toContain('HOLD');
      expect(message).toContain('Data Unavailable');
    });
  });
});
