/**
 * Constants used throughout the application
 */

// KV Storage Keys
export const KV_KEYS = {
  CHAT_IDS: 'chat_ids',
  FEAR_GREED_CACHE: 'fear_greed_cache'
} as const;

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
  QUICKCHART_BASE: 'https://quickchart.io'
} as const;

// Telegram Commands
export const COMMANDS = {
  START: '/start',
  STOP: '/stop',
  HELP: '/help',
  NOW: '/now'
} as const;

// Message Templates
export const MESSAGES = {
  SUBSCRIBED: 'You\'ve subscribed to Fear and Greed Index alerts.',
  UNSUBSCRIBED: 'You\'ve unsubscribed from Fear and Greed Index alerts.',
  HELP: `
Available commands:
/start - Subscribe to Fear and Greed Index alerts.
/stop - Unsubscribe from Fear and Greed Index alerts.
/now - Get the current Fear and Greed Index rating.
/help - Show this help message.
`
} as const;

// HTTP Headers
export const HTTP_HEADERS = {
  // Headers for CNN API (API requires full browser-like headers to prevent bot detection)
  // Note: Accept-Encoding header removed as it's handled automatically by the fetch API
  CNN_API: {
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
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

