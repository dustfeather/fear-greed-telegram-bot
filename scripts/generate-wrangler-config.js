#!/usr/bin/env node
/**
 * Generates wrangler.jsonc configuration file from environment variables.
 * This script is used during CI/CD to create the Wrangler config without
 * needing template files with variable substitution.
 */

const fs = require('fs');
const path = require('path');

// Read environment variables
const FEAR_GREED_KV_NAMESPACE_ID = process.env.FEAR_GREED_KV_NAMESPACE_ID;
const FEAR_GREED_KV_PREVIEW_ID = process.env.FEAR_GREED_KV_PREVIEW_ID || null;

// Validate required environment variable
if (!FEAR_GREED_KV_NAMESPACE_ID) {
  console.error('❌ Error: FEAR_GREED_KV_NAMESPACE_ID environment variable is required');
  process.exit(1);
}

// Build the configuration object
const config = {
  name: 'fear-greed-telegram-bot',
  main: 'src/index.ts',
  compatibility_date: '2024-09-23',
  workers_dev: true,
  send_metrics: true,
  compatibility_flags: ['nodejs_compat'],
  observability: {
    enabled: true
  },
  triggers: {
    crons: ['0 14-21 * * 1-5']
  },
  kv_namespaces: [
    {
      binding: 'FEAR_GREED_KV',
      id: FEAR_GREED_KV_NAMESPACE_ID
    }
  ]
};

// Conditionally add preview_id if provided
if (FEAR_GREED_KV_PREVIEW_ID) {
  config.kv_namespaces[0].preview_id = FEAR_GREED_KV_PREVIEW_ID;
}

// Write the configuration file
const outputPath = path.join(process.cwd(), 'wrangler.jsonc');
const output = JSON.stringify(config, null, 2);

fs.writeFileSync(outputPath, output, 'utf8');

console.log('✓ wrangler.jsonc generated successfully');
console.log(`✓ KV namespace ID: ${FEAR_GREED_KV_NAMESPACE_ID}`);
if (FEAR_GREED_KV_PREVIEW_ID) {
  console.log(`✓ KV preview ID: ${FEAR_GREED_KV_PREVIEW_ID}`);
}

