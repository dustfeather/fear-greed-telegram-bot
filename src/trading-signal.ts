/**
 * Trading signal evaluation based on strategy rules
 */

import type { Env, TradingSignal, TechnicalIndicators, FearGreedIndexResponse, PriceData } from './types.js';
import { RATINGS, TRADING_CONFIG } from './constants.js';
import { calculateIndicators } from './indicators.js';
import { fetchMarketData } from './market-data.js';
import { canTrade, getActivePosition, recordTrade, clearActivePosition } from './utils/trades.js';
import { getLastTrade } from './utils/trades.js';

/**
 * Evaluate Condition A: Price below any SMA
 * @param currentPrice - Current price
 * @param indicators - Technical indicators
 * @returns true if price is below any SMA
 */
function evaluateConditionA(currentPrice: number, indicators: TechnicalIndicators): boolean {
  return (
    currentPrice < indicators.sma20 ||
    currentPrice < indicators.sma50 ||
    currentPrice < indicators.sma100 ||
    currentPrice < indicators.sma200
  );
}

/**
 * Evaluate Condition B: Price near BB lower (within 1% or below)
 * @param currentPrice - Current price
 * @param indicators - Technical indicators
 * @returns true if price is within 1% of lower BB or below it
 */
function evaluateConditionB(currentPrice: number, indicators: TechnicalIndicators): boolean {
  const threshold = indicators.bollingerLower * (1 + TRADING_CONFIG.BB_LOWER_THRESHOLD);
  return currentPrice <= threshold;
}

/**
 * Evaluate Condition C: Fear & Greed Index is fear or extreme fear
 * @param fearGreedData - Fear & Greed Index data
 * @returns true if rating is fear or extreme fear
 */
function evaluateConditionC(fearGreedData: FearGreedIndexResponse): boolean {
  const rating = fearGreedData.rating.toLowerCase();
  return rating === RATINGS.FEAR || rating === RATINGS.EXTREME_FEAR;
}

/**
 * Calculate Fibonacci extension target for SELL signal
 * @param entryPrice - Entry price when BUY was executed (swing low)
 * @param historicalData - Historical price data to find previous swing high
 * @returns Fibonacci extension target (100% extension)
 */
function calculateFibonacciExtension(entryPrice: number, historicalData: PriceData[]): number {
  // For 100% Fibonacci extension, we need:
  // - Swing Low: entryPrice (where we entered)
  // - Swing High: highest price before entry (within reasonable lookback period)
  // - 100% Extension = Swing High + (Swing High - Swing Low)
  
  // Find the highest price in the 30 days before entry (swing high)
  // Since we don't have exact entry timestamp, use the most recent high from historical data
  // For simplicity, use the highest high from the last portion of historical data
  const lookbackDays = 30;
  const recentData = historicalData.slice(-lookbackDays);
  
  if (recentData.length === 0) {
    // Fallback: if no historical data, use a simple 50% gain target
    return entryPrice * 1.5;
  }
  
  const swingHigh = Math.max(...recentData.map(d => d.high));
  const swingLow = entryPrice;
  
  // 100% Fibonacci extension: swingHigh + (swingHigh - swingLow)
  return swingHigh + (swingHigh - swingLow);
}

/**
 * Generate human-readable reasoning for the signal
 */
function generateReasoning(
  signal: TradingSignal['signal'],
  conditionA: boolean,
  conditionB: boolean,
  conditionC: boolean,
  canTrade: boolean,
  indicators: TechnicalIndicators
): string {
  const reasons: string[] = [];

  if (signal === 'BUY') {
    reasons.push('BUY signal triggered');
    if (conditionA) {
      reasons.push('Price is below one or more SMA lines');
    }
    if (conditionB) {
      reasons.push(`Price is within 1% of Bollinger Band lower (${indicators.bollingerLower.toFixed(2)})`);
    }
    if (conditionC) {
      reasons.push('Fear & Greed Index indicates fear/extreme fear');
    }
    if (!canTrade) {
      reasons.push('⚠️ Trading frequency limit: Must wait 30 days since last trade');
    }
  } else if (signal === 'SELL') {
    reasons.push('SELL signal triggered');
    reasons.push('Price reached Fibonacci extension target');
  } else {
    reasons.push('HOLD - No trading signal');
    if (!conditionA && !conditionB) {
      reasons.push('Price is not below SMAs or near BB lower');
    }
    if (!conditionC) {
      reasons.push('Fear & Greed Index is not in fear/extreme fear');
    }
  }

  return reasons.join('. ') + '.';
}

/**
 * Evaluate trading signal based on strategy rules
 * @param env - Environment variables
 * @param fearGreedData - Fear & Greed Index data
 * @returns Trading signal evaluation result
 */
