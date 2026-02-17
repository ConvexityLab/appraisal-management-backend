/**
 * Test fetching report-test-001 via the API endpoint
 * Simulates what the frontend does
 */

const fetch = require('node-fetch');

const API_BASE = 'http://localhost:3001'; // or your backend URL
const REPORT_ID = 'report-test-001';

async function testReportFetch() {
  console.log('\n🧪 Testing Report Fetch via API\n');
  console.log(`GET ${API_BASE}/api/reports/${REPORT_ID}\n`);

  try {
    const response = await fetch(`${API_BASE}/api/reports/${REPORT_ID}`);
    
    console.log('Status:', response.status);
    console.log('Status Text:', response.statusText);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API Error:', errorText);
      return;
    }

    const reportResult = await response.json();
    
    console.log('\n✅ Report fetched successfully!\n');
    console.log('Report keys:', Object.keys(reportResult));
    console.log('Has compsData?', !!reportResult.compsData);
    console.log('compsData length:', reportResult.compsData?.length || 0);
    console.log('Has subject?', !!reportResult.subject);
    
    if (reportResult.compsData && reportResult.compsData.length > 0) {
      console.log('\n📍 First comp from API:');
      console.log('  address:', reportResult.compsData[0].address);
      console.log('  city:', reportResult.compsData[0].city);
      console.log('  state:', reportResult.compsData[0].state);
      console.log('  latitude:', reportResult.compsData[0].latitude);
      console.log('  longitude:', reportResult.compsData[0].longitude);
      
      // Simulate frontend transformation
      console.log('\n🔄 Frontend transformation test:');
      const transformedComps = reportResult.compsData.map((comp) => ({
        ...comp,
        address: {
          street: comp.address || '',
          city: comp.city || '',
          state: comp.state || '',
          zip: comp.zip || '',
          latitude: comp.latitude,
          longitude: comp.longitude,
        }
      }));
      
      console.log('Transformed comps count:', transformedComps.length);
      console.log('First transformed comp address:', transformedComps[0].address);
    } else {
      console.log('\n⚠️  No compsData in API response!');
    }

    // Check if subject has coordinates
    if (reportResult.subject?.address) {
      console.log('\n📍 Subject property:');
      console.log('  address:', reportResult.subject.address);
      console.log('  latitude:', reportResult.subject.address.latitude);
      console.log('  longitude:', reportResult.subject.address.longitude);
    }

  } catch (error) {
    console.error('\n❌ Fetch Error:', error.message);
    console.error('\nIs the backend running on port 3001?');
    console.error('Start it with: npm run dev\n');
  }
}

testReportFetch();
