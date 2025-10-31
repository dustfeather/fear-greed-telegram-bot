/**
 * Scheduled event tests (Fear & Greed Index fetching)
 */

import { handleScheduled } from '../src/sched.js';
import { TestRunner, createMockEnv, createMockFetch, assertEqual } from './utils/test-helpers.js';
import assert from 'node:assert';

const runner = new TestRunner();

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
  
  await handleScheduled(null, env);
  
  assertEqual(telegramCallCount, 2, 'Should send to all subscribers');
});

// Test 4: Handle API errors gracefully
runner.test('Handle API errors gracefully', async () => {
  const env = createMockEnv();
  const chatId = 123456789;
  
  let adminCallCount = 0;
  const mockFetch = createMockFetch({
    'production.dataviz.cnn.io': () => {
      throw new Error('CNN API error');
    },
    'api.telegram.org': (options) => {
      const body = JSON.parse(options.body);
      if (body.chat_id === env.ADMIN_CHAT_ID) {
        adminCallCount++;
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
  
  await handleScheduled(null, env);
  
  // Should not send when rating is not fear/extreme fear and no specific chat
  assertEqual(telegramCallCount, 0, 'Should not send messages when rating is not fear and no specific chat');
});

// Test 6: Verify message format includes chart URL
runner.test('Verify message format includes chart URL', async () => {
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
        timestamp: Date.now()
      })
    }),
    'quickchart.io': () => ({
      ok: true,
      status: 200,
      url: 'https://quickchart.io/chart?c=test123'
    }),
    'api.telegram.org': (options) => {
      const body = JSON.parse(options.body);
      capturedMessage = body.text;
      return {
        ok: true,
        status: 200,
        json: async () => ({ ok: true, result: { message_id: 123 } })
      };
    }
  });
  
  global.fetch = mockFetch;
  
  await handleScheduled(chatId, env);
  
  // Securely verify chart URL by parsing and checking hostname exactly
  // Extract URL from Markdown format: [text](URL)
  const urlMatch = capturedMessage.match(/\[.*?\]\((https?:\/\/[^\)]+)\)/);
  assert(urlMatch, 'Message should contain a URL in Markdown format');
  const chartUrl = urlMatch[1];
  const urlObj = new URL(chartUrl);
  // Verify hostname exactly matches (prevents substring vulnerabilities)
  assert.equal(urlObj.hostname, 'quickchart.io', 'Chart URL hostname should be quickchart.io');
  
  assert(capturedMessage.includes('50.00%'), 'Message should include score');
  assert(capturedMessage.includes('NEUTRAL'), 'Message should include rating');
});

// Run tests
runner.run().catch(console.error);
