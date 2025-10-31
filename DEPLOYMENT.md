# Deployment Guide

## Required GitHub Secrets

Make sure the following secrets are configured in your GitHub repository (Settings → Secrets and variables → Actions):

### Required Secrets:
- `TELEGRAM_BOT_TOKEN_SECRET` - Your Telegram bot token from BotFather (stored as Cloudflare Secret)
- `ADMIN_CHAT_ID` - Chat ID for error notifications (stored as Cloudflare Secret)
- `FEAR_GREED_KV_NAMESPACE_ID` - Production KV namespace ID
- `CF_API_TOKEN` - Cloudflare API token with Workers permissions
- `CF_ACCOUNT_ID` - Your Cloudflare account ID

### Optional Secrets:
- `FEAR_GREED_KV_PREVIEW_ID` - Preview KV namespace ID (for local development/testing)

**Note:** `TELEGRAM_BOT_TOKEN_SECRET` and `ADMIN_CHAT_ID` are automatically uploaded to Cloudflare Secrets API during deployment. They are NOT stored in `wrangler.jsonc` for security compliance with Cloudflare best practices.

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
   - The workflow will validate secrets, generate config, validate config, set secrets, and deploy
2. Once deployed, verify in Cloudflare Dashboard:
   - Workers & Pages → Your worker should be listed
   - Settings → Triggers → Cron Triggers should show your schedule
   - Settings → Variables and Secrets → Verify secrets (`TELEGRAM_BOT_TOKEN_SECRET` and `ADMIN_CHAT_ID`) are listed as "Secret" type (not plaintext vars)

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
- Verify `TELEGRAM_BOT_TOKEN_SECRET` and `ADMIN_CHAT_ID` secrets exist in GitHub and are not empty
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

