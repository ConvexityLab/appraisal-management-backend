/**
 * Test the /api/orders endpoint directly
 */

const axios = require('axios');

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001';

// Test token from TEST_DATA_REFERENCE.md
const TEST_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0LWFkbWluIiwiZW1haWwiOiJhZG1pbkB0ZXN0LmNvbSIsIm5hbWUiOiJUZXN0IEFkbWluIiwicm9sZSI6ImFkbWluIiwidGVuYW50SWQiOiJ0ZXN0LXRlbmFudCIsImlzVGVzdFRva2VuIjp0cnVlLCJpc3MiOiJhcHByYWlzYWwtbWFuYWdlbWVudC10ZXN0IiwiYXVkIjoiYXBwcmFpc2FsLW1hbmFnZW1lbnQtYXBpIiwiaWF0IjoxNzcwOTI3MTUwLCJleHAiOjE3NzEwMTM1NTB9.fm_RuE9vafsicLNkS8wm5t7QqTcQIabxbjoLYYd9w_U';

async function testOrdersAPI() {
  try {
    console.log(`\n🧪 Testing GET /api/orders at ${API_BASE_URL}\n`);

    const response = await axios.get(`${API_BASE_URL}/api/orders`, {
      headers: {
        'Authorization': `Bearer ${TEST_TOKEN}`,
      },
      params: {
        limit: 50
      }
    });

    console.log(`✅ Status: ${response.status}`);
    console.log(`📊 Response structure:`, Object.keys(response.data));
    
    const orders = response.data.orders || response.data.data || response.data;
    console.log(`📦 Total orders returned: ${Array.isArray(orders) ? orders.length : 'Not an array!'}\n`);

    if (Array.isArray(orders)) {
      // Look for order-005
      const order005 = orders.find(o => o.id === 'order-005' || o.orderNumber === 'APR-2026-005');
      
      if (order005) {
        console.log('✅ FOUND APR-2026-005 (order-005)!');
        console.log(`   Status: ${order005.status}`);
        console.log(`   Client: ${order005.clientName}`);
        console.log('');
      } else {
        console.log('❌ APR-2026-005 (order-005) NOT in API response!');
        console.log('');
        console.log('Orders in response:');
        orders.slice(0, 10).forEach(o => {
          console.log(`   - ${o.orderNumber} (${o.id}) - ${o.status}`);
        });
      }
    }

  } catch (error) {
    console.error('❌ Error calling API:', error.message);
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Data:`, error.response.data);
    }
  }
}

testOrdersAPI();
