import { spawn } from 'child_process';
import { promisify } from 'util';

const sleep = promisify(setTimeout);

export default async function globalTeardown() {
  console.log('🛑 Stopping Wrangler dev server...');

  const wranglerProcess = global.__WRANGLER_PROCESS__;

  if (wranglerProcess) {
    // Kill the process and all its children
    if (process.platform === 'win32') {
      // Windows requires taskkill to kill process tree
      spawn('taskkill', ['/pid', wranglerProcess.pid.toString(), '/f', '/t'], {
        stdio: 'ignore'
      });
    } else {
      // Unix: kill process group
      process.kill(-wranglerProcess.pid, 'SIGTERM');
    }

    // Wait a bit for cleanup
    await sleep(1000);
  }

  console.log('✓ Worker stopped');
}
