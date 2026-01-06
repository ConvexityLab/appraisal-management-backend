/**
 * Production Server Startup
 * Clean entry point for Azure deployment
 */

// Load environment variables FIRST, before any other imports
// This ensures env vars are available when modules are loaded
import dotenv from 'dotenv';
dotenv.config(); // Loads from .env in current working directory (project root)

// Now safe to import modules that need env vars
import { AppraisalManagementAPIServer } from './api/api-server.js';

// Environment validation
const requiredEnvVars: string[] = [];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.warn(`⚠️  Missing optional environment variables: ${missingVars.join(', ')}`);
  console.warn('Server will start with defaults');
}

// Server configuration
const config = {
  port: parseInt(process.env.PORT || '8080'), // Azure App Service uses PORT
  nodeEnv: process.env.NODE_ENV || 'production'
};

console.log('🚀 Starting Production Appraisal Management API...');
console.log(`📦 Environment: ${config.nodeEnv}`);
console.log(`🔧 Port: ${config.port}`);

if (process.env.WEBSITE_SITE_NAME) {
  console.log(`☁️  Azure App Service: ${process.env.WEBSITE_SITE_NAME}`);
}

// Start server
const server = new AppraisalManagementAPIServer(config.port);

// Graceful shutdown
const gracefulShutdown = (signal: string) => {
  console.log(`\n🛑 ${signal} received, shutting down gracefully...`);
  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Error handling
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the server
server.start().catch((error: Error) => {
  console.error('❌ Failed to start server:', error);
  process.exit(1);
});