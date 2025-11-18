/**
 * Technical indicator calculations
 */

import type { PriceData, TechnicalIndicators } from './types.js';
import { TRADING_CONFIG } from './constants.js';

/**
 * Calculate Simple Moving Average (SMA)
 * @param prices - Array of closing prices
 * @param period - Period for SMA calculation
 * @returns SMA value
 */
function calculateSMA(prices: number[], period: number): number {
  if (prices.length < period) {
    throw new Error(`Insufficient data for SMA ${period}: need ${period} values, got ${prices.length}`);
  }

  const slice = prices.slice(-period);
  const sum = slice.reduce((acc, val) => acc + val, 0);
  return sum / period;
}

/**
 * Calculate standard deviation
 * @param values - Array of values
 * @param mean - Mean of the values
 * @returns Standard deviation
 */
function calculateStdDev(values: number[], mean: number): number {
  const variance = values.reduce((acc, val) => {
    const diff = val - mean;
    return acc + (diff * diff);
  }, 0) / values.length;
  return Math.sqrt(variance);
}

/**
 * Calculate Bollinger Bands
 * @param prices - Array of closing prices
 * @param period - Period for Bollinger Bands (default: 20)
 * @param stdDev - Standard deviation multiplier (default: 2)
 * @returns Object with upper, middle (SMA), and lower bands
 */
function calculateBollingerBands(
  prices: number[],
  period: number = TRADING_CONFIG.BOLLINGER_PERIOD,
  stdDev: number = TRADING_CONFIG.BOLLINGER_STDDEV
): { upper: number; middle: number; lower: number } {
  if (prices.length < period) {
    throw new Error(`Insufficient data for Bollinger Bands: need ${period} values, got ${prices.length}`);
  }

  const sma = calculateSMA(prices, period);
  const slice = prices.slice(-period);
  const std = calculateStdDev(slice, sma);

  return {
    upper: sma + (std * stdDev),
    middle: sma,
    lower: sma - (std * stdDev)
  };
}

/**
 * Calculate all technical indicators from historical price data
 * @param historicalData - Array of historical price data points
 * @returns Technical indicators object
 */
export function calculateIndicators(historicalData: PriceData[]): TechnicalIndicators {
  if (historicalData.length < TRADING_CONFIG.HISTORICAL_DAYS_NEEDED) {
    throw new Error(
      `Insufficient historical data: need at least ${TRADING_CONFIG.HISTORICAL_DAYS_NEEDED} days, got ${historicalData.length}`
    );
  }

  // Extract closing prices (most recent data is at the end)
  const closingPrices = historicalData.map(d => d.close);

  // Calculate SMAs
  const sma20 = calculateSMA(closingPrices, 20);
  const sma50 = calculateSMA(closingPrices, 50);
  const sma100 = calculateSMA(closingPrices, 100);
  const sma200 = calculateSMA(closingPrices, 200);

  // Calculate Bollinger Bands (based on SMA 20)
  const bollinger = calculateBollingerBands(closingPrices, TRADING_CONFIG.BOLLINGER_PERIOD, TRADING_CONFIG.BOLLINGER_STDDEV);

  return {
    sma20,
    sma50,
    sma100,
    sma200,
    bollingerUpper: bollinger.upper,
    bollingerMiddle: bollinger.middle,
    bollingerLower: bollinger.lower
  };
}

