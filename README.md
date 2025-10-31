# Fear and Greed Telegram Bot

This project is a Telegram bot that provides updates on the Fear and Greed Index. Users can subscribe to receive alerts when the index indicates fear or extreme fear.

## Features

- Subscribe to Fear and Greed Index alerts
- Unsubscribe from alerts
- Get the current Fear and Greed Index rating
- Help command to show available commands

## Commands

- `/start` - Subscribe to Fear and Greed Index alerts.
- `/stop` - Unsubscribe from Fear and Greed Index alerts.
- `/now` - Get the current Fear and Greed Index rating.
- `/help` - Show help message.

## Installation

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

## Configuration

### Required Environment Variables

- `TELEGRAM_BOT_TOKEN_SECRET`: Your Telegram bot token from BotFather
- `TELEGRAM_WEBHOOK_SECRET`: A secure random string for verifying webhook requests (generate using `openssl rand -hex 32`)
- `ADMIN_CHAT_ID`: Chat ID for error notifications (optional but recommended)
- `FEAR_GREED_KV_NAMESPACE_ID`: KV namespace ID for storing chat IDs
- `FEAR_GREED_KV_PREVIEW_ID`: KV namespace preview ID for local development (optional)

### Local Development

1. Create `.dev.vars` file (see Installation step 3)
2. Start the development server:
   ```sh
   npm start
   ```
   or
   ```sh
   npm run dev
   ```

### Deployment

#### Using GitHub Actions (Recommended)

This project uses GitHub Actions to dynamically generate `wrangler.jsonc` from repository secrets. 

1. **Set up GitHub Secrets** in your repository settings:
   - `TELEGRAM_BOT_TOKEN_SECRET`: Your Telegram bot token
   - `TELEGRAM_WEBHOOK_SECRET`: A secure random string for verifying webhook requests (generate using `openssl rand -hex 32`)
   - `ADMIN_CHAT_ID`: Admin chat ID for error notifications
   - `FEAR_GREED_KV_NAMESPACE_ID`: Your production KV namespace ID
   - `FEAR_GREED_KV_PREVIEW_ID`: Your preview KV namespace ID (optional)
   - `CF_API_TOKEN`: Cloudflare API token with Workers permissions (requires Workers Scripts: Edit, Workers KV Storage: Edit, Workers Secrets: Edit, Account Settings: Read)
   - `CF_ACCOUNT_ID`: Your Cloudflare account ID

2. **Configure GitHub Actions** to:
   - Generate `wrangler.jsonc` from environment variables using the generation script
   - Deploy using `wrangler deploy`

3. **Create KV Namespaces** (if not already created):
   ```sh
   npx wrangler kv namespace create "FEAR_GREED_KV"
   npx wrangler kv namespace create "FEAR_GREED_KV" --preview
   ```

#### Cloudflare Secrets API (Current Implementation)

This project uses Cloudflare Secrets API to securely store sensitive values (`TELEGRAM_BOT_TOKEN_SECRET`, `TELEGRAM_WEBHOOK_SECRET`, and `ADMIN_CHAT_ID`). The GitHub Actions workflow automatically uploads these secrets during deployment using `npx wrangler secret bulk`.

Secrets are managed through the workflow and are never stored in `wrangler.jsonc`, following Cloudflare's security best practices.

**Security Note:** The `TELEGRAM_WEBHOOK_SECRET` is used to verify that incoming webhook requests are actually from Telegram. This prevents unauthorized access to your bot endpoints.

For local development, create a `.dev.vars` file (see Installation step 3 above).

### Testing

#### Manual Testing Scripts

Test all endpoints with the provided scripts:

**Linux/Mac (Bash):**
```bash
# Make executable (first time only)
chmod +x scripts/test-worker.sh

# Run tests against local dev server
./scripts/test-worker.sh

# Or test against deployed worker
./scripts/test-worker.sh https://your-worker.workers.dev
```

**Windows (PowerShell):**
```powershell
# Run tests against local dev server
.\scripts\test-worker.ps1

# Or test against deployed worker
.\scripts\test-worker.ps1 -WorkerUrl "https://your-worker.workers.dev"
```

The test scripts will verify:
- `/start` command
- `/stop` command
- `/help` command
- `/now` command
- Unknown commands
- Invalid payloads
- GET requests (should return 405)
- Scheduled/cron endpoint

#### Testing Scheduled Events

Test cron triggers locally:
```sh
npx wrangler dev --test-scheduled
curl "http://localhost:8787/__scheduled?cron=0+*+*+*+*"
```

## Usage

1. **Deploy your bot** (if not already deployed):
   ```sh
   npm run deploy
   ```

2. **Telegram webhook** (required for Telegram to send updates to your bot):
   
   **Automatic Setup (Recommended):**
   - The webhook is automatically configured during CI/CD deployment via GitHub Actions
   - No manual setup needed after initial deployment
   - The webhook is updated automatically on every deployment to ensure it always points to the correct URL
   
   **Manual Setup (if needed):**
   ```sh
   # Set webhook to your deployed worker (replace with your actual Worker URL)
   npm run webhook:setup -- https://your-worker-name.your-subdomain.workers.dev
   
   # Check webhook status
   npm run webhook:info
   
   # Remove webhook (if needed)
   npm run webhook:setup -- ""
   ```

   **Important:** The webhook must be set up for Telegram to deliver messages to your bot. Without it, commands sent directly in Telegram won't reach your worker. The webhook setup is now automated in CI/CD, so you typically only need to set it manually if:
   - You're deploying manually (not using GitHub Actions)
   - Your Worker URL changes
   - You need to remove or change the webhook

3. **Interact with the bot** in Telegram using the commands:
   - `/start` - Subscribe to alerts
   - `/stop` - Unsubscribe
   - `/help` - Show help
   - `/now` - Get current index

## Project Structure

- `src/index.ts` - Main Worker entry point (HTTP and scheduled handlers)
- `src/send.ts` - Telegram message sending utilities
- `src/subs.ts` - Subscription management (KV storage)
- `src/sched.ts` - Scheduled event handler (Fear & Greed Index fetching)
- `src/chart.ts` - Chart generation using QuickChart
- `scripts/generate-wrangler-config.js` - Script to generate wrangler.jsonc from environment variables
- `.dev.vars.example` - Example file for local development secrets
