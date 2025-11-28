/**
 * Send message tests (Telegram API calls)
 */

import { sendTelegramMessage, sendHelpMessage, broadcastToAllSubscribers } from '../../../src/telegram/services/message-service.js';
import { sub } from '../../../src/user-management/services/subscription-service.js';
import { TestRunner, createMockEnv, createMockFetch, assertSuccess, assertFailure, assertEqual } from '../../utils/test-helpers.js';
import assert from 'node:assert';

const runner = new TestRunner();

// Test 1: Send message successfully
runner.test('Send message successfully', async () => {
  const env = createMockEnv();
  const chatId = 123456789;
  const message = 'Test message';

  // Mock successful Telegram API response
  const mockFetch = createMockFetch({
    'api.telegram.org': () => ({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({
        ok: true,
        result: {
          message_id: 123,
          chat: { id: chatId },
          text: message
        }
      })
    })
  });

  global.fetch = mockFetch;

  const result = await sendTelegramMessage(chatId, message, env);

  assertSuccess(result, 'Message sending should succeed');
  assertEqual(result.status, 200, 'HTTP status should be 200');
  assertEqual(result.chatId, chatId, 'Chat ID should match');
  assertEqual(result.message, message, 'Message should match');
  assertEqual(result.data?.ok, true, 'Telegram API should return ok=true');
});

// Test 2: Handle Telegram API failure
runner.test('Handle Telegram API failure', async () => {
  const env = createMockEnv();
  const chatId = 123456789;
  const message = 'Test message';

  // Mock failed Telegram API response
  const mockFetch = createMockFetch({
    'api.telegram.org': () => ({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      json: async () => ({
        ok: false,
        error_code: 400,
        description: 'Bad Request: chat not found'
      })
    })
  });

  global.fetch = mockFetch;

  const result = await sendTelegramMessage(chatId, message, env);

  assertFailure(result, 'Message sending should fail');
  assertEqual(result.status, 400, 'HTTP status should be 400');
});

// Test 3: Handle network errors
runner.test('Handle network errors', async () => {
  const env = createMockEnv();
  const chatId = 123456789;
  const message = 'Test message';

  // Mock network error
  const mockFetch = async () => {
    throw new Error('Network error');
  };

  global.fetch = mockFetch;

  const result = await sendTelegramMessage(chatId, message, env);

  assertFailure(result, 'Message sending should fail on network error');
  assertEqual(result.error, 'Network error', 'Error message should be captured');
});

// Test 4: Send help message
runner.test('Send help message', async () => {
  const env = createMockEnv();
  const chatId = 123456789;

  const mockFetch = createMockFetch({
    'api.telegram.org': () => ({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({
        ok: true,
        result: { message_id: 123 }
      })
    })
  });

  global.fetch = mockFetch;

  const result = await sendHelpMessage(chatId, env);

  assertSuccess(result, 'Help message should be sent successfully');
  assert(result.message.includes('/start'), 'Help message should include /start command');
  assert(result.message.includes('/stop'), 'Help message should include /stop command');
  assert(result.message.includes('/now'), 'Help message should include /now command');
  assert(result.message.includes('/help'), 'Help message should include /help command');
});

// Test 5: Verify message format (Markdown)
runner.test('Verify message format uses Markdown', async () => {
  const env = createMockEnv();
  const chatId = 123456789;
  const message = 'Test message';

  let capturedPayload = null;
  const mockFetch = async (url, options) => {
    const urlObj = new URL(url);
    if (urlObj.hostname === 'api.telegram.org' || urlObj.hostname.endsWith('.api.telegram.org')) {
      capturedPayload = JSON.parse(options.body);
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({ ok: true, result: { message_id: 123 } })
      };
    }
  };

  global.fetch = mockFetch;

  await sendTelegramMessage(chatId, message, env);

  assertEqual(capturedPayload?.parse_mode, 'Markdown', 'Should use Markdown parse mode');
  assertEqual(capturedPayload?.chat_id, chatId, 'Chat ID should match');
  assertEqual(capturedPayload?.text, message, 'Message text should match');
});

// Test 6: Broadcast to no subscribers
runner.test('Broadcast to no subscribers', async () => {
  const env = createMockEnv();
  const message = 'Test broadcast message';

  // No subscribers by default (empty D1 database)
  const result = await broadcastToAllSubscribers(message, env);

  assertEqual(result.totalSubscribers, 0, 'Should have 0 subscribers');
  assertEqual(result.successful, 0, 'Should have 0 successful sends');
  assertEqual(result.failed, 0, 'Should have 0 failed sends');
  assertEqual(result.errors.length, 0, 'Should have no errors');
});

