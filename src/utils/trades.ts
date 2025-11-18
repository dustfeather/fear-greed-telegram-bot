/**
 * Trade history management utilities
 */

import type { KVNamespace } from '@cloudflare/workers-types';
import type { TradeRecord } from '../types.js';
import { KV_KEYS, TRADING_CONFIG } from '../constants.js';
import { createKVError } from './errors.js';

/**
 * Get the last trade record from KV
 * @param kv - KV namespace
 * @returns Last trade record or null if none exists
 */
export async function getLastTrade(kv: KVNamespace): Promise<TradeRecord | null> {
  try {
    const tradeString = await kv.get(KV_KEYS.LAST_TRADE);
    if (!tradeString) {
      return null;
    }
    return JSON.parse(tradeString) as TradeRecord;
  } catch (error) {
    throw createKVError('Failed to get last trade', error);
  }
}

/**
 * Get active position (entry price) from KV
 * @param kv - KV namespace
 * @returns Entry price or null if no active position
 */
export async function getActivePosition(kv: KVNamespace): Promise<number | null> {
  try {
    const positionString = await kv.get(KV_KEYS.ACTIVE_POSITION);
    if (!positionString) {
      return null;
    }
    const position = JSON.parse(positionString) as { entryPrice: number };
    return position.entryPrice;
  } catch (error) {
    throw createKVError('Failed to get active position', error);
  }
}

/**
 * Check if a new trade is allowed (enforce 30-day limit)
 * @param kv - KV namespace
 * @returns true if trading is allowed, false otherwise
 */
export async function canTrade(kv: KVNamespace): Promise<boolean> {
  try {
    const lastTrade = await getLastTrade(kv);
    if (!lastTrade) {
      return true; // No previous trades, trading allowed
    }

    const now = Date.now();
    const daysSinceLastTrade = (now - lastTrade.entryDate) / (1000 * 60 * 60 * 24);

    return daysSinceLastTrade >= TRADING_CONFIG.TRADING_FREQUENCY_DAYS;
  } catch (error) {
    // If there's an error checking, allow trading (fail open)
    console.error('Error checking trade frequency limit:', error);
    return true;
  }
}

/**
 * Record a new trade (BUY signal executed)
 * @param kv - KV namespace
 * @param entryPrice - Entry price for the trade
 * @returns Promise resolving to void
 */
export async function recordTrade(kv: KVNamespace, entryPrice: number): Promise<void> {
  try {
    const trade: TradeRecord = {
      entryPrice,
      entryDate: Date.now(),
      signalType: 'BUY'
    };

    // Store as last trade
    await kv.put(KV_KEYS.LAST_TRADE, JSON.stringify(trade));

    // Store as active position
    await kv.put(KV_KEYS.ACTIVE_POSITION, JSON.stringify({ entryPrice }));
  } catch (error) {
    throw createKVError('Failed to record trade', error);
  }
}

/**
 * Clear active position (when SELL signal is executed)
 * @param kv - KV namespace
 * @returns Promise resolving to void
 */
export async function clearActivePosition(kv: KVNamespace): Promise<void> {
  try {
    await kv.delete(KV_KEYS.ACTIVE_POSITION);
  } catch (error) {
    throw createKVError('Failed to clear active position', error);
  }
}

