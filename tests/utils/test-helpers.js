/**
 * Test utilities and mocks for e2e testing
 */

import assert from 'node:assert';

/**
 * Create a mock KV namespace for testing
 */
export function createMockKV() {
  const store = new Map();
  
  return {
    async get(key) {
      return store.get(key) || null;
    },
    async put(key, value) {
      store.set(key, value);
    },
    async delete(key) {
      store.delete(key);
    },
    async list() {
      return { keys: Array.from(store.keys()).map(k => ({ name: k })) };
    },
    // Helper to clear all data
    clear() {
      store.clear();
    },
    // Helper to get all data for inspection
    getAll() {
      return Object.fromEntries(store);
    }
  };
}

/**
 * Create a mock fetch function
 */
export function createMockFetch(mockResponses = {}) {
  const defaultResponses = {
    'api.telegram.org': () => ({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({ ok: true, result: { message_id: 123 } })
    }),
    'production.dataviz.cnn.io': () => ({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({
        rating: 'Neutral',
        score: 50,
        timestamp: Date.now()
      })
    }),
    'quickchart.io': () => ({
      ok: true,
      status: 200,
      url: 'https://quickchart.io/chart?c=...'
    })
  };

  return async (url, options = {}) => {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;
    
    // Check for custom mock response
    if (mockResponses[url]) {
      const response = mockResponses[url](options);
      return typeof response === 'function' ? response() : response;
    }
    
    // Check for hostname-based mock
    for (const [key, handler] of Object.entries(mockResponses)) {
      if (hostname.includes(key) || url.includes(key)) {
        const response = handler(options);
        return typeof response === 'function' ? response() : response;
      }
    }
    
    // Use default mock
    for (const [key, handler] of Object.entries(defaultResponses)) {
      if (hostname.includes(key)) {
        const response = handler(options);
        return typeof response === 'function' ? response() : response;
      }
    }
    
    // Fallback: return error
    throw new Error(`No mock response for URL: ${url}`);
  };
}

/**
 * Create a mock environment
 */
export function createMockEnv(overrides = {}) {
  return {
    TELEGRAM_BOT_TOKEN_SECRET: 'test-bot-token-12345',
    TELEGRAM_WEBHOOK_SECRET: 'test-webhook-secret-67890',
    ADMIN_CHAT_ID: '999999999',
    FEAR_GREED_KV: createMockKV(),
    ...overrides
  };
}

/**
 * Test runner utility
 */
export class TestRunner {
  constructor() {
    this.tests = [];
    this.passed = 0;
    this.failed = 0;
  }

  test(name, fn) {
    this.tests.push({ name, fn });
  }

  async run() {
    console.log('\n🧪 Running E2E Test Suite\n');
    console.log('═'.repeat(60));
    
    for (const { name, fn } of this.tests) {
      try {
        await fn();
        console.log(`✅ ${name}`);
        this.passed++;
      } catch (error) {
        console.error(`❌ ${name}`);
        console.error(`   ${error.message}`);
        if (error.stack) {
          console.error(`   ${error.stack.split('\n')[1]?.trim()}`);
        }
        this.failed++;
      }
    }
    
    console.log('\n' + '═'.repeat(60));
    console.log(`\n📊 Test Results: ${this.passed} passed, ${this.failed} failed`);
    
    if (this.failed > 0) {
      process.exit(1);
    }
    
    return { passed: this.passed, failed: this.failed };
  }
}

/**
 * Assertion helpers
 */
export function assertSuccess(result, message = 'Operation should succeed') {
  assert(result.success === true, `${message}: Expected success=true, got ${result.success}`);
}

export function assertFailure(result, message = 'Operation should fail') {
  assert(result.success === false, `${message}: Expected success=false, got ${result.success}`);
}

export function assertEqual(actual, expected, message) {
  assert.strictEqual(actual, expected, message || `Expected ${expected}, got ${actual}`);
}

export function assertIncludes(array, item, message) {
  assert(array.includes(item), message || `Array should include ${item}`);
}

export function assertNotIncludes(array, item, message) {
  assert(!array.includes(item), message || `Array should not include ${item}`);
}

/**
 * Create a mock Telegram update payload
 */
export function createTelegramUpdate(command, chatId = 123456789) {
  return {
    message: {
      message_id: Math.floor(Math.random() * 1000000),
      from: {
        id: chatId,
        is_bot: false,
        first_name: 'Test',
        username: 'testuser'
      },
      chat: {
        id: chatId,
        type: 'private'
      },
      date: Math.floor(Date.now() / 1000),
      text: command
    }
  };
}
