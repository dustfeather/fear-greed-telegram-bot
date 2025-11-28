/**
 * Admin command tests (/subscribers functionality)
 */

import { listSubscribers, sub } from '../../src/user-management/services/subscription-service.js';
import { createMockEnv, createMockFetch, assertEqual, assertIncludes } from '../utils/test-helpers.js';


describe('Admin Integration', () => {
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

// Test 1: List subscribers with empty list
test('List subscribers with empty list', async () => {
  const env = createMockEnv();

  const mockFetch = createMockFetch({
    'api.telegram.org': () => ({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, result: {} })
    })
  });

  global.fetch = mockFetch;

  const result = await listSubscribers(env);

  assertIncludes(result, 'Total subscribers: 0', 'Should show total count of 0');
  assertIncludes(result, 'No subscribers found', 'Should indicate no subscribers');
});

// Test 2: List subscribers with multiple users
test('List subscribers with multiple users', async () => {
  const env = createMockEnv();

  // Add subscribers
  await sub(111111111, env);
  await sub(222222222, env);
  await sub(333333333, env);

  const mockFetch = createMockFetch({
    'api.telegram.org': (options) => {
      const body = JSON.parse(options.body || '{}');
      const chatId = body.chat_id;

      // Check if this is a getChat call (has chat_id but no text)
      if (body.chat_id !== undefined && body.text === undefined) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            ok: true,
            result: {
              id: chatId,
              type: 'private',
              username: `user${chatId}`,
              first_name: 'Test'
            }
          })
        };
      }

      // Default response for sendMessage and other Telegram API calls
      return {
        ok: true,
        status: 200,
        json: async () => ({ ok: true, result: { message_id: 123 } })
      };
    }
  });

  global.fetch = mockFetch;

  const result = await listSubscribers(env);

  assertIncludes(result, 'Total subscribers: 3', 'Should show total count of 3');
  assertIncludes(result, '@user111111111', 'Should include first username');
  assertIncludes(result, '@user222222222', 'Should include second username');
  assertIncludes(result, '@user333333333', 'Should include third username');
  assertIncludes(result, '1. @user', 'Should have numbered list starting with 1');
});

// Test 3: Automatically unsubscribe blocked users
test('Automatically unsubscribe blocked users', async () => {
  const env = createMockEnv();

  // Add subscribers including a blocked user
  await sub(111111111, env);
  await sub('blocked_user', env);
  await sub(333333333, env);

  const mockFetch = createMockFetch({
    'api.telegram.org': (options) => {
      const body = JSON.parse(options.body || '{}');
      const chatId = body.chat_id;

      // Check if this is a getChat call (has chat_id but no text)
      if (body.chat_id !== undefined && body.text === undefined) {
        // Simulate blocked user
        if (chatId === 'blocked_user') {
          return {
            ok: false,
            status: 400,
            statusText: 'Bad Request',
            json: async () => ({
              ok: false,
              error_code: 400,
              description: 'Bad Request: chat not found'
            })
          };
        }

        // Normal user
        return {
          ok: true,
          status: 200,
          json: async () => ({
            ok: true,
            result: {
              id: chatId,
              type: 'private',
              username: `user${chatId}`,
              first_name: 'Test'
            }
          })
        };
      }

      // Default response for sendMessage and other Telegram API calls
      return {
        ok: true,
        status: 200,
        json: async () => ({ ok: true, result: { message_id: 123 } })
      };
    }
  });

  global.fetch = mockFetch;

  const result = await listSubscribers(env);

  // Should only show 2 active subscribers (blocked user should be unsubscribed)
  assertIncludes(result, 'Total subscribers: 2', 'Should show total count of 2 after unsubscribing blocked user');
  assertIncludes(result, '@user111111111', 'Should include first username');
  assertIncludes(result, '@user333333333', 'Should include third username');

  // Wait a bit for async unsubscribe to complete
  await new Promise(resolve => setTimeout(resolve, 100));

  // Verify blocked user was unsubscribed from D1
  const chatIds = await env.FEAR_GREED_D1.prepare('SELECT chat_id FROM users WHERE subscription_status = 1').all();
  expect(!chatIds.results.some(r => r.chat_id === 'blocked_user')).toBeTruthy(); // Blocked user should be removed from D1
});

