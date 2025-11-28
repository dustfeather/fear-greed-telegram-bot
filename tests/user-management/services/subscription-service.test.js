/**
 * Subscription tests (sub/unsub functionality)
 */

import { sub, unsub } from '../../../src/user-management/services/subscription-service.js';
import { createMockEnv } from '../../utils/test-helpers.js';

describe('Subscription Service', () => {
  let env;

  beforeEach(() => {
    env = createMockEnv();
  });

  test('should subscribe new user', async () => {
    const chatId = 123456789;

    const result = await sub(chatId, env);

    expect(result.success).toBe(true);
    expect(result.wasAlreadySubscribed).toBe(false);
    expect(result.totalSubscribers).toBe(1);
    expect(result.allSubscribers).toContain(String(chatId));
  });

  test('should handle already subscribed user', async () => {
    const chatId = 123456789;

    // Subscribe first time
    await sub(chatId, env);

    // Subscribe second time
    const result = await sub(chatId, env);

    expect(result.success).toBe(true);
    expect(result.wasAlreadySubscribed).toBe(true);
    expect(result.totalSubscribers).toBe(1);
  });

  test('should unsubscribe subscribed user', async () => {
    const chatId = 123456789;

    // Subscribe first
    await sub(chatId, env);

    // Then unsubscribe
    const result = await unsub(chatId, env);

    expect(result.success).toBe(true);
    expect(result.wasSubscribed).toBe(true);
    expect(result.totalSubscribers).toBe(0);
    expect(result.allSubscribers).not.toContain(String(chatId));
  });

  test('should handle unsubscribe of non-subscribed user', async () => {
    const chatId = 123456789;

    const result = await unsub(chatId, env);

    expect(result.success).toBe(true);
    expect(result.wasSubscribed).toBe(false);
    expect(result.totalSubscribers).toBe(0);
  });

  test('should handle multiple users subscribing', async () => {
    const chatId1 = 111111111;
    const chatId2 = 222222222;
    const chatId3 = 333333333;

    const result1 = await sub(chatId1, env);
    const result2 = await sub(chatId2, env);
    const result3 = await sub(chatId3, env);

    expect(result3.allSubscribers).toHaveLength(3);
    expect(result3.allSubscribers).toContain(String(chatId1));
    expect(result3.allSubscribers).toContain(String(chatId2));
    expect(result3.allSubscribers).toContain(String(chatId3));
  });

  test('should handle subscribe and unsubscribe multiple times', async () => {
    const chatId = 123456789;

    await sub(chatId, env);
    await unsub(chatId, env);
    await sub(chatId, env);
    const result = await unsub(chatId, env);

    expect(result.allSubscribers).toHaveLength(0);
    expect(result.allSubscribers).not.toContain(String(chatId));
  });

  test('should handle D1 errors gracefully', async () => {
    // Create a mock D1 that throws errors
    const brokenD1 = {
      prepare: () => ({
        bind: () => ({
          run: async () => { throw new Error('D1 error'); },
          first: async () => { throw new Error('D1 error'); },
          all: async () => { throw new Error('D1 error'); }
        })
      })
    };
    env.FEAR_GREED_D1 = brokenD1;

    const result = await sub(123456789, env);

    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
    expect(result.error).toContain('D1');
  });
});
