/**
 * Trading signal evaluation based on strategy rules
 */

import type {
  Env,
  TradingSignal,
  TechnicalIndicators,
  FearGreedIndexResponse,
  PriceData,
  ExitTrigger
} from './types.js';
import { RATINGS, TRADING_CONFIG } from './constants.js';
import { calculateIndicators } from './indicators.js';
import { fetchMarketData } from './market-data.js';
import { getActivePosition } from './utils/trades.js';

/**
 * Evaluate Condition A: New BUY signal formula
 * (price <= SMA20 AND (price within 1% or lower than lowerBB)) OR price <= SMA50 OR price <= SMA100 OR price <= SMA200
 * @param currentPrice - Current price
 * @param indicators - Technical indicators
 * @returns true if new condition is met
 */
function evaluateConditionA(currentPrice: number, indicators: TechnicalIndicators): boolean {
  const lowerBBThreshold = indicators.bollingerLower * (1 + TRADING_CONFIG.BB_LOWER_THRESHOLD);
  
  return (
    (currentPrice <= indicators.sma20 && currentPrice <= lowerBBThreshold) ||
    currentPrice <= indicators.sma50 ||
    currentPrice <= indicators.sma100 ||
    currentPrice <= indicators.sma200
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
type ExitReasoningContext = {
  entryPrice?: number;
  exitTrigger?: ExitTrigger;
  bollingerSellTarget?: number;
  hasPositiveProfit?: boolean;
};

function generateReasoning(
  signal: TradingSignal['signal'],
  conditionA: boolean,
  _conditionB: boolean,
  conditionC: boolean,
  indicators: TechnicalIndicators,
  hasActivePosition: boolean = false,
  sellTarget?: number,
  currentPrice?: number,
  exitContext: ExitReasoningContext = {}
): string {
  const reasons: string[] = [];
  const { entryPrice, exitTrigger, bollingerSellTarget, hasPositiveProfit } = exitContext;
  const profitIsNegative = hasPositiveProfit === false && typeof entryPrice === 'number' && typeof currentPrice === 'number';

  if (signal === 'BUY') {
    reasons.push('BUY signal triggered');
    if (conditionA && typeof currentPrice === 'number') {
      const lowerBBThreshold = indicators.bollingerLower * (1 + TRADING_CONFIG.BB_LOWER_THRESHOLD);
      const sma20AndBB = currentPrice <= indicators.sma20 && currentPrice <= lowerBBThreshold;
      const sma50 = currentPrice <= indicators.sma50;
      const sma100 = currentPrice <= indicators.sma100;
      const sma200 = currentPrice <= indicators.sma200;
      
      const conditionParts: string[] = [];
      if (sma20AndBB) {
        conditionParts.push(`Price <= SMA20 (${indicators.sma20.toFixed(2)}) AND within 1% of BB lower (${indicators.bollingerLower.toFixed(2)})`);
      }
      if (sma50) {
        conditionParts.push(`Price <= SMA50 (${indicators.sma50.toFixed(2)})`);
      }
      if (sma100) {
        conditionParts.push(`Price <= SMA100 (${indicators.sma100.toFixed(2)})`);
      }
      if (sma200) {
        conditionParts.push(`Price <= SMA200 (${indicators.sma200.toFixed(2)})`);
      }
      
      if (conditionParts.length > 0) {
        reasons.push(`Entry condition met: ${conditionParts.join(' OR ')}`);
      } else {
        reasons.push('Price condition met (new BUY formula)');
      }
    } else if (conditionA) {
      reasons.push('Price condition met (new BUY formula)');
    }
    if (conditionC) {
      reasons.push('Fear & Greed Index indicates fear/extreme fear');
    }
  } else if (signal === 'SELL') {
    reasons.push('SELL signal triggered');
    if (exitTrigger === 'BOLLINGER_UPPER') {
      reasons.push('Price reached Bollinger Band upper target');
    } else {
      reasons.push('Price reached all-time high');
    }
  } else {
    // HOLD signal
    if (hasActivePosition) {
      // User has an active position - explain why it's HOLD
      reasons.push('HOLD - You have an active position');
      if (sellTarget && currentPrice) {
        const targets: string[] = [];
        const athDistance = sellTarget - currentPrice;
        const athPercent = ((athDistance / currentPrice) * 100).toFixed(2);
        targets.push(`ATH: $${sellTarget.toFixed(2)} (${athPercent}% away)`);

        if (bollingerSellTarget) {
          const bbDistance = bollingerSellTarget - currentPrice;
          const bbPercent = ((bbDistance / currentPrice) * 100).toFixed(2);
          targets.push(`BB upper: $${bollingerSellTarget.toFixed(2)} (${bbPercent}% away)`);
        }

        reasons.push(`Price has not reached the sell targets (${targets.join('; ')}), currently $${currentPrice.toFixed(2)}`);
      } else {
        reasons.push('Waiting for price to reach the configured sell targets before SELL signal');
      }

      if (profitIsNegative) {
        const drawdown = entryPrice - currentPrice;
        const drawdownPercent = ((drawdown / entryPrice) * 100).toFixed(2);
        reasons.push(`Holding until the position is back in profit (entry $${entryPrice.toFixed(2)}, currently $${currentPrice.toFixed(2)}, down ${drawdownPercent}%)`);
      }
    } else {
      // No active position - explain why entry conditions aren't met
      reasons.push('HOLD - Entry conditions not met');
      if (!conditionA) {
        reasons.push('Price condition not met (not (price <= SMA20 AND near BB lower) OR price <= SMA50/100/200)');
      }
      if (!conditionC) {
        reasons.push('Fear & Greed Index is not in fear/extreme fear');
      }
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
    reasoning: reasons.join('. ') + '.'
  };
}

/**
 * Evaluate trading signal based on strategy rules
 * @param env - Environment variables
 * @param fearGreedData - Fear & Greed Index data
 * @param ticker - Ticker symbol (default: 'SPY')
 * @param chatId - Optional user's chat ID for user-specific position checking
 * @returns Trading signal evaluation result
 */
export async function evaluateTradingSignal(
  env: Env,
  fearGreedData: FearGreedIndexResponse,
  ticker: string = 'SPY',
  chatId?: number | string
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

  // Check for user-specific active position if chatId is provided
  let activePosition: { ticker: string; entryPrice: number } | null = null;
  if (chatId) {
    activePosition = await getActivePosition(env.FEAR_GREED_KV, chatId);
    // Only consider active position if it's for the same ticker
    if (activePosition && activePosition.ticker.toUpperCase() !== ticker.toUpperCase()) {
      activePosition = null;
    }
  }

  // Determine signal type
  let signal: TradingSignal['signal'] = 'HOLD';
  let sellTarget: number | undefined;
  let entryPrice: number | undefined;
  let exitTrigger: ExitTrigger | undefined;
  let bollingerSellTargetValue: number | undefined;
  let hasPositiveProfitFlag: boolean | undefined;

  if (activePosition) {
    // User has an active position for this ticker, check for SELL signal only
    entryPrice = activePosition.entryPrice;
    const allTimeHighTarget = calculateAllTimeHigh(marketData.historicalData);
    const bollingerSellTarget = indicators.bollingerUpper * (1 + TRADING_CONFIG.BB_UPPER_THRESHOLD);
    sellTarget = allTimeHighTarget;

    const hasPositiveProfit = currentPrice > entryPrice;
    const reachedAllTimeHigh = currentPrice >= allTimeHighTarget;
    const reachedBollingerUpper = currentPrice >= bollingerSellTarget;

    if (hasPositiveProfit && (reachedAllTimeHigh || reachedBollingerUpper)) {
      signal = 'SELL';
      exitTrigger = reachedAllTimeHigh ? 'ALL_TIME_HIGH' : 'BOLLINGER_UPPER';
      sellTarget = exitTrigger === 'ALL_TIME_HIGH' ? allTimeHighTarget : bollingerSellTarget;
    }
    bollingerSellTargetValue = bollingerSellTarget;
    hasPositiveProfitFlag = hasPositiveProfit;
    // Otherwise signal remains HOLD (user has position, no new BUY signal)
  } else {
    // No active position, check for BUY signal
    // New formula: conditionA AND conditionC (conditionA now includes the new formula)
    const entryCondition = conditionA && conditionC;

    if (entryCondition) {
      // Entry conditions are met - signal is valid
      signal = 'BUY';
    }
  }

  // Generate reasoning
  const reasoning = generateReasoning(
    signal,
    conditionA,
    conditionB,
    conditionC,
    indicators,
    activePosition !== null,
    sellTarget,
    currentPrice,
    {
      entryPrice,
      exitTrigger,
      bollingerSellTarget: bollingerSellTargetValue,
      hasPositiveProfit: hasPositiveProfitFlag
    }
  );

  return {
    signal,
    currentPrice,
    indicators,
    conditionA,
    conditionB,
    conditionC,
    entryPrice,
    sellTarget,
    bollingerSellTarget: bollingerSellTargetValue,
    exitTrigger,
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
    message += `• Condition A (New BUY formula): ${signal.conditionA ? '✅' : '❌'}\n`;
    message += `• Condition B (Price near BB Lower): ${signal.conditionB ? '✅' : '❌'}\n`;
    message += `• Condition C (Fear/Extreme Fear): ${signal.conditionC ? '✅' : '❌'}\n\n`;

    if (fearGreedData) {
      message += `*Fear & Greed Index:* ${fearGreedData.rating} (${fearGreedData.score.toFixed(2)}%)\n\n`;
    }

    if (entryPrice) {
      message += `📈 Entry Price: $${entryPrice.toFixed(2)}\n`;
    }

    if (sellTarget) {
    const targetLabel = signal.exitTrigger === 'BOLLINGER_UPPER'
      ? 'Sell Target (BB Upper)'
      : signal.exitTrigger === 'ALL_TIME_HIGH'
        ? 'Sell Target (ATH)'
        : 'Sell Target';
    message += `🎯 ${targetLabel}: $${sellTarget.toFixed(2)}\n`;
  }

  if (signal.bollingerSellTarget && (sellTarget === undefined || signal.bollingerSellTarget !== sellTarget)) {
    message += `🎯 BB Upper Target: $${signal.bollingerSellTarget.toFixed(2)}\n`;
    }
  }

  message += `\n*Reasoning:* ${reasoning}`;

  return message;
}

