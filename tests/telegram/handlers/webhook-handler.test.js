/**
 * Main handler tests (command processing)
 */

import index from '../../../src/index.js';
import { sub } from '../../../src/user-management/services/subscription-service.js';
import { recordExecution } from '../../../src/trading/services/execution-service.js';
import { TestRunner, createMockEnv, createMockFetch, createTelegramUpdate, assertEqual } from '../../utils/test-helpers.js';
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

// Test 1: /start command
runner.test('/start command', async () => {
  const env = createMockEnv();
  const chatId = 123456789;
  const update = createTelegramUpdate('/start', chatId);

  let telegramCallCount = 0;
  const mockFetch = createMockFetch({
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

  const request = new Request('http://localhost:8787', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Telegram-Bot-Api-Secret-Token': env.TELEGRAM_WEBHOOK_SECRET
    },
    body: JSON.stringify(update)
  });

  const response = await index.fetch(request, env, { waitUntil: () => {} });
  const result = await response.json();

  assertEqual(response.status, 200, 'Response should be 200');
  assertEqual(result.ok, true, 'Should return ok: true');
  assertEqual(telegramCallCount, 1, 'Should send subscription confirmation message');

  // Verify user is subscribed (check D1)
  const chatIds = await env.FEAR_GREED_D1.prepare('SELECT chat_id FROM users WHERE subscription_status = 1').all();
  assert(chatIds.results.some(row => row.chat_id === String(chatId)), 'User should be subscribed');
});

// Test 2: /stop command
runner.test('/stop command', async () => {
  const env = createMockEnv();
  const chatId = 123456789;

  // Subscribe first
  await sub(chatId, env);

  const update = createTelegramUpdate('/stop', chatId);

  let telegramCallCount = 0;
  const mockFetch = createMockFetch({
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

  const request = new Request('http://localhost:8787', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Telegram-Bot-Api-Secret-Token': env.TELEGRAM_WEBHOOK_SECRET
    },
    body: JSON.stringify(update)
  });

  const response = await index.fetch(request, env, { waitUntil: () => {} });
  const result = await response.json();

  assertEqual(response.status, 200, 'Response should be 200');
  assertEqual(result.ok, true, 'Should return ok: true');
  assertEqual(telegramCallCount, 1, 'Should send unsubscription confirmation message');

  // Verify user is unsubscribed (check D1)
  const chatIds = await env.FEAR_GREED_D1.prepare('SELECT chat_id FROM users WHERE subscription_status = 1').all();
  assert(!chatIds.results.some(row => row.chat_id === String(chatId)), 'User should be unsubscribed');
});

// Test 3: /help command
runner.test('/help command', async () => {
  const env = createMockEnv();
  const chatId = 123456789;
  const update = createTelegramUpdate('/help', chatId);

  let telegramCallCount = 0;
  let helpMessage = null;
  const mockFetch = createMockFetch({
    'api.telegram.org': (options) => {
      telegramCallCount++;
      const body = JSON.parse(options.body);
      helpMessage = body.text;
      return {
        ok: true,
        status: 200,
        json: async () => ({ ok: true, result: { message_id: 123 } })
      };
    }
  });

  global.fetch = mockFetch;

  const request = new Request('http://localhost:8787', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Telegram-Bot-Api-Secret-Token': env.TELEGRAM_WEBHOOK_SECRET
    },
    body: JSON.stringify(update)
  });

  const response = await index.fetch(request, env, { waitUntil: () => {} });
  const result = await response.json();

  assertEqual(response.status, 200, 'Response should be 200');
  assertEqual(result.ok, true, 'Should return ok: true');
  assertEqual(telegramCallCount, 1, 'Should send help message');
  assert(helpMessage.includes('/start'), 'Help message should include /start');
  assert(helpMessage.includes('/stop'), 'Help message should include /stop');
  assert(helpMessage.includes('/now'), 'Help message should include /now');
  assert(helpMessage.includes('/help'), 'Help message should include /help');
});

