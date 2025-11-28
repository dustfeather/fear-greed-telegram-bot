import { spawn } from 'child_process';
import { promisify } from 'util';

const sleep = promisify(setTimeout);

let wranglerProcess = null;

export default async function globalSetup() {
  console.log('🚀 Starting Wrangler dev server...');

  // Generate wrangler config first
  const configProcess = spawn('node', ['scripts/generate-wrangler-config-local.js'], {
    stdio: 'inherit',
    shell: true
  });

  await new Promise((resolve, reject) => {
    configProcess.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Config generation failed with code ${code}`));
    });
  });

  // Start wrangler dev
  wranglerProcess = spawn('npx', ['wrangler', 'dev'], {
    stdio: 'pipe',
    shell: true,
    detached: false
  });

  // Store process ID for cleanup
  global.__WRANGLER_PROCESS__ = wranglerProcess;

  // Wait for worker to be ready
  const WORKER_URL = 'http://localhost:8787';
  const MAX_RETRIES = 30;
  const RETRY_DELAY = 1000;

  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      const response = await fetch(WORKER_URL);
      if (response.status < 500) {
        console.log('✓ Worker is ready');
        return;
      }
    } catch (error) {
      // Worker not ready yet
    }
    await sleep(RETRY_DELAY);
  }

  throw new Error('Worker failed to start within timeout');
}
