---
inclusion: fileMatch
fileMatchPattern: ['**/*.ts', '**/trading-signal.ts', '**/market-data.ts', '**/indicators.ts']
---

# Trading Strategy Implementation Rules

When working with trading logic, signals, indicators, or market data, follow these rules strictly.

## Data Sources & APIs

### Yahoo Finance (Price Data)
- Endpoint: `https://query1.finance.yahoo.com/v8/finance/chart/SPY`
- Symbol: SPY (SPDR S&P 500 ETF)
- Extract: `regularMarketPrice`, OHLCV arrays, timestamps
- Requirement: Fetch 200+ days of historical data for indicator calculations

### CNN Fear & Greed Index
- Endpoint: `https://production.dataviz.cnn.io/index/fearandgreed/current`
- Extract: `rating` (string), `score` (0-100), `timestamp`
- Implementation: Use CHROME_HEADERS to avoid bot detection, normalize string/number conversions, validate response structure

## Technical Indicators

Calculate these indicators from historical price data:
- SMA 20, 50, 100, 200 (Simple Moving Averages)
- Bollinger Bands: 20-day SMA base, 2 standard deviations

## Trading Signal Logic

### BUY Signal (Entry)
Execute BUY when BOTH conditions are true:

**Condition A (Price)**: Price meets ANY of:
- `price <= SMA20 * 1.01 AND price <= lowerBB * 1.01`
- `price <= SMA50 * 1.01`
- `price <= SMA100 * 1.01`
- `price <= SMA200 * 1.01`

**Condition C (Sentiment)**: Fear & Greed Index rating is "fear" OR "extreme fear"

**Frequency Limit**: Maximum 1 trade per calendar month (enforce by month name)

### SELL Signal (Exit)
Execute SELL when profit is positive AND price meets ANY of:
- `currentPrice >= allTimeHigh * 0.99`
- `currentPrice >= bollingerUpperBand * 0.99`

Formula: `(currentPrice >= allTimeHigh * 0.99 AND profit > 0) OR (currentPrice >= bollingerUpperBand * 0.99 AND profit > 0)`

## Implementation Notes

- The 1% buffer (1.01 multiplier for entry, 0.99 for exit) provides early signal triggers
- Condition B (Bollinger lower band) is incorporated into Condition A but may be displayed separately for user information
- All conditions must be evaluated in the order specified
- Validate all API responses before processing
- Handle missing or invalid data gracefully
