/**
 * Test Azure Communication Services Identity API
 * Creates a test user and generates a token to verify ACS credentials
 */

const { CommunicationIdentityClient } = require('@azure/communication-identity');
const { AzureKeyCredential } = require('@azure/core-auth');
require('dotenv').config();

async function testAcsIdentity() {
  try {
    const endpoint = process.env.AZURE_COMMUNICATION_ENDPOINT;
    const apiKey = process.env.AZURE_COMMUNICATION_API_KEY;

    if (!endpoint || !apiKey) {
      console.error('❌ Missing ACS credentials');
      console.log('Set AZURE_COMMUNICATION_ENDPOINT and AZURE_COMMUNICATION_API_KEY');
      process.exit(1);
    }

    console.log('🔍 Testing ACS Identity API...');
    console.log(`Endpoint: ${endpoint}`);

    // Initialize client with API key
    const credential = new AzureKeyCredential(apiKey);
    const client = new CommunicationIdentityClient(endpoint, credential);

    console.log('\n📝 Creating test ACS user...');
    const user = await client.createUser();
    console.log(`✅ User created: ${user.communicationUserId}`);

    console.log('\n🔐 Generating access token...');
    const tokenResponse = await client.getToken(user, ['chat']);
    console.log(`✅ Token generated successfully`);
    console.log(`   Token: ${tokenResponse.token.substring(0, 50)}...`);
    console.log(`   Expires: ${tokenResponse.expiresOn}`);

    console.log('\n🧹 Cleaning up test user...');
    await client.deleteUser(user);
    console.log('✅ Test user deleted');

    console.log('\n✅ ACS Identity API is working correctly!');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.statusCode) {
      console.error(`   Status Code: ${error.statusCode}`);
    }
    if (error.code) {
      console.error(`   Error Code: ${error.code}`);
    }
    console.error('\nFull error:', error);
    process.exit(1);
  }
}

testAcsIdentity();
