/**
 * Environment variables for Cloudflare Workers
 */
export interface Env {
  TELEGRAM_BOT_TOKEN_SECRET: string;
  TELEGRAM_WEBHOOK_SECRET: string;
  ADMIN_CHAT_ID?: string;
  FEAR_GREED_D1: D1Database;
}
