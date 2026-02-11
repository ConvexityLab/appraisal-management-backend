/**
 * Test Script: Chat Thread Creation
 * 
 * Tests the complete flow:
 * 1. Create communication context
 * 2. Initialize chat thread with real ACS SDK
 * 3. Verify thread exists in Azure
 * 4. Send test message
 * 5. Retrieve thread details
 */

require('dotenv').config();
const { CommunicationIdentityClient } = require('@azure/communication-identity');
const { ChatClient } = require('@azure/communication-chat');
const { AzureCommunicationTokenCredential } = require('@azure/communication-common');
const { AzureKeyCredential } = require('@azure/core-auth');

// Use correct environment variable names
const ACS_ENDPOINT = process.env.AZURE_COMMUNICATION_ENDPOINT || process.env.ACS_ENDPOINT;
const ACS_API_KEY = process.env.AZURE_COMMUNICATION_API_KEY || process.env.ACS_API_KEY;

async function testChatThreadCreation() {
  console.log('\n🧪 Testing Chat Thread Creation\n');
  console.log('='.repeat(60));

  if (!ACS_ENDPOINT || !ACS_API_KEY) {
    console.error('❌ Missing ACS_ENDPOINT or ACS_API_KEY environment variables');
    process.exit(1);
  }

  try {
    // Step 1: Create ACS users for testing
    console.log('\n📝 Step 1: Creating test ACS users...');
    const identityClient = new CommunicationIdentityClient(
      ACS_ENDPOINT,
      new AzureKeyCredential(ACS_API_KEY)
    );

    const user1 = await identityClient.createUser();
    const user2 = await identityClient.createUser();
    const user3 = await identityClient.createUser();

    console.log('✅ Created 3 test users:');
    console.log(`   User 1: ${user1.communicationUserId}`);
    console.log(`   User 2: ${user2.communicationUserId}`);
    console.log(`   User 3: ${user3.communicationUserId}`);

    // Step 2: Get tokens for users
    console.log('\n📝 Step 2: Generating access tokens...');
    const token1 = await identityClient.getToken(user1, ['chat', 'voip']);
    const token2 = await identityClient.getToken(user2, ['chat', 'voip']);
    const token3 = await identityClient.getToken(user3, ['chat', 'voip']);

    console.log('✅ Generated tokens for all users');

    // Step 3: Create chat thread with User 1 as creator
    console.log('\n📝 Step 3: Creating chat thread...');
    const chatClient = new ChatClient(
      ACS_ENDPOINT,
      new AzureCommunicationTokenCredential(token1.token)
    );

    const createChatThreadRequest = {
      topic: 'Test Order #12345 - Communication',
      participants: [
        {
          id: { communicationUserId: user1.communicationUserId },
          displayName: 'John Appraiser',
          shareHistoryTime: new Date()
        },
        {
          id: { communicationUserId: user2.communicationUserId },
          displayName: 'Jane Client',
          shareHistoryTime: new Date()
        },
        {
          id: { communicationUserId: user3.communicationUserId },
          displayName: 'Mike Manager',
          shareHistoryTime: new Date()
        }
      ]
    };

    const createChatThreadResult = await chatClient.createChatThread(createChatThreadRequest);
    
    if (!createChatThreadResult.chatThread) {
      throw new Error('Failed to create chat thread');
    }

    const threadId = createChatThreadResult.chatThread.id;
    console.log(`✅ Chat thread created successfully!`);
    console.log(`   Thread ID: ${threadId}`);

    // Step 4: Get thread properties
    console.log('\n📝 Step 4: Retrieving thread details...');
    const threadClient = chatClient.getChatThreadClient(threadId);
    const properties = await threadClient.getProperties();

    console.log('✅ Thread Properties:');
    console.log(`   Topic: ${properties.topic}`);
    console.log(`   Created On: ${properties.createdOn}`);
    console.log(`   Created By: ${properties.createdBy}`);

    // Step 5: List participants
    console.log('\n📝 Step 5: Listing participants...');
    const participants = [];
    for await (const participant of threadClient.listParticipants()) {
      participants.push(participant);
    }

    console.log(`✅ Participants (${participants.length}):`);
    participants.forEach((p, index) => {
      console.log(`   ${index + 1}. ${p.displayName} (${p.id.communicationUserId})`);
    });

    // Step 6: Send a test message
    console.log('\n📝 Step 6: Sending test message...');
    const sendMessageResult = await threadClient.sendMessage({
      content: 'Hello! This is a test message from the backend system.'
    });

    console.log('✅ Message sent successfully!');
    console.log(`   Message ID: ${sendMessageResult.id}`);

    // Step 7: Retrieve messages
    console.log('\n📝 Step 7: Retrieving messages...');
    const messages = [];
    for await (const message of threadClient.listMessages({ maxPageSize: 10 })) {
      if (message.type === 'text') {
        messages.push(message);
      }
    }

    console.log(`✅ Found ${messages.length} messages:`);
    messages.reverse().forEach((msg, index) => {
      console.log(`   ${index + 1}. [${msg.createdOn.toLocaleTimeString()}] ${msg.senderDisplayName || 'System'}: ${msg.content?.message || '(no content)'}`);
    });

    // Step 8: Add a new participant
    console.log('\n📝 Step 8: Adding a new participant...');
    const user4 = await identityClient.createUser();
    console.log(`   Created User 4: ${user4.communicationUserId}`);

    await threadClient.addParticipants({
      participants: [{
        id: { communicationUserId: user4.communicationUserId },
        displayName: 'Sarah QC Analyst',
        shareHistoryTime: new Date()
      }]
    });

    console.log('✅ Participant added successfully!');

    // Step 9: Verify final participant count
    console.log('\n📝 Step 9: Verifying participant count...');
    const finalParticipants = [];
    for await (const participant of threadClient.listParticipants()) {
      finalParticipants.push(participant);
    }

    console.log(`✅ Final participant count: ${finalParticipants.length}`);

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('🎉 ALL TESTS PASSED!');
    console.log('='.repeat(60));
    console.log('\n📋 Summary:');
    console.log(`   ✅ Chat thread created: ${threadId}`);
    console.log(`   ✅ Participants: ${finalParticipants.length}`);
    console.log(`   ✅ Messages: ${messages.length}`);
    console.log(`   ✅ All operations working correctly`);
    console.log('\n💡 Frontend Integration:');
    console.log(`   Use this thread ID in your app: ${threadId}`);
    console.log(`   GET /api/acs/token to get chat tokens`);
    console.log(`   Use ACS Chat SDK with the thread ID to join`);
    
    // Cleanup
    console.log('\n📝 Cleanup: Deleting test users...');
    await identityClient.deleteUser(user1);
    await identityClient.deleteUser(user2);
    await identityClient.deleteUser(user3);
    await identityClient.deleteUser(user4);
    console.log('✅ Cleanup complete\n');

  } catch (error) {
    console.error('\n❌ Test Failed!');
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Response:', JSON.stringify(error.response, null, 2));
    }
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Run the test
console.log('🚀 Starting Chat Thread Creation Test...');
testChatThreadCreation();
