/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    // Test environment
    environment: 'node',
    
    // Global test setup
    globals: true,
    
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        'coverage/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/types/**',
        'src/tests/**',
        'src/demos/**'
      ],
      thresholds: {
        statements: 70,
        branches: 60,
        functions: 70,
        lines: 70
      }
    },
    
    // Test timeout
    testTimeout: 30000,
    hookTimeout: 30000,
    
    // Test file patterns
    include: [
      'src/**/*.{test,spec}.{js,ts}',
      'tests/**/*.{test,spec}.{js,ts}'
    ],
    exclude: [
      'node_modules/',
      'dist/',
      'src/tests/' // Exclude old test files
    ],
    
    // Setup files
    setupFiles: ['./tests/setup.ts'],
    
    // Reporter configuration
    reporters: ['verbose', 'json', 'html'],
    
    // Output directory
    outputFile: {
      json: './coverage/test-results.json',
      html: './coverage/test-report.html'
    }
  },
  
  // TypeScript resolution
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@tests': path.resolve(__dirname, './tests')
    }
  },
  
  // ESM configuration
  esbuild: {
    target: 'node18'
  }
})