// Test 4: /now command
runner.test('/now command', async () => {
  const env = createMockEnv();
  const chatId = 123456789;
  const update = createTelegramUpdate('/now', chatId);

  let telegramCallCount = 0;
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

  const request = new Request('http://localhost:8787', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Telegram-Bot-Api-Secret-Token': env.TELEGRAM_WEBHOOK_SECRET
    },
    body: JSON.stringify(update)
  });

  const response = await index.fetch(request, env, { waitUntil: () => {} });
  const result = await response.json();

  assertEqual(response.status, 200, 'Response should be 200');
  assertEqual(result.ok, true, 'Should return ok: true');
  assert(telegramCallCount >= 1, 'Should send Fear & Greed Index message');
});

// Test 4b: /now command with ticker parameter
runner.test('/now command with ticker parameter', async () => {
  const env = createMockEnv();
  const chatId = 123456789;
  const update = createTelegramUpdate('/now AAPL', chatId);

  let telegramCallCount = 0;
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

  const request = new Request('http://localhost:8787', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Telegram-Bot-Api-Secret-Token': env.TELEGRAM_WEBHOOK_SECRET
    },
    body: JSON.stringify(update)
  });

  const response = await index.fetch(request, env, { waitUntil: () => {} });
  const result = await response.json();

  assertEqual(response.status, 200, 'Response should be 200');
  assertEqual(result.ok, true, 'Should return ok: true');
  assert(telegramCallCount >= 1, 'Should send Fear & Greed Index message');
});

// Test 4c: /now command with invalid ticker
runner.test('/now command with invalid ticker', async () => {
  const env = createMockEnv();
  const chatId = 123456789;
  const update = createTelegramUpdate('/now INVALID-TICKER!', chatId);

  let telegramCallCount = 0;
  const mockFetch = createMockFetch({
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

  const request = new Request('http://localhost:8787', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Telegram-Bot-Api-Secret-Token': env.TELEGRAM_WEBHOOK_SECRET
    },
    body: JSON.stringify(update)
  });

  const response = await index.fetch(request, env, { waitUntil: () => {} });
  const result = await response.json();

  assertEqual(response.status, 200, 'Response should be 200');
  assertEqual(result.ok, true, 'Should return ok: true');
  assert(telegramCallCount === 1, 'Should send error message for invalid ticker');
});

// Test 4d: /execute command
runner.test('/execute command', async () => {
  const env = createMockEnv();
  const chatId = 123456789;
  const update = createTelegramUpdate('/execute SPY 400.50', chatId);

  let telegramCallCount = 0;
  const mockFetch = createMockFetch({
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

  const request = new Request('http://localhost:8787', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Telegram-Bot-Api-Secret-Token': env.TELEGRAM_WEBHOOK_SECRET
    },
    body: JSON.stringify(update)
  });

  const response = await index.fetch(request, env, { waitUntil: () => {} });
  const result = await response.json();

  assertEqual(response.status, 200, 'Response should be 200');
  assertEqual(result.ok, true, 'Should return ok: true');
  assert(telegramCallCount === 1, 'Should send execution confirmation message');

  // Verify execution was recorded in D1
  const executions = await env.FEAR_GREED_D1.prepare('SELECT * FROM executions WHERE chat_id = ?').bind(String(chatId)).all();
  assert(executions.results.length === 1, 'Should have one execution');
  assert(executions.results[0].ticker === 'SPY', 'Should have correct ticker');
  assert(executions.results[0].execution_price === 400.50, 'Should have correct price');
  assert(executions.results[0].signal_type === 'BUY', 'Should be BUY (no active position)');
});

// Test 4e: /execute command with invalid format
runner.test('/execute command with invalid format', async () => {
  const env = createMockEnv();
  const chatId = 123456789;
  const update = createTelegramUpdate('/execute SPY', chatId);

  let telegramCallCount = 0;
  const mockFetch = createMockFetch({
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

  const request = new Request('http://localhost:8787', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Telegram-Bot-Api-Secret-Token': env.TELEGRAM_WEBHOOK_SECRET
    },
    body: JSON.stringify(update)
  });

  const response = await index.fetch(request, env, { waitUntil: () => {} });
  const result = await response.json();

  assertEqual(response.status, 200, 'Response should be 200');
  assertEqual(result.ok, true, 'Should return ok: true');
  assert(telegramCallCount === 1, 'Should send error message for invalid format');
});

