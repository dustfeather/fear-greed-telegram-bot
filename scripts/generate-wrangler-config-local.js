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
const FEAR_GREED_KV_NAMESPACE_ID = process.env.FEAR_GREED_KV_NAMESPACE_ID || devVars.FEAR_GREED_KV_NAMESPACE_ID;
const FEAR_GREED_KV_PREVIEW_ID = process.env.FEAR_GREED_KV_PREVIEW_ID || devVars.FEAR_GREED_KV_PREVIEW_ID || null;

// For local development, use a placeholder if not set
const kvNamespaceId = FEAR_GREED_KV_NAMESPACE_ID || 'local-dev-namespace-id';

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
  tail_consumers: [
    {
      service: 'cf-tail-worker'
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
      id: kvNamespaceId
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

console.log('✓ wrangler.jsonc generated successfully for local development');
if (FEAR_GREED_KV_NAMESPACE_ID) {
  console.log(`✓ KV namespace ID: ${FEAR_GREED_KV_NAMESPACE_ID}`);
  if (FEAR_GREED_KV_PREVIEW_ID) {
    console.log(`✓ KV preview ID: ${FEAR_GREED_KV_PREVIEW_ID}`);
  }
} else {
  console.log('⚠️  Using placeholder KV namespace ID (set FEAR_GREED_KV_NAMESPACE_ID in .dev.vars for real KV access)');
}

