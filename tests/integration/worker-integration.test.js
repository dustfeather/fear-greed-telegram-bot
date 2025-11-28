/**
 * Worker Integration Tests
 * Tests all endpoints and commands for the Fear and Greed Telegram Bot Worker
 *
 * Requires a running worker instance at http://localhost:8787
 * Run with: npm run dev (in another terminal)
 */

import { execSync } from 'child_process';
import { platform } from 'os';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..', '..');

const isWindows = platform() === 'win32';
const workerUrl = process.env.WORKER_URL || 'http://localhost:8787';

// Check if worker is running
async function isWorkerRunning() {
  try {
    const response = await fetch(workerUrl, { method: 'GET' });
    return response.status === 405; // Worker returns 405 for GET requests
  } catch (error) {
    return false;
  }
}

console.log('Running worker integration tests...');
console.log(`Worker URL: ${workerUrl}`);
console.log('');

// Check if worker is running before attempting tests
const workerRunning = await isWorkerRunning();

if (!workerRunning) {
  console.log('⚠️  Worker is not running at', workerUrl);
  console.log('   To run these tests, start the worker in another terminal:');
  console.log('   npm run dev');
  console.log('');
  console.log('⏭️  Skipping worker integration tests');
  console.log('✅ Worker integration tests skipped (worker not running)');
  process.exit(0);
}

try {
  if (isWindows) {
    const scriptPath = join(projectRoot, 'scripts', 'test-worker.ps1');
    execSync(`pwsh -File "${scriptPath}" -WorkerUrl "${workerUrl}"`, {
      stdio: 'inherit',
      cwd: projectRoot,
    });
  } else {
    const scriptPath = join(projectRoot, 'scripts', 'test-worker.sh');
    execSync(`bash "${scriptPath}" "${workerUrl}"`, {
      stdio: 'inherit',
      cwd: projectRoot,
    });
  }
  console.log('\n✅ Worker integration tests completed successfully');
} catch (error) {
  console.error('\n❌ Worker integration tests failed');
  if (!error.message.includes('exit code')) {
    console.error('Error:', error.message);
  }
  process.exit(1);
}