// Test 4f: /execute command with valid date parameter
runner.test('/execute command with valid date parameter', async () => {
  const env = createMockEnv();
  const chatId = 123456789;
  const update = createTelegramUpdate('/execute SPY 400.50 2024-01-15', chatId);

  let telegramCallCount = 0;
  const mockFetch = createMockFetch({
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

  const request = new Request('http://localhost:8787', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Telegram-Bot-Api-Secret-Token': env.TELEGRAM_WEBHOOK_SECRET
    },
    body: JSON.stringify(update)
  });

  const response = await index.fetch(request, env, { waitUntil: () => {} });
  const result = await response.json();

  assertEqual(response.status, 200, 'Response should be 200');
  assertEqual(result.ok, true, 'Should return ok: true');
  assert(telegramCallCount === 1, 'Should send execution confirmation message');

  // Verify execution was recorded with correct date in D1
  const executions = await env.FEAR_GREED_D1.prepare('SELECT * FROM executions WHERE chat_id = ?').bind(String(chatId)).all();
  assert(executions.results.length === 1, 'Should have one execution');
  assert(executions.results[0].ticker === 'SPY', 'Should have correct ticker');
  assert(executions.results[0].execution_price === 400.50, 'Should have correct price');

  // Verify the date is correct (2024-01-15, start of day UTC)
  const executionDate = new Date(executions.results[0].execution_date);
  assert(executionDate.getUTCFullYear() === 2024, 'Should have correct year');
  assert(executionDate.getUTCMonth() === 0, 'Should have correct month (January = 0)');
  assert(executionDate.getUTCDate() === 15, 'Should have correct day');
  assert(executionDate.getUTCHours() === 0, 'Should be start of day (0 hours)');
  assert(executionDate.getUTCMinutes() === 0, 'Should be start of day (0 minutes)');
});

// Test 4g: /execute command with invalid date format
runner.test('/execute command with invalid date format', async () => {
  const env = createMockEnv();
  const chatId = 123456789;
  const update = createTelegramUpdate('/execute SPY 400.50 2024/01/15', chatId);

  let telegramCallCount = 0;
  const mockFetch = createMockFetch({
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

  const request = new Request('http://localhost:8787', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Telegram-Bot-Api-Secret-Token': env.TELEGRAM_WEBHOOK_SECRET
    },
    body: JSON.stringify(update)
  });

  const response = await index.fetch(request, env, { waitUntil: () => {} });
  const result = await response.json();

  assertEqual(response.status, 200, 'Response should be 200');
  assertEqual(result.ok, true, 'Should return ok: true');
  assert(telegramCallCount === 1, 'Should send error message for invalid date format');

  // Verify execution was NOT recorded in D1
  const executions1 = await env.FEAR_GREED_D1.prepare('SELECT * FROM executions WHERE chat_id = ?').bind(String(chatId)).all();
  assert(executions1.results.length === 0, 'Should not have execution history');
});

// Test 4h: /execute command with invalid date (e.g., Feb 30)
runner.test('/execute command with invalid date', async () => {
  const env = createMockEnv();
  const chatId = 123456789;
  const update = createTelegramUpdate('/execute SPY 400.50 2024-02-30', chatId);

  let telegramCallCount = 0;
  const mockFetch = createMockFetch({
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

  const request = new Request('http://localhost:8787', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Telegram-Bot-Api-Secret-Token': env.TELEGRAM_WEBHOOK_SECRET
    },
    body: JSON.stringify(update)
  });

  const response = await index.fetch(request, env, { waitUntil: () => {} });
  const result = await response.json();

  assertEqual(response.status, 200, 'Response should be 200');
  assertEqual(result.ok, true, 'Should return ok: true');
  assert(telegramCallCount === 1, 'Should send error message for invalid date');

  // Verify execution was NOT recorded in D1
  const executions2 = await env.FEAR_GREED_D1.prepare('SELECT * FROM executions WHERE chat_id = ?').bind(String(chatId)).all();
  assert(executions2.results.length === 0, 'Should not have execution history');
});

