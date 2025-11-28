/**
 * Worker Integration Tests
 * Tests all endpoints and commands for the Fear and Greed Telegram Bot Worker
 *
 * With Jest global setup enabled, the worker is automatically started before tests
 * and stopped after all tests complete.
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

// Worker integration tests - runs shell script that tests the actual worker
test('Worker integration tests via shell script', async () => {
  console.log('Running worker integration tests...');
  console.log(`Worker URL: ${workerUrl}`);
  console.log('');

  // Check if worker is running
  const workerRunning = await isWorkerRunning();

  if (!workerRunning) {
    console.log('⚠️  Worker is not running at', workerUrl);
    console.log('   This should not happen with global setup enabled');
    throw new Error('Worker is not running - global setup may have failed');
  }

  // Run the shell script tests
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
});
