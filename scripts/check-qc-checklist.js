/**
 * Check QC Checklist in Cosmos DB
 * Displays the structure and question count for debugging
 */

require('dotenv').config();
const { CosmosClient } = require('@azure/cosmos');
const { DefaultAzureCredential } = require('@azure/identity');

const COSMOS_ENDPOINT = process.env.AZURE_COSMOS_ENDPOINT || 'https://appraisal-mgmt-staging-cosmos.documents.azure.com:443/';
const DATABASE_ID = 'appraisal-management';
const CLIENT_ID = 'default-client';

const credential = new DefaultAzureCredential();
const client = new CosmosClient({ endpoint: COSMOS_ENDPOINT, aadCredentials: credential });
const database = client.database(DATABASE_ID);
const container = database.container('criteria');

async function checkChecklist() {
  try {
    console.log('📋 Fetching checklist from Cosmos DB...\n');
    
    const { resource } = await container.item('checklist-uad-standard-2026', CLIENT_ID).read();
    
    if (!resource) {
      console.error('❌ Checklist not found!');
      return;
    }
    
    console.log('✅ Checklist found:', resource.name);
    console.log('   Version:', resource.version);
    console.log('   Type:', resource.type);
    console.log('   Categories:', resource.categories.length);
    console.log('');
    
    let totalQuestions = 0;
    
    resource.categories.forEach((cat, i) => {
      console.log(`📁 Category ${i+1}: ${cat.name}`);
      console.log(`   ID: ${cat.id}`);
      console.log(`   Subcategories: ${cat.subcategories.length}`);
      
      cat.subcategories.forEach((sub, j) => {
        console.log(`   └─ Subcategory ${j+1}: ${sub.name}`);
        console.log(`      Questions: ${sub.questions.length}`);
        
        sub.questions.forEach((q, k) => {
          const questionPreview = q.question.length > 60 
            ? q.question.substring(0, 60) + '...' 
            : q.question;
          console.log(`      ${k+1}. [${q.id}] ${questionPreview}`);
          totalQuestions++;
        });
      });
      console.log('');
    });
    
    console.log('📊 Summary:');
    console.log(`   Total Categories: ${resource.categories.length}`);
    console.log(`   Total Questions: ${totalQuestions}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  }
}

checkChecklist()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
