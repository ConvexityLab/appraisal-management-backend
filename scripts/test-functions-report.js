/**
 * Test fetching report via Azure Functions endpoint
 * Azure Functions might have different auth requirements
 */

const fetch = require('node-fetch');

const FUNCTIONS_URL = 'https://l1-valuation-platform-functions.azurewebsites.net/api/getReport';
const REPORT_ID = 'report-test-001';

async function testFunctionsReport() {
  console.log('\n🧪 Testing Report Fetch via Azure Functions\n');
  console.log(`POST ${FUNCTIONS_URL}\n`);

  try {
    const response = await fetch(FUNCTIONS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        reportRecordId: REPORT_ID
      })
    });
    
    console.log('Status:', response.status);
    console.log('Status Text:', response.statusText);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API Error:', errorText);
      return;
    }

    const reportResult = await response.json();
    
    console.log('\n✅ Report fetched successfully!\n');
    console.log('Has compsData?', !!reportResult.compsData);
    console.log('compsData length:', reportResult.compsData?.length || 0);
    
    if (reportResult.compsData && reportResult.compsData.length > 0) {
      console.log('\n📍 First comp:');
      console.log(JSON.stringify(reportResult.compsData[0], null, 2));
    }

  } catch (error) {
    console.error('\n❌ Fetch Error:', error.message);
  }
}

testFunctionsReport();
