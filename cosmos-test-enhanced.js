#!/usr/bin/env node

/**
 * Enhanced Cosmos DB Setup and Test Script
 * Comprehensive testing with setup guidance and troubleshooting
 */

const { CosmosClient } = require('@azure/cosmos');
const https = require('https');
const { exec } = require('child_process');

// Cosmos DB Emulator settings
const endpoint = 'https://localhost:8081';
const key = 'C2y6yDjf5/R+ob0N8A7Cgv30VRDJIWEHLM+4QDU5DE2nQ9nDuVTqobD4b8mGGyPMbIZnqyMsEcaGQy67XIw/Jw==';
const databaseId = 'appraisal-management';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function colorLog(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function checkEmulatorProcess() {
  return new Promise((resolve) => {
    exec('tasklist /FI "IMAGENAME eq CosmosDB.Emulator.exe"', (error, stdout) => {
      if (error) {
        resolve(false);
      } else {
        resolve(stdout.includes('CosmosDB.Emulator.exe'));
      }
    });
  });
}

function testEndpointReachability() {
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: 8081,
      path: '/',
      method: 'GET',
      rejectUnauthorized: false, // Accept self-signed certificate
      timeout: 5000
    };

    const req = https.request(options, (res) => {
      resolve(true);
    });

    req.on('error', () => {
      resolve(false);
    });

    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });

    req.end();
  });
}

async function runDiagnostics() {
  colorLog('cyan', '\n🔍 Running Cosmos DB Emulator Diagnostics...\n');

  // Check if emulator process is running
  colorLog('blue', '1️⃣ Checking if Cosmos DB Emulator process is running...');
  const processRunning = await checkEmulatorProcess();
  if (processRunning) {
    colorLog('green', '✅ Cosmos DB Emulator process is running');
  } else {
    colorLog('red', '❌ Cosmos DB Emulator process is NOT running');
    colorLog('yellow', '   Please start the emulator first');
  }

  // Check endpoint reachability
  colorLog('blue', '\n2️⃣ Testing endpoint reachability...');
  const endpointReachable = await testEndpointReachability();
  if (endpointReachable) {
    colorLog('green', '✅ Endpoint https://localhost:8081 is reachable');
  } else {
    colorLog('red', '❌ Endpoint https://localhost:8081 is NOT reachable');
    colorLog('yellow', '   The emulator may still be starting up (wait 1-2 minutes)');
  }

  return { processRunning, endpointReachable };
}

async function testCosmosConnection() {
  colorLog('cyan', '🚀 Testing Cosmos DB Emulator Connection...\n');

  try {
    // Run diagnostics first
    const diagnostics = await runDiagnostics();
    
    if (!diagnostics.processRunning || !diagnostics.endpointReachable) {
      colorLog('yellow', '\n⚠️  Emulator appears to not be ready. Attempting connection anyway...\n');
    }

    // Create client
    colorLog('blue', '3️⃣ Creating Cosmos DB client...');
    const client = new CosmosClient({ 
      endpoint, 
      key,
      // Disable SSL verification for emulator
      agent: { rejectUnauthorized: false }
    });
    colorLog('green', '✅ Client created successfully\n');
    
    // Test connection by listing databases
    colorLog('blue', '4️⃣ Testing connection and listing databases...');
    const { resources: databases } = await client.databases.readAll().fetchAll();
    colorLog('green', `✅ Connection successful! Found ${databases.length} databases:`);
    databases.forEach(db => colorLog('cyan', `   - ${db.id}`));
    console.log('');
    
    // Check if our database exists
    colorLog('blue', '5️⃣ Checking for appraisal-management database...');
    const dbExists = databases.some(db => db.id === databaseId);
    
    if (dbExists) {
      colorLog('green', `✅ Database '${databaseId}' exists\n`);
      
      // List containers
      colorLog('blue', '6️⃣ Listing containers...');
      const database = client.database(databaseId);
      const { resources: containers } = await database.containers.readAll().fetchAll();
      colorLog('green', `✅ Found ${containers.length} containers:`);
      containers.forEach(container => colorLog('cyan', `   - ${container.id}`));
      
    } else {
      colorLog('yellow', `⚠️  Database '${databaseId}' does not exist yet`);
      colorLog('yellow', '   This is normal for first run - database will be created automatically\n');
    }
    
    colorLog('green', '🎉 Cosmos DB Emulator test completed successfully!\n');
    colorLog('cyan', '📋 Connection Summary:');
    colorLog('green', `   ✅ Endpoint: ${endpoint}`);
    colorLog('green', `   ✅ Database: ${databaseId} ${dbExists ? '(exists)' : '(will be created)'}`);
    colorLog('green', `   ✅ Status: Ready for use`);
    
    return true;
    
  } catch (error) {
    colorLog('red', '❌ Cosmos DB connection test failed!\n');
    colorLog('red', 'Error details:', error.message);
    
    // Provide specific troubleshooting based on error
    if (error.code === 'ECONNREFUSED') {
      colorLog('yellow', '\n🔧 Connection Refused - Troubleshooting:');
      colorLog('yellow', '   1. Start Cosmos DB Emulator:');
      colorLog('cyan', '      - Press Win+R, type "CosmosDB.Emulator.exe", press Enter');
      colorLog('yellow', '   2. Wait 1-2 minutes for emulator to fully start');
      colorLog('yellow', '   3. Check if https://localhost:8081 opens in browser');
    } else if (error.code === 'ENOTFOUND') {
      colorLog('yellow', '\n🔧 DNS/Network Issue - Troubleshooting:');
      colorLog('yellow', '   1. Ensure you\'re using localhost (not 127.0.0.1)');
      colorLog('yellow', '   2. Check if port 8081 is blocked by firewall');
    } else if (error.message.includes('certificate')) {
      colorLog('yellow', '\n🔧 Certificate Issue - Troubleshooting:');
      colorLog('yellow', '   1. Run emulator as Administrator first time');
      colorLog('yellow', '   2. Accept certificate installation prompt');
    } else {
      colorLog('yellow', '\n🔧 General Troubleshooting:');
      colorLog('yellow', '   1. Restart Cosmos DB Emulator');
      colorLog('yellow', '   2. Run as Administrator if needed');
      colorLog('yellow', '   3. Check Windows Firewall settings');
    }
    
    colorLog('cyan', '\n📖 For detailed setup guide, see: COSMOS_DB_LOCAL_SETUP.md');
    
    return false;
  }
}

