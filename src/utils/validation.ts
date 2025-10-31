/**
 * Runtime validation utilities
 */

import type { FearGreedIndexResponse, TelegramApiResponse } from '../types.js';

/**
 * Validate Fear & Greed Index response structure
 */
export function isValidFearGreedIndexResponse(data: unknown): data is FearGreedIndexResponse {
  if (!data || typeof data !== 'object') {
    return false;
  }

  const obj = data as Record<string, unknown>;

  // Must have rating string
  if (typeof obj.rating !== 'string' || !obj.rating) {
    return false;
  }

  // Score can be number or string that can be converted to number
  let score: number;
  if (typeof obj.score === 'number') {
    score = obj.score;
  } else if (typeof obj.score === 'string') {
    score = parseFloat(obj.score);
    if (isNaN(score)) {
      return false;
    }
  } else {
    return false;
  }

  // Optional timestamp (can be number or ISO string)
  if (obj.timestamp !== undefined && typeof obj.timestamp !== 'number' && typeof obj.timestamp !== 'string') {
    return false;
  }

  // Optional additional fields (previous_close, previous_1_week, etc.)
  // These are allowed but not required

  return true;
}

/**
 * Validate Telegram API response structure
 */
export function isValidTelegramApiResponse(data: unknown): data is TelegramApiResponse {
  if (!data || typeof data !== 'object') {
    return false;
  }

  const obj = data as Record<string, unknown>;

  // Must have ok boolean
  if (typeof obj.ok !== 'boolean') {
    return false;
  }

  // Optional fields
  if (obj.error_code !== undefined && typeof obj.error_code !== 'number') {
    return false;
  }

  if (obj.description !== undefined && typeof obj.description !== 'string') {
    return false;
  }

  return true;
}

