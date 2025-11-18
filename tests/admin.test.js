/**
 * Admin command tests (/subscribers functionality)
 */

import { listSubscribers } from '../src/subs.js';
import { TestRunner, createMockEnv, createMockFetch, assertEqual, assertIncludes } from './utils/test-helpers.js';
import assert from 'node:assert';

const runner = new TestRunner();

// Test 1: List subscribers with empty list
runner.test('List subscribers with empty list', async () => {
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
runner.test('List subscribers with multiple users', async () => {
  const env = createMockEnv();
  
  // Add subscribers to KV
  await env.FEAR_GREED_KV.put('chat_ids', JSON.stringify([111111111, 222222222, 333333333]));
  
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
runner.test('Automatically unsubscribe blocked users', async () => {
  const env = createMockEnv();
  
  // Add subscribers including a blocked user
  await env.FEAR_GREED_KV.put('chat_ids', JSON.stringify([111111111, 'blocked_user', 333333333]));
  
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
  
  // Verify blocked user was unsubscribed from KV
  const chatIdsString = await env.FEAR_GREED_KV.get('chat_ids');
  const chatIds = JSON.parse(chatIdsString);
  assert(!chatIds.includes('blocked_user'), 'Blocked user should be removed from KV');
});

// Test 4: Format includes total count and numbered list
runner.test('Format includes total count and numbered list', async () => {
  const env = createMockEnv();
  
  // Add 2 subscribers
  await env.FEAR_GREED_KV.put('chat_ids', JSON.stringify([111111111, 222222222]));
  
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
  assertEqual(lines[0], 'Total subscribers: 2', 'First line should be total count');
  assertEqual(lines[1], '', 'Second line should be empty (separator)');
  assertIncludes(lines[2], '1.', 'Third line should start with "1."');
  assertIncludes(lines[3], '2.', 'Fourth line should start with "2."');
});

// Test 5: Handle errors gracefully
runner.test('Handle errors gracefully', async () => {
  const env = createMockEnv();
  
  // Create a broken KV that throws errors
  const brokenKV = {
    get: async () => { throw new Error('KV error'); },
    put: async () => { throw new Error('KV error'); }
  };
  env.FEAR_GREED_KV = brokenKV;
  
  const mockFetch = createMockFetch();
  global.fetch = mockFetch;
  
  const result = await listSubscribers(env);
  
  assertIncludes(result, 'Error retrieving subscriber list', 'Should show error message');
});

// Test 6: Rate limiting with batch processing
runner.test('Rate limiting with batch processing', async () => {
  const env = createMockEnv();
  
  // Add many subscribers (more than batch size of 30)
  const manyChatIds = Array.from({ length: 35 }, (_, i) => 100000000 + i);
  await env.FEAR_GREED_KV.put('chat_ids', JSON.stringify(manyChatIds));
  
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
runner.test('Fallback to first_name/last_name when username is missing', async () => {
  const env = createMockEnv();
  
  // Add subscribers: one with username, one without username but with first+last name, one with only first name
  await env.FEAR_GREED_KV.put('chat_ids', JSON.stringify([111111111, 222222222, 333333333]));
  
  const mockFetch = createMockFetch({
    'api.telegram.org': (options) => {
      const body = JSON.parse(options.body || '{}');
      const chatId = body.chat_id;
      
      // Check if this is a getChat call (has chat_id but no text)
      if (body.chat_id !== undefined && body.text === undefined) {
        let result;
        
        if (chatId === 111111111) {
          // User with username
          result = {
            id: chatId,
            type: 'private',
            username: 'user_with_username',
            first_name: 'John'
          };
        } else if (chatId === 222222222) {
          // User without username but with first and last name
          result = {
            id: chatId,
            type: 'private',
            first_name: 'Jane',
            last_name: 'Doe'
          };
        } else if (chatId === 333333333) {
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

// Run tests
runner.run().catch(console.error);

