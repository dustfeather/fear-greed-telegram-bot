# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## 2025-11-28

### Added
- Jest testing framework with automatic Wrangler dev server management
- D1 database support with SQL repositories replacing KV storage for all data operations
- SQL migration scripts with proper schema, indexes, and foreign key constraints
- Property-based tests using fast-check for D1 operations, migration, and validation
- Comprehensive testing documentation (`.kiro/steering/testing.md`, updated `TESTING.md`, `README.md`, `CONTRIBUTING.md`)

### Changed
- **Completed Jest migration**: All 18 test files migrated from custom TestRunner to Jest (171+ tests passing)
- **Migrated from KV to D1**: All data storage now uses D1 database with SQL repositories
- Tests now use Jest's `expect()` API and organized with `describe()` blocks
- Reorganized codebase into feature-based modules: `core/`, `telegram/`, `user-management/`, `trading/`, `market-data/`, `scheduler/`
- Improved architecture with clear separation of concerns (handlers → services → repositories)

### Fixed
- Added missing test helper exports (`TestRunner`, `assertEqual`, `assertIncludes`, `assertNotIncludes`) to fix 3 failing test suites
- Fixed unbound variable error in `scripts/test-worker.sh` by moving color variable definitions before first use
- Fixed worker integration tests to handle missing `TELEGRAM_WEBHOOK_SECRET` gracefully: tests now expect 401 responses when webhook secret is not configured instead of failing
- Fixed CI test job to create `.dev.vars` file from GitHub secrets, allowing tests to properly authenticate with the test worker
- Fixed Jest hanging after test completion: added `--forceExit` flag to test scripts to force Jest to exit after tests complete, preventing hang from lingering Wrangler process handles

### Removed
- Custom TestRunner class and assertion helpers
- Legacy test runner script and `test:legacy` npm script
- All KV-related code, repositories, and configuration

### Dependencies
- Bumped `@cloudflare/workers-types` from `^4.20251126.0` to `^4.20251127.0`

## 2025-11-27

### Added
- Bank holiday detection: scheduled jobs now skip execution on US stock market holidays (New Year's Day, MLK Day, Presidents' Day, Good Friday, Memorial Day, Juneteenth, Independence Day, Labor Day, Thanksgiving, Christmas)
- Market closed notices: manual `/now` requests on holidays include a notice that markets are closed
- Weekend observation rules: holidays falling on weekends are automatically observed on the adjacent weekday (Friday for Saturday, Monday for Sunday)

### Dependencies
- Added `fast-check` `^3.23.1` for property-based testing
- Bumped `wrangler` from `^4.50.0` to `^4.51.0`
- Bumped `@cloudflare/kv-asset-handler` from `^0.4.0` to `^0.4.1`

### Technical Details
- New module: `src/utils/holidays.ts` with holiday detection logic and UTC timezone consistency
- Enhanced `handleScheduled` in `src/sched.ts` to check for bank holidays before processing
- Enhanced `/now` command handler in `src/index.ts` to display market closed notices
- Comprehensive test coverage: 22 unit tests and 6 integration tests including property-based tests for correctness verification

## 2025-11-26

### Dependencies
- Bumped `@cloudflare/workers-types` from `^4.20251117.0` to `^4.20251125.0`
- Bumped `wrangler` from `^4.49.0` to `^4.50.0`

## 2025-11-19

### Added
- Admin command `/subscribers`: admin-only command to list all subscribed Telegram users with their usernames
- Automatic cleanup: users who have blocked the bot are automatically unsubscribed when listing subscribers

### Changed
- SELL signal formula: updated to trigger when (price >= allTimeHigh * 0.99 AND profit > 0) OR (price >= bollingerUpper * 0.99 AND profit > 0), allowing earlier exit signals when price is within 1% of targets

### Technical Details
- New module: `src/utils/telegram.ts` with `getChatInfo` function for fetching user information from Telegram API
- New function: `listSubscribers` in `src/subs.ts` for retrieving and formatting subscriber list
- Admin command access control: `/subscribers` command only accessible to admin (ADMIN_CHAT_ID), silently ignored for non-admin users
- New test file: `tests/admin.test.js` for testing admin command functionality

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
- BUY signal formula: updated to (price <= SMA20 AND (price within 1% or lower than lowerBB)) OR price <= SMA50 OR price <= SMA100 OR price <= SMA200, while still requiring Fear & Greed Index to be fear/extreme fear
- BUY signal formula: added 1% buffer to all SMA checks (price within 1% of SMA OR price <= SMA), allowing signals to trigger slightly before price hits the SMA for earlier entry opportunities

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
