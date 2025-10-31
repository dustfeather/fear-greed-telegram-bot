import type { Env, SendMessageResponse, TelegramApiResponse } from './types.js';

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
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

  const payload = {
    chat_id: chatId,
    text: message,
    parse_mode: 'Markdown' as const
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    const responseData = await response.json() as TelegramApiResponse;
    
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
      error: error instanceof Error ? error.message : String(error),
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
  const helpMessage = `
Available commands:
/start - Subscribe to Fear and Greed Index alerts.
/stop - Unsubscribe from Fear and Greed Index alerts.
/now - Get the current Fear and Greed Index rating.
/help - Show this help message.
 `;
  return await sendTelegramMessage(chatId, helpMessage, env);
}

/**
 * Broadcast a message to all subscribed users.
 * @param message - The message text to send
 * @param env - Environment variables
 * @returns Promise resolving to broadcast summary
 */
export async function broadcastToAllSubscribers(
  message: string,
  env: Env
): Promise<{ totalSubscribers: number; successful: number; failed: number; errors: Array<{ chatId: number | string; error: string }> }> {
  try {
    const chatIdsString = await env.FEAR_GREED_KV.get('chat_ids');
    const chatIds: (number | string)[] = chatIdsString ? JSON.parse(chatIdsString) : [];
    
    if (chatIds.length === 0) {
      return {
        totalSubscribers: 0,
        successful: 0,
        failed: 0,
        errors: []
      };
    }
    
    const results = await Promise.allSettled(
      chatIds.map(chatId => sendTelegramMessage(chatId, message, env))
    );
    
    const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const failed = results.length - successful;
    const errors: Array<{ chatId: number | string; error: string }> = [];
    
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        errors.push({
          chatId: chatIds[index],
          error: result.reason instanceof Error ? result.reason.message : String(result.reason)
        });
      } else if (result.status === 'fulfilled' && !result.value.success) {
        errors.push({
          chatId: chatIds[index],
          error: result.value.error || 'Unknown error'
        });
      }
    });
    
    return {
      totalSubscribers: chatIds.length,
      successful,
      failed,
      errors
    };
  } catch (error) {
    return {
      totalSubscribers: 0,
      successful: 0,
      failed: 0,
      errors: [{
        chatId: 'unknown',
        error: error instanceof Error ? error.message : String(error)
      }]
    };
  }
}

