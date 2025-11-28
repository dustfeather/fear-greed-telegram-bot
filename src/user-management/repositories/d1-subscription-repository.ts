/**
 * D1 subscription repository
 * Manages user subscriptions in D1 database
 */

import type { D1Database } from '@cloudflare/workers-types';
import { wrapD1Error, logD1Error } from '../../core/utils/d1-errors.js';

/**
 * Get all subscribed chat IDs from D1
 * @param db - D1 database instance
 * @returns Array of chat IDs (as strings)
 */
export async function getChatIds(db: D1Database): Promise<string[]> {
  try {
    const result = await db
      .prepare('SELECT chat_id FROM users WHERE subscription_status = 1')
      .all<{ chat_id: string }>();

    return result.results.map(row => row.chat_id);
  } catch (error) {
    const d1Error = wrapD1Error('getChatIds', error);
    logD1Error(d1Error);
    throw d1Error;
  }
}

/**
 * Add a chat ID to subscriptions (or reactivate if exists)
 * @param db - D1 database instance
 * @param chatId - Chat ID to add
 * @returns true if newly added, false if already subscribed
 */
export async function addChatId(
  db: D1Database,
  chatId: number | string
): Promise<boolean> {
  try {
    const chatIdStr = String(chatId);
    const now = Date.now();

    // Check if user already exists
    const existing = await db
      .prepare('SELECT subscription_status FROM users WHERE chat_id = ?')
      .bind(chatIdStr)
      .first<{ subscription_status: number }>();

    if (existing) {
      if (existing.subscription_status === 1) {
        return false; // Already subscribed
      }

      // Reactivate subscription
      await db
        .prepare('UPDATE users SET subscription_status = 1, updated_at = ? WHERE chat_id = ?')
        .bind(now, chatIdStr)
        .run();

      return true;
    }

    // Insert new user
    await db
      .prepare('INSERT INTO users (chat_id, subscription_status, created_at, updated_at) VALUES (?, 1, ?, ?)')
      .bind(chatIdStr, now, now)
      .run();

    return true;
  } catch (error) {
    const d1Error = wrapD1Error('addChatId', error);
    logD1Error(d1Error);
    throw d1Error;
  }
}

/**
 * Remove a chat ID from subscriptions (soft delete - sets status to 0)
 * @param db - D1 database instance
 * @param chatId - Chat ID to remove
 * @returns true if removed, false if not subscribed
 */
export async function removeChatId(
  db: D1Database,
  chatId: number | string
): Promise<boolean> {
  try {
    const chatIdStr = String(chatId);
    const now = Date.now();

    const result = await db
      .prepare('UPDATE users SET subscription_status = 0, updated_at = ? WHERE chat_id = ? AND subscription_status = 1')
      .bind(now, chatIdStr)
      .run();

    return (result.meta.changes ?? 0) > 0;
  } catch (error) {
    const d1Error = wrapD1Error('removeChatId', error);
    logD1Error(d1Error);
    throw d1Error;
  }
}

/**
 * Check if a chat ID exists and is subscribed
 * @param db - D1 database instance
 * @param chatId - Chat ID to check
 * @returns true if subscribed, false otherwise
 */
export async function chatIdExists(
  db: D1Database,
  chatId: number | string
): Promise<boolean> {
  try {
    const chatIdStr = String(chatId);

    const result = await db
      .prepare('SELECT 1 FROM users WHERE chat_id = ? AND subscription_status = 1')
      .bind(chatIdStr)
      .first();

    return result !== null;
  } catch (error) {
    const d1Error = wrapD1Error('chatIdExists', error);
    logD1Error(d1Error);
    throw d1Error;
  }
}
