/**
 * D1 cache repository
 * Manages cached data with TTL in D1 database
 */

import type { D1Database } from '@cloudflare/workers-types';
import { wrapD1Error, logD1Error } from '../../core/utils/d1-errors.js';

/**
 * Get cached value by key
 * @param db - D1 database instance
 * @param key - Cache key
 * @returns Cached value or null if not found or expired
 */
export async function get<T>(db: D1Database, key: string): Promise<T | null> {
  try {
    const now = Date.now();

    const row = await db
      .prepare('SELECT cache_value, CAST(expires_at AS INTEGER) as expires_at FROM cache WHERE cache_key = ?')
      .bind(key)
      .first<{ cache_value: string; expires_at: number }>();

    if (!row) {
      return null;
    }

    // Check if expired
    if (row.expires_at < now) {
      // Delete expired entry
      await db
        .prepare('DELETE FROM cache WHERE cache_key = ?')
        .bind(key)
        .run();
      return null;
    }

    return JSON.parse(row.cache_value) as T;
  } catch (error) {
    const d1Error = wrapD1Error('cache.get', error);
    logD1Error(d1Error);
    throw d1Error;
  }
}

/**
 * Set cached value with TTL
 * @param db - D1 database instance
 * @param key - Cache key
 * @param value - Value to cache
 * @param ttlMs - Time to live in milliseconds
 */
export async function set<T>(
  db: D1Database,
  key: string,
  value: T,
  ttlMs: number
): Promise<void> {
  try {
    const now = Date.now();
    const expiresAt = now + ttlMs;
    const cacheValue = JSON.stringify(value);

    await db
      .prepare(
        'INSERT INTO cache (cache_key, cache_value, expires_at, updated_at) ' +
        'VALUES (?, ?, ?, ?) ' +
        'ON CONFLICT(cache_key) DO UPDATE SET cache_value = ?, expires_at = ?, updated_at = ?'
      )
      .bind(key, cacheValue, expiresAt, now, cacheValue, expiresAt, now)
      .run();
  } catch (error) {
    const d1Error = wrapD1Error('cache.set', error);
    logD1Error(d1Error);
    throw d1Error;
  }
}

/**
 * Delete cached value by key
 * @param db - D1 database instance
 * @param key - Cache key
 */
export async function deleteCacheKey(db: D1Database, key: string): Promise<void> {
  try {
    await db
      .prepare('DELETE FROM cache WHERE cache_key = ?')
      .bind(key)
      .run();
  } catch (error) {
    const d1Error = wrapD1Error('cache.delete', error);
    logD1Error(d1Error);
    throw d1Error;
  }
}

/**
 * Clean up expired cache entries
 * @param db - D1 database instance
 * @returns Number of entries deleted
 */
export async function cleanup(db: D1Database): Promise<number> {
  try {
    const now = Date.now();

    const result = await db
      .prepare('DELETE FROM cache WHERE expires_at < ?')
      .bind(now)
      .run();

    return result.meta.changes ?? 0;
  } catch (error) {
    const d1Error = wrapD1Error('cache.cleanup', error);
    logD1Error(d1Error);
    throw d1Error;
  }
}
