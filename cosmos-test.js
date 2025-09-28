#!/usr/bin/env node

/**
 * Cosmos DB Test Script
 * Standalone test to validate Cosmos DB Emulator connectivity
 * Run with: node cosmos-test.js
 */

const { CosmosClient } = require('@azure/cosmos');
const https = require('https');

// Cosmos DB Emulator settings
const endpoint = 'https://localhost:8081';
const key = 'C2y6yDjf5/R+ob0N8A7Cgv30VRDJIWEHLM+4QDU5DE2nQ9nDuVTqobD4b8mGGyPMbIZnqyMsEcaGQy67XIw/Jw==';
const databaseId = 'appraisal-management';

async function testCosmosConnection() {
  console.log('🚀 Testing Cosmos DB Emulator Connection...\n');
  
  try {
    // Create HTTPS agent for emulator
    const httpsAgent = new https.Agent({
      rejectUnauthorized: false
    });
    
    // Create client
    console.log('1️⃣ Creating Cosmos DB client...');
    const client = new CosmosClient({ 
      endpoint, 
      key,
      agent: httpsAgent
    });
    console.log('✅ Client created successfully\n');
    
    // Test connection by listing databases
    console.log('2️⃣ Testing connection...');
    const { resources: databases } = await client.databases.readAll().fetchAll();
    console.log(`✅ Connection successful! Found ${databases.length} databases:`);
    databases.forEach(db => console.log(`   - ${db.id}`));
    console.log('');
    
    // Check if our database exists
    console.log('3️⃣ Checking for appraisal-management database...');
    const dbExists = databases.some(db => db.id === databaseId);
    
    if (dbExists) {
      console.log(`✅ Database '${databaseId}' exists\n`);
      
      // List containers
      console.log('4️⃣ Listing containers...');
      const database = client.database(databaseId);
      const { resources: containers } = await database.containers.readAll().fetchAll();
      console.log(`✅ Found ${containers.length} containers:`);
      containers.forEach(container => console.log(`   - ${container.id}`));
      
    } else {
      console.log(`⚠️  Database '${databaseId}' does not exist yet`);
      console.log('   This is normal for first run - database will be created automatically\n');
    }
    
    console.log('🎉 Cosmos DB Emulator test completed successfully!\n');
    console.log('📋 Connection Summary:');
    console.log(`   ✅ Endpoint: ${endpoint}`);
    console.log(`   ✅ Database: ${databaseId} ${dbExists ? '(exists)' : '(will be created)'}`);
    console.log(`   ✅ Status: Ready for use`);
    
  } catch (error) {
    console.error('❌ Cosmos DB connection test failed!\n');
    console.error('Error details:', error.message);
    console.error('\n🔍 Troubleshooting steps:');
    console.error('   1. Ensure Cosmos DB Emulator is running');
    console.error('   2. Check that the emulator is accessible at https://localhost:8081');
    console.error('   3. Try restarting the Cosmos DB Emulator');
    console.error('   4. On Windows, run as Administrator if needed');
    console.error('\n📖 Setup Guide: See COSMOS_DB_SETUP.md for detailed instructions');
    
    process.exit(1);
  }
}

// Run the test
testCosmosConnection();