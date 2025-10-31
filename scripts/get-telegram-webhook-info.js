#!/usr/bin/env node
/**
 * Get Telegram webhook information
 * 
 * Usage:
 *   node scripts/get-telegram-webhook-info.js
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

// Get bot token
const devVars = loadDevVars();
const botToken = process.env.TELEGRAM_BOT_TOKEN_SECRET || devVars.TELEGRAM_BOT_TOKEN_SECRET;

if (!botToken) {
  console.error('❌ Error: TELEGRAM_BOT_TOKEN_SECRET not found');
  console.error('   Set it in .dev.vars or as an environment variable');
  process.exit(1);
}

async function getWebhookInfo() {
  const url = `https://api.telegram.org/bot${botToken}/getWebhookInfo`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.ok) {
      const info = data.result;
      console.log('📋 Telegram Webhook Information:');
      console.log('');
      console.log(`  URL: ${info.url || 'Not set'}`);
      console.log(`  Has custom certificate: ${info.has_custom_certificate || false}`);
      console.log(`  Pending update count: ${info.pending_update_count || 0}`);
      
      if (info.last_error_date) {
        const errorDate = new Date(info.last_error_date * 1000);
        console.log(`  Last error date: ${errorDate.toISOString()}`);
        console.log(`  Last error message: ${info.last_error_message || 'N/A'}`);
      }
      
      if (info.max_connections) {
        console.log(`  Max connections: ${info.max_connections}`);
      }
      
      if (!info.url) {
        console.log('');
        console.log('⚠️  Webhook is not set!');
        console.log('   Run: node scripts/setup-telegram-webhook.js [WEBHOOK_URL]');
      }
    } else {
      console.error('❌ Failed to get webhook info:', data.description);
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

getWebhookInfo();

