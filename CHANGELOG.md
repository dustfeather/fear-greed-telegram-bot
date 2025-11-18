# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## 2025-11-18

### Added
- Trading signal feature that evaluates buy/sell signals based on technical indicators and Fear & Greed Index
- SPY (SPDR S&P 500 ETF) price data fetching from Yahoo Finance API
- Technical indicator calculations:
  - Simple Moving Averages (SMA) for 20, 50, 100, and 200 day periods
  - Bollinger Bands (SMA 20, Standard Deviation 2)
- Trading signal evaluation logic:
  - Condition A: Price below any SMA line (20, 50, 100, or 200)
  - Condition B: Price within 1% of Bollinger Band lower band or below it
  - Condition C: Fear & Greed Index rating is "fear" or "extreme fear"
  - Entry rule: (Condition A OR Condition B) AND Condition C
- Trading frequency limit enforcement (maximum 1 trade per 30 days)
- Fibonacci extension target calculation for SELL signals (100% extension level)
- Trade history management with KV storage
- Active position tracking for exit signal evaluation
- Trading signal messages integrated into `/now` command and scheduled tasks
- Comprehensive test suite for indicators and trading signals

### Changed
- Enhanced `/now` command to include trading signal evaluation and display
- Updated scheduled task handler to include trading signal information in messages
- Extended type definitions to support trading data structures
- Added trading-related constants and configuration
- Trading signals are now always sent to users, even when data sources are unavailable
- When market data or Fear & Greed Index data is unavailable, a HOLD signal is sent with reasoning explaining the data unavailability
- Signal messages now always include a trading signal (BUY/SELL/HOLD) with clear reasoning, ensuring users always receive actionable information
- Improved error handling to gracefully handle data source failures while still providing users with signal information

### Technical Details
- New modules:
  - `src/market-data.ts`: Fetches SPY price data from Yahoo Finance
  - `src/indicators.ts`: Calculates technical indicators (SMA, Bollinger Bands)
  - `src/trading-signal.ts`: Evaluates trading signals based on strategy rules
  - `src/utils/trades.ts`: Manages trade history and frequency limits
- New test files:
  - `tests/indicators.test.js`: Unit tests for indicator calculations
  - `tests/trading-signal.test.js`: Integration tests for signal evaluation
- Added `createDataUnavailableSignal()` function in `src/trading-signal.ts` to generate HOLD signals when data sources fail
- Modified `handleScheduled()` to always generate and send a signal, using fallback HOLD signal when evaluation fails
- Updated `formatTradingSignalMessage()` to handle data unavailable scenarios with simplified message format
- Enhanced test coverage for data unavailability scenarios

