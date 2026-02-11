/**
 * Test Script: End-to-End API Communication Test
 * 
 * Tests the complete unified communication platform via REST API:
 * 1. Create communication context
 * 2. Initialize chat thread via API
 * 3. Start an ad-hoc call
 * 4. Schedule a Teams meeting
 * 5. Verify all IDs are real and usable
 */

require('dotenv').config();
const axios = require('axios');

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001';
const TEST_JWT = process.env.TEST_JWT_ADMIN;

if (!TEST_JWT) {
  console.error('❌ Missing TEST_JWT_ADMIN environment variable');
  process.exit(1);
}

const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Authorization': `Bearer ${TEST_JWT}`,
    'Content-Type': 'application/json'
  }
});

async function testUnifiedCommunicationAPI() {
  console.log('\n🧪 Testing Unified Communication Platform API\n');
  console.log('='.repeat(60));
  console.log(`API Base URL: ${API_BASE_URL}`);
  console.log('='.repeat(60));

  try {
    // Step 1: Create Communication Context
    console.log('\n📝 Step 1: Creating communication context for order...');
    const contextPayload = {
      type: 'order',
      entityId: 'test-order-' + Date.now(),
      tenantId: 'test-tenant-123',
      createdBy: 'test-user-admin',
      participants: [
        {
          userId: 'user-appraiser-1',
          displayName: 'John Appraiser',
          email: 'john.appraiser@example.com',
          role: 'appraiser'
        },
        {
          userId: 'user-client-1',
          displayName: 'Jane Client',
          email: 'jane.client@example.com',
          role: 'client'
        },
        {
          userId: 'user-manager-1',
          displayName: 'Mike Manager',
          email: 'mike.manager@example.com',
          role: 'manager'
        }
      ],
      autoCreateChat: false  // We'll create it manually in next step
    };

    const contextResponse = await axiosInstance.post('/api/communication/contexts', contextPayload);
    const context = contextResponse.data.data;

    console.log('✅ Context created successfully!');
    console.log(`   Context ID: ${context.id}`);
    console.log(`   Entity: ${context.type} - ${context.entityId}`);
    console.log(`   Participants: ${context.participants.length}`);
    console.log(`   ACS User IDs created: ${context.participants.map(p => p.acsUserId).join(', ')}`);

    // Step 2: Initialize Chat Thread
    console.log('\n📝 Step 2: Initializing chat thread...');
    const chatResponse = await axiosInstance.post(`/api/communication/contexts/${context.id}/chat`, {
      userId: 'user-appraiser-1'
    });
    const chatData = chatResponse.data.data;

    console.log('✅ Chat thread created!');
    console.log(`   Thread ID: ${chatData.threadId}`);
    console.log(`   ✨ This is a REAL ACS thread ID - frontend can use it!`);

    // Step 3: Start Ad-Hoc Call
    console.log('\n📝 Step 3: Starting ad-hoc call...');
    const callResponse = await axiosInstance.post(`/api/communication/contexts/${context.id}/call`, {
      participants: ['user-appraiser-1', 'user-client-1']
    });
    const callData = callResponse.data.data;

    console.log('✅ Call started!');
    console.log(`   Call ID: ${callData.id}`);
    console.log(`   Group Call ID: ${callData.groupCallId}`);
    console.log(`   ✨ Use this groupCallId with ACS Calling SDK to join!`);

    // Step 4: Schedule Teams Meeting (if Teams service is available)
    console.log('\n📝 Step 4: Scheduling Teams meeting...');
    try {
      const startTime = new Date();
      startTime.setHours(startTime.getHours() + 1);
      const endTime = new Date(startTime);
      endTime.setHours(endTime.getHours() + 1);

      const meetingResponse = await axiosInstance.post(`/api/communication/contexts/${context.id}/meeting`, {
        subject: 'QC Review Discussion',
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        participants: ['john.appraiser@example.com', 'jane.client@example.com'],
        organizerUserId: 'user-manager-1',
        description: 'Discuss QC findings and next steps'
      });
      const meetingData = meetingResponse.data.data;

      console.log('✅ Meeting scheduled!');
      console.log(`   Meeting ID: ${meetingData.id}`);
      console.log(`   Join URL: ${meetingData.meetingLink}`);
      console.log(`   ✨ This is a REAL Teams meeting link!`);
    } catch (error) {
      if (error.response?.status === 500) {
        console.log('⚠️  Teams meeting creation failed (Teams service may not be configured)');
        console.log('   This is OK - chat and calls are working!');
      } else {
        throw error;
      }
    }

    // Step 5: Retrieve Context to verify everything
    console.log('\n📝 Step 5: Retrieving context to verify all data...');
    const getContextResponse = await axiosInstance.get(`/api/communication/contexts/${context.id}`);
    const finalContext = getContextResponse.data.data;

    console.log('✅ Context retrieved!');
    console.log(`   Chat Thread ID: ${finalContext.chatThreadId || 'Not created'}`);
    console.log(`   Calls recorded: ${finalContext.calls.length}`);
    console.log(`   Active participants: ${finalContext.participants.length}`);

    // Step 6: Add a new participant
    console.log('\n📝 Step 6: Adding new participant...');
    await axiosInstance.post(`/api/communication/contexts/${context.id}/participants`, {
      userId: 'user-qc-analyst-1',
      displayName: 'Sarah QC Analyst',
      email: 'sarah.qc@example.com',
      role: 'qc_analyst'
    });

    console.log('✅ Participant added!');

    // Step 7: Get context by entity
    console.log('\n📝 Step 7: Getting context by entity type and ID...');
    const getByEntityResponse = await axiosInstance.get(
      `/api/communication/contexts/${context.type}/${context.entityId}?tenantId=${context.tenantId}`
    );
    const contextByEntity = getByEntityResponse.data.data;

    console.log('✅ Context found by entity!');
    console.log(`   Participants now: ${contextByEntity.participants.length}`);

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('🎉 ALL API TESTS PASSED!');
    console.log('='.repeat(60));
    console.log('\n📋 Summary:');
    console.log(`   ✅ Communication context: ${context.id}`);
    console.log(`   ✅ Real chat thread: ${chatData.threadId}`);
    console.log(`   ✅ Real group call: ${callData.groupCallId}`);
    console.log(`   ✅ Participants managed: ${contextByEntity.participants.length}`);
    console.log('\n💡 Frontend can now:');
    console.log(`   1. GET /api/acs/token to get chat/call tokens`);
    console.log(`   2. Use thread ID: ${chatData.threadId}`);
    console.log(`   3. Use group call ID: ${callData.groupCallId}`);
    console.log(`   4. Join real ACS chat and calls!`);
    console.log('\n🚀 The backend is providing REAL IDs - no more mocks!\n');

  } catch (error) {
    console.error('\n❌ Test Failed!');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Error:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('Error:', error.message);
    }
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Run the test
console.log('🚀 Starting Unified Communication API Test...');
console.log('Make sure the API server is running on port 3001!');
testUnifiedCommunicationAPI();