// Test 7: Broadcast to single subscriber
runner.test('Broadcast to single subscriber', async () => {
  const env = createMockEnv();
  const chatId = 123456789;
  const message = 'Test broadcast message';

  // Set up one subscriber
  await sub(chatId, env);

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

  const result = await broadcastToAllSubscribers(message, env);

  assertEqual(result.totalSubscribers, 1, 'Should have 1 subscriber');
  assertEqual(result.successful, 1, 'Should have 1 successful send');
  assertEqual(result.failed, 0, 'Should have 0 failed sends');
  assertEqual(result.errors.length, 0, 'Should have no errors');
  assertEqual(telegramCallCount, 1, 'Should send one message');
});

// Test 8: Broadcast to multiple subscribers
runner.test('Broadcast to multiple subscribers', async () => {
  const env = createMockEnv();
  const chatIds = [111111111, 222222222, 333333333];
  const message = 'Test broadcast message';

  // Set up multiple subscribers
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

  const result = await broadcastToAllSubscribers(message, env);

  assertEqual(result.totalSubscribers, 3, 'Should have 3 subscribers');
  assertEqual(result.successful, 3, 'Should have 3 successful sends');
  assertEqual(result.failed, 0, 'Should have 0 failed sends');
  assertEqual(result.errors.length, 0, 'Should have no errors');
  assertEqual(telegramCallCount, 3, 'Should send 3 messages');
});

// Test 9: Broadcast with partial failures
runner.test('Broadcast with partial failures', async () => {
  const env = createMockEnv();
  const chatIds = [111111111, 222222222, 333333333];
  const message = 'Test broadcast message';

  // Set up multiple subscribers
  for (const chatId of chatIds) {
    await sub(chatId, env);
  }

  let callCount = 0;
  const mockFetch = createMockFetch({
    'api.telegram.org': () => {
      callCount++;
      // Fail for chatId 222222222
      if (callCount === 2) {
        return {
          ok: false,
          status: 400,
          statusText: 'Bad Request',
          json: async () => ({
            ok: false,
            error_code: 400,
            description: 'Chat not found'
          })
        };
      }
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({ ok: true, result: { message_id: 123 } })
      };
    }
  });

  global.fetch = mockFetch;

  const result = await broadcastToAllSubscribers(message, env);

  assertEqual(result.totalSubscribers, 3, 'Should have 3 subscribers');
  assertEqual(result.successful, 2, 'Should have 2 successful sends');
  assertEqual(result.failed, 1, 'Should have 1 failed send');
  assertEqual(result.errors.length, 1, 'Should have 1 error');
  assertEqual(String(result.errors[0].chatId), '222222222', 'Error should be for chatId 222222222');
});

// Test 10: Broadcast with network errors
runner.test('Broadcast with network errors', async () => {
  const env = createMockEnv();
  const chatIds = [111111111, 222222222];
  const message = 'Test broadcast message';

  // Set up multiple subscribers
  for (const chatId of chatIds) {
    await sub(chatId, env);
  }

  let callCount = 0;
  const mockFetch = async (url, options) => {
    const urlObj = new URL(url);
    if (urlObj.hostname === 'api.telegram.org' || urlObj.hostname.endsWith('.api.telegram.org')) {
      callCount++;
      // Extract chat_id from request body to determine which call should fail
      const body = JSON.parse(options?.body || '{}');
      // Throw error for second chat ID (compare as strings since D1 returns strings)
      if (String(body.chat_id) === String(chatIds[1])) {
        throw new Error('Network error');
      }
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({ ok: true, result: { message_id: 123 } })
      };
    }
    throw new Error('No mock for URL');
  };

  global.fetch = mockFetch;

  const result = await broadcastToAllSubscribers(message, env);

  assertEqual(result.totalSubscribers, 2, 'Should have 2 subscribers');
  // With batching, both are processed but one should fail
  assertEqual(result.successful, 1, 'Should have 1 successful send');
  assertEqual(result.failed, 1, 'Should have 1 failed send');
  assertEqual(result.errors.length, 1, 'Should have 1 error');
  assert(result.errors[0].error.includes('Network error'), 'Error should mention network error');
});

// Test 11: Broadcast handles D1 errors
runner.test('Broadcast handles D1 errors', async () => {
  const env = createMockEnv();
  const message = 'Test broadcast message';

  // Create a broken D1 that throws errors
  env.FEAR_GREED_D1 = {
    prepare: () => ({
      bind: () => ({
        all: async () => { throw new Error('D1 error'); }
      })
    })
  };

  const result = await broadcastToAllSubscribers(message, env);

  assertEqual(result.totalSubscribers, 0, 'Should have 0 subscribers');
  assertEqual(result.successful, 0, 'Should have 0 successful sends');
  assertEqual(result.failed, 0, 'Should have 0 failed sends');
  assertEqual(result.errors.length, 1, 'Should have 1 error');
  // Error message is wrapped by D1 utilities
  assert(result.errors[0].error.includes('D1 operation failed') || result.errors[0].error.includes('D1 error'), 'Error should mention D1 error');
});

// Run tests
runner.run().catch(console.error);
