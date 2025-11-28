/**
 * Subscription tests (sub/unsub functionality)
 */

import { sub, unsub } from '../../../src/user-management/services/subscription-service.js';
import { TestRunner, createMockEnv, assertSuccess, assertFailure, assertEqual, assertIncludes, assertNotIncludes } from '../../utils/test-helpers.js';
import assert from 'node:assert';

const runner = new TestRunner();

// Test 1: Subscribe new user
runner.test('Subscribe new user', async () => {
  const env = createMockEnv();
  const chatId = 123456789;

  const result = await sub(chatId, env);

  assertSuccess(result, 'Subscription should succeed');
  assertEqual(result.wasAlreadySubscribed, false, 'User should not be already subscribed');
  assertEqual(result.totalSubscribers, 1, 'Should have 1 subscriber');
  assertIncludes(result.allSubscribers, String(chatId), 'Chat ID should be in subscribers list');
});

// Test 2: Subscribe already subscribed user
runner.test('Subscribe already subscribed user', async () => {
  const env = createMockEnv();
  const chatId = 123456789;

  // Subscribe first time
  await sub(chatId, env);

  // Subscribe second time
  const result = await sub(chatId, env);

  assertSuccess(result, 'Subscription should still succeed');
  assertEqual(result.wasAlreadySubscribed, true, 'User should be already subscribed');
  assertEqual(result.totalSubscribers, 1, 'Should still have 1 subscriber (no duplicates)');
});

// Test 3: Unsubscribe subscribed user
runner.test('Unsubscribe subscribed user', async () => {
  const env = createMockEnv();
  const chatId = 123456789;

  // Subscribe first
  await sub(chatId, env);

  // Then unsubscribe
  const result = await unsub(chatId, env);

  assertSuccess(result, 'Unsubscription should succeed');
  assertEqual(result.wasSubscribed, true, 'User should have been subscribed');
  assertEqual(result.totalSubscribers, 0, 'Should have 0 subscribers after unsubscribe');
  assertNotIncludes(result.allSubscribers, String(chatId), 'Chat ID should not be in subscribers list');
});

// Test 4: Unsubscribe non-subscribed user
runner.test('Unsubscribe non-subscribed user', async () => {
  const env = createMockEnv();
  const chatId = 123456789;

  const result = await unsub(chatId, env);

  assertSuccess(result, 'Unsubscription should still succeed');
  assertEqual(result.wasSubscribed, false, 'User should not have been subscribed');
  assertEqual(result.totalSubscribers, 0, 'Should have 0 subscribers');
});

// Test 5: Multiple users subscribe
runner.test('Multiple users subscribe', async () => {
  const env = createMockEnv();
  const chatId1 = 111111111;
  const chatId2 = 222222222;
  const chatId3 = 333333333;

  const result1 = await sub(chatId1, env);
  const result2 = await sub(chatId2, env);
  const result3 = await sub(chatId3, env);

  assertEqual(result3.allSubscribers.length, 3, 'Should have 3 subscribers');
  assertIncludes(result3.allSubscribers, String(chatId1), 'Chat ID 1 should be in list');
  assertIncludes(result3.allSubscribers, String(chatId2), 'Chat ID 2 should be in list');
  assertIncludes(result3.allSubscribers, String(chatId3), 'Chat ID 3 should be in list');
});

// Test 6: Subscribe and unsubscribe multiple times
runner.test('Subscribe and unsubscribe multiple times', async () => {
  const env = createMockEnv();
  const chatId = 123456789;

  await sub(chatId, env);
  await unsub(chatId, env);
  await sub(chatId, env);
  const result = await unsub(chatId, env);

  assertEqual(result.allSubscribers.length, 0, 'Should have 0 subscribers after final unsubscribe');
  assertNotIncludes(result.allSubscribers, String(chatId), 'Chat ID should not be in list');
});

// Test 7: Handle D1 errors gracefully
runner.test('Handle D1 errors gracefully', async () => {
  const env = createMockEnv();
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

  assertFailure(result, 'Subscription should fail when D1 errors');
  assert(result.error && result.error.includes('D1'), 'Error message should mention D1 error');
});

// Run tests
runner.run().catch(console.error);
