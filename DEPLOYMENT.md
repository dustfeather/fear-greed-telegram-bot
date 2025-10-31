# Deployment Guide

## Required GitHub Secrets

Make sure the following secrets are configured in your GitHub repository (Settings → Secrets and variables → Actions):

### Required Secrets:
- `TELEGRAM_BOT_TOKEN_SECRET` - Your Telegram bot token from BotFather (stored as Cloudflare Secret)
- `TELEGRAM_WEBHOOK_SECRET` - A secure random string for verifying webhook requests (stored as Cloudflare Secret). Generate using: `openssl rand -hex 32`
- `ADMIN_CHAT_ID` - Chat ID for error notifications (stored as Cloudflare Secret)
- `FEAR_GREED_KV_NAMESPACE_ID` - Production KV namespace ID
- `CF_API_TOKEN` - Cloudflare API token with Workers permissions
- `CF_ACCOUNT_ID` - Your Cloudflare account ID
- `WORKER_URL` - Your deployed Worker URL (e.g., `https://fear-greed-telegram-bot.your-subdomain.workers.dev`) - used for Telegram webhook setup

### Optional Secrets:
- `FEAR_GREED_KV_PREVIEW_ID` - Preview KV namespace ID (for local development/testing)

**Note:** `TELEGRAM_BOT_TOKEN_SECRET`, `TELEGRAM_WEBHOOK_SECRET`, and `ADMIN_CHAT_ID` are automatically uploaded to Cloudflare Secrets API during deployment. They are NOT stored in `wrangler.jsonc` for security compliance with Cloudflare best practices.

**Security:** The `TELEGRAM_WEBHOOK_SECRET` is used to verify that incoming webhook requests are actually from Telegram. This prevents unauthorized access to your bot endpoints. The same secret must be configured in both Telegram (via webhook setup) and your Worker environment.

## Getting Your Cloudflare Account ID

1. Log in to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Select your account
3. The Account ID is shown in the right sidebar under "API"

## Getting Your Cloudflare API Token

1. Go to [Cloudflare API Tokens](https://dash.cloudflare.com/profile/api-tokens)
2. Click "Create Token"
3. Use "Edit Cloudflare Workers" template, or create a custom token with:
   - **Permissions:**
     - Account: Workers Scripts: Edit
     - Account: Workers KV Storage: Edit
     - Account: Workers Secrets: Edit (required for uploading secrets via `wrangler secret bulk`)
     - Account: Account Settings: Read
   - **Account Resources:** Include - Your Account
4. Copy the token and add it as `CF_API_TOKEN` secret
   
**Note:** The GitHub secret is named `CF_API_TOKEN` for brevity, but internally it's mapped to `CLOUDFLARE_API_TOKEN` environment variable for wrangler commands.

## Getting Your KV Namespace IDs

If you haven't created KV namespaces yet:

```bash
# Create production namespace
npx wrangler kv namespace create "FEAR_GREED_KV"

# Create preview namespace
npx wrangler kv namespace create "FEAR_GREED_KV" --preview
```

The output will show the namespace IDs. Add them to GitHub secrets.

## Verifying Deployment

After pushing to the `main` branch:

1. Check GitHub Actions tab to see deployment progress
   - The workflow will validate secrets, generate config, validate config, set secrets, deploy, and set the Telegram webhook
2. Once deployed, verify in Cloudflare Dashboard:
   - Workers & Pages → Your worker should be listed
   - Settings → Triggers → Cron Triggers should show your schedule
   - Settings → Variables and Secrets → Verify secrets (`TELEGRAM_BOT_TOKEN_SECRET` and `ADMIN_CHAT_ID`) are listed as "Secret" type (not plaintext vars)
3. Verify Telegram webhook (optional):
   ```bash
   npm run webhook:info
   ```
   - This should show your deployed Worker URL
   - The webhook is automatically set during deployment, so this is just for verification

## Deployment Notifications

When a new version is deployed, the bot automatically sends a notification message to all subscribed Telegram users. The notification includes:

- Git commit hash (short form, 7 characters)
- Commit message (first line)
- Clickable link to the GitHub commit

This happens automatically after each successful deployment via the GitHub Actions workflow. No additional configuration is needed beyond the existing secrets:

- `TELEGRAM_BOT_TOKEN_SECRET` - Used for authentication when calling the deployment notification endpoint
- `WORKER_URL` - Used to make the POST request to the `/deploy-notify` endpoint

The notification step in the workflow is non-blocking - if it fails, the deployment itself is still considered successful. Check the GitHub Actions logs to see if notifications were sent successfully.

### Manual Deployment Notification

If you need to manually trigger a deployment notification, you can make a POST request to the `/deploy-notify` endpoint:

```bash
curl -X POST "https://your-worker-url.workers.dev/deploy-notify" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TELEGRAM_BOT_TOKEN" \
  -d '{
    "commitHash": "abc1234",
    "commitMessage": "Your commit message",
    "commitUrl": "https://github.com/owner/repo/commit/fullsha",
    "timestamp": "2024-01-01T00:00:00Z"
  }'
```

## Troubleshooting

### Deployment fails with "Invalid API token"
- Verify `CF_API_TOKEN` is correct and has required permissions
- Check token hasn't expired
- Ensure token has the following permissions:
  - Account: Workers Scripts: Edit
  - Account: Workers KV Storage: Edit
  - Account: Workers Secrets: Edit (required for secret management)
  - Account: Account Settings: Read

### Deployment fails with "Namespace not found"
- Verify `FEAR_GREED_KV_NAMESPACE_ID` matches your actual KV namespace ID
- Ensure the namespace exists in your Cloudflare account

### Configuration generation fails
- Check all required secrets are set in GitHub
- Verify secret names match exactly (case-sensitive)
- Ensure `FEAR_GREED_KV_NAMESPACE_ID` is set (required)
- Check workflow logs for specific error messages

### Secrets upload fails
- Verify `TELEGRAM_BOT_TOKEN_SECRET`, `TELEGRAM_WEBHOOK_SECRET`, and `ADMIN_CHAT_ID` secrets exist in GitHub and are not empty
- Check that `CF_API_TOKEN` has **Workers Secrets: Edit** permission (required for `wrangler secret bulk`)
- Review workflow logs for detailed error messages from `npx wrangler secret bulk`
- If secrets already exist, the upload may show warnings but should still succeed
- Check that the generated `wrangler.jsonc` file is valid before secrets are uploaded

### Configuration validation fails
- The workflow validates `wrangler.jsonc` before deployment using `wrangler deploy --dry-run`
- This catches configuration errors before deployment
- Check the error message for specific issues in `wrangler.jsonc`
- Common issues: invalid KV namespace IDs, syntax errors, missing required fields (name, main, compatibility_date)
- The generated `wrangler.jsonc` is also validated for required fields and non-empty values before the dry-run

### Deployment notification fails
- The notification step uses `continue-on-error: true`, so deployment failures won't block deployments
- Check the GitHub Actions logs for the "Notify Subscribers of Deployment" step
- Verify `TELEGRAM_BOT_TOKEN_SECRET` and `WORKER_URL` secrets are set correctly
- Ensure the Worker URL is accessible and the `/deploy-notify` endpoint is responding
- If the endpoint returns 401, verify the token matches `TELEGRAM_BOT_TOKEN_SECRET`
- If the endpoint returns 400, check that commit information is being extracted correctly from the GitHub event

