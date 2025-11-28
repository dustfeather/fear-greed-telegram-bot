/**
 * Bank Holiday Detection Integration Tests
 *
 * Tests for holiday detection integration with scheduled jobs and manual requests.
 * Includes property-based tests for scheduled job behavior.
 */

import { handleScheduled } from '../../../src/scheduler/handlers/scheduled-handler.js';
import { isBankHoliday, isTradingDay } from '../../../src/trading/utils/holidays.js';
import { setWatchlist } from '../../../src/user-management/services/watchlist-service.js';
import { TestRunner } from '../../utils/test-helpers.js';
import fc from 'fast-check';


// Mock environment for testing
function createMockEnv() {
  return {
    FEAR_GREED_D1: {
      prepare: (query) => ({
        bind: (...params) => ({
          run: async () => ({ success: true }),
          first: async () => null,
          all: async () => ({ results: [] }),
          raw: async () => []
        }),
        run: async () => ({ success: true }),
        first: async () => null,
        all: async () => ({ results: [] }),
        raw: async () => []
      }),
      batch: async (statements) => statements.map(() => ({ success: true })),
      exec: async (query) => ({ success: true })
    },
    TELEGRAM_BOT_TOKEN: 'test-token',
    TELEGRAM_WEBHOOK_SECRET: 'test-secret',
    ADMIN_CHAT_ID: '12345'
  };
}

// Mock console.log to capture log messages
let logMessages = [];
const originalLog = console.log;

function startCapturingLogs() {
  logMessages = [];
  console.log = (...args) => {
    logMessages.push(args.join(' '));
    originalLog(...args);
  };
}

function stopCapturingLogs() {
  console.log = originalLog;
  return logMessages;
}

// ============================================================================
// Integration Tests
// ============================================================================

test('Scheduled job skips execution on Christmas 2024', async () => {
  const env = createMockEnv();

  // Mock the current date to be Christmas 2024
  const originalDate = Date;
  global.Date = class extends originalDate {
    constructor(...args) {
      if (args.length === 0) {
        return new originalDate(originalDate.UTC(2024, 11, 25));
      }
      return new originalDate(...args);
    }
    static now() {
      return new originalDate(originalDate.UTC(2024, 11, 25)).getTime();
    }
  };

  startCapturingLogs();

  try {
    // Call handleScheduled with null chatId (broadcast mode)
    await handleScheduled(null, env);

    const logs = stopCapturingLogs();

    // Verify that execution was skipped
    const skippedLog = logs.find(log => log.includes('Scheduled execution skipped'));
    expect(skippedLog).toBeTruthy(); // Should log that execution was skipped
    expect(skippedLog.includes('Christmas Day')).toBeTruthy(); // Should mention Christmas Day in log
  } finally {
    global.Date = originalDate;
    stopCapturingLogs();
  }
});

test('Scheduled job skips execution on Thanksgiving 2025', async () => {
  const env = createMockEnv();

  // Mock the current date to be Thanksgiving 2025
  const originalDate = Date;
  global.Date = class extends originalDate {
    constructor(...args) {
      if (args.length === 0) {
        return new originalDate(originalDate.UTC(2025, 10, 27));
      }
      return new originalDate(...args);
    }
    static now() {
      return new originalDate(originalDate.UTC(2025, 10, 27)).getTime();
    }
  };

  startCapturingLogs();

  try {
    await handleScheduled(null, env);

    const logs = stopCapturingLogs();

    const skippedLog = logs.find(log => log.includes('Scheduled execution skipped'));
    expect(skippedLog).toBeTruthy(); // Should log that execution was skipped
    expect(skippedLog.includes('Thanksgiving Day')).toBeTruthy(); // Should mention Thanksgiving in log
  } finally {
    global.Date = originalDate;
    stopCapturingLogs();
  }
});

test('Manual /now request does not skip on holiday', async () => {
  const env = createMockEnv();
  const chatId = 123456;

  // Initialize user with default watchlist
  await setWatchlist(env, chatId, ['SPY']);

  // Mock the current date to be Christmas 2024
  const originalDate = Date;
  global.Date = class extends originalDate {
    constructor(...args) {
      if (args.length === 0) {
        return new originalDate(originalDate.UTC(2024, 11, 25));
      }
      return new originalDate(...args);
    }
    static now() {
      return new originalDate(originalDate.UTC(2024, 11, 25)).getTime();
    }
  };

  startCapturingLogs();

  try {
    // Call handleScheduled with specific chatId (manual request mode)
    // This should NOT skip execution even on a holiday
    await handleScheduled(chatId, env);

    const logs = stopCapturingLogs();

    // Verify that execution was NOT skipped
    const skippedLog = logs.find(log => log.includes('Scheduled execution skipped'));
    expect(!skippedLog).toBeTruthy(); // Manual request should not skip execution on holiday
  } finally {
    global.Date = originalDate;
    stopCapturingLogs();
  }
});

