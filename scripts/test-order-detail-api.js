/**
 * Test what the order detail API returns for order-005
 */

const axios = require('axios');

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001';
const TEST_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0LWFkbWluIiwiZW1haWwiOiJhZG1pbkB0ZXN0LmNvbSIsIm5hbWUiOiJUZXN0IEFkbWluIiwicm9sZSI6ImFkbWluIiwidGVuYW50SWQiOiJ0ZXN0LXRlbmFudCIsImlzVGVzdFRva2VuIjp0cnVlLCJpc3MiOiJhcHByYWlzYWwtbWFuYWdlbWVudC10ZXN0IiwiYXVkIjoiYXBwcmFpc2FsLW1hbmFnZW1lbnQtYXBpIiwiaWF0IjoxNzcwOTI3MTUwLCJleHAiOjE3NzEwMTM1NTB9.fm_RuE9vafsicLNkS8wm5t7QqTcQIabxbjoLYYd9w_U';

async function testOrderDetailAPI() {
  try {
    console.log(`\n🧪 Testing GET /api/orders/order-005\n`);

    const response = await axios.get(`${API_BASE_URL}/api/orders/order-005`, {
      headers: {
        'Authorization': `Bearer ${TEST_TOKEN}`,
      }
    });

    console.log(`✅ Status: ${response.status}`);
    console.log('\n📋 Response data:\n');
    console.log(JSON.stringify(response.data, null, 2));

  } catch (error) {
    console.error('❌ Error calling API:', error.message);
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Data:`, error.response.data);
    }
  }
}

testOrderDetailAPI();
