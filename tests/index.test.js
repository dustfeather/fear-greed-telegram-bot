/**
 * Main handler tests (command processing)
 */

import index from '../src/index.js';
import { TestRunner, createMockEnv, createMockFetch, createTelegramUpdate, assertEqual } from './utils/test-helpers.js';
import assert from 'node:assert';

const runner = new TestRunner();

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
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(update)
  });
  
  const response = await index.fetch(request, env, { waitUntil: () => {} });
  const result = await response.json();
  
  assertEqual(response.status, 200, 'Response should be 200');
  assertEqual(result.commandProcessing?.command, '/start', 'Should process /start command');
  assertEqual(result.commandProcessing?.subscription?.success, true, 'Subscription should succeed');
  assertEqual(telegramCallCount, 1, 'Should send subscription confirmation message');
  
  // Verify user is subscribed
  const chatIdsString = await env.FEAR_GREED_KV.get('chat_ids');
  const chatIds = JSON.parse(chatIdsString);
  assert(chatIds.includes(chatId), 'User should be subscribed');
});

// Test 2: /stop command
runner.test('/stop command', async () => {
  const env = createMockEnv();
  const chatId = 123456789;
  
  // Subscribe first
  await env.FEAR_GREED_KV.put('chat_ids', JSON.stringify([chatId]));
  
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
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(update)
  });
  
  const response = await index.fetch(request, env, { waitUntil: () => {} });
  const result = await response.json();
  
  assertEqual(response.status, 200, 'Response should be 200');
  assertEqual(result.commandProcessing?.command, '/stop', 'Should process /stop command');
  assertEqual(result.commandProcessing?.unsubscription?.success, true, 'Unsubscription should succeed');
  assertEqual(telegramCallCount, 1, 'Should send unsubscription confirmation message');
  
  // Verify user is unsubscribed
  const chatIdsString = await env.FEAR_GREED_KV.get('chat_ids');
  const chatIds = JSON.parse(chatIdsString);
  assert(!chatIds.includes(chatId), 'User should be unsubscribed');
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
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(update)
  });
  
  const response = await index.fetch(request, env, { waitUntil: () => {} });
  const result = await response.json();
  
  assertEqual(response.status, 200, 'Response should be 200');
  assertEqual(result.commandProcessing?.command, '/help', 'Should process /help command');
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
        timestamp: Date.now()
      })
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
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(update)
  });
  
  const response = await index.fetch(request, env, { waitUntil: () => {} });
  const result = await response.json();
  
  assertEqual(response.status, 200, 'Response should be 200');
  assertEqual(result.commandProcessing?.command, '/now', 'Should process /now command');
  assert(telegramCallCount >= 1, 'Should send Fear & Greed Index message');
});

// Test 5: Unknown command
runner.test('Unknown command', async () => {
  const env = createMockEnv();
  const chatId = 123456789;
  const update = createTelegramUpdate('/unknown', chatId);
  
  const request = new Request('http://localhost:8787', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(update)
  });
  
  const response = await index.fetch(request, env, { waitUntil: () => {} });
  const result = await response.json();
  
  assertEqual(response.status, 200, 'Response should still be 200');
  assertEqual(result.commandProcessing?.command, 'unknown', 'Should mark as unknown command');
  assertEqual(result.commandProcessing?.receivedText, '/unknown', 'Should capture received text');
});

// Test 6: Invalid payload (no message)
runner.test('Invalid payload (no message)', async () => {
  const env = createMockEnv();
  const update = { invalid: 'payload' };
  
  const request = new Request('http://localhost:8787', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(update)
  });
  
  const response = await index.fetch(request, env, { waitUntil: () => {} });
  const result = await response.json();
  
  assertEqual(response.status, 200, 'Response should be 200');
  assert(result.error, 'Should have error field');
  assert(result.error.includes('No message or text'), 'Should indicate missing message');
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

// Test 8: Scheduled handler
runner.test('Scheduled handler', async () => {
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
          timestamp: Date.now()
        })
      };
    }
  });
  
  global.fetch = mockFetch;
  
  const controller = {
    cron: '0 14-21 * * 1-5',
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
  
  assert(scheduledExecuted, 'Scheduled handler should execute');
});

// Run tests
runner.run().catch(console.error);