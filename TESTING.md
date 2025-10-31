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
    -d '{
      "message": {
        "text": "/start",
        "chat": {"id": 123456789},
        "from": {"id": 123456789, "first_name": "Test"},
        "message_id": 1
      }
    }'
  ```

- **Test different commands:**
  - `/start` - Subscribe
  - `/stop` - Unsubscribe  
  - `/help` - Help message
  - `/now` - Get current Fear & Greed Index

- **View console output:** All `console.log()` statements will appear in your terminal

### Test Cron Triggers Locally

You can test scheduled/cron handlers locally:

```bash
# Start dev server (in one terminal)
npm run dev

# In another terminal, trigger the scheduled handler
curl "http://localhost:8787/__scheduled?cron=0+14-21+*+*+1-5"
```

### Using `.dev.vars` for Local Development

Your local environment variables are loaded from `.dev.vars`:
- `TELEGRAM_BOT_TOKEN_SECRET` - Your bot token
- `ADMIN_CHAT_ID` - Admin chat ID for notifications
- `FEAR_GREED_KV_NAMESPACE_ID` - KV namespace for testing (optional for local dev)
- `FEAR_GREED_KV_PREVIEW_ID` - Preview KV namespace (optional)

**Note:** The `wrangler.jsonc` file is automatically generated when you run `npm run dev`. It reads from `.dev.vars` or environment variables. If `FEAR_GREED_KV_NAMESPACE_ID` is not set, a placeholder will be used (KV operations won't work, but other functionality will).

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
- [ ] Commands (`/start`, `/stop`, `/help`, `/now`) work
- [ ] Cron triggers can be tested manually
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
   # Test POST endpoint
   curl -X POST http://localhost:8787 \
     -H "Content-Type: application/json" \
     -d @test-payload.json
   ```

4. **Test scheduled events:**
   ```bash
   # Trigger scheduled handler
   curl "http://localhost:8787/__scheduled?cron=0+*+*+*+*"
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