export async function evaluateTradingSignal(
  env: Env,
  fearGreedData: FearGreedIndexResponse
): Promise<TradingSignal> {
  // Fetch market data
  const marketData = await fetchMarketData();
  const currentPrice = marketData.currentPrice;

  // Calculate indicators
  const indicators = calculateIndicators(marketData.historicalData);

  // Evaluate conditions
  const conditionA = evaluateConditionA(currentPrice, indicators);
  const conditionB = evaluateConditionB(currentPrice, indicators);
  const conditionC = evaluateConditionC(fearGreedData);

  // Check for active position and trading eligibility
  const activePosition = await getActivePosition(env.FEAR_GREED_KV);
  const lastTrade = await getLastTrade(env.FEAR_GREED_KV);
  const tradingAllowed = await canTrade(env.FEAR_GREED_KV);

  // Determine signal type
  let signal: TradingSignal['signal'] = 'HOLD';
  let sellTarget: number | undefined;
  let entryPrice: number | undefined;

  if (activePosition) {
    // We have an active position, check for SELL signal
    entryPrice = activePosition;
    sellTarget = calculateFibonacciExtension(entryPrice, marketData.historicalData);

    // SELL signal: price reached Fibonacci extension target
    if (currentPrice >= sellTarget) {
      signal = 'SELL';
      // Clear active position when SELL signal is generated
      await clearActivePosition(env.FEAR_GREED_KV).catch(err => {
        console.error('Failed to clear active position:', err);
      });
    }
  } else {
    // No active position, check for BUY signal
    const entryCondition = (conditionA || conditionB) && conditionC;

    if (entryCondition && tradingAllowed) {
      signal = 'BUY';
      // Record trade when BUY signal is generated
      await recordTrade(env.FEAR_GREED_KV, currentPrice).catch(err => {
        console.error('Failed to record trade:', err);
      });
      entryPrice = currentPrice;
    } else if (entryCondition && !tradingAllowed) {
      // Conditions met but trading not allowed due to frequency limit
      signal = 'HOLD';
    }
  }

  // Generate reasoning
  const reasoning = generateReasoning(
    signal,
    conditionA,
    conditionB,
    conditionC,
    tradingAllowed,
    indicators
  );

  return {
    signal,
    currentPrice,
    indicators,
    conditionA,
    conditionB,
    conditionC,
    canTrade: tradingAllowed,
    lastTradeDate: lastTrade?.entryDate,
    entryPrice,
    sellTarget,
    reasoning
  };
}

/**
 * Format trading signal as a human-readable message
 * @param signal - Trading signal evaluation result
 * @param fearGreedData - Fear & Greed Index data
 * @returns Formatted message string
 */
export function formatTradingSignalMessage(
  signal: TradingSignal,
  fearGreedData: FearGreedIndexResponse
): string {
  const { signal: signalType, currentPrice, indicators, reasoning, entryPrice, sellTarget } = signal;

  let message = `📊 *Trading Signal: ${signalType}*\n\n`;
  message += `💰 Current SPY Price: $${currentPrice.toFixed(2)}\n\n`;

  message += `*Technical Indicators:*\n`;
  message += `• SMA 20: $${indicators.sma20.toFixed(2)}\n`;
  message += `• SMA 50: $${indicators.sma50.toFixed(2)}\n`;
  message += `• SMA 100: $${indicators.sma100.toFixed(2)}\n`;
  message += `• SMA 200: $${indicators.sma200.toFixed(2)}\n`;
  message += `• BB Upper: $${indicators.bollingerUpper.toFixed(2)}\n`;
  message += `• BB Middle: $${indicators.bollingerMiddle.toFixed(2)}\n`;
  message += `• BB Lower: $${indicators.bollingerLower.toFixed(2)}\n\n`;

  message += `*Conditions:*\n`;
  message += `• Condition A (Price < SMA): ${signal.conditionA ? '✅' : '❌'}\n`;
  message += `• Condition B (Price near BB Lower): ${signal.conditionB ? '✅' : '❌'}\n`;
  message += `• Condition C (Fear/Extreme Fear): ${signal.conditionC ? '✅' : '❌'}\n\n`;

  message += `*Fear & Greed Index:* ${fearGreedData.rating} (${fearGreedData.score.toFixed(2)}%)\n\n`;

  if (entryPrice) {
    message += `📈 Entry Price: $${entryPrice.toFixed(2)}\n`;
  }

  if (sellTarget) {
    message += `🎯 Sell Target: $${sellTarget.toFixed(2)}\n`;
  }

  if (signal.lastTradeDate) {
    const daysSince = Math.floor((Date.now() - signal.lastTradeDate) / (1000 * 60 * 60 * 24));
    message += `\n⏰ Last Trade: ${daysSince} days ago\n`;
  }

  message += `\n*Reasoning:* ${reasoning}`;

  return message;
}