// Test 4i: /executions command
runner.test('/executions command', async () => {
  const env = createMockEnv();
  const chatId = 123456789;

  // Record some executions first using the service
  await recordExecution(env, chatId, 'BUY', 'SPY', 400.50, undefined, Date.now());

  const update = createTelegramUpdate('/executions', chatId);

  let telegramCallCount = 0;
  const mockFetch = createMockFetch({
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

  const request = new Request('http://localhost:8787', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Telegram-Bot-Api-Secret-Token': env.TELEGRAM_WEBHOOK_SECRET
    },
    body: JSON.stringify(update)
  });

  const response = await index.fetch(request, env, { waitUntil: () => {} });
  const result = await response.json();

  assertEqual(response.status, 200, 'Response should be 200');
  assertEqual(result.ok, true, 'Should return ok: true');
  assert(telegramCallCount === 1, 'Should send execution history message');
});

// Test 5: Unknown command
runner.test('Unknown command', async () => {
  const env = createMockEnv();
  const chatId = 123456789;
  const update = createTelegramUpdate('/unknown', chatId);

  const request = new Request('http://localhost:8787', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Telegram-Bot-Api-Secret-Token': env.TELEGRAM_WEBHOOK_SECRET
    },
    body: JSON.stringify(update)
  });

  const response = await index.fetch(request, env, { waitUntil: () => {} });
  const result = await response.json();

  assertEqual(response.status, 200, 'Response should still be 200');
  assertEqual(result.ok, true, 'Should return ok: true for unknown commands');
});

// Test 6: Invalid payload (no message)
runner.test('Invalid payload (no message)', async () => {
  const env = createMockEnv();
  const update = { invalid: 'payload' };

  const request = new Request('http://localhost:8787', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Telegram-Bot-Api-Secret-Token': env.TELEGRAM_WEBHOOK_SECRET
    },
    body: JSON.stringify(update)
  });

  const response = await index.fetch(request, env, { waitUntil: () => {} });
  const result = await response.json();

  assertEqual(response.status, 200, 'Response should be 200');
  assertEqual(result.ok, true, 'Should return ok: true for updates without text');
});

// Test 6b: Invalid payload structure (missing chat)
runner.test('Invalid payload structure (missing chat)', async () => {
  const env = createMockEnv();
  const update = {
    message: {
      message_id: 1,
      text: '/start'
      // Missing chat field
    }
  };

  const request = new Request('http://localhost:8787', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Telegram-Bot-Api-Secret-Token': env.TELEGRAM_WEBHOOK_SECRET
    },
    body: JSON.stringify(update)
  });

  const response = await index.fetch(request, env, { waitUntil: () => {} });
  const result = await response.json();

  // Return 200 to acknowledge webhook request (Telegram best practice)
  assertEqual(response.status, 200, 'Response should be 200');
  assertEqual(result.ok, true, 'Should return ok: true to acknowledge webhook');
});

// Test 6c: Invalid JSON payload
runner.test('Invalid JSON payload', async () => {
  const env = createMockEnv();

  const request = new Request('http://localhost:8787', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Telegram-Bot-Api-Secret-Token': env.TELEGRAM_WEBHOOK_SECRET
    },
    body: 'invalid json {'
  });

  const response = await index.fetch(request, env, { waitUntil: () => {} });
  const result = await response.json();

  assertEqual(response.status, 400, 'Response should be 400');
  assertEqual(result.ok, false, 'Should return ok: false');
  assert(result.error.includes('Invalid JSON'), 'Should indicate invalid JSON');
});

// Test 6d: Webhook secret verification failure (missing header)
runner.test('Webhook secret verification failure (missing header)', async () => {
  const env = createMockEnv();
  const update = createTelegramUpdate('/start', 123456789);

  const request = new Request('http://localhost:8787', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
      // Missing X-Telegram-Bot-Api-Secret-Token header
    },
    body: JSON.stringify(update)
  });

  const response = await index.fetch(request, env, { waitUntil: () => {} });
  const result = await response.json();

  assertEqual(response.status, 401, 'Response should be 401');
  assertEqual(result.ok, false, 'Should return ok: false');
  assertEqual(result.error, 'Unauthorized', 'Should indicate unauthorized');
});

