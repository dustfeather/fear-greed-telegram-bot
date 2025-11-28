/**
 * Send message tests (Telegram API calls)
 */

import { sendTelegramMessage, sendHelpMessage, broadcastToAllSubscribers } from '../../../src/telegram/services/message-service.js';
import { sub } from '../../../src/user-management/services/subscription-service.js';
import { createMockEnv, createMockFetch } from '../../utils/test-helpers.js';

describe('Message Service', () => {
  let env;
  let originalFetch;

  beforeEach(() => {
    env = createMockEnv();
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('Send Message', () => {
    test('should send message successfully', async () => {
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

      expect(result.success).toBe(true);
      expect(result.status).toBe(200);
      expect(result.chatId).toBe(chatId);
      expect(result.message).toBe(message);
      expect(result.data?.ok).toBe(true);
    });

    test('should handle Telegram API failure', async () => {
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

      expect(result.success).toBe(false);
      expect(result.status).toBe(400);
    });

    test('should handle network errors', async () => {
      const chatId = 123456789;
      const message = 'Test message';

      // Mock network error
      const mockFetch = async () => {
        throw new Error('Network error');
      };

      global.fetch = mockFetch;

      const result = await sendTelegramMessage(chatId, message, env);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });

    test('should use Markdown format', async () => {
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

      expect(capturedPayload?.parse_mode).toBe('Markdown');
      expect(capturedPayload?.chat_id).toBe(chatId);
      expect(capturedPayload?.text).toBe(message);
    });
  });

  describe('Help Message', () => {
    test('should send help message with all commands', async () => {
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

      expect(result.success).toBe(true);
      expect(result.message).toContain('/start');
      expect(result.message).toContain('/stop');
      expect(result.message).toContain('/now');
      expect(result.message).toContain('/help');
    });
  });

  describe('Broadcast', () => {
    test('should handle broadcast to no subscribers', async () => {
      const message = 'Test broadcast message';

      // No subscribers by default (empty D1 database)
      const result = await broadcastToAllSubscribers(message, env);

      expect(result.totalSubscribers).toBe(0);
      expect(result.successful).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    test('should broadcast to single subscriber', async () => {
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

      expect(result.totalSubscribers).toBe(1);
      expect(result.successful).toBe(1);
      expect(result.failed).toBe(0);
      expect(result.errors).toHaveLength(0);
      expect(telegramCallCount).toBe(1);
    });

    test('should broadcast to multiple subscribers', async () => {
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

      expect(result.totalSubscribers).toBe(3);
      expect(result.successful).toBe(3);
      expect(result.failed).toBe(0);
      expect(result.errors).toHaveLength(0);
      expect(telegramCallCount).toBe(3);
    });

    test('should handle partial failures', async () => {
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

      expect(result.totalSubscribers).toBe(3);
      expect(result.successful).toBe(2);
      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(String(result.errors[0].chatId)).toBe('222222222');
    });

    test('should handle network errors', async () => {
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

      expect(result.totalSubscribers).toBe(2);
      // With batching, both are processed but one should fail
      expect(result.successful).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].error).toContain('Network error');
    });

    test('should handle D1 errors', async () => {
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

      expect(result.totalSubscribers).toBe(0);
      expect(result.successful).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.errors).toHaveLength(1);
      // Error message is wrapped by D1 utilities
      expect(result.errors[0].error).toMatch(/D1 operation failed|D1 error/);
    });
  });
});
