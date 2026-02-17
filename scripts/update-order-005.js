/**
 * Update order-005 with correct schema
 */

require('dotenv').config();
const { CosmosClient } = require('@azure/cosmos');
const { DefaultAzureCredential } = require('@azure/identity');

const COSMOS_ENDPOINT = process.env.AZURE_COSMOS_ENDPOINT || process.env.COSMOS_ENDPOINT;
const DATABASE_ID = 'appraisal-management';
const TENANT_ID = 'test-tenant-123';

async function updateOrder005() {
  try {
    console.log('\n🔄 Updating order-005 with correct schema...\n');

    const credential = new DefaultAzureCredential();
    const client = new CosmosClient({ 
      endpoint: COSMOS_ENDPOINT, 
      aadCredentials: credential 
    });
    
    const database = client.database(DATABASE_ID);
    const container = database.container('orders');

    const updatedOrder = {
      id: 'order-005',
      type: 'order',
      tenantId: TENANT_ID,
      orderNumber: 'APR-2026-005',
      status: 'COMPLETED',
      orderType: 'FULL_APPRAISAL',
      productType: 'FULL_APPRAISAL_1004',
      priority: 'STANDARD',
      propertyAddress: {
        street: '555 Cedar Ln',
        city: 'Frisco',
        state: 'TX',
        zipCode: '75034',
        county: 'Collin',
        latitude: 33.1507,
        longitude: -96.8236
      },
      // Add propertyData for property valuation page
      propertyData: {
        address: {
          street: '555 Cedar Ln',
          city: 'Frisco',
          state: 'TX',
          zipCode: '75034',
          county: 'Collin',
          latitude: 33.1507,
          longitude: -96.8236
        },
        building: {
          yearBuilt: 2018,
          livingAreaSquareFeet: 2800,
          bedrooms: 4,
          bathrooms: 3,
          lotSizeSquareFeet: 8500,
          stories: 2,
          garageSpaces: 2,
          basement: false,
          pool: true
        }
      },
      propertyDetails: {
        propertyType: 'SINGLE_FAMILY',
        yearBuilt: 2018,
        squareFeet: 2800,
        bedrooms: 4,
        bathrooms: 3,
        lotSize: 8500,
        stories: 2,
        garageSpaces: 2,
        basement: false,
        pool: true,
        condition: 'Excellent',
        occupancyStatus: 'Owner Occupied'
      },
      clientInformation: {
        clientName: 'Wells Fargo',
        contactName: 'Sarah Johnson',
        contactEmail: 'sarah.johnson@wellsfargo.com',
        contactPhone: '214-555-0102',
        loanNumber: 'WF-2026-789456',
        borrowerName: 'Robert Martinez',
        loanType: 'Conventional',
        loanPurpose: 'Purchase'
      },
      vendorInformation: {
        vendorId: 'vendor-005',
        vendorName: 'Heritage Valuation Co',
        vendorEmail: 'robert@heritagevalue.com',
        vendorPhone: '+12145551005',
        licenseNumber: 'TX-CR-98765',
        assignedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
        acceptedAt: new Date(Date.now() - 14.9 * 24 * 60 * 60 * 1000).toISOString()
      },
      loanAmount: 625000,
      dueDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      reportSubmittedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      reportUrl: 'blob://reports/order-005-report.pdf',
      reportId: 'report-test-001',
      qcStatus: 'PASSED',
      qcScore: 95,
      qcApprovedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      qcApprovedBy: 'test-user-qc',
      deliveredAt: new Date(Date.now() - 1.5 * 24 * 60 * 60 * 1000).toISOString(),
      finalValue: 625000,
      specialInstructions: 'Property has solar panels and energy-efficient features - please note in valuation',
      accessInstructions: 'Contact borrower 24 hours in advance. Gate code: #5432',
      createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: 'test-user-admin'
    };

    console.log('Upserting order with coordinates:',  JSON.stringify({
      id: updatedOrder.id,
      propertyAddress: updatedOrder.propertyAddress
    }, null, 2));

    const { resource } = await container.items.upsert(updatedOrder);
    
    console.log('✅ order-005 updated successfully!');
    console.log('\nVerifying propertyAddress from upsert response:');
    console.log(JSON.stringify(resource.propertyAddress, null, 2));
    console.log('\nUpdated fields:');
    console.log('  - status: COMPLETED');
    console.log('  - orderType: FULL_APPRAISAL');
    console.log('  - priority: STANDARD');
    console.log('  - Added propertyDetails object');
    console.log('  - Added clientInformation object');
    console.log('  - Added vendorInformation object');
    console.log('  - Added qcStatus: PASSED');
    console.log('  - Added specialInstructions and accessInstructions');
    console.log('\n✨ Frontend should now display all data correctly!\n');

  } catch (error) {
    console.error('❌ Error updating order:', error.message);
  }
}

updateOrder005();
