# Trading Strategy Rules

## Data Sources

### Price Data
- **Source**: Yahoo Finance API
- **URL**: https://query1.finance.yahoo.com/v8/finance/chart/SPY
- **Symbol**: SPDR S&P 500 ETF (SPY)
- **Data Extracted**:
  - Current price (`regularMarketPrice`)
  - Historical price data (200+ days) for indicator calculations
  - OHLCV data (Open, High, Low, Close, Volume) arrays
  - Timestamps array

### Fear & Greed Index
- **Source**: CNN Fear & Greed Index API
- **URL**: https://production.dataviz.cnn.io/index/fearandgreed/current
- **Data Extracted**:
  - `rating`: String value ("fear", "extreme fear", "neutral", "greed", "extreme greed")
  - `score`: Numeric value (0-100)
  - `timestamp`: Timestamp of the data
  - Optional fields: `previous_close`, `previous_1_week`, `previous_1_month`, `previous_1_year`
- **Extraction Method**:
  - Uses browser-like headers (CHROME_HEADERS) to prevent bot detection
  - Normalizes response (handles string/number conversions)
  - Validates response structure before processing

## Trading Indicators Configuration
- **SMA 20**: 20-day Simple Moving Average
- **SMA 50**: 50-day Simple Moving Average
- **SMA 100**: 100-day Simple Moving Average
- **SMA 200**: 200-day Simple Moving Average
- **Bollinger Bands**: 
  - Base: SMA 20 days
  - Standard Deviation: 2

## Entry Conditions

### Condition A: Price Below SMA
- **Trigger**: Current price drops below ANY of the following SMA lines:
  - SMA 20
  - SMA 50
  - SMA 100
  - SMA 200

### Condition B: Price Near Bollinger Band Lower
- **Trigger**: Current price gets near the Bollinger Band lower band

### Condition C: Fear & Greed Index
- **Source**: CNN Fear & Greed Index
- **Required Values**: "fear" OR "extreme fear"

### Entry Rule
- **Formula**: (Condition A OR Condition B) AND Condition C
- **Action**: Execute BUY order when all conditions are met

## Trading Frequency Limit
- **Maximum Trades**: 1 per month
- **Enforcement**: Do not execute more than one trade within any 30-day period

## Exit Strategy (Profit-Taking)
- **Method**: Fibonacci Extension Targets
- **Target Level**: 100% extension level
- **Action**: Execute SELL order when price reaches the 100% Fibonacci extension target
