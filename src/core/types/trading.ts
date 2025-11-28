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
export type ExitTrigger = 'ALL_TIME_HIGH' | 'BOLLINGER_UPPER';

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
  entryPrice?: number; // Entry price if there's an active position
  sellTarget?: number; // Exit target that triggered SELL (or ATH target when holding)
  bollingerSellTarget?: number; // Bollinger-based sell target
  exitTrigger?: ExitTrigger; // Which exit condition triggered
  reasoning: string; // Human-readable explanation
}

/**
 * Trade record stored in KV (deprecated - use SignalExecution instead)
 */
export interface TradeRecord {
  entryPrice: number;
  entryDate: number; // Unix timestamp
  signalType: 'BUY';
}

/**
 * Signal execution record - tracks when a user executed a signal
 */
export interface SignalExecution {
  signalType: 'BUY' | 'SELL';
  ticker: string;
  executionPrice: number;
  executionDate: number; // Unix timestamp
  signalPrice?: number; // Price when signal was generated (optional)
}

/**
 * Active position for a user
 */
export interface ActivePosition {
  ticker: string;
  entryPrice: number;
}

/**
 * Watchlist - array of ticker symbols
 */
export type Watchlist = string[];
