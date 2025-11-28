#!/usr/bin/env node
/**
 * Generates wrangler.jsonc configuration file for local development.
 * Reads from .dev.vars file or environment variables.
 * This is a local development version that's more lenient than the CI/CD version.
 */

import fs from 'fs';
import path from 'path';

// Try to read .dev.vars file for local development
function loadDevVars() {
  const devVarsPath = path.join(process.cwd(), '.dev.vars');
  const vars = {};

  if (fs.existsSync(devVarsPath)) {
    const content = fs.readFileSync(devVarsPath, 'utf8');
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      // Skip comments and empty lines
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

// Load from .dev.vars first, then fall back to environment variables
const devVars = loadDevVars();
const FEAR_GREED_D1_DATABASE_ID = process.env.FEAR_GREED_D1_DATABASE_ID || devVars.FEAR_GREED_D1_DATABASE_ID;

// For local development, use a placeholder if not set
const d1DatabaseId = FEAR_GREED_D1_DATABASE_ID || 'local-dev-database-id';

// Build the configuration object
const config = {
  name: 'fear-greed-telegram-bot',
  main: 'src/index.ts',
  compatibility_date: '2024-09-23',
  workers_dev: true,
  send_metrics: true,
  compatibility_flags: ['nodejs_compat'],
  observability: {
    logs: {
      enabled: true,
      head_sampling_rate: 1,
      invocation_logs: true,
      persist: true
    },
    traces: {
      enabled: true,
      persist: true,
      head_sampling_rate: 1
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
      database_id: d1DatabaseId
    }
  ]
};

// Write the configuration file
const outputPath = path.join(process.cwd(), 'wrangler.jsonc');
const output = JSON.stringify(config, null, 2);

fs.writeFileSync(outputPath, output, 'utf8');

console.log('✓ wrangler.jsonc generated successfully for local development');
if (FEAR_GREED_D1_DATABASE_ID) {
  console.log(`✓ D1 database ID: ${FEAR_GREED_D1_DATABASE_ID}`);
} else {
  console.log('⚠️  Using placeholder D1 database ID (set FEAR_GREED_D1_DATABASE_ID in .dev.vars for real D1 access)');
}

