# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## 2025-11-18

### Added
- Trading signal feature: automated buy/sell recommendations based on technical indicators (SMA, Bollinger Bands) and Fear & Greed Index
- Market data integration: fetch price data from Yahoo Finance for any ticker symbol
- `/now` command enhancement: optional ticker parameter to get trading signals for any ticker (e.g., `/now AAPL`, default: SPY)
- `/execute` command: record signal executions with optional date parameter (format: `/execute TICKER PRICE [YYYY-MM-DD]`)
- `/executions` command: view execution history (optionally filtered by ticker)
- Per-user execution tracking: each user has their own execution history and active positions
- Trading signal evaluation: BUY signals when price is below SMA or near Bollinger lower band AND Fear & Greed Index shows fear/extreme fear
- Color-coded signal indicators: 🟢 BUY, 🟡 HOLD, 🔴 SELL
- TradingView chart links in signal messages
- Watchlist feature: per-user watchlist for managing tickers to monitor
- `/watchlist` command: view, add, or remove tickers from your watchlist
- Default watchlist: all users start with $SPY in their watchlist
- Auto-add to watchlist: opening a position (BUY) automatically adds that ticker to your watchlist
- Watchlist-based signals: scheduled broadcasts and `/now` command return trading signals for all tickers in your watchlist

### Changed
- Scheduled task cron schedule: runs at specific times, Monday-Friday: 09:00, 14:30, 21:00, and 01:00 UTC (next day)
- `/now` command: now includes trading signal evaluation and display; when no ticker specified, returns signals for all tickers in watchlist
- Scheduled broadcasts: now send one message per ticker per user based on each user's watchlist
- Trading signals: always sent to users (HOLD signal when data unavailable)
- Execution tracking: signals are recommendations only; execution tracked separately per user
- Trading frequency limit: changed from 30-day rolling window to calendar month-based (once per month)
- Active positions: users with open positions only see SELL/HOLD signals (no additional BUY signals)
- Error handling: improved graceful handling of data source failures
- Security: enhanced input validation and URL encoding for market data fetching
- Exit strategy: SELL now requires a profitable position and can trigger at either all-time highs or near the Bollinger upper band (within 1%)
- Watchlist management: removing the last ticker automatically re-adds SPY to ensure users always have at least one ticker
- Watchlist auto-initialization: existing subscribed users without a watchlist are automatically assigned the default watchlist (SPY) on the first scheduled job run or first /now command

### Technical Details
- New modules: `market-data.ts`, `indicators.ts`, `trading-signal.ts`, `utils/trades.ts`, `utils/executions.ts`, `utils/watchlist.ts`
- New test files: `indicators.test.js`, `trading-signal.test.js`, `executions.test.js`, `watchlist.test.js`
- User-specific position tracking and execution history management
- Flexible indicator calculations with fallback handling for insufficient historical data
- Watchlist storage: per-user watchlists stored in KV with key pattern `watchlist:${chatId}`
- Watchlist uniqueness: all tickers stored in uppercase with case-insensitive duplicate prevention

### Dependencies
- Bumped `@cloudflare/workers-types` from `^4.20251014.0` to `^4.20251117.0`
- Bumped `wrangler` from `^4.45.3` to `^4.48.0`
- Bumped `@types/node` from `^24.9.2` to `^24.10.1`
