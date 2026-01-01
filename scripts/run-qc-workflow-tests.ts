/**
 * QC Workflow Test Runner
 * 
 * Starts the API server and runs end-to-end tests
 */

import { spawn, ChildProcess } from 'child_process';
import axios from 'axios';
import * as path from 'path';

const API_PORT = process.env.PORT || 3000;
const API_BASE_URL = `http://localhost:${API_PORT}`;
const MAX_STARTUP_TIME = 30000; // 30 seconds
const HEALTH_CHECK_INTERVAL = 1000; // 1 second

class TestRunner {
  private serverProcess: ChildProcess | null = null;

  async startServer(): Promise<void> {
    console.log('Starting API server...');
    
    const serverPath = path.resolve(__dirname, '../src/api/api-server.ts');
    
    this.serverProcess = spawn('npx', ['ts-node', serverPath], {
      stdio: 'inherit',
      shell: true,
      env: {
        ...process.env,
        PORT: String(API_PORT),
        NODE_ENV: 'test'
      }
    });

    this.serverProcess.on('error', (error) => {
      console.error('Failed to start server:', error);
      process.exit(1);
    });

    // Wait for server to be ready
    await this.waitForServer();
  }

  async waitForServer(): Promise<void> {
    console.log('Waiting for API server to be ready...');
    
    const startTime = Date.now();
    
    while (Date.now() - startTime < MAX_STARTUP_TIME) {
      try {
        const response = await axios.get(`${API_BASE_URL}/health`, {
          timeout: 1000
        });
        
        if (response.status === 200) {
          console.log('✓ API server is ready');
          return;
        }
      } catch (error) {
        // Server not ready yet, wait and retry
        await new Promise(resolve => setTimeout(resolve, HEALTH_CHECK_INTERVAL));
      }
    }

    throw new Error('Server failed to start within timeout period');
  }

  async runTests(): Promise<void> {
    console.log('Running QC workflow tests...\n');
    
    const testPath = path.resolve(__dirname, '../tests/qc-workflow-e2e.test.ts');
    
    return new Promise((resolve, reject) => {
      const testProcess = spawn('npx', ['ts-node', testPath], {
        stdio: 'inherit',
        shell: true,
        env: {
          ...process.env,
          API_BASE_URL,
          NODE_ENV: 'test'
        }
      });

      testProcess.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Tests failed with exit code ${code}`));
        }
      });

      testProcess.on('error', (error) => {
        reject(error);
      });
    });
  }

  async cleanup(): Promise<void> {
    if (this.serverProcess) {
      console.log('\nStopping API server...');
      this.serverProcess.kill();
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  async run(): Promise<void> {
    try {
      await this.startServer();
      await this.runTests();
      console.log('\n✓ All tests completed successfully');
    } catch (error) {
      console.error('\n✗ Test execution failed:', error);
      process.exit(1);
    } finally {
      await this.cleanup();
    }
  }
}

// Run the test suite
const runner = new TestRunner();
runner.run();
