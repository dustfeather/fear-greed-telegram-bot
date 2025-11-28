/**
 * Scheduled event tests (Fear & Greed Index fetching)
 */

import { handleScheduled } from '../../../src/scheduler/handlers/scheduled-handler.js';
import { sub } from '../../../src/user-management/services/subscription-service.js';
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

describe('Scheduled Handler', () => {
  let originalFetch;
  let originalDate;

  beforeEach(() => {
    originalFetch = global.fetch;
    originalDate = global.Date;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    global.Date = originalDate;
  });

// Test 1: Fetch Fear and Greed Index successfully
test('Fetch Fear and Greed Index successfully', async () => {
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
  expect(telegramCallCount).toBe(1); // Should send one Telegram message
});

// Test 2: Send to all subscribers on fear rating
test('Send to all subscribers on fear rating', async () => {
  const env = createMockEnv();

  // Mock date to be a trading day (Tuesday, March 5, 2024)
  const originalDate = Date;
  global.Date = class extends originalDate {
    constructor(...args) {
      if (args.length === 0) {
        return new originalDate(originalDate.UTC(2024, 2, 5));
      }
      return new originalDate(...args);
    }
    static now() {
      return new originalDate(originalDate.UTC(2024, 2, 5)).getTime();
    }
  };

  // Add subscribers
  await sub(111111111, env);
  await sub(222222222, env);
  await sub(333333333, env);

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

  try {
    await handleScheduled(null, env);

    // Should send to all 3 subscribers
    expect(telegramCallCount).toBe(3); // Should send to all subscribers
  } finally {
    global.Date = originalDate;
  }
});

// Test 3: Send to all subscribers on extreme fear rating
test('Send to all subscribers on extreme fear rating', async () => {
  const env = createMockEnv();

  // Mock date to be a trading day (Wednesday, March 6, 2024)
  const originalDate = Date;
  global.Date = class extends originalDate {
    constructor(...args) {
      if (args.length === 0) {
        return new originalDate(originalDate.UTC(2024, 2, 6));
      }
      return new originalDate(...args);
    }
    static now() {
      return new originalDate(originalDate.UTC(2024, 2, 6)).getTime();
    }
  };

  await sub(111111111, env);
  await sub(222222222, env);

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

  try {
    await handleScheduled(null, env);

    expect(telegramCallCount).toBe(2); // Should send to all subscribers
  } finally {
    global.Date = originalDate;
  }
});

// Test 4: Handle API errors gracefully
test('Handle API errors gracefully', async () => {
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
  expect(adminCallCount).toBe(1); // Should notify admin about error
  // Should still send HOLD signal to user even when Fear & Greed Index fails
  expect(userCallCount).toBe(1); // Should send signal to user even on error
  expect(capturedUserMessage.includes('HOLD')).toBeTruthy(); // Should send HOLD signal
  expect(capturedUserMessage.includes('Data Unavailable')).toBeTruthy(); // Should indicate data unavailable
});

// Test 5: Don't send when rating is not fear/extreme fear and no specific chat
test('Don\'t send when rating is neutral and no specific chat', async () => {
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
  expect(telegramCallCount).toBe(0); // Should not send messages when rating is not fear and no specific chat
});

// Test 6: Verify message format includes chart URL
test('Verify message format includes chart URL', async () => {
  const env = createMockEnv();
  const chatId = 123456789;

  // Initialize watchlist for test user (defaults to SPY)
  const { getWatchlist } = await import('../../../src/user-management/services/watchlist-service.js');
  await getWatchlist(env, chatId);

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
  expect(capturedMessages.length > 0).toBeTruthy(); // At least one message should be sent

  const messageWithChart = capturedMessages.find(msg => {
    const urlMatch = msg.match(/\[.*?\]\((https?:\/\/[^\)]+)\)/);
    return urlMatch && new URL(urlMatch[1]).hostname === 'quickchart.io';
  });

  expect(messageWithChart).toBeTruthy(); // At least one message should contain a chart URL from quickchart.io

  // Verify message content
  expect(messageWithChart.includes('25.00%')).toBeTruthy(); // Message should include score
  expect(messageWithChart.includes('FEAR')).toBeTruthy(); // Message should include rating
  // Verify that trading signal is always included
  expect(messageWithChart.includes('Trading Signal')).toBeTruthy(); // Message should always include trading signal
});

// Test 7: Verify signal is always sent when market data fails
test('Verify signal is always sent when market data fails', async () => {
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
  expect(capturedMessage !== null).toBeTruthy(); // Should send message to user
  expect(capturedMessage.includes('Trading Signal')).toBeTruthy(); // Message should include trading signal
  expect(capturedMessage.includes('HOLD')).toBeTruthy(); // Should send HOLD signal when data unavailable
  expect(capturedMessage.includes('Data Unavailable') || capturedMessage.includes('Insufficient data')).toBeTruthy(); // Should indicate data unavailable
});

// Test 8: Verify signal is always sent for /now command even when conditions not met
test('Verify signal is always sent for /now command', async () => {
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
  expect(capturedMessage !== null).toBeTruthy(); // Should send message to user
  expect(capturedMessage.includes('Trading Signal')).toBeTruthy(); // Message should always include trading signal
  expect(capturedMessage.includes('HOLD') || capturedMessage.includes('BUY') || capturedMessage.includes('SELL')).toBeTruthy(); // Should include a valid signal type
});


});
