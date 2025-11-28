import { spawn } from 'child_process';

export default async function globalTeardown() {
  console.log('🛑 Stopping Wrangler dev server...');

  const wranglerProcess = global.__WRANGLER_PROCESS__;

  if (wranglerProcess && !wranglerProcess.killed) {
    try {
      // Kill the process and all its children
      if (process.platform === 'win32') {
        // Windows requires taskkill to kill process tree
        spawn('taskkill', ['/pid', wranglerProcess.pid.toString(), '/f', '/t'], {
          stdio: 'ignore'
        });
      } else {
        // Unix: kill process group (use SIGKILL for immediate termination)
        try {
          process.kill(-wranglerProcess.pid, 'SIGKILL');
        } catch (error) {
          // Process already gone, that's fine
        }
      }
    } catch (error) {
      // Ignore all errors - process cleanup will happen anyway
    }
  }

  console.log('✓ Worker stopped');
}
