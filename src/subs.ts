import type { Env, SubscriptionResult } from './types.js';

/**
 * Subscribe user to Fear and Greed Index alerts.
 * @param chatId - The Telegram chat ID
 * @param env - Environment variables
 * @returns Promise resolving to subscription result
 */
export async function sub(chatId: number | string, env: Env): Promise<SubscriptionResult> {
  try {
    const chatIdsString = await env.FEAR_GREED_KV.get('chat_ids');
    const chatIds: (number | string)[] = chatIdsString ? JSON.parse(chatIdsString) : [];
    const wasAlreadySubscribed = chatIds.includes(chatId);
    
    if (!wasAlreadySubscribed) {
      chatIds.push(chatId);
      await env.FEAR_GREED_KV.put('chat_ids', JSON.stringify(chatIds));
    }
    
    return {
      success: true,
      chatId: chatId,
      wasAlreadySubscribed: wasAlreadySubscribed,
      totalSubscribers: chatIds.length,
      allSubscribers: chatIds
    };
  } catch (error) {
    return {
      success: false,
      chatId: chatId,
      totalSubscribers: 0,
      allSubscribers: [],
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Unsubscribe user from Fear and Greed Index alerts.
 * @param chatId - The Telegram chat ID
 * @param env - Environment variables
 * @returns Promise resolving to unsubscription result
 */
export async function unsub(chatId: number | string, env: Env): Promise<SubscriptionResult> {
  try {
    const chatIdsString = await env.FEAR_GREED_KV.get('chat_ids');
    const chatIds: (number | string)[] = chatIdsString ? JSON.parse(chatIdsString) : [];
    const index = chatIds.indexOf(chatId);
    const wasSubscribed = index !== -1;
    
    if (wasSubscribed) {
      chatIds.splice(index, 1);
      await env.FEAR_GREED_KV.put('chat_ids', JSON.stringify(chatIds));
    }
    
    return {
      success: true,
      chatId: chatId,
      wasSubscribed: wasSubscribed,
      totalSubscribers: chatIds.length,
      allSubscribers: chatIds
    };
  } catch (error) {
    return {
      success: false,
      chatId: chatId,
      totalSubscribers: 0,
      allSubscribers: [],
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

