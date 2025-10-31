/**
 * Environment variables for Cloudflare Workers
 */
export interface Env {
  TELEGRAM_BOT_TOKEN_SECRET: string;
  ADMIN_CHAT_ID?: string;
  FEAR_GREED_KV: KVNamespace;
}

/**
 * Telegram Update payload structure
 */
export interface TelegramUpdate {
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
}

export interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  chat: TelegramChat;
  text?: string;
}

export interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  username?: string;
}

export interface TelegramChat {
  id: number;
  type: 'private' | 'group' | 'supergroup' | 'channel';
}

/**
 * Telegram API Response structure
 */
export interface TelegramApiResponse {
  ok: boolean;
  result?: unknown;
  error_code?: number;
  description?: string;
}

/**
 * Response wrapper for Telegram message sending
 */
export interface SendMessageResponse {
  success: boolean;
  status?: number;
  statusText?: string;
  data?: TelegramApiResponse;
  error?: string;
  chatId: number | string;
  message: string;
}

/**
 * Subscription operation result
 */
export interface SubscriptionResult {
  success: boolean;
  chatId: number | string;
  wasAlreadySubscribed?: boolean;
  wasSubscribed?: boolean;
  totalSubscribers: number;
  allSubscribers: (number | string)[];
  error?: string;
}

/**
 * Fear and Greed Index API Response
 */
export interface FearGreedIndexResponse {
  rating: string;
  score: number;
  timestamp?: number;
}

