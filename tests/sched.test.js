/**
 * Scheduled event tests (Fear & Greed Index fetching)
 */

import { handleScheduled } from '../src/sched.js';
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

// Test 1: Fetch Fear and Greed Index successfully
runner.test('Fetch Fear and Greed Index successfully', async () => {
  const env = createMockEnv();
  const chatId = 123456789;
  
  let telegramCallCount = 0;
  const mockFetch = createMockFetch({
    'production.dataviz.cnn.io': () => ({
      ok: true,
      status: 200,
      json: async () => ({
        rating: 'Neutral',
        score: 50.5,
        timestamp: new Date().toISOString()
      })
    }),
    'query1.finance.yahoo.com': () => ({
      ok: true,
      status: 200,
      json: async () => createMockMarketData(400)
    }),
    'quickchart.io': () => ({
      ok: true,
      status: 200,
      url: 'https://quickchart.io/chart?c=...'
    }),
    'api.telegram.org': () => {
      telegramCallCount++;
      return {
        ok: true,
        status: 200,
        json: async () => ({ ok: true, result: { message_id: 123 } })
      };
    }
  });
  
  global.fetch = mockFetch;
  
  await handleScheduled(chatId, env);
  
  // Should send message to specific chat since rating is not fear/extreme fear
  assertEqual(telegramCallCount, 1, 'Should send one Telegram message');
});

// Test 2: Send to all subscribers on fear rating
runner.test('Send to all subscribers on fear rating', async () => {
  const env = createMockEnv();
  
  // Add subscribers
  await env.FEAR_GREED_KV.put('chat_ids', JSON.stringify([111111111, 222222222, 333333333]));
  
  let telegramCallCount = 0;
  const mockFetch = createMockFetch({
    'production.dataviz.cnn.io': () => ({
      ok: true,
      status: 200,
      json: async () => ({
        rating: 'Fear',
        score: 25.0,
        timestamp: new Date().toISOString()
      })
    }),
    'query1.finance.yahoo.com': () => ({
      ok: true,
      status: 200,
      json: async () => createMockMarketData(400)
    }),
    'quickchart.io': () => ({
      ok: true,
      status: 200,
      url: 'https://quickchart.io/chart?c=...'
    }),
    'api.telegram.org': () => {
      telegramCallCount++;
      return {
        ok: true,
        status: 200,
        json: async () => ({ ok: true, result: { message_id: 123 } })
      };
    }
  });
  
  global.fetch = mockFetch;
  
  await handleScheduled(null, env);
  
  // Should send to all 3 subscribers
  assertEqual(telegramCallCount, 3, 'Should send to all subscribers');
});

// Test 3: Send to all subscribers on extreme fear rating
runner.test('Send to all subscribers on extreme fear rating', async () => {
  const env = createMockEnv();
  
  await env.FEAR_GREED_KV.put('chat_ids', JSON.stringify([111111111, 222222222]));
  
  let telegramCallCount = 0;
  const mockFetch = createMockFetch({
    'production.dataviz.cnn.io': () => ({
      ok: true,
      status: 200,
      json: async () => ({
        rating: 'Extreme Fear',
        score: 10.0,
        timestamp: new Date().toISOString()
      })
    }),
    'query1.finance.yahoo.com': () => ({
      ok: true,
      status: 200,
      json: async () => createMockMarketData(400)
    }),
    'quickchart.io': () => ({
      ok: true,
      status: 200,
      url: 'https://quickchart.io/chart?c=...'
    }),
    'api.telegram.org': () => {
      telegramCallCount++;
      return {
        ok: true,
        status: 200,
        json: async () => ({ ok: true, result: { message_id: 123 } })
      };
    }
  });
  
  global.fetch = mockFetch;
  
  await handleScheduled(null, env);
  
  assertEqual(telegramCallCount, 2, 'Should send to all subscribers');
});

// Test 4: Handle API errors gracefully
runner.test('Handle API errors gracefully', async () => {
  const env = createMockEnv();
  const chatId = 123456789;
  
  let adminCallCount = 0;
  let userCallCount = 0;
  let capturedUserMessage = null;
  const mockFetch = createMockFetch({
    'production.dataviz.cnn.io': () => {
      throw new Error('CNN API error');
    },
    'query1.finance.yahoo.com': () => ({
      ok: true,
      status: 200,
      json: async () => createMockMarketData(400)
    }),
    'api.telegram.org': (options) => {
      const body = JSON.parse(options.body);
      if (body.chat_id === env.ADMIN_CHAT_ID) {
        adminCallCount++;
      } else if (body.chat_id === chatId) {
        userCallCount++;
        capturedUserMessage = body.text;
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ ok: true, result: { message_id: 123 } })
      };
    }
  });
  
  global.fetch = mockFetch;
  
  await handleScheduled(chatId, env);
  
  // Should notify admin about the error
  assertEqual(adminCallCount, 1, 'Should notify admin about error');
  // Should still send HOLD signal to user even when Fear & Greed Index fails
  assertEqual(userCallCount, 1, 'Should send signal to user even on error');
  assert(capturedUserMessage.includes('HOLD'), 'Should send HOLD signal');
  assert(capturedUserMessage.includes('Data Unavailable'), 'Should indicate data unavailable');
});

