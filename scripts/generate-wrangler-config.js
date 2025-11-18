#!/usr/bin/env node
/**
 * Generates wrangler.jsonc configuration file from environment variables.
 * This script is used during CI/CD to create the Wrangler config without
 * needing template files with variable substitution.
 */

import fs from 'fs';
import path from 'path';

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
  "observability": {
    "logs": {
      "enabled": true,
      "head_sampling_rate": 1,
      "invocation_logs": true,
      "persist": true
    },
    "traces": {
      "enabled": true,
      "persist": true,
      "head_sampling_rate": 1
    }
  },
  "tail_consumers": [
    {
      "service": "cf-tail-worker"
    }
  ],
  triggers: {
    crons: [
      '0 9-23 * * 1',  // Monday 09:00-23:00
      '0 0-1 * * 2',   // Tuesday 00:00-01:00 (covers Monday late night)
      '0 9-23 * * 2',  // Tuesday 09:00-23:00
      '0 0-1 * * 3',   // Wednesday 00:00-01:00 (covers Tuesday late night)
      '0 9-23 * * 3',  // Wednesday 09:00-23:00
      '0 0-1 * * 4',   // Thursday 00:00-01:00 (covers Wednesday late night)
      '0 9-23 * * 4',  // Thursday 09:00-23:00
      '0 0-1 * * 5',   // Friday 00:00-01:00 (covers Thursday late night)
      '0 9-23 * * 5',  // Friday 09:00-23:00
      '0 0-1 * * 6'    // Saturday 00:00-01:00 (covers Friday late night, weekday check will skip)
    ]
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

