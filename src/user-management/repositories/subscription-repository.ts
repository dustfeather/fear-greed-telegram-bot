/**
 * KV storage utility functions
 */

import type { KVNamespace } from '@cloudflare/workers-types';
import { KV_KEYS } from '../../core/constants/index.js';
import { createKVError } from '../../core/utils/errors.js';

/**
 * Get all chat IDs from KV storage
 */
export async function getChatIds(kv: KVNamespace): Promise<(number | string)[]> {
  try {
    const chatIdsString = await kv.get(KV_KEYS.CHAT_IDS);
    if (!chatIdsString) {
      return [];
    }
    return JSON.parse(chatIdsString) as (number | string)[];
  } catch (error) {
    throw createKVError('Failed to get chat IDs', error);
  }
}

/**
 * Save chat IDs to KV storage
 */
export async function saveChatIds(
  kv: KVNamespace,
  chatIds: (number | string)[]
): Promise<void> {
  try {
    await kv.put(KV_KEYS.CHAT_IDS, JSON.stringify(chatIds));
  } catch (error) {
    throw createKVError('Failed to save chat IDs', error);
  }
}

/**
 * Add a chat ID to the list (handles duplicates)
 */
export async function addChatId(
  kv: KVNamespace,
  chatId: number | string
): Promise<boolean> {
  try {
    const chatIds = await getChatIds(kv);
    if (chatIds.includes(chatId)) {
      return false; // Already subscribed
    }
    chatIds.push(chatId);
    await saveChatIds(kv, chatIds);
    return true; // Successfully added
  } catch (error) {
    throw createKVError('Failed to add chat ID', error);
  }
}

/**
 * Remove a chat ID from the list
 */
export async function removeChatId(
  kv: KVNamespace,
  chatId: number | string
): Promise<boolean> {
  try {
    const chatIds = await getChatIds(kv);
    const index = chatIds.indexOf(chatId);
    if (index === -1) {
      return false; // Not subscribed
    }
    chatIds.splice(index, 1);
    await saveChatIds(kv, chatIds);
    return true; // Successfully removed
  } catch (error) {
    throw createKVError('Failed to remove chat ID', error);
  }
}

