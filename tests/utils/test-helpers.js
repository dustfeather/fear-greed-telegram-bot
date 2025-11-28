/**
 * Test utilities and mocks for Jest testing
 */

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
        score: 50.0,
        timestamp: new Date().toISOString(),
        previous_close: 48.5,
        previous_1_week: 52.0,
        previous_1_month: 45.0,
        previous_1_year: 55.0
      })
    }),
    'quickchart.io': () => ({
      ok: true,
      status: 200,
      url: 'https://quickchart.io/chart?c=...'
    })
  };

  /**
   * Securely check if hostname matches a domain (exact match only)
   * Prevents partial string matching vulnerabilities (e.g., "example.com.evil.com" matching "example.com")
   * @param {string} hostname - The hostname to check
   * @param {string} domain - The domain to match against
   * @returns {boolean} - True if hostname exactly matches domain
   */
  function matchesHostname(hostname, domain) {
    // Exact match only - prevents substring vulnerabilities
    return hostname === domain;
  }

  return async (url, options = {}) => {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;

    // Check for custom mock response (exact URL match)
    if (mockResponses[url]) {
      const response = mockResponses[url](options);
      return typeof response === 'function' ? response() : response;
    }

    // Check for hostname-based mock (secure domain matching)
    for (const [key, handler] of Object.entries(mockResponses)) {
      // Try hostname matching first (most secure)
      if (matchesHostname(hostname, key)) {
        const response = handler(options);
        return typeof response === 'function' ? response() : response;
      }
      // Fallback: check if key is a full URL and matches
      try {
        const keyUrl = new URL(key);
        if (keyUrl.hostname === hostname && keyUrl.pathname === urlObj.pathname) {
          const response = handler(options);
          return typeof response === 'function' ? response() : response;
        }
      } catch {
        // key is not a URL, skip
      }
    }

    // Use default mock (secure domain matching)
    for (const [key, handler] of Object.entries(defaultResponses)) {
      if (matchesHostname(hostname, key)) {
        const response = handler(options);
        return typeof response === 'function' ? response() : response;
      }
    }

    // Fallback: return error
    // This error should cause tests to fail - it indicates missing mock setup
    const error = new Error(`No mock response for URL: ${url}`);
    error.name = 'MockResponseError';
    throw error;
  };
}

/**
 * Create a mock D1 database with in-memory storage for all tables
 */
