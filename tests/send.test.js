/**
 * Send message tests (Telegram API calls)
 */

import { sendTelegramMessage, sendHelpMessage } from '../src/send.js';
import { TestRunner, createMockEnv, createMockFetch, assertSuccess, assertFailure, assertEqual } from './utils/test-helpers.js';
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
    if (url.includes('api.telegram.org')) {
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

// Run tests
runner.run().catch(console.error);
