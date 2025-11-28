/**
 * Run all e2e tests
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const testFiles = [
  'user-management/services/subscription-service.test.js',
  'telegram/services/message-service.test.js',
  'scheduler/handlers/scheduled-handler.test.js',
  'telegram/handlers/webhook-handler.test.js',
  'integration/webhook-integration.test.js',
  'trading/utils/indicators.test.js',
  'trading/services/signal-service.test.js',
  'user-management/services/watchlist-service.test.js',
  'integration/admin-integration.test.js',
  'trading/utils/holidays.test.js',
  'trading/utils/holidays-integration.test.js',
  'trading/services/execution-service.test.js',
  'integration/worker-integration.test.js'
];

console.log('🚀 Running comprehensive e2e test suite\n');
console.log('═'.repeat(60));

let totalPassed = 0;
let totalFailed = 0;

async function runTest(file) {
  return new Promise((resolve) => {
    console.log(`\n📋 Running ${file}...`);
    console.log('-'.repeat(60));

    const testPath = join(__dirname, file);
    const proc = spawn('npx', ['tsx', testPath], {
      stdio: 'inherit',
      shell: true
    });

    proc.on('close', (code) => {
      if (code === 0) {
        totalPassed++;
        resolve(true);
      } else {
        totalFailed++;
        resolve(false);
      }
    });

    proc.on('error', (err) => {
      console.error(`Error running ${file}:`, err);
      totalFailed++;
      resolve(false);
    });
  });
}

async function runAllTests() {
  for (const file of testFiles) {
    await runTest(file);
  }

  console.log('\n' + '═'.repeat(60));
  console.log('\n📊 Final Test Summary');
  console.log('═'.repeat(60));
  console.log(`✅ Passed: ${totalPassed}`);
  console.log(`❌ Failed: ${totalFailed}`);
  console.log(`📈 Total:  ${totalPassed + totalFailed}`);

  if (totalFailed > 0) {
    console.log('\n❌ Some tests failed!');
    process.exit(1);
  } else {
    console.log('\n🎉 All tests passed!');
    process.exit(0);
  }
}

runAllTests().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
