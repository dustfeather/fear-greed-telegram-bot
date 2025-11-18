# Testing Guide

## Local Development Testing

### Test Your Telegram Bot Locally

Run your worker locally for development and testing:

```bash
npm run dev
# or
npx wrangler dev
```

This starts your worker at `http://localhost:8787`. You can:

- **Test Telegram webhook payloads:**
  ```bash
  curl -X POST http://localhost:8787 \
    -H "Content-Type: application/json" \
    -H "X-Telegram-Bot-Api-Secret-Token: your_webhook_secret_here" \
    -d '{
      "message": {
        "text": "/start",
        "chat": {"id": 123456789},
        "from": {"id": 123456789, "first_name": "Test"},
        "message_id": 1
      }
    }'
  ```
  
  **Note:** Replace `your_webhook_secret_here` with the value from your `.dev.vars` file (`TELEGRAM_WEBHOOK_SECRET`). Requests without this header will return 401 Unauthorized.

- **Test different commands:**
  - `/start` - Subscribe
  - `/stop` - Unsubscribe  
  - `/help` - Help message
  - `/now` - Get trading signals for all tickers in your watchlist
  - `/now TICKER` - Get trading signal for a specific ticker (e.g., `/now AAPL`)
  - `/watchlist` - View your watchlist
  - `/watchlist add TICKER` - Add ticker to your watchlist
  - `/watchlist remove TICKER` - Remove ticker from your watchlist
  - `/execute TICKER PRICE [DATE]` - Record execution of a signal at a specific price
  - `/executions` - View your execution history
  - `/executions TICKER` - View execution history for a specific ticker

- **View console output:** All `console.log()` statements will appear in your terminal

### Test Cron Triggers Locally

You can test scheduled/cron handlers locally:

```bash
# Start dev server with scheduled testing enabled (in one terminal)
npm run dev:scheduled
# or
npx wrangler dev --test-scheduled

# In another terminal, trigger the scheduled handler
curl "http://localhost:8787/__scheduled?cron=0+14+*+*+1-5"
```

**Note:** The scheduled endpoint (`/__scheduled`) is only available when running with the `--test-scheduled` flag. The actual cron schedule runs on weekdays (Monday-Friday) between 14:00-21:00 UTC (`0 14-21 * * 1-5`).

### Using `.dev.vars` for Local Development

Your local environment variables are loaded from `.dev.vars`:
- `TELEGRAM_BOT_TOKEN_SECRET` - Your bot token (required)
- `TELEGRAM_WEBHOOK_SECRET` - Secure random string for verifying webhook requests (required)
- `ADMIN_CHAT_ID` - Admin chat ID for notifications (optional but recommended)
- `FEAR_GREED_KV_NAMESPACE_ID` - KV namespace for testing (optional for local dev)
- `FEAR_GREED_KV_PREVIEW_ID` - Preview KV namespace (optional)

**Note:** The `wrangler.jsonc` file is automatically generated when you run `npm run dev`. It reads from `.dev.vars` or environment variables. If `FEAR_GREED_KV_NAMESPACE_ID` is not set, a placeholder will be used (KV operations won't work, but other functionality will).

**Important:** The `TELEGRAM_WEBHOOK_SECRET` is required for webhook authentication. All POST requests to the worker must include the `X-Telegram-Bot-Api-Secret-Token` header with this secret value. The test scripts automatically include this header when the secret is present in `.dev.vars`.

### Automated Testing Scripts

Use the provided test scripts to verify all endpoints:

**Linux/Mac:**
```bash
chmod +x scripts/test-worker.sh
./scripts/test-worker.sh
```

**Windows:**
```powershell
.\scripts\test-worker.ps1
```

The scripts test:
- All bot commands (`/start`, `/stop`, `/help`, `/now`)
- Unknown commands handling
- Invalid payload handling
- Webhook authentication (401 when secret is missing)
- GET request rejection (405)
- Scheduled endpoint

You can also test against a deployed worker:
```bash
# Linux/Mac
./scripts/test-worker.sh https://your-worker.workers.dev

# Windows
.\scripts\test-worker.ps1 -WorkerUrl "https://your-worker.workers.dev"
```

### Testing Checklist

- [ ] Worker starts with `npm run dev`
- [ ] Test script runs successfully: `./scripts/test-worker.sh` (or `.ps1` on Windows)
- [ ] Can send POST requests to `http://localhost:8787`
- [ ] Telegram webhook payloads are processed correctly
- [ ] Webhook authentication works (requests without `TELEGRAM_WEBHOOK_SECRET` return 401)
- [ ] Commands (`/start`, `/stop`, `/help`, `/now`, `/watchlist`, `/execute`, `/executions`) work
- [ ] Cron triggers can be tested manually with `npm run dev:scheduled`
- [ ] Console logs appear in terminal
- [ ] KV operations work (if KV namespace is configured)

### Debugging Tips

1. **Check your `.dev.vars` file:**
   - Ensure all required variables are set
   - Use test/development values (not production secrets)

2. **Watch the terminal output:**
   - All `console.log()` calls will appear there
   - Errors will be shown with stack traces

3. **Test with curl:**
   ```bash
   # Test POST endpoint (include webhook secret header)
   curl -X POST http://localhost:8787 \
     -H "Content-Type: application/json" \
     -H "X-Telegram-Bot-Api-Secret-Token: your_webhook_secret_here" \
     -d @test-payload.json
   ```
   
   **Note:** Replace `your_webhook_secret_here` with the value from your `.dev.vars` file.

4. **Test scheduled events:**
   ```bash
   # First, start dev server with scheduled testing enabled
   npm run dev:scheduled
   
   # In another terminal, trigger scheduled handler
   curl "http://localhost:8787/__scheduled?cron=0+14+*+*+1-5"
   ```

## Production Testing

Once deployed, you can monitor logs with:

```bash
# View real-time logs
npx wrangler tail fear-greed-telegram-bot

# View only errors
npx wrangler tail fear-greed-telegram-bot --status error
```

Or view logs in the [Cloudflare Dashboard](https://dash.cloudflare.com/) under Workers & Pages → fear-greed-telegram-bot → Logs.

