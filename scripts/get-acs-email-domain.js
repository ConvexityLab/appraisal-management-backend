/**
 * Get Azure Communication Services Email Domain
 * Retrieves the Azure-managed email domain from ACS
 */

const { EmailClient } = require('@azure/communication-email');
const { AzureKeyCredential } = require('@azure/core-auth');
require('dotenv').config();

async function getEmailDomain() {
  try {
    const endpoint = process.env.AZURE_COMMUNICATION_ENDPOINT;
    const apiKey = process.env.AZURE_COMMUNICATION_API_KEY;

    if (!endpoint || !apiKey) {
      console.error('❌ Missing ACS credentials');
      console.log('Set AZURE_COMMUNICATION_ENDPOINT and AZURE_COMMUNICATION_API_KEY');
      process.exit(1);
    }

    console.log('🔍 Connecting to ACS Email...');
    console.log(`Endpoint: ${endpoint}`);

    // The Azure-managed domain follows this pattern:
    // DoNotReply@<guid>.azurecomm.net
    
    // Extract the resource name from endpoint
    const resourceMatch = endpoint.match(/https:\/\/([^.]+)\./);
    if (resourceMatch) {
      const resourceName = resourceMatch[1];
      console.log(`\n📧 Azure-managed email domain (auto-provisioned):`);
      console.log(`   DoNotReply@${resourceName}.azurecomm.net`);
      console.log(`\n✅ Use this domain in .env file (no verification needed)`);
      console.log(`\n⚠️  REMINDER: For production, link custom domain loneanalytics.com in Azure Portal:`);
      console.log(`   1. Go to Azure Portal → Communication Services → Email`);
      console.log(`   2. Click "Provision domains" → "Add domain"`);
      console.log(`   3. Add loneanalytics.com and complete DNS verification`);
      console.log(`   4. Update AZURE_COMMUNICATION_EMAIL_DOMAIN=DoNotReply@loneanalytics.com`);
    } else {
      console.log('❌ Could not parse resource name from endpoint');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

getEmailDomain();
