/**
 * Minimal Server Startup
 * Starts only the working API endpoints
 */

import dotenv from 'dotenv';
import MinimalAPIServer from './api/minimal-api-server';

// Load environment variables
dotenv.config();

async function startServer() {
  console.log('🔧 Starting Minimal API Server...');
  console.log('📦 Only including working services:');
  console.log('   ✅ Property Intelligence Controller');
  console.log('   ✅ Dynamic Code Execution Service');
  console.log('   ✅ Authentication (demo mode)');
  console.log('   ❌ Skipping broken services (temporary)\n');

  const server = new MinimalAPIServer(3000);
  await server.start();
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down server...');
  process.exit(0);
});

startServer().catch(error => {
  console.error('💥 Failed to start server:', error);
  process.exit(1);
});