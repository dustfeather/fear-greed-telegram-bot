import type { Env, SubscriptionResult, SanitizedSubscriptionResult } from './types.js';
import { getChatIds, addChatId, removeChatId } from './utils/kv.js';
import { getWatchlist } from './utils/watchlist.js';
import { getErrorMessage } from './utils/errors.js';
import { getChatInfo } from './utils/telegram.js';
import { RATE_LIMITS } from './constants.js';

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
    
    // Initialize watchlist with SPY if user doesn't have one
    // This ensures new subscribers start with SPY
    if (!wasAlreadySubscribed) {
      try {
        await getWatchlist(env.FEAR_GREED_KV, chatId);
        // If getWatchlist succeeds, watchlist already exists (or was created with default)
      } catch (error) {
        // If there's an error, the watchlist will be initialized on first access
        console.error('Error initializing watchlist for new subscriber:', error);
      }
    }
    
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

/**
 * Sleep utility for rate limiting
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * List all subscribers with their usernames.
 * Automatically unsubscribes users who have blocked the bot.
 * @param env - Environment variables
 * @returns Promise resolving to formatted subscriber list string
 */
export async function listSubscribers(env: Env): Promise<string> {
  try {
    const chatIds = await getChatIds(env.FEAR_GREED_KV);
    
    if (chatIds.length === 0) {
      return 'Total subscribers: 0\n\nNo subscribers found.';
    }
    
    const usernames: string[] = [];
    const batchSize = RATE_LIMITS.TELEGRAM_BATCH_SIZE;
    const delayBetweenBatches = 1000 / RATE_LIMITS.TELEGRAM_MESSAGES_PER_SECOND * batchSize;
    
    // Process in batches to respect rate limits
    for (let i = 0; i < chatIds.length; i += batchSize) {
      const batch = chatIds.slice(i, i + batchSize);
      const results = await Promise.allSettled(
        batch.map(chatId => getChatInfo(chatId, env))
      );
      
      results.forEach((result, batchIndex) => {
        const chatId = batch[batchIndex];
        
        if (result.status === 'fulfilled' && result.value) {
          const chatInfo = result.value;
          // Prefer username if available
          if (chatInfo.username) {
            usernames.push(`@${chatInfo.username}`);
          } else if (chatInfo.first_name) {
            // Use first_name + last_name as fallback
            const fullName = chatInfo.last_name 
              ? `${chatInfo.first_name} ${chatInfo.last_name}`
              : chatInfo.first_name;
            usernames.push(fullName);
          } else {
            // Last resort: use chat ID
            usernames.push(`User ${chatId}`);
          }
        } else {
          // User blocked bot or chat not found - unsubscribe them
          console.log(`Unsubscribing ${chatId} - chat not found or user blocked bot`);
          unsub(chatId, env).catch(err => {
            console.error(`Failed to unsubscribe ${chatId}:`, err);
          });
        }
      });
      
      // Wait before processing next batch (except for the last batch)
      if (i + batchSize < chatIds.length) {
        await sleep(delayBetweenBatches);
      }
    }
    
    // Format output with total count first, then numbered list
    let message = `Total subscribers: ${usernames.length}\n\n`;
    
    if (usernames.length === 0) {
      message += 'No active subscribers found.';
    } else {
      usernames.forEach((username, index) => {
        message += `${index + 1}. ${username}\n`;
      });
    }
    
    return message.trim();
  } catch (error) {
    console.error('Error listing subscribers:', error);
    return `Error retrieving subscriber list: ${getErrorMessage(error)}`;
  }
}

