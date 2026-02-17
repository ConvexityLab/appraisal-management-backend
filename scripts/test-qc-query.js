/**
 * Test QC Results Query
 * Debug the API query to see what's happening
 */

import { CosmosDbService } from '../src/services/cosmos-db.service.ts';

const cosmosService = new CosmosDbService();

async function testQuery() {
  try {
    await cosmosService.initialize();
    
    console.log('🔍 Testing QC Results Query...\n');
    
    // Test 1: Try to get item from results container
    console.log('1️⃣ Trying results container with ID "3":');
    const resultItem = await cosmosService.getItem('results', '3');
    console.log('Result:', resultItem ? 'Found' : 'Not found');
    console.log();
    
    // Test 2: Query qc-reviews container by orderId
    console.log('2️⃣ Querying qc-reviews container for orderId "3":');
    const query1 = {
      query: 'SELECT * FROM c WHERE c.orderId = @orderId',
      parameters: [{ name: '@orderId', value: '3' }]
    };
    
    const qcReviewResult1 = await cosmosService.queryItems('qc-reviews', query1);
    console.log('Success:', qcReviewResult1.success);
    console.log('Data count:', qcReviewResult1.data?.length || 0);
    if (qcReviewResult1.data && qcReviewResult1.data.length > 0) {
      console.log('First result ID:', qcReviewResult1.data[0].id);
      console.log('Order ID:', qcReviewResult1.data[0].orderId);
    }
    console.log();
    
    // Test 3: Query qc-reviews container for orderId "ord_2024_00123456"
    console.log('3️⃣ Querying qc-reviews container for orderId "ord_2024_00123456":');
    const query2 = {
      query: 'SELECT * FROM c WHERE c.orderId = @orderId',
      parameters: [{ name: '@orderId', value: 'ord_2024_00123456' }]
    };
    
    const qcReviewResult2 = await cosmosService.queryItems('qc-reviews', query2);
    console.log('Success:', qcReviewResult2.success);
    console.log('Data count:', qcReviewResult2.data?.length || 0);
    if (qcReviewResult2.data && qcReviewResult2.data.length > 0) {
      console.log('First result ID:', qcReviewResult2.data[0].id);
      console.log('Order ID:', qcReviewResult2.data[0].orderId);
      console.log('Has categoriesResults:', !!qcReviewResult2.data[0].categoriesResults);
      console.log('Categories count:', qcReviewResult2.data[0].categoriesResults?.length || 0);
    }
    console.log();
    
    // Test 4: List all items in qc-reviews to see what's there
    console.log('4️⃣ Listing all items in qc-reviews container:');
    const allQuery = {
      query: 'SELECT c.id, c.orderId, c.orderNumber FROM c'
    };
    
    const allItems = await cosmosService.queryItems('qc-reviews', allQuery);
    console.log('Success:', allItems.success);
    console.log('Total items:', allItems.data?.length || 0);
    if (allItems.data) {
      allItems.data.forEach((item, index) => {
        console.log(`  ${index + 1}. ID: ${item.id}, OrderID: ${item.orderId}, OrderNumber: ${item.orderNumber}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testQuery();