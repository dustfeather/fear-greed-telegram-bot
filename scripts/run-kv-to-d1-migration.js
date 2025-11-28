#!/usr/bin/env node

/**
 * Script to trigger KV to D1 data migration via Worker endpoint
 * This is run during GitHub Actions deployment after D1 schema is applied
 */

const WORKER_URL = process.env.WORKER_URL;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN_SECRET;

if (!WORKER_URL) {
  console.error('❌ Error: WORKER_URL environment variable is required');
  process.exit(1);
}

if (!TELEGRAM_BOT_TOKEN) {
  console.error('❌ Error: TELEGRAM_BOT_TOKEN_SECRET environment variable is required');
  process.exit(1);
}

async function triggerMigration() {
  console.log('Triggering KV to D1 data migration...');
  console.log(`Worker URL: ${WORKER_URL}`);

  try {
    const response = await fetch(`${WORKER_URL}/migrate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TELEGRAM_BOT_TOKEN}`
      }
    });

    const responseText = await response.text();

    if (!response.ok) {
      console.error(`❌ Migration request failed with status ${response.status}`);
      console.error(`Response: ${responseText}`);
      process.exit(1);
    }

    let result;
    try {
      result = JSON.parse(responseText);
    } catch (e) {
      console.error('❌ Failed to parse migration response as JSON');
      console.error(`Response: ${responseText}`);
      process.exit(1);
    }

    if (result.success) {
      console.log('✓ Migration completed successfully');
      console.log('\nMigration Summary:');

      if (result.status && result.status.results) {
        for (const tableResult of result.status.results) {
          console.log(`  ${tableResult.table}: ${tableResult.recordsMigrated} records migrated (${tableResult.duration}ms)`);

          if (tableResult.errors && tableResult.errors.length > 0) {
            console.log(`    ⚠️  Errors: ${tableResult.errors.length}`);
            for (const error of tableResult.errors.slice(0, 5)) {
              console.log(`      - ${error.key}: ${error.error}`);
            }
            if (tableResult.errors.length > 5) {
              console.log(`      ... and ${tableResult.errors.length - 5} more errors`);
            }
          }
        }
      }

      if (result.message) {
        console.log(`\n${result.message}`);
      }
    } else {
      console.error('❌ Migration failed');
      console.error(`Message: ${result.message || 'Unknown error'}`);

      if (result.status && result.status.results) {
        console.error('\nError Details:');
        for (const tableResult of result.status.results) {
          if (tableResult.errors && tableResult.errors.length > 0) {
            console.error(`  ${tableResult.table}:`);
            for (const error of tableResult.errors) {
              console.error(`    - ${error.key}: ${error.error}`);
            }
          }
        }
      }

      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Failed to trigger migration:', error.message);
    process.exit(1);
  }
}

triggerMigration();
