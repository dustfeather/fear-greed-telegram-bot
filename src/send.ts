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

