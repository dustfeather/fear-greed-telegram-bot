import type { Env, SubscriptionResult, SanitizedSubscriptionResult } from './types.js';
import { getChatIds, addChatId, removeChatId } from './utils/kv.js';
import { getErrorMessage } from './utils/errors.js';

/**
 * Sanitize subscription result by removing sensitive data.
 * @param result - The subscription result to sanitize
 * @returns Sanitized subscription result without allSubscribers
 */
export function sanitizeSubscriptionResult(result: SubscriptionResult): SanitizedSubscriptionResult {
  const { allSubscribers, ...sanitized } = result;
  return sanitized;
}

/**
 * Subscribe user to Fear and Greed Index alerts.
 * @param chatId - The Telegram chat ID
 * @param env - Environment variables
 * @returns Promise resolving to subscription result
 */
export async function sub(chatId: number | string, env: Env): Promise<SubscriptionResult> {
  try {
    const wasAlreadySubscribed = !(await addChatId(env.FEAR_GREED_KV, chatId));
    const chatIds = await getChatIds(env.FEAR_GREED_KV);
    
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
      error: getErrorMessage(error)
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
    const wasSubscribed = await removeChatId(env.FEAR_GREED_KV, chatId);
    const chatIds = await getChatIds(env.FEAR_GREED_KV);
    
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
      error: getErrorMessage(error)
    };
  }
}

