/**
 * Market data fetching from Yahoo Finance
 */

import type { MarketDataResponse, PriceData } from './types.js';
import { TRADING_CONFIG, HTTP_HEADERS } from './constants.js';
import { enhancedFetch } from './utils/fetch.js';
import { createApiError } from './utils/errors.js';
import { isValidTicker } from './utils/validation.js';

/**
 * Fetch price data from Yahoo Finance
 * @param ticker - Ticker symbol (default: 'SPY')
 * @returns Market data with current price and historical data
 * @throws Error if ticker is invalid or API call fails
 */
export async function fetchMarketData(ticker: string = 'SPY'): Promise<MarketDataResponse> {
  // Validate and sanitize ticker to prevent URL injection attacks
  const validation = isValidTicker(ticker);
  if (!validation.isValid) {
    throw createApiError(`Invalid ticker symbol: "${ticker}". Ticker must be 1-10 alphanumeric characters.`);
  }
  const sanitizedTicker = validation.ticker;
  
  const endDate = Math.floor(Date.now() / 1000);
  // Request more days to account for weekends and holidays
  // 200 trading days ≈ 280-300 calendar days (200 * 7/5 = 280 trading days per 280 calendar days)
  // Use 1.5x multiplier to ensure we get enough trading days even with holidays
  const calendarDaysToRequest = Math.ceil(TRADING_CONFIG.HISTORICAL_DAYS_NEEDED * 1.5);
  const startDate = endDate - (calendarDaysToRequest * 24 * 60 * 60);

  // Construct URL with validated ticker symbol
  // Using encodeURIComponent for defense-in-depth, though validation ensures alphanumeric-only
  const encodedTicker = encodeURIComponent(sanitizedTicker);
  const baseUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodedTicker}`;
  const url = `${baseUrl}?period1=${startDate}&period2=${endDate}&interval=1d&events=history`;
  
  console.log(`Fetching market data for ${sanitizedTicker} from: ${url}`);

  const response = await enhancedFetch(url, {
    method: 'GET',
    headers: HTTP_HEADERS.CHROME_HEADERS
  });

  if (!response.ok) {
    // Try to get error details from response body
    let errorDetails: unknown;
    try {
      const errorBody = await response.text();
      errorDetails = errorBody;
      console.error(`Yahoo Finance API error (${response.status}):`, errorBody);
    } catch {
      // Ignore if we can't read the error body
    }
    throw createApiError(
      `Failed to fetch market data for ${ticker}: ${response.status} ${response.statusText}`,
      errorDetails,
      response.status
    );
  }

  let data: {
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

  try {
    data = await response.json() as typeof data;
  } catch (jsonError) {
    console.error(`Failed to parse Yahoo Finance JSON response for ${ticker}:`, jsonError);
    const responseText = await response.text().catch(() => 'Unable to read response body');
    console.error(`Response body (first 500 chars):`, responseText.substring(0, 500));
    throw createApiError(`Failed to parse Yahoo Finance response for ${ticker}`, jsonError);
  }

  // Check for API errors
  if (data.chart?.error) {
    console.error('Yahoo Finance API error in response:', JSON.stringify(data.chart.error, null, 2));
    throw createApiError(`Yahoo Finance API returned an error for ${ticker}`, data.chart.error);
  }

  if (!data.chart?.result || data.chart.result.length === 0) {
    console.error('Invalid market data response structure for', ticker, ':', JSON.stringify(data, null, 2));
    throw createApiError(`Invalid market data response structure for ${ticker}`, data);
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

