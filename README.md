# Fear and Greed Telegram Bot

![Logo](misc/logo.png)

[![Deploy to Cloudflare Workers](https://github.com/dustfeather/fear-greed-telegram-bot/actions/workflows/deploy.yml/badge.svg)](https://github.com/dustfeather/fear-greed-telegram-bot/actions/workflows/deploy.yml)

A Telegram bot that provides automated trading signals based on the Fear and Greed Index and technical indicators. Features personalized watchlists, execution tracking, and automatic position management with BUY/SELL/HOLD recommendations using SMA, Bollinger Bands, and market sentiment analysis.

## Features

- Subscribe to Fear and Greed Index alerts
- Unsubscribe from alerts
- Get the current Fear and Greed Index rating with visual gauge chart
- Trading signal feature: automated buy/sell recommendations based on technical indicators (SMA, Bollinger Bands) and Fear & Greed Index
- Market data integration: fetch price data from Yahoo Finance for any ticker symbol
- Per-user watchlist: manage your own list of tickers to monitor
- Scheduled automatic broadcasts: receive trading signals for all tickers in your watchlist on weekdays
- Per-user execution tracking: record and view your trading signal executions with optional date parameter
- Active position tracking: automatically tracks open positions and adjusts signals accordingly
- Trading frequency limits: calendar month-based restrictions (once per month)
- Color-coded signal indicators: 🟢 BUY, 🟡 HOLD, 🔴 SELL
- TradingView chart links in signal messages
- Deployment notifications: automatic notifications to subscribers when new versions are deployed
- Admin features: admin-only commands for managing subscribers

## Commands

- `/start` - Subscribe to Fear and Greed Index alerts.
- `/stop` - Unsubscribe from Fear and Greed Index alerts.
- `/now` - Get trading signals for all tickers in your watchlist.
- `/now TICKER` - Get trading signal for a specific ticker (e.g., `/now AAPL`).
- `/watchlist` - View your watchlist.
- `/watchlist add TICKER` - Add ticker to your watchlist (e.g., `/watchlist add AAPL`).
- `/watchlist remove TICKER` - Remove ticker from your watchlist (e.g., `/watchlist remove SPY`).
- `/execute TICKER PRICE [DATE]` - Record execution of a signal at a specific price (e.g., `/execute SPY 400.50`). Optionally specify date as YYYY-MM-DD (e.g., `/execute SPY 400.50 2024-01-15`).
- `/executions` - View your execution history.
- `/executions TICKER` - View execution history for a specific ticker (e.g., `/executions SPY`).
- `/help` - Show help message.

## Installation

![QR Code](misc/QR.png)

Scan the QR code above to open the bot in Telegram, or search for `@CNN_FEAR_GREED_ALERT_BOT`.

1. Clone the repository:
    ```sh
    git clone https://github.com/yourusername/fear-greed-telegram-bot.git
    cd fear-greed-telegram-bot
    ```

2. Install dependencies:
    ```sh
    npm install
    ```

3. Set up local development environment:
    - Copy `.dev.vars.example` to `.dev.vars`:
      ```sh
      cp .dev.vars.example .dev.vars
      ```
    - Edit `.dev.vars` and fill in your values:
      - `TELEGRAM_BOT_TOKEN_SECRET`: Your Telegram bot token (get from [@BotFather](https://t.me/BotFather))
      - `TELEGRAM_WEBHOOK_SECRET`: A secure random string for verifying webhook requests (generate using `openssl rand -hex 32`)
      - `ADMIN_CHAT_ID`: Your chat ID for error notifications (optional)
      - `FEAR_GREED_KV_NAMESPACE_ID`: KV namespace ID (optional for local dev)

4. Start the development server:
   ```sh
   npm run dev
   ```

### Deployment

For comprehensive deployment instructions, see [DEPLOYMENT.md](DEPLOYMENT.md).

### Testing

For comprehensive testing instructions, see [TESTING.md](TESTING.md).

## Quick Start

1. **Deploy your bot** (see [DEPLOYMENT.md](DEPLOYMENT.md) for details):
   ```sh
   npm run deploy
   ```

2. **Set up Telegram webhook** (automatically configured via GitHub Actions, or manually):
   ```sh
   npm run webhook:setup -- https://your-worker-name.your-subdomain.workers.dev
   ```

3. **Start using the bot** - Scan the QR code above or search for `@CNN_FEAR_GREED_ALERT_BOT` in Telegram, then use `/start` to subscribe. See the [Commands](#commands) section above for all available commands.

![Bot Screenshot](misc/screenshot.png)

*Example of a trading signal message from the bot*

## Project Structure

- `src/index.ts` - Main Worker entry point (HTTP and scheduled handlers)
- `src/send.ts` - Telegram message sending utilities
- `src/subs.ts` - Subscription management (KV storage)
- `src/sched.ts` - Scheduled event handler (Fear & Greed Index fetching and trading signals)
- `src/chart.ts` - Chart generation using QuickChart
- `src/market-data.ts` - Market data fetching from Yahoo Finance
- `src/indicators.ts` - Technical indicator calculations (SMA, Bollinger Bands)
- `src/trading-signal.ts` - Trading signal evaluation logic
- `src/utils/trades.ts` - Trade history and frequency limit management
- `src/utils/executions.ts` - Per-user execution tracking
- `src/utils/validation.ts` - Input validation utilities
- `scripts/generate-wrangler-config.js` - Script to generate wrangler.jsonc from environment variables
- `.dev.vars.example` - Example file for local development secrets
