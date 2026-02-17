/**
 * Seed Appraiser Test Data
 * Creates test appraisers with licenses, service areas, and capacity tracking
 */

import { CosmosClient } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';

const COSMOS_ENDPOINT = process.env.COSMOS_DB_ENDPOINT || 'https://appraisal-mgmt-staging-cosmos.documents.azure.com:443/';
const DATABASE_NAME = 'appraisal-management';
const CONTAINER_NAME = 'vendors'; // Appraisers ARE vendors, partitioned by licenseState

// Use real tenant ID from Azure AD
const TENANT_ID = '885097ba-35ea-48db-be7a-a0aa7ff451bd';

const testAppraisers = [
  {
    id: 'appraiser-fl-res-11111',
    type: 'appraiser',
    licenseState: 'FL',
    tenantId: TENANT_ID,
    firstName: 'Michael',
    lastName: 'Thompson',
    email: 'michael.thompson@appraisal.com',
    phone: '+1-305-555-1234',
    employmentStatus: 'STAFF',
    status: 'active',
    availability: 'available',
    specialties: ['RESIDENTIAL', 'CONDO'],
    rating: 4.8,
    totalAssignments: 156,
    successfulCompletions: 152,
    currentWorkload: 8,
    maxCapacity: 15,
    licenses: [
      {
        type: 'Certified Residential',
        number: 'RD5678',
        issuingAuthority: 'Florida DBPR',
        state: 'FL',
        issueDate: '2018-03-15',
        expirationDate: '2026-03-15',
        status: 'active'
      },
      {
        type: 'Certified Residential',
        number: 'RD8901',
        issuingAuthority: 'Georgia Real Estate Appraisers Board',
        state: 'GA',
        issueDate: '2019-05-20',
        expirationDate: '2027-05-20',
        status: 'active'
      }
    ],
    serviceAreas: [
      { state: 'FL', counties: ['Miami-Dade', 'Broward', 'Palm Beach'], radius: 50 },
      { state: 'GA', counties: ['Fulton', 'DeKalb', 'Cobb'], radius: 40 }
    ],
    conflictProperties: [],
    conflictOfInterestChecks: [],
    createdAt: new Date('2023-01-15').toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'appraiser-ca-com-22222',
    type: 'appraiser',
    licenseState: 'CA',
    tenantId: TENANT_ID,
    firstName: 'Sarah',
    lastName: 'Chen',
    email: 'sarah.chen@appraisal.com',
    phone: '+1-415-555-5678',
    employmentStatus: 'STAFF',
    status: 'active',
    availability: 'available',
    specialties: ['COMMERCIAL', 'MULTI_FAMILY'],
    rating: 4.9,
    totalAssignments: 89,
    successfulCompletions: 88,
    currentWorkload: 5,
    maxCapacity: 10,
    licenses: [
      {
        type: 'Certified General',
        number: 'AG3456',
        issuingAuthority: 'California BREA',
        state: 'CA',
        issueDate: '2017-06-10',
        expirationDate: '2027-06-10',
        status: 'active'
      }
    ],
    serviceAreas: [
      { state: 'CA', counties: ['San Francisco', 'San Mateo', 'Santa Clara'], radius: 60 }
    ],
    conflictProperties: [],
    conflictOfInterestChecks: [],
    createdAt: new Date('2023-02-20').toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'appraiser-tx-res-33333',
    type: 'appraiser',
    licenseState: 'TX',
    tenantId: TENANT_ID,
    firstName: 'James',
    lastName: 'Rodriguez',
    email: 'james.rodriguez@appraisal.com',
    phone: '+1-512-555-9012',
    employmentStatus: 'STAFF',
    status: 'active',
    availability: 'limited',
    specialties: ['RESIDENTIAL', 'RURAL'],
    rating: 4.7,
    totalAssignments: 234,
    successfulCompletions: 228,
    currentWorkload: 12,
    maxCapacity: 15,
    licenses: [
      {
        type: 'Certified Residential',
        number: 'TX-1234567',
        issuingAuthority: 'Texas Appraiser Licensing',
        state: 'TX',
        issueDate: '2016-09-01',
        expirationDate: '2026-09-01',
        status: 'active'
      },
      {
        type: 'Certified Residential',
        number: 'OK-9876',
        issuingAuthority: 'Oklahoma Real Estate Appraiser Board',
        state: 'OK',
        issueDate: '2020-11-15',
        expirationDate: '2024-11-15',
        status: 'expired'
      }
    ],
    serviceAreas: [
      { state: 'TX', counties: ['Travis', 'Williamson', 'Hays', 'Bastrop'], radius: 75 }
    ],
    conflictProperties: [],
    conflictOfInterestChecks: [],
    createdAt: new Date('2022-08-10').toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'appraiser-ny-res-44444',
    type: 'appraiser',
    licenseState: 'NY',
    tenantId: TENANT_ID,
    firstName: 'Emily',
    lastName: 'Wang',
    email: 'emily.wang@appraisal.com',
    phone: '+1-212-555-3456',
    employmentStatus: 'CONTRACTOR',
    status: 'active',
    availability: 'available',
    specialties: ['RESIDENTIAL', 'LUXURY'],
    rating: 4.95,
    totalAssignments: 67,
    successfulCompletions: 67,
    currentWorkload: 3,
    maxCapacity: 8,
    licenses: [
      {
        type: 'Certified Residential',
        number: 'NY-46000012345',
        issuingAuthority: 'NYS Dept of State',
        state: 'NY',
        issueDate: '2020-01-20',
        expirationDate: '2026-01-20',
        status: 'active'
      }
    ],
    serviceAreas: [
      { state: 'NY', counties: ['New York', 'Kings', 'Queens', 'Bronx'], radius: 30 }
    ],
    conflictProperties: [],
    conflictOfInterestChecks: [],
    createdAt: new Date('2023-06-01').toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'appraiser-az-com-55555',
    type: 'appraiser',
    licenseState: 'AZ',
    tenantId: TENANT_ID,
    firstName: 'David',
    lastName: 'Martinez',
    email: 'david.martinez@appraisal.com',
    phone: '+1-602-555-7890',
    employmentStatus: 'STAFF',
    status: 'active',
    availability: 'unavailable',
    specialties: ['COMMERCIAL', 'INDUSTRIAL'],
    rating: 4.6,
    totalAssignments: 112,
    successfulCompletions: 108,
    currentWorkload: 15,
    maxCapacity: 15,
    licenses: [
      {
        type: 'Certified General',
        number: 'AZ-30001234',
        issuingAuthority: 'Arizona Board of Appraisal',
        state: 'AZ',
        issueDate: '2015-04-10',
        expirationDate: '2027-04-10',
        status: 'active'
      }
    ],
    serviceAreas: [
      { state: 'AZ', counties: ['Maricopa', 'Pinal'], radius: 80 }
    ],
    conflictProperties: [],
    conflictOfInterestChecks: [],
    createdAt: new Date('2022-11-15').toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'appraiser-fl-res-66666',
    type: 'appraiser',
    licenseState: 'FL',
    tenantId: TENANT_ID,
    firstName: 'Jennifer',
    lastName: 'Anderson',
    email: 'jennifer.anderson@appraisal.com',
    phone: '+1-727-555-2345',
    employmentStatus: 'CONTRACTOR',
    status: 'onboarding',
    availability: 'unavailable',
    specialties: ['RESIDENTIAL'],
    rating: 0,
    totalAssignments: 0,
    successfulCompletions: 0,
    currentWorkload: 0,
    maxCapacity: 12,
    licenses: [
      {
        type: 'Certified Residential',
        number: 'RD9999',
        issuingAuthority: 'Florida DBPR',
        state: 'FL',
        issueDate: '2024-01-10',
        expirationDate: '2026-01-31',
        status: 'active'
      }
    ],
    serviceAreas: [
      { state: 'FL', counties: ['Pinellas', 'Hillsborough'], radius: 35 }
    ],
    conflictProperties: [],
    conflictOfInterestChecks: [],
    createdAt: new Date('2026-01-05').toISOString(),
    updatedAt: new Date().toISOString()
  }
];

