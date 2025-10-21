/**
 * Production Server Startup
 * Clean entry point for Azure deployment
 */

import dotenv from 'dotenv';
import ProductionAPIServer from './production-server';

// Load environment variables
dotenv.config();

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
const server = new ProductionAPIServer(config.port);

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
server.start().catch((error) => {
  console.error('❌ Failed to start server:', error);
  process.exit(1);
});