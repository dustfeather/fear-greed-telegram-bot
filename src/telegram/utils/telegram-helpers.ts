/**
 * Telegram API utility functions
 */

import type { Env, TelegramApiResponse } from '../../core/types/index.js';
import { API_URLS, HTTP_HEADERS } from '../../core/constants/index.js';
import { enhancedFetch } from '../../core/utils/fetch.js';
import { getErrorMessage } from '../../core/utils/errors.js';

/**
 * Telegram Chat information from getChat API
 */
export interface TelegramChatInfo {
  id: number;
  type: 'private' | 'group' | 'supergroup' | 'channel';
  username?: string;
  first_name?: string;
  last_name?: string;
  title?: string;
}

/**
 * Get chat information from Telegram Bot API.
 * @param chatId - The Telegram chat ID
 * @param env - Environment variables
 * @returns Promise resolving to chat information or null if error
 */
export async function getChatInfo(
  chatId: number | string,
  env: Env
): Promise<TelegramChatInfo | null> {
  const TELEGRAM_BOT_TOKEN = env.TELEGRAM_BOT_TOKEN_SECRET;
  const url = `${API_URLS.TELEGRAM_BASE}/bot${TELEGRAM_BOT_TOKEN}/getChat`;

  const payload = {
    chat_id: chatId
  };

  try {
    const response = await enhancedFetch(url, {
      method: 'POST',
      headers: HTTP_HEADERS.TELEGRAM_API,
      body: JSON.stringify(payload)
    });

    const responseData = await response.json() as TelegramApiResponse;

    if (!response.ok || !responseData.ok) {
      // Handle errors like "chat not found" (user blocked bot, etc.)
      return null;
    }

    return responseData.result as TelegramChatInfo;
  } catch (error) {
    console.error(`Error getting chat info for ${chatId}:`, getErrorMessage(error));
    return null;
  }
}

