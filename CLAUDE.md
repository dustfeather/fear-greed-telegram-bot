# Project Guidelines

## Update Management

### Changelog Maintenance
- Update `CHANGELOG.md` using YYYY-MM-DD format for new entries
- Consolidate all changes on the same date under a single date heading
- Keep entries concise and group related changes together

### Command Documentation
- When modifying bot commands, update the "Available commands" helper message
- Ensure command descriptions are accurate and up-to-date

### Type Safety
- Run `npx tsc --noEmit` to verify no TypeScript type errors before completing work

## NPM Package Management

### When Modifying Dependencies
1. Run `npm install` to update `package-lock.json`
2. Run `npm audit` to check for security vulnerabilities
3. Address any audit findings before completing work

### Adding New Packages
- Use `npm install <package>` for runtime dependencies
- Use `npm install --save-dev <package>` for development dependencies
- Always run `npm audit` after installation
- Fix critical and high severity vulnerabilities immediately

### Lock File Management
- Never manually edit `package-lock.json`
- Commit both `package.json` and `package-lock.json` together

## Trading Strategy Implementation Rules

When working with trading logic, signals, indicators, or market data, follow these rules strictly.

### Data Sources & APIs

**Yahoo Finance (Price Data)**
- Endpoint: `https://query1.finance.yahoo.com/v8/finance/chart/SPY`
- Symbol: SPY (SPDR S&P 500 ETF)
- Extract: `regularMarketPrice`, OHLCV arrays, timestamps
- Requirement: Fetch 200+ days of historical data for indicator calculations

**CNN Fear & Greed Index**
- Endpoint: `https://production.dataviz.cnn.io/index/fearandgreed/current`
- Extract: `rating` (string), `score` (0-100), `timestamp`
- Use CHROME_HEADERS to avoid bot detection, normalize string/number conversions, validate response structure

### Technical Indicators
Calculate from historical price data:
- SMA 20, 50, 100, 200 (Simple Moving Averages)
- Bollinger Bands: 20-day SMA base, 2 standard deviations

### Trading Signal Logic

**BUY Signal (Entry)** — execute when BOTH conditions are true:

Condition A (Price) — price meets ANY of:
- `price <= SMA20 * 1.01 AND price <= lowerBB * 1.01`
- `price <= SMA50 * 1.01`
- `price <= SMA100 * 1.01`
- `price <= SMA200 * 1.01`

Condition B (Sentiment): Fear & Greed Index rating is "fear" OR "extreme fear"

Frequency Limit: Maximum 1 trade per calendar month (enforce by month name)

**SELL Signal (Exit)** — execute when profit is positive AND price meets ANY of:
- `currentPrice >= allTimeHigh * 0.99`
- `currentPrice >= bollingerUpperBand * 0.99`

### Implementation Notes
- The 1% buffer (1.01 for entry, 0.99 for exit) provides early signal triggers
- All conditions must be evaluated in the order specified
- Validate all API responses before processing
- Handle missing or invalid data gracefully