// ============================================================================
// Property-Based Tests
// ============================================================================

/**
 * **Feature: bank-holiday-detection, Property 1: Scheduled job skips all bank holidays**
 * **Validates: Requirements 1.1**
 *
 * For any bank holiday date, when the scheduled job runs with that date,
 * the system should not send any trading signals to subscribers.
 */
test('Property 1: Scheduled job skips all bank holidays', async () => {
  const result = await fc.assert(
    fc.asyncProperty(
      fc.integer({ min: 2020, max: 2030 }),
      fc.integer({ min: 0, max: 11 }),
      fc.integer({ min: 1, max: 28 }),
      async (year, month, day) => {
        const testDate = new Date(Date.UTC(year, month, day));
        const holiday = isBankHoliday(testDate);

        // Only test if this is actually a holiday
        if (!holiday) {
          return true;
        }

        const env = createMockEnv();

        // Mock the current date
        const originalDate = Date;
        global.Date = class extends originalDate {
          constructor(...args) {
            if (args.length === 0) {
              return new originalDate(testDate);
            }
            return new originalDate(...args);
          }
          static now() {
            return testDate.getTime();
          }
        };

        startCapturingLogs();

        try {
          // Call handleScheduled in broadcast mode (null chatId)
          await handleScheduled(null, env);

          const logs = stopCapturingLogs();

          // Verify execution was skipped
          const skippedLog = logs.find(log => log.includes('Scheduled execution skipped'));
          expect(skippedLog).toBeTruthy(); // Should skip execution on holiday

          return true;
        } finally {
          global.Date = originalDate;
          stopCapturingLogs();
        }
      }
    ),
    { numRuns: 100 }
  );

  expect(result === null || result === undefined).toBeTruthy(); // Property should hold for all test cases
});

/**
 * **Feature: bank-holiday-detection, Property 2: Scheduled job runs on all trading days**
 * **Validates: Requirements 1.2**
 *
 * For any trading day (weekday that is not a bank holiday), when the scheduled job runs
 * with that date, the system should send trading signals to subscribers.
 */
test('Property 2: Scheduled job runs on all trading days', async () => {
  const result = await fc.assert(
    fc.asyncProperty(
      fc.integer({ min: 2020, max: 2030 }),
      fc.integer({ min: 0, max: 11 }),
      fc.integer({ min: 1, max: 28 }),
      async (year, month, day) => {
        const testDate = new Date(Date.UTC(year, month, day));

        // Only test if this is a trading day
        if (!isTradingDay(testDate)) {
          return true;
        }

        const env = createMockEnv();

        // Mock the current date
        const originalDate = Date;
        global.Date = class extends originalDate {
          constructor(...args) {
            if (args.length === 0) {
              return new originalDate(testDate);
            }
            return new originalDate(...args);
          }
          static now() {
            return testDate.getTime();
          }
        };

        startCapturingLogs();

        try {
          // Call handleScheduled in broadcast mode
          await handleScheduled(null, env);

          const logs = stopCapturingLogs();

          // Verify execution was NOT skipped
          const skippedLog = logs.find(log => log.includes('Scheduled execution skipped'));
          expect(!skippedLog).toBeTruthy(); // Should not skip execution on trading day

          return true;
        } finally {
          global.Date = originalDate;
          stopCapturingLogs();
        }
      }
    ),
    { numRuns: 100 }
  );

  expect(result === null || result === undefined).toBeTruthy(); // Property should hold for all test cases
});

/**
 * **Feature: bank-holiday-detection, Property 4: Holiday detection logs skipped executions**
 * **Validates: Requirements 1.5**
 *
 * For any bank holiday date, when the scheduled job runs with that date,
 * the system should log a message indicating the execution was skipped due to the holiday.
 */
