# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## 2025-01-20

### Added
- Optional date parameter for `/execute` command: users can now specify a custom execution date in YYYY-MM-DD format (e.g., `/execute SPY 400.50 2024-01-15`). When provided, the execution date is set to the start of the specified day (UTC). If omitted, the current timestamp is used.

## 2025-11-18

### Added
- Trading signal feature that evaluates buy/sell signals based on technical indicators and Fear & Greed Index
- SPY (SPDR S&P 500 ETF) price data fetching from Yahoo Finance API
- `/now` command now accepts optional ticker parameter to get trading signals for any ticker (default: SPY)
- Ticker validation function to ensure valid ticker symbols (1-10 alphanumeric characters)
- Support for fetching market data and generating trading signals for any ticker supported by Yahoo Finance
- Technical indicator calculations:
  - Simple Moving Averages (SMA) for 20, 50, 100, and 200 day periods
  - Bollinger Bands (SMA 20, Standard Deviation 2)
- Trading signal evaluation logic:
  - Condition A: Price below any SMA line (20, 50, 100, or 200)
  - Condition B: Price within 1% of Bollinger Band lower band or below it
  - Condition C: Fear & Greed Index rating is "fear" or "extreme fear"
  - Entry rule: (Condition A OR Condition B) AND Condition C
- Trading frequency limit enforcement (maximum 1 trade per 30 days)
- All-time high target calculation for SELL signals
- Trade history management with KV storage
- Active position tracking for exit signal evaluation
- Trading signal messages integrated into `/now` command and scheduled tasks
- Comprehensive test suite for indicators and trading signals

### Changed
- Enhanced `/now` command to include trading signal evaluation and display
- Updated `/now` command to parse optional ticker parameter (e.g., `/now AAPL`, `/now TSLA`)
- Modified `fetchMarketData()` to accept ticker parameter (defaults to 'SPY')
- Updated `evaluateTradingSignal()` and `formatTradingSignalMessage()` to support ticker parameter
- Enhanced help message to document the new ticker parameter feature
- Trading signal messages now display the ticker symbol dynamically instead of hardcoded "SPY"
- Updated scheduled task handler to include trading signal information in messages
- Extended type definitions to support trading data structures
- Added trading-related constants and configuration
- Trading signals are now always sent to users, even when data sources are unavailable
- When market data or Fear & Greed Index data is unavailable, a HOLD signal is sent with reasoning explaining the data unavailability
- Signal messages now always include a trading signal (BUY/SELL/HOLD) with clear reasoning, ensuring users always receive actionable information
- Improved error handling to gracefully handle data source failures while still providing users with signal information
- Enhanced security in `fetchMarketData()` with input validation and URL encoding to prevent URL injection attacks
- Improved URL construction in `fetchMarketData()` using direct string interpolation instead of regex replacement
- Added comprehensive error logging for Yahoo Finance API failures to aid in debugging
- Added color-coded indicators to trading signals: 🟢 (green) for BUY, 🟡 (yellow) for HOLD, 🔴 (red) for SELL
- Added TradingView chart links to ticker prices in trading signal messages (e.g., [SPY Price](https://www.tradingview.com/chart/?symbol=SPY))
- Fixed insufficient historical data issue by requesting 1.5x calendar days to account for weekends and holidays
- Made indicator calculation more flexible to handle cases with less than 200 trading days (uses fallback values with warnings)
- Improved trading signal reasoning messages to clearly explain when entry conditions are met but trading is blocked by the 30-day frequency limit
- Fixed trading signal logic: BUY signals now show as valid when entry conditions are met, even if a trade was executed today (0 days ago). The frequency limit only prevents recording a new trade, not from showing that the signal conditions are valid
- Added per-user signal execution tracking: users can manually record when they execute signals at specific prices using `/execute TICKER PRICE` command
- Added `/executions` command to view execution history (optionally filtered by ticker)
- Signals are now recommendations only - execution is tracked separately per user
- Removed automatic trade recording from signal evaluation - trades are only recorded when users explicitly execute signals
- Active positions are now user-specific - each user has their own execution history and positions
- Trading frequency limit (once per calendar month) now applies only to executed signals, not to signal generation - users can always see signals as recommendations
- Changed trading frequency limit from 30-day rolling window to calendar month-based restriction (users can execute once per calendar month, e.g., once in January, once in February)
- When a user has an active position from a previous BUY execution, they will only see SELL or HOLD signals (never another BUY) until the position is closed

### Technical Details
- New modules:
  - `src/market-data.ts`: Fetches SPY price data from Yahoo Finance
  - `src/indicators.ts`: Calculates technical indicators (SMA, Bollinger Bands)
  - `src/trading-signal.ts`: Evaluates trading signals based on strategy rules
  - `src/utils/trades.ts`: Manages trade history and frequency limits (now user-specific)
  - `src/utils/executions.ts`: Manages per-user signal execution history
- New test files:
  - `tests/indicators.test.js`: Unit tests for indicator calculations
  - `tests/trading-signal.test.js`: Integration tests for signal evaluation
  - `tests/executions.test.js`: Tests for execution tracking functionality
- Added `createDataUnavailableSignal()` function in `src/trading-signal.ts` to generate HOLD signals when data sources fail
- Modified `handleScheduled()` to always generate and send a signal, using fallback HOLD signal when evaluation fails
- Updated `formatTradingSignalMessage()` to handle data unavailable scenarios with simplified message format
- Enhanced test coverage for data unavailability scenarios
- Updated `evaluateTradingSignal()` to accept optional `chatId` parameter for user-specific position checking
- Updated `getActivePosition()`, `setActivePosition()`, `clearActivePosition()`, and `canTrade()` to be user-specific (require `chatId` parameter)
- Removed `canTrade` and `lastTradeDate` fields from `TradingSignal` interface (no longer needed for signal display)
- Deprecated `recordTrade()` function - use `recordExecution()` from executions.ts instead
- Changed `canTrade()` to use calendar month comparison instead of 30-day rolling window
- Added `getMonthName()` helper function to format month names in error messages

### Dependencies
- Bumped `@cloudflare/workers-types` from `^4.20251014.0` to `^4.20251117.0`
- Bumped `wrangler` from `^4.45.3` to `^4.48.0`
- Bumped `@types/node` from `^24.9.2` to `^24.10.1`

