#!/usr/bin/env node
/**
 * Generates wrangler.jsonc configuration file from environment variables.
 * This script is used during CI/CD to create the Wrangler config without
 * needing template files with variable substitution.
 */

import fs from 'fs';
import path from 'path';

// Read environment variables
const FEAR_GREED_D1_DATABASE_ID = process.env.FEAR_GREED_D1_DATABASE_ID;

// Validate required environment variables
if (!FEAR_GREED_D1_DATABASE_ID) {
  console.error('❌ Error: FEAR_GREED_D1_DATABASE_ID environment variable is required');
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
  triggers: {
    crons: [
      '0 9 * * 1-5',     // 09:00 weekdays (Mon-Fri)
      '30 14 * * 1-5',   // 14:30 weekdays (Mon-Fri)
      '0 21 * * 1-5',    // 21:00 weekdays (Mon-Fri)
      '0 1 * * 2-6'      // 01:00 (next day) - Tue-Sat to cover weekday late nights
    ]
  },
  d1_databases: [
    {
      binding: 'FEAR_GREED_D1',
      database_name: 'fear-greed',
      database_id: FEAR_GREED_D1_DATABASE_ID
    }
  ]
};

// Write the configuration file
const outputPath = path.join(process.cwd(), 'wrangler.jsonc');
const output = JSON.stringify(config, null, 2);

fs.writeFileSync(outputPath, output, 'utf8');

console.log('✓ wrangler.jsonc generated successfully');
console.log(`✓ D1 database ID: ${FEAR_GREED_D1_DATABASE_ID}`);