// Self-starting setup helper
async function startEmulatorIfNeeded() {
  colorLog('cyan', '🚀 Cosmos DB Emulator Setup Helper\n');
  
  const processRunning = await checkEmulatorProcess();
  
  if (!processRunning) {
    colorLog('yellow', '⚠️  Cosmos DB Emulator is not running');
    colorLog('blue', '🔄 Attempting to start emulator...');
    
    return new Promise((resolve) => {
      exec('"C:\\Program Files\\Azure Cosmos DB Emulator\\CosmosDB.Emulator.exe" /NoFirewall /NoUI', (error) => {
        if (error) {
          colorLog('red', '❌ Failed to start emulator automatically');
          colorLog('yellow', '   Please start it manually:');
          colorLog('cyan', '   1. Press Win+R');
          colorLog('cyan', '   2. Type: CosmosDB.Emulator.exe');
          colorLog('cyan', '   3. Press Enter');
          colorLog('cyan', '   4. Wait 1-2 minutes, then re-run this test');
          resolve(false);
        } else {
          colorLog('green', '✅ Emulator start command sent');
          colorLog('yellow', '   Waiting 30 seconds for startup...');
          setTimeout(() => {
            resolve(true);
          }, 30000);
        }
      });
    });
  } else {
    colorLog('green', '✅ Cosmos DB Emulator is already running');
    return true;
  }
}

// Main execution
async function main() {
  try {
    // First try to start emulator if needed
    const emulatorReady = await startEmulatorIfNeeded();
    
    if (emulatorReady) {
      // Run the actual test
      const testPassed = await testCosmosConnection();
      process.exit(testPassed ? 0 : 1);
    } else {
      colorLog('red', '\n❌ Unable to start or connect to Cosmos DB Emulator');
      colorLog('cyan', '📖 Please see COSMOS_DB_LOCAL_SETUP.md for manual setup instructions');
      process.exit(1);
    }
  } catch (error) {
    colorLog('red', '💥 Unexpected error:', error.message);
    process.exit(1);
  }
}

// Help and usage information
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
Cosmos DB Test Script

Usage:
  node cosmos-test-enhanced.js          Run full test with auto-setup
  node cosmos-test-enhanced.js --help   Show this help

This script will:
1. Check if Cosmos DB Emulator is running
2. Attempt to start it if needed
3. Test database connectivity
4. Provide troubleshooting guidance

For manual setup, see: COSMOS_DB_LOCAL_SETUP.md
`);
  process.exit(0);
}

// Run the main function
main();