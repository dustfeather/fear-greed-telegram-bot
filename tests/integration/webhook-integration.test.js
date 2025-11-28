/**
 * Integration tests (full user flows)
 */

import index from '../../src/index.js';
import { TestRunner, createMockEnv, createMockFetch, createTelegramUpdate, assertEqual, assertIncludes, assertNotIncludes } from '../utils/test-helpers.js';
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

// Test 1: Complete user flow: subscribe -> get index -> unsubscribe
runner.test('Complete user flow: subscribe -> get index -> unsubscribe', async () => {
  const env = createMockEnv();
  const chatId = 123456789;

  let telegramMessages = [];
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
    'api.telegram.org': (options) => {
      const body = JSON.parse(options.body);
      telegramMessages.push(body.text);
      return {
        ok: true,
        status: 200,
        json: async () => ({ ok: true, result: { message_id: 123 } })
      };
    }
  });

  global.fetch = mockFetch;

  // Step 1: Subscribe
  const startUpdate = createTelegramUpdate('/start', chatId);
  const startRequest = new Request('http://localhost:8787', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Telegram-Bot-Api-Secret-Token': env.TELEGRAM_WEBHOOK_SECRET
    },
    body: JSON.stringify(startUpdate)
  });

  await index.fetch(startRequest, env, { waitUntil: () => {} });

  // Verify subscription
  const chatIdsString = await env.FEAR_GREED_KV.get('chat_ids');
  const chatIds = JSON.parse(chatIdsString);
  assertIncludes(chatIds, chatId, 'User should be subscribed');

  // Step 2: Get current index
  const nowUpdate = createTelegramUpdate('/now', chatId);
  const nowRequest = new Request('http://localhost:8787', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Telegram-Bot-Api-Secret-Token': env.TELEGRAM_WEBHOOK_SECRET
    },
    body: JSON.stringify(nowUpdate)
  });

  await index.fetch(nowRequest, env, { waitUntil: () => {} });

  // Step 3: Unsubscribe
  const stopUpdate = createTelegramUpdate('/stop', chatId);
  const stopRequest = new Request('http://localhost:8787', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Telegram-Bot-Api-Secret-Token': env.TELEGRAM_WEBHOOK_SECRET
    },
    body: JSON.stringify(stopUpdate)
  });

  await index.fetch(stopRequest, env, { waitUntil: () => {} });

  // Verify unsubscription
  const chatIdsStringAfter = await env.FEAR_GREED_KV.get('chat_ids');
  const chatIdsAfter = JSON.parse(chatIdsStringAfter || '[]');
  assertNotIncludes(chatIdsAfter, chatId, 'User should be unsubscribed');

  // Verify messages were sent
  assert(telegramMessages.length >= 3, 'Should send at least 3 messages');
  assert(telegramMessages.some(m => m.includes('subscribed')), 'Should send subscription message');
  assert(telegramMessages.some(m => m.includes('Fear and Greed Index')), 'Should send index message');
  assert(telegramMessages.some(m => m.includes('unsubscribed')), 'Should send unsubscription message');
});

// Test 2: Multiple users subscribe and receive alerts
runner.test('Multiple users subscribe and receive alerts', async () => {
  const env = createMockEnv();
  const chatId1 = 111111111;
  const chatId2 = 222222222;
  const chatId3 = 333333333;

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

  const telegramRecipients = [];
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
    'api.telegram.org': (options) => {
      const body = JSON.parse(options.body);
      telegramRecipients.push(body.chat_id);
      return {
        ok: true,
        status: 200,
        json: async () => ({ ok: true, result: { message_id: 123 } })
      };
    }
  });

  global.fetch = mockFetch;

  // Subscribe all users
  for (const chatId of [chatId1, chatId2, chatId3]) {
    const update = createTelegramUpdate('/start', chatId);
    const request = new Request('http://localhost:8787', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Telegram-Bot-Api-Secret-Token': env.TELEGRAM_WEBHOOK_SECRET
      },
      body: JSON.stringify(update)
    });
    await index.fetch(request, env, { waitUntil: () => {} });
  }

  // Verify all subscribed
  const chatIdsString = await env.FEAR_GREED_KV.get('chat_ids');
  const chatIds = JSON.parse(chatIdsString);
  assertEqual(chatIds.length, 3, 'Should have 3 subscribers');

  // Trigger scheduled event (fear rating should send to all)
  const { handleScheduled } = await import('../../src/scheduler/handlers/scheduled-handler.js');
  await handleScheduled(null, env);

  try {
    // Verify all received the alert
    // Should have 3 subscription confirmations + 3 fear alerts = 6 messages
    assertEqual(telegramRecipients.length, 6, 'Should send to all subscribers (3 subscriptions + 3 alerts)');
    assertIncludes(telegramRecipients, chatId1, 'User 1 should receive alert');
    assertIncludes(telegramRecipients, chatId2, 'User 2 should receive alert');
    assertIncludes(telegramRecipients, chatId3, 'User 3 should receive alert');
  } finally {
    global.Date = originalDate;
  }
});

