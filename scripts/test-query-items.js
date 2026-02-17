/**
 * Test the new queryItems method in CosmosDbService
 */

import { CosmosDbService } from '../src/services/cosmos-db.service.ts';

async function testQueryItems() {
  console.log('🧪 Testing queryItems method...');
  
  const cosmosService = new CosmosDbService();
  await cosmosService.initialize();
  
  console.log('✅ CosmosDB initialized');
  
  // Test the query that the API is using
  const query = {
    query: 'SELECT * FROM c WHERE c.orderId = @orderId',
    parameters: [{ name: '@orderId', value: 'ord_2024_00123456' }]
  };
  
  console.log('🔍 Executing query:', JSON.stringify(query, null, 2));
  
  try {
    const result = await cosmosService.queryItems('qc-reviews', query);
    
    console.log('📊 Query result:', {
      success: result.success,
      dataCount: result.data?.length || 0,
      error: result.error
    });
    
    if (result.success && result.data && result.data.length > 0) {
      console.log('✅ Found QC review:');
      console.log('   ID:', result.data[0].id);
      console.log('   Order ID:', result.data[0].orderId);
      console.log('   Categories:', result.data[0].categoriesResults?.length || 0);
    }
    
  } catch (error) {
    console.error('❌ Query failed:', error.message);
  }
}

testQueryItems().catch(console.error);