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

### Changed
- Scheduled task cron schedule: runs at specific times, Monday-Friday: 09:00, 14:30, 21:00, and 01:00 UTC (next day)
- `/now` command: now includes trading signal evaluation and display
- Trading signals: always sent to users (HOLD signal when data unavailable)
- Execution tracking: signals are recommendations only; execution tracked separately per user
- Trading frequency limit: changed from 30-day rolling window to calendar month-based (once per month)
- Active positions: users with open positions only see SELL/HOLD signals (no additional BUY signals)
- Error handling: improved graceful handling of data source failures
- Security: enhanced input validation and URL encoding for market data fetching
- Exit strategy: SELL now requires a profitable position and can trigger at either all-time highs or near the Bollinger upper band (within 1%)

### Technical Details
- New modules: `market-data.ts`, `indicators.ts`, `trading-signal.ts`, `utils/trades.ts`, `utils/executions.ts`
- New test files: `indicators.test.js`, `trading-signal.test.js`, `executions.test.js`
- User-specific position tracking and execution history management
- Flexible indicator calculations with fallback handling for insufficient historical data

### Dependencies
- Bumped `@cloudflare/workers-types` from `^4.20251014.0` to `^4.20251117.0`
- Bumped `wrangler` from `^4.45.3` to `^4.48.0`
- Bumped `@types/node` from `^24.9.2` to `^24.10.1`