// Test 5: Don't send when rating is not fear/extreme fear and no specific chat
runner.test('Don\'t send when rating is neutral and no specific chat', async () => {
  const env = createMockEnv();
  
  let telegramCallCount = 0;
  const mockFetch = createMockFetch({
    'production.dataviz.cnn.io': () => ({
      ok: true,
      status: 200,
      json: async () => ({
        rating: 'Greed',
        score: 75.0,
        timestamp: new Date().toISOString()
      })
    }),
    'query1.finance.yahoo.com': () => ({
      ok: true,
      status: 200,
      json: async () => createMockMarketData(400)
    }),
    'quickchart.io': () => ({
      ok: true,
      status: 200,
      url: 'https://quickchart.io/chart?c=...'
    }),
    'api.telegram.org': () => {
      telegramCallCount++;
      return {
        ok: true,
        status: 200,
        json: async () => ({ ok: true, result: { message_id: 123 } })
      };
    }
  });
  
  global.fetch = mockFetch;
  
  await handleScheduled(null, env);
  
  // Should not send when rating is not fear/extreme fear and no specific chat
  assertEqual(telegramCallCount, 0, 'Should not send messages when rating is not fear and no specific chat');
});

// Test 6: Verify message format includes chart URL
runner.test('Verify message format includes chart URL', async () => {
  const env = createMockEnv();
  const chatId = 123456789;
  
  // Initialize watchlist for test user (defaults to SPY)
  const { getWatchlist } = await import('../src/utils/watchlist.js');
  await getWatchlist(env.FEAR_GREED_KV, chatId);
  
  const capturedMessages = [];
  const mockFetch = createMockFetch({
    'production.dataviz.cnn.io': () => ({
      ok: true,
      status: 200,
      json: async () => ({
        rating: 'Fear',
        score: 25.0,
        timestamp: new Date().toISOString()
      })
    }),
    'query1.finance.yahoo.com': () => ({
      ok: true,
      status: 200,
      json: async () => createMockMarketData(400)
    }),
    'quickchart.io': () => ({
      ok: true,
      status: 200,
      url: 'https://quickchart.io/chart?c=test123'
    }),
    'api.telegram.org': (options) => {
      const body = JSON.parse(options.body);
      capturedMessages.push(body.text);
      return {
        ok: true,
        status: 200,
        json: async () => ({ ok: true, result: { message_id: 123 } })
      };
    }
  });
  
  global.fetch = mockFetch;
  
  await handleScheduled(chatId, env);
  
  // With watchlist, multiple messages may be sent (one per ticker)
  // Verify at least one message contains the chart URL
  assert(capturedMessages.length > 0, 'At least one message should be sent');
  
  const messageWithChart = capturedMessages.find(msg => {
    const urlMatch = msg.match(/\[.*?\]\((https?:\/\/[^\)]+)\)/);
    return urlMatch && new URL(urlMatch[1]).hostname === 'quickchart.io';
  });
  
  assert(messageWithChart, 'At least one message should contain a chart URL from quickchart.io');
  
  // Verify message content
  assert(messageWithChart.includes('25.00%'), 'Message should include score');
  assert(messageWithChart.includes('FEAR'), 'Message should include rating');
  // Verify that trading signal is always included
  assert(messageWithChart.includes('Trading Signal'), 'Message should always include trading signal');
});

// Test 7: Verify signal is always sent when market data fails
runner.test('Verify signal is always sent when market data fails', async () => {
  const env = createMockEnv();
  const chatId = 123456789;
  
  let capturedMessage = null;
  const mockFetch = createMockFetch({
    'production.dataviz.cnn.io': () => ({
      ok: true,
      status: 200,
      json: async () => ({
        rating: 'Neutral',
        score: 50.0,
        timestamp: new Date().toISOString()
      })
    }),
    'query1.finance.yahoo.com': () => {
      throw new Error('Yahoo Finance API error');
    },
    'quickchart.io': () => ({
      ok: true,
      status: 200,
      url: 'https://quickchart.io/chart?c=test123'
    }),
    'api.telegram.org': (options) => {
      const body = JSON.parse(options.body);
      if (body.chat_id === chatId) {
        capturedMessage = body.text;
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ ok: true, result: { message_id: 123 } })
      };
    }
  });
  
  global.fetch = mockFetch;
  
  await handleScheduled(chatId, env);
  
  // Should send message with trading signal even when market data fails
  assert(capturedMessage !== null, 'Should send message to user');
  assert(capturedMessage.includes('Trading Signal'), 'Message should include trading signal');
  assert(capturedMessage.includes('HOLD'), 'Should send HOLD signal when data unavailable');
  assert(capturedMessage.includes('Data Unavailable') || capturedMessage.includes('Insufficient data'), 'Should indicate data unavailable');
});

// Test 8: Verify signal is always sent for /now command even when conditions not met
runner.test('Verify signal is always sent for /now command', async () => {
  const env = createMockEnv();
  const chatId = 123456789;
  
  let capturedMessage = null;
  const mockFetch = createMockFetch({
    'production.dataviz.cnn.io': () => ({
      ok: true,
      status: 200,
      json: async () => ({
        rating: 'Greed',
        score: 75.0,
        timestamp: new Date().toISOString()
      })
    }),
    'query1.finance.yahoo.com': () => ({
      ok: true,
      status: 200,
      json: async () => createMockMarketData(400)
    }),
    'quickchart.io': () => ({
      ok: true,
      status: 200,
      url: 'https://quickchart.io/chart?c=test123'
    }),
    'api.telegram.org': (options) => {
      const body = JSON.parse(options.body);
      if (body.chat_id === chatId) {
        capturedMessage = body.text;
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ ok: true, result: { message_id: 123 } })
      };
    }
  });
  
  global.fetch = mockFetch;
  
  await handleScheduled(chatId, env);
  
  // Should send trading signal even when rating is not fear/extreme fear
  assert(capturedMessage !== null, 'Should send message to user');
  assert(capturedMessage.includes('Trading Signal'), 'Message should always include trading signal');
  assert(capturedMessage.includes('HOLD') || capturedMessage.includes('BUY') || capturedMessage.includes('SELL'), 'Should include a valid signal type');
});

// Run tests
runner.run().catch(console.error);
