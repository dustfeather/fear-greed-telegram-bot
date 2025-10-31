import type { Env, SendMessageResponse, TelegramApiResponse } from './types.js';
import { API_URLS, MESSAGES, HTTP_HEADERS, RATE_LIMITS } from './constants.js';
import { enhancedFetch } from './utils/fetch.js';
import { getErrorMessage } from './utils/errors.js';
import { getChatIds } from './utils/kv.js';
import { isValidTelegramApiResponse } from './utils/validation.js';

/**
 * Send a message to a Telegram chat.
 * @param chatId - The Telegram chat ID
 * @param message - The message text to send
 * @param env - Environment variables
 * @returns Promise resolving to Telegram API response wrapper
 */
export async function sendTelegramMessage(
  chatId: number | string,
  message: string,
  env: Env
): Promise<SendMessageResponse> {
  const TELEGRAM_BOT_TOKEN = env.TELEGRAM_BOT_TOKEN_SECRET;
  const url = `${API_URLS.TELEGRAM_BASE}/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

  const payload = {
    chat_id: chatId,
    text: message,
    parse_mode: 'Markdown' as const
  };

  try {
    const response = await enhancedFetch(url, {
      method: 'POST',
      headers: HTTP_HEADERS.TELEGRAM_API,
      body: JSON.stringify(payload)
    });
    
    const responseData = await response.json();
    
    // Validate response structure
    if (!isValidTelegramApiResponse(responseData)) {
      return {
        success: false,
        error: 'Invalid Telegram API response structure',
        chatId: chatId,
        message: message
      };
    }
    
    return {
      success: response.ok,
      status: response.status,
      statusText: response.statusText,
      data: responseData,
      chatId: chatId,
      message: message
    };
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error),
      chatId: chatId,
      message: message
    };
  }
}

/**
 * Send help message to the user.
 * @param chatId - The Telegram chat ID
 * @param env - Environment variables
 * @returns Promise resolving to Telegram API response wrapper
 */
export async function sendHelpMessage(chatId: number | string, env: Env): Promise<SendMessageResponse> {
  return await sendTelegramMessage(chatId, MESSAGES.HELP, env);
}

/**
 * Sleep utility for rate limiting
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Broadcast a message to all subscribed users with rate limiting.
 * @param message - The message text to send
 * @param env - Environment variables
 * @returns Promise resolving to broadcast summary
 */
export async function broadcastToAllSubscribers(
  message: string,
  env: Env
): Promise<{ totalSubscribers: number; successful: number; failed: number; errors: Array<{ chatId: number | string; error: string }> }> {
  try {
    const chatIds = await getChatIds(env.FEAR_GREED_KV);
    
    if (chatIds.length === 0) {
      return {
        totalSubscribers: 0,
        successful: 0,
        failed: 0,
        errors: []
      };
    }
    
    const batchSize = RATE_LIMITS.TELEGRAM_BATCH_SIZE;
    const delayBetweenBatches = 1000 / RATE_LIMITS.TELEGRAM_MESSAGES_PER_SECOND * batchSize;
    const errors: Array<{ chatId: number | string; error: string }> = [];
    let successful = 0;
    
    // Process in batches to respect rate limits
    for (let i = 0; i < chatIds.length; i += batchSize) {
      const batch = chatIds.slice(i, i + batchSize);
      const results = await Promise.allSettled(
        batch.map(chatId => sendTelegramMessage(chatId, message, env))
      );
      
      results.forEach((result, batchIndex) => {
        const chatId = batch[batchIndex];
        if (result.status === 'rejected') {
          errors.push({
            chatId,
            error: getErrorMessage(result.reason)
          });
        } else if (result.status === 'fulfilled' && !result.value.success) {
          errors.push({
            chatId,
            error: result.value.error || 'Unknown error'
          });
        } else if (result.status === 'fulfilled' && result.value.success) {
          successful++;
        }
      });
      
      // Wait before processing next batch (except for the last batch)
      if (i + batchSize < chatIds.length) {
        await sleep(delayBetweenBatches);
      }
    }
    
    return {
      totalSubscribers: chatIds.length,
      successful,
      failed: chatIds.length - successful,
      errors
    };
  } catch (error) {
    return {
      totalSubscribers: 0,
      successful: 0,
      failed: 0,
      errors: [{
        chatId: 'unknown',
        error: getErrorMessage(error)
      }]
    };
  }
}

