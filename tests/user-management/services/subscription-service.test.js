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
  assertIncludes(result.allSubscribers, chatId, 'Chat ID should be in subscribers list');

  // Verify in KV storage
  const chatIdsString = await env.FEAR_GREED_KV.get('chat_ids');
  const chatIds = JSON.parse(chatIdsString);
  assertIncludes(chatIds, chatId, 'Chat ID should be stored in KV');
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

  // Verify no duplicates in KV
  const chatIdsString = await env.FEAR_GREED_KV.get('chat_ids');
  const chatIds = JSON.parse(chatIdsString);
  const count = chatIds.filter(id => id === chatId).length;
  assertEqual(count, 1, 'Should have exactly one instance of chat ID');
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
  assertNotIncludes(result.allSubscribers, chatId, 'Chat ID should not be in subscribers list');

  // Verify removed from KV
  const chatIdsString = await env.FEAR_GREED_KV.get('chat_ids');
  const chatIds = JSON.parse(chatIdsString);
  assertNotIncludes(chatIds, chatId, 'Chat ID should be removed from KV');
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

  await sub(chatId1, env);
  await sub(chatId2, env);
  await sub(chatId3, env);

  const chatIdsString = await env.FEAR_GREED_KV.get('chat_ids');
  const chatIds = JSON.parse(chatIdsString);

  assertEqual(chatIds.length, 3, 'Should have 3 subscribers');
  assertIncludes(chatIds, chatId1, 'Chat ID 1 should be in list');
  assertIncludes(chatIds, chatId2, 'Chat ID 2 should be in list');
  assertIncludes(chatIds, chatId3, 'Chat ID 3 should be in list');
});

// Test 6: Subscribe and unsubscribe multiple times
runner.test('Subscribe and unsubscribe multiple times', async () => {
  const env = createMockEnv();
  const chatId = 123456789;

  await sub(chatId, env);
  await unsub(chatId, env);
  await sub(chatId, env);
  await unsub(chatId, env);

  const chatIdsString = await env.FEAR_GREED_KV.get('chat_ids');
  const chatIds = JSON.parse(chatIdsString);

  assertEqual(chatIds.length, 0, 'Should have 0 subscribers after final unsubscribe');
  assertNotIncludes(chatIds, chatId, 'Chat ID should not be in list');
});

// Test 7: Handle KV errors gracefully
runner.test('Handle KV errors gracefully', async () => {
  const env = createMockEnv();
  // Create a mock KV that throws errors
  const brokenKV = {
    get: async () => { throw new Error('KV error'); },
    put: async () => { throw new Error('KV error'); }
  };
  env.FEAR_GREED_KV = brokenKV;

  const result = await sub(123456789, env);

  assertFailure(result, 'Subscription should fail when KV errors');
  // Error message might be wrapped by KV utilities
  assert(result.error && (result.error.includes('KV error') || result.error.includes('Failed to add chat ID')), 'Error message should mention KV error');
});

// Run tests
runner.run().catch(console.error);