// Test 4: Format includes total count and numbered list
test('Format includes total count and numbered list', async () => {
  const env = createMockEnv();

  // Add 2 subscribers
  await sub(111111111, env);
  await sub(222222222, env);

  const mockFetch = createMockFetch({
    'api.telegram.org': (options) => {
      const body = JSON.parse(options.body || '{}');
      const chatId = body.chat_id;

      // Check if this is a getChat call (has chat_id but no text)
      if (body.chat_id !== undefined && body.text === undefined) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            ok: true,
            result: {
              id: chatId,
              type: 'private',
              username: `user${chatId}`,
              first_name: 'Test'
            }
          })
        };
      }

      // Default response for sendMessage and other Telegram API calls
      return {
        ok: true,
        status: 200,
        json: async () => ({ ok: true, result: { message_id: 123 } })
      };
    }
  });

  global.fetch = mockFetch;

  const result = await listSubscribers(env);

  // Check format: total count first, then numbered list
  const lines = result.split('\n');
  expect(lines[0]).toBe('Total subscribers: 2'); // First line should be total count
  expect(lines[1]).toBe(''); // Second line should be empty (separator)
  assertIncludes(lines[2], '1.', 'Third line should start with "1."');
  assertIncludes(lines[3], '2.', 'Fourth line should start with "2."');
});

// Test 5: Handle errors gracefully
test('Handle errors gracefully', async () => {
  const env = createMockEnv();

  // Create a broken D1 that throws errors
  env.FEAR_GREED_D1 = {
    prepare: () => ({
      all: async () => { throw new Error('D1 error'); }
    })
  };

  const mockFetch = createMockFetch();
  global.fetch = mockFetch;

  const result = await listSubscribers(env);

  assertIncludes(result, 'Error retrieving subscriber list', 'Should show error message');
});

// Test 6: Rate limiting with batch processing
test('Rate limiting with batch processing', async () => {
  const env = createMockEnv();

  // Add many subscribers (more than batch size of 30)
  const manyChatIds = Array.from({ length: 35 }, (_, i) => 100000000 + i);
  for (const chatId of manyChatIds) {
    await sub(chatId, env);
  }

  const mockFetch = createMockFetch({
    'api.telegram.org': (options) => {
      const body = JSON.parse(options.body || '{}');
      const chatId = body.chat_id;

      // Check if this is a getChat call (has chat_id but no text)
      if (body.chat_id !== undefined && body.text === undefined) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            ok: true,
            result: {
              id: chatId,
              type: 'private',
              username: `user${chatId}`,
              first_name: 'Test'
            }
          })
        };
      }

      // Default response for sendMessage and other Telegram API calls
      return {
        ok: true,
        status: 200,
        json: async () => ({ ok: true, result: { message_id: 123 } })
      };
    }
  });

  global.fetch = mockFetch;

  const result = await listSubscribers(env);

  assertIncludes(result, 'Total subscribers: 35', 'Should show total count of 35');
  // Verify all usernames are included
  for (let i = 0; i < 35; i++) {
    assertIncludes(result, `@user${100000000 + i}`, `Should include username for user ${100000000 + i}`);
  }
});

// Test 7: Fallback to first_name/last_name when username is missing
test('Fallback to first_name/last_name when username is missing', async () => {
  const env = createMockEnv();

  // Add subscribers: one with username, one without username but with first+last name, one with only first name
  await sub(111111111, env);
  await sub(222222222, env);
  await sub(333333333, env);

  const mockFetch = createMockFetch({
    'api.telegram.org': (options) => {
      const body = JSON.parse(options.body || '{}');
      const chatId = body.chat_id;

      // Check if this is a getChat call (has chat_id but no text)
      if (body.chat_id !== undefined && body.text === undefined) {
        let result;

        // Compare as strings since D1 returns strings
        if (String(chatId) === '111111111') {
          // User with username
          result = {
            id: chatId,
            type: 'private',
            username: 'user_with_username',
            first_name: 'John'
          };
        } else if (String(chatId) === '222222222') {
          // User without username but with first and last name
          result = {
            id: chatId,
            type: 'private',
            first_name: 'Jane',
            last_name: 'Doe'
          };
        } else if (String(chatId) === '333333333') {
          // User without username, only first name
          result = {
            id: chatId,
            type: 'private',
            first_name: 'Bob'
          };
        }

        return {
          ok: true,
          status: 200,
          json: async () => ({
            ok: true,
            result: result
          })
        };
      }

      // Default response for sendMessage and other Telegram API calls
      return {
        ok: true,
        status: 200,
        json: async () => ({ ok: true, result: { message_id: 123 } })
      };
    }
  });

  global.fetch = mockFetch;

  const result = await listSubscribers(env);

  assertIncludes(result, 'Total subscribers: 3', 'Should show total count of 3');
  assertIncludes(result, '@user_with_username', 'Should show username when available');
  assertIncludes(result, 'Jane Doe', 'Should show first_name + last_name when username is missing');
  assertIncludes(result, 'Bob', 'Should show first_name only when username and last_name are missing');
});


});
