import { exec, spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface RunResult {
  stdout: string;
  stderr: string;
  error?: string;
  exitCode?: number;
}

// Ensure sandbox directory exists in the workspace
const SANDBOX_DIR = path.join(__dirname, '..', '..', 'sandbox');
if (!fs.existsSync(SANDBOX_DIR)) {
  fs.mkdirSync(SANDBOX_DIR, { recursive: true });
}

/**
 * Checks if Docker is installed and running.
 */
async function isDockerAvailable(): Promise<boolean> {
  try {
    await execAsync('docker ps');
    return true;
  } catch {
    return false;
  }
}

/**
 * Helper to run a command with child_process.spawn.
 * Feeds stdin content and manages execution timeouts.
 */
function runCommandWithSpawn(
  command: string,
  args: string[],
  stdinContent: string = '',
  timeoutMs: number = 3000
): Promise<RunResult> {
  return new Promise((resolve) => {
    const child = spawn(command, args, { timeout: timeoutMs });

    let stdout = '';
    let stderr = '';
    let timeoutTriggered = false;

    // Timeout trigger
    const timer = setTimeout(() => {
      timeoutTriggered = true;
      child.kill('SIGTERM');
    }, timeoutMs);

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    // Write input values to standard input stream and close it
    try {
      child.stdin.write(stdinContent);
      child.stdin.end();
    } catch (err) {
      console.warn('⚠️ Standard input write issue:', err);
    }

    child.on('close', (code, signal) => {
      clearTimeout(timer);

      if (timeoutTriggered || signal === 'SIGTERM') {
        resolve({
          stdout: stdout,
          stderr: stderr + '\nTimeLimitExceeded: Your program exceeded the 3.0-second execution time limit.',
          error: 'Execution Timed Out',
          exitCode: 124
        });
      } else {
        resolve({
          stdout: stdout,
          stderr: stderr,
          exitCode: code ?? 0
        });
      }
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      resolve({
        stdout: stdout,
        stderr: stderr + `\nExecutionError: ${err.message}`,
        error: 'Process Spawn Failure',
        exitCode: 1
      });
    });
  });
}

/**
 * Runs the Python code in a sandboxed environment.
 */
export async function runPythonCode(code: string, stdin: string = ''): Promise<RunResult> {
  const fileName = `temp_${Date.now()}_${Math.random().toString(36).substring(7)}.py`;
  const filePath = path.join(SANDBOX_DIR, fileName);

  // Write student code to local sandbox folder
  fs.writeFileSync(filePath, code, 'utf8');

  const dockerActive = await isDockerAvailable();

  try {
    if (dockerActive) {
      console.log('🐳 Running code inside isolated Docker container...');
      const absoluteSandboxDir = path.resolve(SANDBOX_DIR).replace(/\\/g, '/');
      
      const command = 'docker';
      const args = [
        'run',
        '--rm',
        '-i',
        '--net=none',
        '--memory=128m',
        '--cpus=0.5',
        '-v',
        `${absoluteSandboxDir}:/app`,
        '-w',
        '/app',
        'python-sandbox',
        'python',
        fileName
      ];

      return await runCommandWithSpawn(command, args, stdin, 3000);
    } else {
      console.warn('⚠️ Docker is not available. Falling back to local python child process execution.');
      
      const command = 'python';
      const args = [filePath];

      return await runCommandWithSpawn(command, args, stdin, 3000);
    }
  } catch (err: any) {
    console.error('Execution failure:', err);
    return {
      stdout: '',
      stderr: err.message || 'Execution failed',
      error: 'Runtime Error',
      exitCode: 1
    };
  } finally {
    // Cleanup temporary script file
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (cleanupErr) {
      console.error('Failed to clean up temp script:', cleanupErr);
    }
  }
}
