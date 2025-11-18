/**
 * Environment variables for Cloudflare Workers
 */
export interface Env {
  TELEGRAM_BOT_TOKEN_SECRET: string;
  TELEGRAM_WEBHOOK_SECRET: string;
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
 * Sanitized subscription result (excludes sensitive data)
 */
export interface SanitizedSubscriptionResult {
  success: boolean;
  chatId: number | string;
  wasAlreadySubscribed?: boolean;
  wasSubscribed?: boolean;
  totalSubscribers: number;
  error?: string;
}

/**
 * Fear and Greed Index API Response
 */
export interface FearGreedIndexResponse {
  rating: string;
  score: number;
  timestamp?: number | string;
  previous_close?: number;
  previous_1_week?: number;
  previous_1_month?: number;
  previous_1_year?: number;
}

/**
 * Price data point
 */
export interface PriceData {
  date: number; // Unix timestamp
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/**
 * Market data response from Yahoo Finance
 */
export interface MarketDataResponse {
  currentPrice: number;
  historicalData: PriceData[];
}

/**
 * Technical indicators
 */
export interface TechnicalIndicators {
  sma20: number;
  sma50: number;
  sma100: number;
  sma200: number;
  bollingerUpper: number;
  bollingerMiddle: number; // Same as SMA 20
  bollingerLower: number;
}

/**
 * Trading signal type
 */
export type TradingSignalType = 'BUY' | 'SELL' | 'HOLD';

/**
 * Trading signal evaluation result
 */
export interface TradingSignal {
  signal: TradingSignalType;
  currentPrice: number;
  indicators: TechnicalIndicators;
  conditionA: boolean; // Price below any SMA
  conditionB: boolean; // Price near BB lower (within 1%)
  conditionC: boolean; // Fear & Greed Index is fear/extreme fear
  canTrade: boolean; // Whether trading is allowed (frequency limit check)
  lastTradeDate?: number; // Timestamp of last trade
  entryPrice?: number; // Entry price if there's an active position
  sellTarget?: number; // All-time high target for SELL
  reasoning: string; // Human-readable explanation
}

/**
 * Trade record stored in KV
 */
export interface TradeRecord {
  entryPrice: number;
  entryDate: number; // Unix timestamp
  signalType: 'BUY';
}

