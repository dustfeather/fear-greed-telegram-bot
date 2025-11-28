import { spawn } from 'child_process';
import { promisify } from 'util';

const sleep = promisify(setTimeout);

export default async function globalTeardown() {
  console.log('🛑 Stopping Wrangler dev server...');

  const wranglerProcess = global.__WRANGLER_PROCESS__;

  if (wranglerProcess && !wranglerProcess.killed) {
    try {
      // Create a promise that resolves when the process exits
      const exitPromise = new Promise((resolve) => {
        wranglerProcess.once('exit', resolve);
        // Fallback timeout in case exit event doesn't fire
        setTimeout(resolve, 3000);
      });

      // Kill the process and all its children
      if (process.platform === 'win32') {
        // Windows requires taskkill to kill process tree
        spawn('taskkill', ['/pid', wranglerProcess.pid.toString(), '/f', '/t'], {
          stdio: 'ignore'
        });
      } else {
        // Unix: kill process group
        try {
          process.kill(-wranglerProcess.pid, 'SIGTERM');
        } catch (error) {
          // If process group kill fails, try killing just the process
          if (error.code === 'ESRCH') {
            // Process already gone
          } else {
            wranglerProcess.kill('SIGTERM');
          }
        }
      }

      // Wait for the process to actually exit
      await exitPromise;

      // Clean up any remaining handles
      if (wranglerProcess.stdout) wranglerProcess.stdout.destroy();
      if (wranglerProcess.stderr) wranglerProcess.stderr.destroy();
      if (wranglerProcess.stdin) wranglerProcess.stdin.destroy();
    } catch (error) {
      // Process may have already exited, which is fine
      if (error.code !== 'ESRCH') {
        console.warn('Warning: Error stopping Wrangler process:', error.message);
      }
    }
  }

  console.log('✓ Worker stopped');
}
