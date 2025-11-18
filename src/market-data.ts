/**
 * Market data fetching from Yahoo Finance
 */

import type { MarketDataResponse, PriceData } from './types.js';
import { API_URLS, TRADING_CONFIG, HTTP_HEADERS } from './constants.js';
import { enhancedFetch } from './utils/fetch.js';
import { createApiError } from './utils/errors.js';

/**
 * Fetch SPY price data from Yahoo Finance
 * @returns Market data with current price and historical data
 */
export async function fetchMarketData(): Promise<MarketDataResponse> {
  const endDate = Math.floor(Date.now() / 1000);
  const startDate = endDate - (TRADING_CONFIG.HISTORICAL_DAYS_NEEDED * 24 * 60 * 60); // 200 days ago

  const url = `${API_URLS.YAHOO_FINANCE}?period1=${startDate}&period2=${endDate}&interval=1d&events=history`;

  const response = await enhancedFetch(url, {
    method: 'GET',
    headers: HTTP_HEADERS.CHROME_HEADERS
  });

  if (!response.ok) {
    throw createApiError(
      `Failed to fetch market data: ${response.status} ${response.statusText}`,
      undefined,
      response.status
    );
  }

  const data = await response.json() as {
    chart?: {
      result?: Array<{
        meta?: {
          regularMarketPrice?: number;
        };
        timestamp?: number[];
        indicators?: {
          quote?: Array<{
            open?: (number | null)[];
            high?: (number | null)[];
            low?: (number | null)[];
            close?: (number | null)[];
            volume?: (number | null)[];
          }>;
        };
      }>;
      error?: unknown;
    };
  };

  // Check for API errors
  if (data.chart?.error) {
    throw createApiError('Yahoo Finance API returned an error', data.chart.error);
  }

  if (!data.chart?.result || data.chart.result.length === 0) {
    throw createApiError('Invalid market data response structure', data);
  }

  const result = data.chart.result[0];
  const currentPrice = result.meta?.regularMarketPrice;

  if (!currentPrice || !result.timestamp || !result.indicators?.quote?.[0]) {
    throw createApiError('Missing required market data fields', data);
  }

  const timestamps = result.timestamp;
  const quote = result.indicators.quote[0];
  const opens = quote.open || [];
  const highs = quote.high || [];
  const lows = quote.low || [];
  const closes = quote.close || [];
  const volumes = quote.volume || [];

  // Build historical data array
  const historicalData: PriceData[] = [];
  const dataLength = Math.min(
    timestamps.length,
    opens.length,
    highs.length,
    lows.length,
    closes.length,
    volumes.length
  );

  for (let i = 0; i < dataLength; i++) {
    // Skip entries with null/undefined values
    if (
      timestamps[i] &&
      opens[i] != null &&
      highs[i] != null &&
      lows[i] != null &&
      closes[i] != null &&
      volumes[i] != null
    ) {
      historicalData.push({
        date: timestamps[i] as number,
        open: opens[i] as number,
        high: highs[i] as number,
        low: lows[i] as number,
        close: closes[i] as number,
        volume: volumes[i] as number
      });
    }
  }

  // Sort by date (oldest first) for indicator calculations
  historicalData.sort((a, b) => a.date - b.date);

  return {
    currentPrice,
    historicalData
  };
}

