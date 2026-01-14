/**
 * Test Teams Direct Messaging
 * Sends a 1-on-1 Teams message to verify integration
 * 
 * This test uses the TEST TOKEN that bypasses user profile requirement
 */

const YOUR_AZURE_AD_USER_ID = 'd14de96e-1d1b-43d4-8250-7086f0a386b9'; // From your JWT token (oid claim)

// Use TEST_JWT_ADMIN token which is configured in .env and works without database user
const TEST_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0LWFkbWluIiwiZW1haWwiOiJhZG1pbkB0ZXN0LmxvY2FsIiwibmFtZSI6IlRlc3QgQWRtaW4iLCJyb2xlIjoiYWRtaW4iLCJ0ZW5hbnRJZCI6InRlc3QtdGVuYW50IiwiYWNjZXNzU2NvcGUiOnsidGVhbUlkcyI6WyJ0ZWFtLWFsbCJdLCJkZXBhcnRtZW50SWRzIjpbImRlcHQtYWxsIl0sIm1hbmFnZWRDbGllbnRJZHMiOlsiY2xpZW50LWFsbCJdLCJtYW5hZ2VkVmVuZG9ySWRzIjpbInZlbmRvci1hbGwiXSwibWFuYWdlZFVzZXJJZHMiOlsidXNlci1hbGwiXSwicmVnaW9uSWRzIjpbInJlZ2lvbi1hbGwiXSwic3RhdGVzQ292ZXJlZCI6WyJBTEwiXSwiY2FuVmlld0FsbE9yZGVycyI6dHJ1ZSwiY2FuVmlld0FsbFZlbmRvcnMiOnRydWUsImNhbk92ZXJyaWRlUUMiOnRydWV9LCJwZXJtaXNzaW9ucyI6WyIqIl0sImlzcyI6ImFwcHJhaXNhbC1tYW5hZ2VtZW50LXRlc3QiLCJhdWQiOiJhcHByYWlzYWwtbWFuYWdlbWVudC1hcGkiLCJpYXQiOjE3NjcyOTY1NTMsImlzVGVzdFRva2VuIjp0cnVlLCJleHAiOjE3NjczODI5NTN9.CoxEvvxE8kHzc7WmP9HZP3ksXjXbibNvwvkgiqMmNME';

const API_URL = 'http://localhost:3001';

async function testDirectMessage() {
  console.log('\n=== TESTING TEAMS DIRECT MESSAGING ===\n');
  
  try {
    console.log('Sending direct Teams message to:', YOUR_AZURE_AD_USER_ID);
    
    const response = await fetch(`${API_URL}/api/teams/messages/direct`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TEST_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        recipientUserId: YOUR_AZURE_AD_USER_ID,
        message: `
          <h2>🎉 Teams Integration Test Successful!</h2>
          <p>Your appraisal management platform can now send direct Teams messages.</p>
          <p><strong>Timestamp:</strong> ${new Date().toLocaleString()}</p>
          <p><strong>Capabilities:</strong></p>
          <ul>
            <li>✅ 1-on-1 Direct Messaging</li>
            <li>✅ Order Notifications</li>
            <li>✅ Teams Meeting Integration</li>
            <li>✅ External User Chat (ACS)</li>
          </ul>
          <p><em>This message was sent programmatically via Microsoft Graph API.</em></p>
        `
      })
    });

    const result = await response.json();
    
    if (response.ok && result.success) {
      console.log('✅ SUCCESS! Teams message sent.');
      console.log('Chat ID:', result.data.chatId);
      console.log('Message ID:', result.data.messageId);
      console.log('\n👉 Check your Teams app - you should see the message now!');
    } else {
      console.error('❌ FAILED:', result.error || result.message);
      if (result.message && result.message.includes('not configured')) {
        console.log('\n⚠️  Teams service not configured. Ensure:');
        console.log('   - AZURE_TENANT_ID is set in .env');
        console.log('   - AZURE_CLIENT_ID has Microsoft Graph permissions');
        console.log('   - App has Chat.ReadWrite permission');
      }
    }
  } catch (error) {
    console.error('❌ ERROR:', error.message);
    if (error.message.includes('ECONNREFUSED')) {
      console.log('\n⚠️  API server not running. Start it with: npm run dev');
    }
  }
}

async function testOrderNotification() {
  console.log('\n=== TESTING ORDER NOTIFICATION ===\n');
  
  try {
    console.log('Sending order notification to:', YOUR_AZURE_AD_USER_ID);
    
    const response = await fetch(`${API_URL}/api/teams/messages/order-notification`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TEST_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        recipientUserId: YOUR_AZURE_AD_USER_ID,
        orderId: 'TEST-12345',
        subject: '📋 New Order Assignment',
        message: 'You have been assigned to appraise the property at 123 Main Street. Please review and accept within 24 hours.'
      })
    });

    const result = await response.json();
    
    if (response.ok && result.success) {
      console.log('✅ SUCCESS! Order notification sent.');
      console.log('Chat ID:', result.data.chatId);
      console.log('Message ID:', result.data.messageId);
      console.log('\n👉 Check Teams for the formatted order notification!');
    } else {
      console.error('❌ FAILED:', result.error || result.message);
    }
  } catch (error) {
    console.error('❌ ERROR:', error.message);
  }
}

// Run both tests
(async () => {
  await testDirectMessage();
  await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
  await testOrderNotification();
  
  console.log('\n=== TEST COMPLETE ===\n');
})();