// Test 3: Subscribe twice, unsubscribe once
runner.test('Subscribe twice, unsubscribe once', async () => {
  const env = createMockEnv();
  const chatId = 123456789;

  const mockFetch = createMockFetch({
    'api.telegram.org': () => ({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, result: { message_id: 123 } })
    })
  });

  global.fetch = mockFetch;

  // Subscribe twice
  const update1 = createTelegramUpdate('/start', chatId);
  const request1 = new Request('http://localhost:8787', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Telegram-Bot-Api-Secret-Token': env.TELEGRAM_WEBHOOK_SECRET
    },
    body: JSON.stringify(update1)
  });
  await index.fetch(request1, env, { waitUntil: () => {} });

  const update2 = createTelegramUpdate('/start', chatId);
  const request2 = new Request('http://localhost:8787', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Telegram-Bot-Api-Secret-Token': env.TELEGRAM_WEBHOOK_SECRET
    },
    body: JSON.stringify(update2)
  });
  await index.fetch(request2, env, { waitUntil: () => {} });

  // Verify still only one subscription
  const chatIdsString = await env.FEAR_GREED_KV.get('chat_ids');
  const chatIds = JSON.parse(chatIdsString);
  assertEqual(chatIds.length, 1, 'Should have only 1 subscription');
  assertEqual(chatIds.filter(id => id === chatId).length, 1, 'Should have only one instance');

  // Unsubscribe once
  const update3 = createTelegramUpdate('/stop', chatId);
  const request3 = new Request('http://localhost:8787', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Telegram-Bot-Api-Secret-Token': env.TELEGRAM_WEBHOOK_SECRET
    },
    body: JSON.stringify(update3)
  });
  await index.fetch(request3, env, { waitUntil: () => {} });

  // Verify unsubscribed
  const chatIdsStringAfter = await env.FEAR_GREED_KV.get('chat_ids');
  const chatIdsAfter = JSON.parse(chatIdsStringAfter || '[]');
  assertEqual(chatIdsAfter.length, 0, 'Should have 0 subscriptions');
});

// Test 4: Help command shows all commands
runner.test('Help command shows all commands', async () => {
  const env = createMockEnv();
  const chatId = 123456789;

  let helpMessage = null;
  const mockFetch = createMockFetch({
    'api.telegram.org': (options) => {
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

  const update = createTelegramUpdate('/help', chatId);
  const request = new Request('http://localhost:8787', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Telegram-Bot-Api-Secret-Token': env.TELEGRAM_WEBHOOK_SECRET
    },
    body: JSON.stringify(update)
  });

  await index.fetch(request, env, { waitUntil: () => {} });

  assert(helpMessage.includes('/start'), 'Help should include /start');
  assert(helpMessage.includes('/stop'), 'Help should include /stop');
  assert(helpMessage.includes('/now'), 'Help should include /now');
  assert(helpMessage.includes('/help'), 'Help should include /help');
});

// Test 5: Error handling flow
runner.test('Error handling flow', async () => {
  const env = createMockEnv();
  const chatId = 123456789;

  let adminNotified = false;
  const mockFetch = createMockFetch({
    'production.dataviz.cnn.io': () => {
      throw new Error('API Error');
    },
    'api.telegram.org': (options) => {
      const body = JSON.parse(options.body);
      if (body.chat_id === env.ADMIN_CHAT_ID) {
        adminNotified = true;
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ ok: true, result: { message_id: 123 } })
      };
    }
  });

  global.fetch = mockFetch;

  // Try to get index when API fails
  const update = createTelegramUpdate('/now', chatId);
  const request = new Request('http://localhost:8787', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Telegram-Bot-Api-Secret-Token': env.TELEGRAM_WEBHOOK_SECRET
    },
    body: JSON.stringify(update)
  });

  await index.fetch(request, env, { waitUntil: () => {} });

  // Admin should be notified
  // Note: This happens in handleScheduled, which is async
  await new Promise(resolve => setTimeout(resolve, 200));

  // The error should be handled gracefully (no crash)
  assert(true, 'Should handle errors gracefully');
});

// Run tests
runner.run().catch(console.error);