async function seedAppraisers() {
  console.log('🌱 Starting appraiser seed process...');
  console.log(`Cosmos Endpoint: ${COSMOS_ENDPOINT}`);
  console.log(`Database: ${DATABASE_NAME}`);
  console.log(`Container: ${CONTAINER_NAME}`);

  try {
    // Use Managed Identity
    const credential = new DefaultAzureCredential();
    const client = new CosmosClient({ endpoint: COSMOS_ENDPOINT, aadCredentials: credential });

    const database = client.database(DATABASE_NAME);
    const container = database.container(CONTAINER_NAME);

    console.log(`\n📦 Seeding ${testAppraisers.length} appraisers...\n`);

    for (const appraiser of testAppraisers) {
      try {
        // Upsert (insert or replace if exists)
        const { resource } = await container.items.upsert(appraiser);
        console.log(`✅ Seeded appraiser: ${appraiser.firstName} ${appraiser.lastName} (${appraiser.id})`);
        console.log(`   Status: ${appraiser.status} | Specialty: ${appraiser.specialties.join(', ')}`);
        console.log(`   Workload: ${appraiser.currentWorkload}/${appraiser.maxCapacity} | Rating: ${appraiser.rating}`);
      } catch (error) {
        console.error(`❌ Failed to seed appraiser ${appraiser.id}:`, error.message);
      }
    }

    console.log('\n✨ Appraiser seeding complete!');
    console.log('\n📊 Summary:');
    console.log(`   Total appraisers: ${testAppraisers.length}`);
    console.log(`   Active: ${testAppraisers.filter(a => a.status === 'active').length}`);
    console.log(`   Available: ${testAppraisers.filter(a => a.availability === 'available').length}`);
    console.log(`   Staff: ${testAppraisers.filter(a => a.employmentStatus === 'STAFF').length}`);
    console.log(`   Contractors: ${testAppraisers.filter(a => a.employmentStatus === 'CONTRACTOR').length}`);

  } catch (error) {
    console.error('❌ Seed process failed:', error);
    throw error;
  }
}

// Run the seed
seedAppraisers()
  .then(() => {
    console.log('\n🎉 All done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Fatal error:', error);
    process.exit(1);
  });