// Test 6e: Webhook secret verification failure (wrong secret)
runner.test('Webhook secret verification failure (wrong secret)', async () => {
  const env = createMockEnv();
  const update = createTelegramUpdate('/start', 123456789);

  const request = new Request('http://localhost:8787', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Telegram-Bot-Api-Secret-Token': 'wrong-secret-token'
    },
    body: JSON.stringify(update)
  });

  const response = await index.fetch(request, env, { waitUntil: () => {} });
  const result = await response.json();

  assertEqual(response.status, 401, 'Response should be 401');
  assertEqual(result.ok, false, 'Should return ok: false');
  assertEqual(result.error, 'Unauthorized', 'Should indicate unauthorized');
});

// Test 7: GET request (should return 405)
runner.test('GET request (Method not allowed)', async () => {
  const env = createMockEnv();

  const request = new Request('http://localhost:8787', {
    method: 'GET'
  });

  const response = await index.fetch(request, env, { waitUntil: () => {} });
  const text = await response.text();

  assertEqual(response.status, 405, 'Response should be 405');
  assertEqual(text, 'Method not allowed', 'Should return method not allowed message');
});

// Test 8: Scheduled handler on weekday
runner.test('Scheduled handler executes on weekday', async () => {
  const env = createMockEnv();
  let scheduledExecuted = false;

  const mockFetch = createMockFetch({
    'production.dataviz.cnn.io': () => {
      scheduledExecuted = true;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          rating: 'Neutral',
          score: 50.0,
          timestamp: new Date().toISOString()
        })
      };
    },
    'query1.finance.yahoo.com': () => ({
      ok: true,
      status: 200,
      json: async () => createMockMarketData(400)
    }),
    'quickchart.io': () => ({
      ok: true,
      status: 200,
      url: 'https://quickchart.io/chart?c=...'
    })
  });

  global.fetch = mockFetch;

  // Mock Date to return a known weekday (Tuesday, March 5, 2024 - a regular trading day)
  const originalDate = global.Date;
  const mockDate = class extends Date {
    constructor(...args) {
      if (args.length === 0) {
        super('2024-03-05T14:00:00Z'); // Tuesday
      } else {
        super(...args);
      }
    }
    static now() {
      return new Date('2024-03-05T14:00:00Z').getTime();
    }
  };
  // Copy static methods
  Object.setPrototypeOf(mockDate, originalDate);
  Object.defineProperty(global, 'Date', { value: mockDate, writable: true, configurable: true });

  try {
    const controller = {
      cron: '0 9 * * 1-5',
      scheduledTime: Date.now(),
      type: 'scheduled'
    };

    const ctx = {
      waitUntil: (promise) => {
        promise.then(() => {}).catch(() => {});
      }
    };

    await index.scheduled(controller, env, ctx);

    // Give it a moment to execute
    await new Promise(resolve => setTimeout(resolve, 100));

    assert(scheduledExecuted, 'Scheduled handler should execute on weekday');
  } finally {
    // Restore original Date
    global.Date = originalDate;
  }
});

// Test 8b: Scheduled handler skips on weekend
runner.test('Scheduled handler skips on weekend', async () => {
  const env = createMockEnv();
  let scheduledExecuted = false;

  const mockFetch = createMockFetch({
    'production.dataviz.cnn.io': () => {
      scheduledExecuted = true;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          rating: 'Neutral',
          score: 50.0,
          timestamp: new Date().toISOString()
        })
      };
    },
    'query1.finance.yahoo.com': () => ({
      ok: true,
      status: 200,
      json: async () => createMockMarketData(400)
    }),
    'quickchart.io': () => ({
      ok: true,
      status: 200,
      url: 'https://quickchart.io/chart?c=...'
    })
  });

  global.fetch = mockFetch;

  // Mock Date to return a known weekend day (Saturday, January 6, 2024)
  const originalDate = global.Date;
  const mockDate = class extends Date {
    constructor(...args) {
      if (args.length === 0) {
        super('2024-01-06T14:00:00Z'); // Saturday
      } else {
        super(...args);
      }
    }
    static now() {
      return new Date('2024-01-06T14:00:00Z').getTime();
    }
  };
  // Copy static methods
  Object.setPrototypeOf(mockDate, originalDate);
  Object.defineProperty(global, 'Date', { value: mockDate, writable: true, configurable: true });

  try {
    const controller = {
      cron: '0 9 * * 1-5',
      scheduledTime: Date.now(),
      type: 'scheduled'
    };

    const ctx = {
      waitUntil: (promise) => {
        promise.then(() => {}).catch(() => {});
      }
    };

    await index.scheduled(controller, env, ctx);

    // Give it a moment - should not execute
    await new Promise(resolve => setTimeout(resolve, 100));

    assert(!scheduledExecuted, 'Scheduled handler should NOT execute on weekend');
  } finally {
    // Restore original Date
    global.Date = originalDate;
  }
});

