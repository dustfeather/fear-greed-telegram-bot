#!/usr/bin/env node
/**
 * Set up Telegram webhook for the bot
 * 
 * This script registers your Worker URL with Telegram so that
 * Telegram knows where to send messages when users interact with your bot.
 * 
 * Usage:
 *   node scripts/setup-telegram-webhook.js [WEBHOOK_URL]
 *   
 *   WEBHOOK_URL can be provided as:
 *   - Command line argument
 *   - Environment variable WEBHOOK_URL
 *   - If neither is provided, the script will exit with an error
 */

import fs from 'fs';
import path from 'path';

// Read .dev.vars file if it exists
function loadDevVars() {
  const devVarsPath = path.join(process.cwd(), '.dev.vars');
  const vars = {};
  
  if (fs.existsSync(devVarsPath)) {
    const content = fs.readFileSync(devVarsPath, 'utf8');
    const lines = content.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      
      const match = trimmed.match(/^([^=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim();
        vars[key] = value;
      }
    }
  }
  
  return vars;
}

// Get values
const devVars = loadDevVars();
const botToken = process.env.TELEGRAM_BOT_TOKEN_SECRET || devVars.TELEGRAM_BOT_TOKEN_SECRET;
const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET || devVars.TELEGRAM_WEBHOOK_SECRET;
const webhookUrl = process.argv[2] || process.env.WEBHOOK_URL || devVars.WEBHOOK_URL;

if (!botToken) {
  console.error('❌ Error: TELEGRAM_BOT_TOKEN_SECRET not found');
  console.error('   Set it in .dev.vars or as an environment variable');
  process.exit(1);
}

if (!webhookSecret) {
  console.error('❌ Error: TELEGRAM_WEBHOOK_SECRET not found');
  console.error('   Set it in .dev.vars or as an environment variable');
  console.error('   This secret is used to verify webhook requests are from Telegram');
  process.exit(1);
}

if (!webhookUrl) {
  console.error('❌ Error: WEBHOOK_URL not provided');
  console.error('   Provide it as a command line argument:');
  console.error('     node scripts/setup-telegram-webhook.js https://your-worker.workers.dev');
  console.error('   Or set it as an environment variable or in .dev.vars');
  process.exit(1);
}

async function setWebhook() {
  const url = `https://api.telegram.org/bot${botToken}/setWebhook`;
  
  console.log('Setting up Telegram webhook...');
  console.log(`Bot Token: ${botToken.substring(0, 10)}...${botToken.substring(botToken.length - 5)}`);
  console.log(`Webhook URL: ${webhookUrl}`);
  console.log(`Webhook Secret: ${webhookSecret.substring(0, 4)}...${webhookSecret.substring(webhookSecret.length - 4)}`);
  console.log('');
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: webhookUrl,
        secret_token: webhookSecret,
      }),
    });
    
    const data = await response.json();
    
    if (data.ok) {
      console.log('✅ Webhook set successfully!');
      console.log('');
      console.log('You can verify it by checking webhook info:');
      console.log(`  curl "https://api.telegram.org/bot${botToken}/getWebhookInfo"`);
      console.log('');
      console.log('Your bot should now respond to messages in Telegram.');
    } else {
      console.error('❌ Failed to set webhook:');
      console.error(`   ${data.description || 'Unknown error'}`);
      if (data.error_code) {
        console.error(`   Error code: ${data.error_code}`);
      }
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error setting webhook:', error.message);
    process.exit(1);
  }
}

setWebhook();