export function createMockD1() {
  // In-memory storage for all tables
  const users = new Map();
  const watchlists = new Map();
  const executions = new Map();
  const activePositions = new Map();
  const cache = new Map();

  let executionIdCounter = 1;
  let watchlistIdCounter = 1;
  let positionIdCounter = 1;

  const db = {
    prepare: (query) => {
      const normalizedQuery = query.trim().toLowerCase();

      return {
        bind: (...params) => {
          return {
            run: async () => {
              // ===== USERS TABLE =====
              if (normalizedQuery.includes('insert into users')) {
                const [chatId, createdAt, updatedAt] = params;
                users.set(chatId, {
                  chat_id: chatId,
                  subscription_status: 1,
                  created_at: createdAt,
                  updated_at: updatedAt
                });
                return { success: true, meta: { changes: 1 } };
              }

              if (normalizedQuery.includes('update users set subscription_status = 1')) {
                const [updatedAt, chatId] = params;
                const user = users.get(chatId);
                if (user) {
                  user.subscription_status = 1;
                  user.updated_at = updatedAt;
                  return { success: true, meta: { changes: 1 } };
                }
                return { success: true, meta: { changes: 0 } };
              }

              if (normalizedQuery.includes('update users set subscription_status = 0')) {
                const [updatedAt, chatId] = params;
                const user = users.get(chatId);
                if (user && user.subscription_status === 1) {
                  user.subscription_status = 0;
                  user.updated_at = updatedAt;
                  return { success: true, meta: { changes: 1 } };
                }
                return { success: true, meta: { changes: 0 } };
              }

              // ===== WATCHLISTS TABLE =====
              if (normalizedQuery.includes('insert into watchlists')) {
                const [chatId, ticker, createdAt] = params;
                const key = `${chatId}:${ticker}`;
                if (!watchlists.has(key)) {
                  watchlists.set(key, {
                    id: watchlistIdCounter++,
                    chat_id: chatId,
                    ticker: ticker,
                    created_at: createdAt
                  });
                  return { success: true, meta: { changes: 1 } };
                }
                return { success: true, meta: { changes: 0 } };
              }

              if (normalizedQuery.includes('delete from watchlists')) {
                const [chatId, ticker] = params;
                const key = `${chatId}:${ticker}`;
                if (watchlists.has(key)) {
                  watchlists.delete(key);
                  return { success: true, meta: { changes: 1 } };
                }
                return { success: true, meta: { changes: 0 } };
              }

              // ===== EXECUTIONS TABLE =====
              if (normalizedQuery.includes('insert into executions')) {
                const [chatId, signalType, ticker, executionPrice, signalPrice, executionDate, createdAt] = params;
                const id = executionIdCounter++;
                executions.set(id, {
                  id,
                  chat_id: chatId,
                  signal_type: signalType,
                  ticker: ticker,
                  execution_price: executionPrice,
                  signal_price: signalPrice,
                  execution_date: executionDate,
                  created_at: createdAt
                });
                return { success: true, meta: { changes: 1, last_row_id: id } };
              }

              // ===== ACTIVE_POSITIONS TABLE =====
              if (normalizedQuery.includes('insert into active_positions')) {
                const [chatId, ticker, entryPrice, createdAt, updatedAt] = params;
                const key = `${chatId}:${ticker}`;
                if (!activePositions.has(key)) {
                  activePositions.set(key, {
                    id: positionIdCounter++,
                    chat_id: chatId,
                    ticker: ticker,
                    entry_price: entryPrice,
                    created_at: createdAt,
                    updated_at: updatedAt
                  });
                  return { success: true, meta: { changes: 1 } };
                }
                return { success: true, meta: { changes: 0 } };
              }

              if (normalizedQuery.includes('delete from active_positions')) {
                // Handle both "WHERE chat_id = ? AND ticker = ?" and "WHERE chat_id = ?"
                if (params.length === 1) {
                  // Delete all positions for a user
                  const [chatId] = params;
                  let deleted = 0;
                  for (const [key, pos] of activePositions.entries()) {
                    if (String(pos.chat_id) === String(chatId)) {
                      activePositions.delete(key);
                      deleted++;
                    }
                  }
                  return { success: true, meta: { changes: deleted } };
                } else {
                  // Delete specific position
                  const [chatId, ticker] = params;
                  const key = `${chatId}:${ticker}`;
                  if (activePositions.has(key)) {
                    activePositions.delete(key);
                    return { success: true, meta: { changes: 1 } };
                  }
                  return { success: true, meta: { changes: 0 } };
                }
              }

              // ===== CACHE TABLE =====
              if (normalizedQuery.includes('insert into cache') || normalizedQuery.includes('insert or replace into cache')) {
                const [cacheKey, cacheValue, expiresAt, updatedAt] = params;
                cache.set(cacheKey, {
                  cache_key: cacheKey,
                  cache_value: cacheValue,
                  expires_at: expiresAt,
                  updated_at: updatedAt
                });
                return { success: true, meta: { changes: 1 } };
              }

              if (normalizedQuery.includes('delete from cache where cache_key')) {
                const [cacheKey] = params;
                if (cache.has(cacheKey)) {
                  cache.delete(cacheKey);
                  return { success: true, meta: { changes: 1 } };
                }
                return { success: true, meta: { changes: 0 } };
              }

              return { success: true, meta: { changes: 0 } };
            },

            first: async () => {
              // ===== USERS TABLE =====
              if (normalizedQuery.includes('select cast(subscription_status as integer)') || normalizedQuery.includes('select subscription_status from users')) {
                const [chatId] = params;
                const user = users.get(chatId);
                return user ? { subscription_status: user.subscription_status } : null;
              }

              if (normalizedQuery.includes('select 1 from users')) {
                const [chatId] = params;
                const user = users.get(chatId);
                return (user && user.subscription_status === 1) ? { '1': 1 } : null;
              }

              // ===== WATCHLISTS TABLE =====
              if (normalizedQuery.includes('select * from watchlists') && normalizedQuery.includes('limit 1')) {
                const [chatId, ticker] = params;
                const key = `${chatId}:${ticker}`;
                return watchlists.get(key) || null;
              }

              // ===== EXECUTIONS TABLE =====
              if (normalizedQuery.includes('from executions') && normalizedQuery.includes('order by execution_date desc')) {
                const [chatId, ticker] = params;
                const userExecutions = Array.from(executions.values())
                  .filter(e => String(e.chat_id) === String(chatId) && (!ticker || e.ticker === ticker))
                  .sort((a, b) => b.execution_date - a.execution_date);
                return userExecutions[0] || null;
              }

              // ===== ACTIVE_POSITIONS TABLE =====
              if (normalizedQuery.includes('from active_positions')) {
                if (params.length === 1) {
                  // Get any position for user
                  const [chatId] = params;
                  for (const pos of activePositions.values()) {
                    if (String(pos.chat_id) === String(chatId)) {
                      return pos;
                    }
                  }
                  return null;
                } else {
                  // Get specific position
                  const [chatId, ticker] = params;
                  const key = `${chatId}:${ticker}`;
                  return activePositions.get(key) || null;
                }
              }

              // ===== CACHE TABLE =====
              if (normalizedQuery.includes('select * from cache')) {
                const [cacheKey] = params;
                const entry = cache.get(cacheKey);
                if (entry && entry.expires_at > Date.now()) {
                  return entry;
                }
                return null;
              }

              return null;
            },

            all: async () => {
              // ===== USERS TABLE =====
              if (normalizedQuery.includes('select chat_id from users')) {
                const results = Array.from(users.values())
                  .filter(user => user.subscription_status === 1)
                  .map(user => ({ chat_id: user.chat_id }));
                return { results };
              }

              // ===== WATCHLISTS TABLE =====
              if (normalizedQuery.includes('select ticker from watchlists')) {
                const [chatId] = params;
                const results = Array.from(watchlists.values())
                  .filter(w => w.chat_id === chatId)
                  .map(w => ({ ticker: w.ticker }));
                return { results };
              }

              // ===== EXECUTIONS TABLE =====
              if (normalizedQuery.includes('from executions')) {
                const [chatId, ticker] = params;
                let results = Array.from(executions.values())
                  .filter(e => String(e.chat_id) === String(chatId));

                if (ticker) {
                  results = results.filter(e => e.ticker === ticker);
                }

                results.sort((a, b) => b.execution_date - a.execution_date);
                return { results };
              }

              return { results: [] };
            },

            raw: async () => []
          };
        },

        run: async () => ({ success: true, meta: { changes: 0 } }),

        first: async () => null,

        all: async () => {
          if (normalizedQuery.includes('select chat_id from users')) {
            const results = Array.from(users.values())
              .filter(user => user.subscription_status === 1)
              .map(user => ({ chat_id: user.chat_id }));
            return { results };
          }
          return { results: [] };
        },

        raw: async () => []
      };
    },

    batch: async (statements) => {
      return statements.map(() => ({ success: true }));
    },

    exec: async (query) => {
      return { success: true };
    },

    // Helper methods for testing
    _clear: () => {
      users.clear();
      watchlists.clear();
      executions.clear();
      activePositions.clear();
      cache.clear();
      executionIdCounter = 1;
      watchlistIdCounter = 1;
      positionIdCounter = 1;
    },

    _getUsers: () => Array.from(users.values()),
    _getWatchlists: () => Array.from(watchlists.values()),
    _getExecutions: () => Array.from(executions.values()),
    _getActivePositions: () => Array.from(activePositions.values()),
    _getCache: () => Array.from(cache.values())
  };

  return db;
}

/**
 * Create a mock environment
 */
export function createMockEnv(overrides = {}) {
  return {
    TELEGRAM_BOT_TOKEN_SECRET: 'test-bot-token-12345',
    TELEGRAM_WEBHOOK_SECRET: 'test-webhook-secret-67890',
    ADMIN_CHAT_ID: '999999999',
    FEAR_GREED_D1: createMockD1(),
    ...overrides
  };
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

/**
 * Assert that two values are equal
 */
export function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(message || `Expected ${expected} but got ${actual}`);
  }
}

/**
 * Assert that a string includes a substring
 */
export function assertIncludes(str, substring, message) {
  if (!str.includes(substring)) {
    throw new Error(message || `Expected "${str}" to include "${substring}"`);
  }
}

/**
 * Assert that a string does not include a substring
 */
export function assertNotIncludes(str, substring, message) {
  if (str.includes(substring)) {
    throw new Error(message || `Expected "${str}" to not include "${substring}"`);
  }
}

/**
 * Test runner utility for property-based tests
 */
export class TestRunner {
  constructor(env) {
    this.env = env;
  }

  async run(testFn) {
    return await testFn(this.env);
  }
}