test('Property 4: Holiday detection logs skipped executions', async () => {
  const result = await fc.assert(
    fc.asyncProperty(
      fc.integer({ min: 2020, max: 2030 }),
      fc.integer({ min: 0, max: 11 }),
      fc.integer({ min: 1, max: 28 }),
      async (year, month, day) => {
        const testDate = new Date(Date.UTC(year, month, day));
        const holiday = isBankHoliday(testDate);

        // Only test if this is actually a holiday
        if (!holiday) {
          return true;
        }

        const env = createMockEnv();

        // Mock the current date
        const originalDate = Date;
        global.Date = class extends originalDate {
          constructor(...args) {
            if (args.length === 0) {
              return new originalDate(testDate);
            }
            return new originalDate(...args);
          }
          static now() {
            return testDate.getTime();
          }
        };

        startCapturingLogs();

        try {
          await handleScheduled(null, env);

          const logs = stopCapturingLogs();

          // Verify proper logging
          const skippedLog = logs.find(log =>
            log.includes('Scheduled execution skipped') &&
            log.includes(holiday.name)
          );

          expect(skippedLog).toBeTruthy(); // Should log skipped execution with holiday name

          return true;
        } finally {
          global.Date = originalDate;
          stopCapturingLogs();
        }
      }
    ),
    { numRuns: 100 }
  );

  expect(result === null || result === undefined).toBeTruthy(); // Property should hold for all test cases
});

/**
 * **Feature: bank-holiday-detection, Property 3: Manual requests on holidays include market closed notice**
 * **Validates: Requirements 1.3**
 *
 * For any bank holiday date, when a user requests a signal via /now on that date,
 * the response message should contain a notice that markets are closed.
 */
test('Property 3: Manual requests on holidays include market closed notice', async () => {
  // Import the index module to test the /now command
  const index = await import('../../../src/index.js');

  const result = await fc.assert(
    fc.asyncProperty(
      fc.integer({ min: 2020, max: 2030 }),
      fc.integer({ min: 0, max: 11 }),
      fc.integer({ min: 1, max: 28 }),
      async (year, month, day) => {
        const testDate = new Date(Date.UTC(year, month, day));
        const holiday = isBankHoliday(testDate);

        // Only test if this is actually a holiday
        if (!holiday) {
          return true;
        }

        const env = createMockEnv();
        const chatId = 123456789;

        // Initialize user with default watchlist
        await setWatchlist(env, chatId, ['SPY']);

        // Track Telegram messages sent
        const telegramMessages = [];

        // Mock fetch to capture Telegram API calls
        const mockFetch = async (url, options = {}) => {
          const urlObj = new URL(url);

          if (urlObj.hostname === 'api.telegram.org') {
            // Capture the message being sent
            if (options.body) {
              try {
                const body = JSON.parse(options.body);
                if (body.text) {
                  telegramMessages.push(body.text);
                }
              } catch (e) {
                // Ignore parse errors
              }
            }

            return {
              ok: true,
              status: 200,
              json: async () => ({ ok: true, result: { message_id: 123 } })
            };
          }

          // Mock other APIs
          if (urlObj.hostname === 'production.dataviz.cnn.io') {
            return {
              ok: true,
              status: 200,
              json: async () => ({
                rating: 'Neutral',
                score: 50.0,
                timestamp: new Date().toISOString()
              })
            };
          }

          if (urlObj.hostname === 'query1.finance.yahoo.com') {
            return {
              ok: true,
              status: 200,
              json: async () => ({
                chart: {
                  result: [{
                    meta: { regularMarketPrice: 400.0 },
                    indicators: {
                      quote: [{
                        close: [400.0, 401.0, 402.0, 403.0, 404.0]
                      }]
                    }
                  }]
                }
              })
            };
          }

          if (urlObj.hostname === 'quickchart.io') {
            return {
              ok: true,
              status: 200,
              url: 'https://quickchart.io/chart?c=...'
            };
          }

          throw new Error(`Unmocked URL: ${url}`);
        };

        // Mock the current date
        const originalDate = Date;
        const originalFetch = global.fetch;

        global.Date = class extends originalDate {
          constructor(...args) {
            if (args.length === 0) {
              return new originalDate(testDate);
            }
            return new originalDate(...args);
          }
          static now() {
            return testDate.getTime();
          }
        };

        global.fetch = mockFetch;

        try {
          // Create /now command request
          const update = {
            message: {
              message_id: 1,
              from: { id: chatId, is_bot: false, first_name: 'Test' },
              chat: { id: chatId, type: 'private' },
              date: Math.floor(testDate.getTime() / 1000),
              text: '/now'
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

          // Execute the request
          await index.default.fetch(request, env, { waitUntil: () => {} });

          // Verify that at least one message contains the market closed notice
          const hasMarketClosedNotice = telegramMessages.some(msg =>
            msg.includes('Market Closed') &&
            msg.includes(holiday.name)
          );

          expect(hasMarketClosedNotice).toBeTruthy(); // Manual request on holiday should include market closed notice

          return true;
        } finally {
          global.Date = originalDate;
          global.fetch = originalFetch;
        }
      }
    ),
    { numRuns: 100 }
  );

  expect(result === null || result === undefined).toBeTruthy(); // Property should hold for all test cases
});

// Empty describe block removed - no additional tests needed
