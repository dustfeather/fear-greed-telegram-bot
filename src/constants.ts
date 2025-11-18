/**
 * Constants used throughout the application
 */

// KV Storage Keys
export const KV_KEYS = {
  CHAT_IDS: 'chat_ids',
  FEAR_GREED_CACHE: 'fear_greed_cache',
  LAST_TRADE: 'last_trade',
  ACTIVE_POSITION: 'active_position'
} as const;

/**
 * Generate user-specific KV key for execution history
 * @param chatId - User's chat ID
 * @returns KV key string
 */
export function executionHistoryKey(chatId: number | string): string {
  return `execution_history:${chatId}`;
}

/**
 * Generate user-specific KV key for active position
 * @param chatId - User's chat ID
 * @returns KV key string
 */
export function activePositionKey(chatId: number | string): string {
  return `active_position:${chatId}`;
}

/**
 * Generate user-specific KV key for watchlist
 * @param chatId - User's chat ID
 * @returns KV key string
 */
export function watchlistKey(chatId: number | string): string {
  return `watchlist:${chatId}`;
}

// Fear & Greed Index Rating Values
export const RATINGS = {
  FEAR: 'fear',
  EXTREME_FEAR: 'extreme fear',
  NEUTRAL: 'neutral',
  GREED: 'greed',
  EXTREME_GREED: 'extreme greed'
} as const;

// API URLs
export const API_URLS = {
  FEAR_GREED_INDEX: 'https://production.dataviz.cnn.io/index/fearandgreed/current',
  TELEGRAM_BASE: 'https://api.telegram.org',
  QUICKCHART_BASE: 'https://quickchart.io',
  YAHOO_FINANCE: 'https://query1.finance.yahoo.com/v8/finance/chart/SPY'
} as const;

// Telegram Commands
export const COMMANDS = {
  START: '/start',
  STOP: '/stop',
  HELP: '/help',
  NOW: '/now',
  EXECUTE: '/execute',
  EXECUTIONS: '/executions',
  WATCHLIST: '/watchlist'
} as const;

// Message Templates
export const MESSAGES = {
  SUBSCRIBED: 'You\'ve subscribed to Fear and Greed Index alerts.',
  UNSUBSCRIBED: 'You\'ve unsubscribed from Fear and Greed Index alerts.',
  HELP: `
Available commands:
/start - Subscribe to Fear and Greed Index alerts.
/stop - Unsubscribe from Fear and Greed Index alerts.
/now - Get trading signals for all tickers in your watchlist.
/now TICKER - Get trading signal for a specific ticker (e.g., /now AAPL).
/watchlist - View your watchlist.
/watchlist add TICKER - Add ticker to your watchlist (e.g., /watchlist add AAPL).
/watchlist remove TICKER - Remove ticker from your watchlist (e.g., /watchlist remove SPY).
/execute TICKER PRICE [DATE] - Record execution of a signal at a specific price (e.g., /execute SPY 400.50). Optionally specify date as YYYY-MM-DD (e.g., /execute SPY 400.50 2024-01-15).
/executions - View your execution history.
/executions TICKER - View execution history for a specific ticker (e.g., /executions SPY).
/help - Show this help message.
`
} as const;

// HTTP Headers
export const HTTP_HEADERS = {
  // Headers for external APIs (uses full browser-like headers to prevent bot detection)
  // Note: Accept-Encoding header removed as it's handled automatically by the fetch API
  CHROME_HEADERS: {
    'Accept': 'application/json',
    'Accept-Language': 'en-US,en;q=0.9,ro;q=0.8',
    'Cache-Control': 'max-age=0',
    'Dnt': '1',
    'Priority': 'u=0, i',
    'Sec-Ch-Ua': '"Chromium";v="142", "Google Chrome";v="142", "Not_A Brand";v="99"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"Windows"',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36'
  },
  TELEGRAM_API: {
    'Content-Type': 'application/json'
  }
} as const;

// Cache Configuration
export const CACHE_CONFIG = {
  FEAR_GREED_TTL_SECONDS: 300, // 5 minutes
  FEAR_GREED_TTL_MS: 300_000
} as const;

// Rate Limiting Configuration
export const RATE_LIMITS = {
  TELEGRAM_MESSAGES_PER_SECOND: 30,
  TELEGRAM_BATCH_SIZE: 30
} as const;

// Request Configuration
export const REQUEST_CONFIG = {
  TIMEOUT_MS: 10_000, // 10 seconds
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 1000, // Initial delay of 1 second
  RETRY_BACKOFF_MULTIPLIER: 2
} as const;

// Chart Configuration
export const CHART_CONFIG = {
  WIDTH: 400,
  HEIGHT: 250,
  GAUGE_SEGMENTS: [25, 45, 55, 75, 100],
  GAUGE_COLORS: ['#f06c00ff', '#ffb9a180', '#e6e6e6', '#b9ede9', '#8cd6c3']
} as const;

// Trading Configuration
export const TRADING_CONFIG = {
  SYMBOL: 'SPY',
  SMA_PERIODS: [20, 50, 100, 200] as const,
  BOLLINGER_PERIOD: 20,
  BOLLINGER_STDDEV: 2,
  BB_LOWER_THRESHOLD: 0.01, // 1% above lower band
  BB_UPPER_THRESHOLD: 0.01, // 1% above upper band
  TRADING_FREQUENCY_DAYS: 30, // Deprecated: now using calendar month restriction
  HISTORICAL_DAYS_NEEDED: 200 // Need 200 days for SMA 200
} as const;

