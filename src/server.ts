/**
 * API Server Startup Script
 * Initializes and starts the Appraisal Management API Server
 */

import dotenv from 'dotenv';
import { AppraisalManagementAPIServer } from './api/api-server';

// Load environment variables
dotenv.config();

// Environment configuration
const config = {
  port: parseInt(process.env.PORT || '3000'),
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
  allowedOrigins: process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://localhost:3001',
  rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW || '900000'), // 15 minutes
  rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '100'),
  logLevel: process.env.LOG_LEVEL || 'info'
};

// Validate critical environment variables
function validateEnvironment(): void {
  const required = ['JWT_SECRET'];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.warn(`⚠️  Missing environment variables: ${missing.join(', ')}`);
    console.warn('Using default values - NOT recommended for production!');
  }
}

// Handle graceful shutdown
function setupGracefulShutdown(): void {
  const shutdown = (signal: string) => {
    console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);
    
    // Perform cleanup operations here
    setTimeout(() => {
      console.log('✅ Graceful shutdown completed');
      process.exit(0);
    }, 5000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

// Main startup function
async function startServer(): Promise<void> {
  try {
    console.log('🔧 Initializing Appraisal Management API Server...');
    
    // Validate environment
    validateEnvironment();
    
    // Setup graceful shutdown handlers
    setupGracefulShutdown();
    
    // Log configuration (excluding sensitive data)
    console.log('📋 Server Configuration:');
    console.log(`   - Environment: ${config.nodeEnv}`);
    console.log(`   - Port: ${config.port}`);
    console.log(`   - Allowed Origins: ${config.allowedOrigins}`);
    console.log(`   - Rate Limit: ${config.rateLimitMax} requests per ${config.rateLimitWindow/1000/60} minutes`);
    console.log(`   - Log Level: ${config.logLevel}`);
    
    // Create and start server
    const server = new AppraisalManagementAPIServer(config.port);
    server.start();
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Error handling for unhandled promises and exceptions
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

// Start the server
if (require.main === module) {
  startServer();
}

export { startServer, config };