// Test 9: /deploy-notify endpoint with valid token (Authorization header)
runner.test('/deploy-notify endpoint with valid token (Authorization header)', async () => {
  const env = createMockEnv();
  const chatIds = [111111111, 222222222];

  // Set up subscribers
  for (const chatId of chatIds) {
    await sub(chatId, env);
  }

  let telegramCallCount = 0;
  const mockFetch = createMockFetch({
    'api.telegram.org': () => {
      telegramCallCount++;
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({ ok: true, result: { message_id: 123 } })
      };
    }
  });

  global.fetch = mockFetch;

  const request = new Request('http://localhost:8787/deploy-notify', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.TELEGRAM_BOT_TOKEN_SECRET}`
    },
    body: JSON.stringify({
      commitHash: 'abc1234',
      commitMessage: 'Test commit message',
      commitUrl: 'https://github.com/owner/repo/commit/abc1234567890',
      timestamp: '2024-01-01T00:00:00Z'
    })
  });

  const response = await index.fetch(request, env, { waitUntil: () => {} });
  const result = await response.json();

  assertEqual(response.status, 200, 'Response should be 200');
  assertEqual(result.success, true, 'Should succeed');
  assertEqual(result.broadcast.totalSubscribers, 2, 'Should have 2 subscribers');
  assertEqual(result.broadcast.successful, 2, 'Should send to 2 subscribers');
  assertEqual(telegramCallCount, 2, 'Should send 2 Telegram messages');
});

// Test 10: /deploy-notify endpoint with valid token (body)
runner.test('/deploy-notify endpoint with valid token (body)', async () => {
  const env = createMockEnv();
  const chatIds = [111111111];

  // Set up one subscriber
  await sub(chatIds[0], env);

  let telegramCallCount = 0;
  const mockFetch = createMockFetch({
    'api.telegram.org': () => {
      telegramCallCount++;
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({ ok: true, result: { message_id: 123 } })
      };
    }
  });

  global.fetch = mockFetch;

  const request = new Request('http://localhost:8787/deploy-notify', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      token: env.TELEGRAM_BOT_TOKEN_SECRET,
      commitHash: 'def5678',
      commitMessage: 'Another test commit',
      commitUrl: 'https://github.com/owner/repo/commit/def5678901234'
    })
  });

  const response = await index.fetch(request, env, { waitUntil: () => {} });
  const result = await response.json();

  assertEqual(response.status, 200, 'Response should be 200');
  assertEqual(result.success, true, 'Should succeed');
  assertEqual(result.broadcast.totalSubscribers, 1, 'Should have 1 subscriber');
  assertEqual(result.broadcast.successful, 1, 'Should send to 1 subscriber');
});

// Test 11: /deploy-notify endpoint with invalid token
runner.test('/deploy-notify endpoint with invalid token', async () => {
  const env = createMockEnv();

  const request = new Request('http://localhost:8787/deploy-notify', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer invalid-token'
    },
    body: JSON.stringify({
      commitHash: 'abc1234',
      commitMessage: 'Test commit',
      commitUrl: 'https://github.com/owner/repo/commit/abc1234'
    })
  });

  const response = await index.fetch(request, env, { waitUntil: () => {} });
  const result = await response.json();

  assertEqual(response.status, 401, 'Response should be 401');
  assertEqual(result.ok, false, 'Should fail');
  assertEqual(result.error, 'Invalid token', 'Should indicate invalid token');
});

// Test 12: /deploy-notify endpoint missing required fields
runner.test('/deploy-notify endpoint missing required fields', async () => {
  const env = createMockEnv();

  const request = new Request('http://localhost:8787/deploy-notify', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.TELEGRAM_BOT_TOKEN_SECRET}`
    },
    body: JSON.stringify({
      commitHash: 'abc1234'
      // Missing commitMessage and commitUrl
    })
  });

  const response = await index.fetch(request, env, { waitUntil: () => {} });
  const result = await response.json();

  assertEqual(response.status, 400, 'Response should be 400');
  assertEqual(result.ok, false, 'Should fail');
  assert(result.error.includes('Missing required fields'), 'Should indicate missing fields');
});

