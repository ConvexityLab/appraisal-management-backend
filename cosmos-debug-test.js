#!/usr/bin/env node

/**
 * Simple Cosmos DB Test with Detailed Error Reporting
 */

const { CosmosClient } = require('@azure/cosmos');
const https = require('https');

const endpoint = 'https://localhost:8081';
const key = 'C2y6yDjf5/R+ob0N8A7Cgv30VRDJIWEHLM+4QDU5DE2nQ9nDuVTqobD4b8mGGyPMbIZnqyMsEcaGQy67XIw/Jw==';

async function testConnection() {
  console.log('🚀 Testing Cosmos DB Connection...\n');
  
  try {
    // Create HTTPS agent that accepts self-signed certificates
    const httpsAgent = new https.Agent({
      rejectUnauthorized: false
    });
    
    // Create client with proper agent
    const client = new CosmosClient({ 
      endpoint, 
      key,
      agent: httpsAgent,
      connectionPolicy: {
        requestTimeout: 10000
      }
    });
    
    console.log('✅ Client created');
    
    // Try a simple operation
    console.log('🔄 Testing database list...');
    const { resources: databases } = await client.databases.readAll().fetchAll();
    
    console.log(`✅ SUCCESS! Found ${databases.length} databases:`);
    databases.forEach(db => console.log(`   - ${db.id}`));
    
    // Test creating a database
    console.log('\n🔄 Testing database creation...');
    const { database } = await client.databases.createIfNotExists({ id: 'test-db' });
    console.log(`✅ Database ready: ${database.id}`);
    
    // Test creating a container
    console.log('🔄 Testing container creation...');
    const { container } = await database.containers.createIfNotExists({
      id: 'test-container',
      partitionKey: '/id'
    });
    console.log(`✅ Container ready: ${container.id}`);
    
    // Test inserting a document
    console.log('🔄 Testing document insert...');
    const testDoc = {
      id: 'test-doc-1',
      message: 'Hello Cosmos DB!',
      timestamp: new Date().toISOString()
    };
    
    const { resource } = await container.items.create(testDoc);
    console.log(`✅ Document created: ${resource.id}`);
    
    // Test querying
    console.log('🔄 Testing document query...');
    const { resources } = await container.items.query('SELECT * FROM c').fetchAll();
    console.log(`✅ Query returned ${resources.length} documents`);
    
    console.log('\n🎉 All tests passed! Cosmos DB Emulator is working correctly.');
    console.log('\n📋 Test Summary:');
    console.log('   ✅ Client connection: PASSED');
    console.log('   ✅ Database operations: PASSED');
    console.log('   ✅ Container operations: PASSED');
    console.log('   ✅ Document operations: PASSED');
    console.log('   ✅ Query operations: PASSED');
    
    return true;
    
  } catch (error) {
    console.error('❌ Test failed with error:');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error code:', error.code);
    
    if (error.body) {
      console.error('Error body:', JSON.stringify(error.body, null, 2));
    }
    
    if (error.stack) {
      console.error('\nFull stack trace:');
      console.error(error.stack);
    }
    
    console.error('\n🔧 Troubleshooting suggestions:');
    console.error('1. Ensure Cosmos DB Emulator is fully started (check system tray)');
    console.error('2. Try accessing https://localhost:8081 in your browser');
    console.error('3. Restart the emulator and wait 2-3 minutes');
    console.error('4. Check Windows Event Logs for emulator errors');
    
    return false;
  }
}

testConnection().then(success => {
  process.exit(success ? 0 : 1);
});