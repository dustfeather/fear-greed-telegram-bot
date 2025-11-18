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
 * Calculate all-time high from historical price data
 * @param historicalData - Historical price data
 * @returns All-time high price
 */
function calculateAllTimeHigh(historicalData: PriceData[]): number {
  if (historicalData.length === 0) {
    throw new Error('Cannot calculate all-time high: no historical data available');
  }
  
  // Find the maximum high price across all historical data
  return Math.max(...historicalData.map(d => d.high));
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
    reasons.push('Price reached all-time high');
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
 * Create a HOLD signal when data sources are unavailable
 * @param fearGreedData - Fear & Greed Index data (may be unavailable)
 * @param ticker - Ticker symbol (default: 'SPY')
 * @returns Trading signal with HOLD and data unavailability reasoning
 */
export function createDataUnavailableSignal(
  fearGreedData?: FearGreedIndexResponse,
  ticker: string = 'SPY'
): TradingSignal {
  // Create default indicators (all zeros as placeholders)
  const defaultIndicators: TechnicalIndicators = {
    sma20: 0,
    sma50: 0,
    sma100: 0,
    sma200: 0,
    bollingerUpper: 0,
    bollingerMiddle: 0,
    bollingerLower: 0
  };

  // Build reasoning based on what data is available
  const reasons: string[] = ['HOLD - Insufficient data to evaluate trading conditions'];
  
  if (!fearGreedData) {
    reasons.push('Fear & Greed Index data unavailable');
  } else {
    reasons.push(`Market data (${ticker} price and indicators) unavailable`);
  }

  return {
    signal: 'HOLD',
    currentPrice: 0, // Placeholder value
    indicators: defaultIndicators,
    conditionA: false,
    conditionB: false,
    conditionC: false,
    canTrade: false,
    reasoning: reasons.join('. ') + '.'
  };
}

/**
 * Evaluate trading signal based on strategy rules
 * @param env - Environment variables
 * @param fearGreedData - Fear & Greed Index data
 * @param ticker - Ticker symbol (default: 'SPY')
 * @returns Trading signal evaluation result
 */
export async function evaluateTradingSignal(
  env: Env,
  fearGreedData: FearGreedIndexResponse,
  ticker: string = 'SPY'
): Promise<TradingSignal> {
  // Fetch market data
  const marketData = await fetchMarketData(ticker);
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
    sellTarget = calculateAllTimeHigh(marketData.historicalData);

    // SELL signal: price reached all-time high
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
 * @param fearGreedData - Fear & Greed Index data (optional, may be unavailable)
 * @param ticker - Ticker symbol (default: 'SPY')
 * @returns Formatted message string
 */
export function formatTradingSignalMessage(
  signal: TradingSignal,
  fearGreedData?: FearGreedIndexResponse,
  ticker: string = 'SPY'
): string {
  const { signal: signalType, currentPrice, indicators, reasoning, entryPrice, sellTarget } = signal;

  // Check if this is a data unavailable signal (currentPrice is 0 and indicators are all zeros)
  const isDataUnavailable = currentPrice === 0 && 
    indicators.sma20 === 0 && 
    indicators.sma50 === 0 && 
    indicators.sma100 === 0 && 
    indicators.sma200 === 0;

  // Color-coded signal indicators
  const signalEmoji = signalType === 'BUY' ? '🟢' : signalType === 'SELL' ? '🔴' : '🟡';
  let message = `${signalEmoji} *Trading Signal: ${signalType}*\n\n`;

  if (isDataUnavailable) {
    // Simplified message format for data unavailable cases
    message += `⚠️ *Data Unavailable*\n\n`;
    
    if (fearGreedData) {
      message += `*Fear & Greed Index:* ${fearGreedData.rating} (${fearGreedData.score.toFixed(2)}%)\n`;
      message += `Market data (${ticker} price and indicators) unavailable.\n\n`;
    } else {
      message += `Fear & Greed Index data unavailable.\n`;
      message += `Market data (${ticker} price and indicators) unavailable.\n\n`;
    }
  } else {
    // Full message format with all data
    const tradingViewUrl = `https://www.tradingview.com/chart/?symbol=${ticker}`;
    message += `💰 Current [${ticker} Price](${tradingViewUrl}): $${currentPrice.toFixed(2)}\n\n`;

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

    if (fearGreedData) {
      message += `*Fear & Greed Index:* ${fearGreedData.rating} (${fearGreedData.score.toFixed(2)}%)\n\n`;
    }

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
  }

  message += `\n*Reasoning:* ${reasoning}`;

  return message;
}