// Test 13: /deploy-notify endpoint verifies message format
runner.test('/deploy-notify endpoint verifies message format', async () => {
  const env = createMockEnv();
  const chatIds = [111111111];

  await sub(chatIds[0], env);

  let capturedMessage = null;
  const mockFetch = createMockFetch({
    'api.telegram.org': (options) => {
      const body = JSON.parse(options.body);
      capturedMessage = body.text;
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({ ok: true, result: { message_id: 123 } })
      };
    }
  });

  global.fetch = mockFetch;

  const request = new Request('http://localhost:8787/deploy-notify', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.TELEGRAM_BOT_TOKEN_SECRET}`
    },
    body: JSON.stringify({
      commitHash: 'abc1234',
      commitMessage: 'Test commit\n\nWith multiple lines\nAnd details',
      commitUrl: 'https://github.com/owner/repo/commit/abc1234567890'
    })
  });

  const response = await index.fetch(request, env, { waitUntil: () => {} });
  const result = await response.json();

  assertEqual(response.status, 200, 'Response should be 200');
  assert(capturedMessage.includes('🚀 New version deployed!'), 'Message should include deployment emoji');
  assert(capturedMessage.includes('abc1234'), 'Message should include commit hash');
  assert(capturedMessage.includes('Test commit'), 'Message should include first line of commit message');
  assert(!capturedMessage.includes('With multiple lines'), 'Message should only include first line');

  // Securely verify commit URL by parsing and checking hostname exactly
  // Extract URL from Markdown format: [text](URL)
  const urlMatch = capturedMessage.match(/\[.*?\]\((https?:\/\/[^\)]+)\)/);
  assert(urlMatch, 'Message should contain a URL in Markdown format');
  const commitUrl = urlMatch[1];
  const urlObj = new URL(commitUrl);
  // Verify hostname exactly matches (prevents substring vulnerabilities)
  assert.equal(urlObj.hostname, 'github.com', 'Commit URL hostname should be github.com');
  // Verify the full URL matches expected format
  assert.equal(commitUrl, 'https://github.com/owner/repo/commit/abc1234567890', 'Commit URL should match expected value');
});

// Test 14: /deploy-notify endpoint with no subscribers
runner.test('/deploy-notify endpoint with no subscribers', async () => {
  const env = createMockEnv();

  // No subscribers by default (empty D1 database)

  const request = new Request('http://localhost:8787/deploy-notify', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.TELEGRAM_BOT_TOKEN_SECRET}`
    },
    body: JSON.stringify({
      commitHash: 'abc1234',
      commitMessage: 'Test commit',
      commitUrl: 'https://github.com/owner/repo/commit/abc1234'
    })
  });

  const response = await index.fetch(request, env, { waitUntil: () => {} });
  const result = await response.json();

  assertEqual(response.status, 200, 'Response should be 200');
  assertEqual(result.success, true, 'Should succeed');
  assertEqual(result.broadcast.totalSubscribers, 0, 'Should have 0 subscribers');
  assertEqual(result.broadcast.successful, 0, 'Should have 0 successful sends');
});

// Test 15: /deploy-notify endpoint with GET method (should fail)
runner.test('/deploy-notify endpoint with GET method', async () => {
  const env = createMockEnv();

  const request = new Request('http://localhost:8787/deploy-notify', {
    method: 'GET'
  });

  const response = await index.fetch(request, env, { waitUntil: () => {} });
  const text = await response.text();

  assertEqual(response.status, 405, 'Response should be 405');
  assertEqual(text, 'Method not allowed', 'Should return method not allowed');
});

// Run tests
runner.run().catch(console.error);
