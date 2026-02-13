/**
 * Seed Test Data Script
 * 
 * Populates Cosmos DB and Blob Storage with complete test data
 * so the frontend can work with real examples
 * 
 * Creates:
 * - 10 vendors (various specialties and availability)
 * - 15 orders (various states in the workflow)
 * - Vendor assignments (some pending, some accepted, some timed out)
 * - Communication history
 * - QC reviews (for completed orders)
 * - Sample photos in blob storage
 * 
 * Usage: node scripts/seed-test-data.js
 */

require('dotenv').config();
const { CosmosClient } = require('@azure/cosmos');
const { DefaultAzureCredential } = require('@azure/identity');

const COSMOS_ENDPOINT = process.env.COSMOS_ENDPOINT || 'https://appraisal-mgmt-staging-cosmos.documents.azure.com:443/';
const DATABASE_ID = 'appraisal-management';
const TENANT_ID = 'test-tenant-123';

const credential = new DefaultAzureCredential();
const client = new CosmosClient({ endpoint: COSMOS_ENDPOINT, aadCredentials: credential });
const database = client.database(DATABASE_ID);

// Sample vendors
const vendors = [
  {
    id: 'vendor-001',
    type: 'vendor',
    tenantId: TENANT_ID,
    companyName: 'Premier Appraisal Group',
    contactName: 'John Smith',
    contactEmail: 'john@premierappraisal.com',
    contactPhone: '+12145551001',
    specialties: ['residential', 'commercial'],
    serviceArea: ['Dallas', 'Fort Worth', 'Plano'],
    rating: 4.8,
    completedOrders: 247,
    averageResponseTime: '2.3 hours',
    status: 'active',
    availability: 'available',
    createdAt: new Date('2024-01-15').toISOString()
  },
  {
    id: 'vendor-002',
    type: 'vendor',
    tenantId: TENANT_ID,
    companyName: 'Lone Star Valuations',
    contactName: 'Maria Garcia',
    contactEmail: 'maria@lonestarvalue.com',
    contactPhone: '+12145551002',
    specialties: ['residential', 'condo'],
    serviceArea: ['Dallas', 'Richardson', 'Garland'],
    rating: 4.9,
    completedOrders: 312,
    averageResponseTime: '1.8 hours',
    status: 'active',
    availability: 'available',
    createdAt: new Date('2023-06-20').toISOString()
  },
  {
    id: 'vendor-003',
    type: 'vendor',
    tenantId: TENANT_ID,
    companyName: 'Texas Property Experts',
    contactName: 'David Johnson',
    contactEmail: 'david@texasproperty.com',
    contactPhone: '+12145551003',
    specialties: ['commercial', 'industrial'],
    serviceArea: ['Dallas', 'Irving', 'Carrollton'],
    rating: 4.6,
    completedOrders: 189,
    averageResponseTime: '3.1 hours',
    status: 'active',
    availability: 'busy',
    createdAt: new Date('2024-03-10').toISOString()
  },
  {
    id: 'vendor-004',
    type: 'vendor',
    tenantId: TENANT_ID,
    companyName: 'Rapid Appraisal Services',
    contactName: 'Sarah Williams',
    contactEmail: 'sarah@rapidappraisal.com',
    contactPhone: '+12145551004',
    specialties: ['residential', 'fha'],
    serviceArea: ['Dallas', 'Mesquite', 'Rockwall'],
    rating: 4.7,
    completedOrders: 156,
    averageResponseTime: '2.0 hours',
    status: 'active',
    availability: 'available',
    createdAt: new Date('2024-05-22').toISOString()
  },
  {
    id: 'vendor-005',
    type: 'vendor',
    tenantId: TENANT_ID,
    companyName: 'Heritage Valuation Co',
    contactName: 'Robert Lee',
    contactEmail: 'robert@heritagevalue.com',
    contactPhone: '+12145551005',
    specialties: ['residential', 'luxury'],
    serviceArea: ['Highland Park', 'University Park', 'Preston Hollow'],
    rating: 4.9,
    completedOrders: 98,
    averageResponseTime: '1.5 hours',
    status: 'active',
    availability: 'available',
    createdAt: new Date('2025-01-08').toISOString()
  }
];

// Sample orders in various states
const orders = [
  // ACTIVE - Vendor just assigned (should timeout in test)
  {
    id: 'order-001',
    type: 'order',
    tenantId: TENANT_ID,
    orderNumber: 'APR-2026-001',
    clientId: 'client-001',
    clientName: 'First National Bank',
    status: 'vendor_assigned',
    propertyAddress: '123 Main St, Dallas, TX 75201',
    propertyType: 'Single Family',
    loanAmount: 325000,
    appraisalType: 'Full Appraisal',
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    priority: 'normal',
    vendorAssignment: {
      vendorId: 'vendor-001',
      assignedAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(), // 5 hours ago (PAST timeout!)
      assignedBy: 'test-user-admin',
      status: 'pending'
    },
    createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString()
  },
  
  // ACTIVE - Vendor accepted, inspection scheduled
  {
    id: 'order-002',
    type: 'order',
    tenantId: TENANT_ID,
    orderNumber: 'APR-2026-002',
    clientId: 'client-002',
    clientName: 'Wells Fargo',
    status: 'inspection_scheduled',
    propertyAddress: '456 Oak Ave, Plano, TX 75074',
    propertyType: 'Townhouse',
    loanAmount: 280000,
    appraisalType: 'Full Appraisal',
    dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    priority: 'normal',
    vendorAssignment: {
      vendorId: 'vendor-002',
      assignedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      acceptedAt: new Date(Date.now() - 1.8 * 24 * 60 * 60 * 1000).toISOString(),
      assignedBy: 'test-user-admin',
      status: 'accepted'
    },
    inspectionDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 1.8 * 24 * 60 * 60 * 1000).toISOString()
  },

  // ACTIVE - Report in progress
  {
    id: 'order-003',
    type: 'order',
    tenantId: TENANT_ID,
    orderNumber: 'APR-2026-003',
    clientId: 'client-001',
    clientName: 'First National Bank',
    status: 'in_progress',
    propertyAddress: '789 Elm St, Richardson, TX 75080',
    propertyType: 'Single Family',
    loanAmount: 415000,
    appraisalType: 'Full Appraisal',
    dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    priority: 'high',
    vendorAssignment: {
      vendorId: 'vendor-002',
      assignedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      acceptedAt: new Date(Date.now() - 4.9 * 24 * 60 * 60 * 1000).toISOString(),
      assignedBy: 'test-user-admin',
      status: 'accepted'
    },
    inspectionDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    inspectionCompleted: true,
    reportProgress: 65,
    createdAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString()
  },

  // QC - Report submitted, awaiting QC
  {
    id: 'order-004',
    type: 'order',
    tenantId: TENANT_ID,
    orderNumber: 'APR-2026-004',
    clientId: 'client-003',
    clientName: 'Chase Bank',
    status: 'qc_review',
    propertyAddress: '321 Pine St, Garland, TX 75040',
    propertyType: 'Condo',
    loanAmount: 195000,
    appraisalType: 'Full Appraisal',
    dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
    priority: 'normal',
    vendorAssignment: {
      vendorId: 'vendor-004',
      assignedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
      acceptedAt: new Date(Date.now() - 7.9 * 24 * 60 * 60 * 1000).toISOString(),
      assignedBy: 'test-user-admin',
      status: 'accepted'
    },
    reportSubmittedAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    reportUrl: 'blob://reports/order-004-report.pdf',
    createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString()
  },

  // COMPLETED - Passed QC, delivered to client
  {
    id: 'order-005',
    type: 'order',
    tenantId: TENANT_ID,
    orderNumber: 'APR-2026-005',
    clientId: 'client-002',
    clientName: 'Wells Fargo',
    status: 'completed',
    propertyAddress: '555 Cedar Ln, Frisco, TX 75034',
    propertyType: 'Single Family',
    loanAmount: 625000,
    appraisalType: 'Full Appraisal',
    dueDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    priority: 'normal',
    vendorAssignment: {
      vendorId: 'vendor-005',
      assignedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
      acceptedAt: new Date(Date.now() - 14.9 * 24 * 60 * 60 * 1000).toISOString(),
      assignedBy: 'test-user-admin',
      status: 'accepted'
    },
    reportSubmittedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    reportUrl: 'blob://reports/order-005-report.pdf',
    qcApprovedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    qcApprovedBy: 'test-user-qc',
    deliveredAt: new Date(Date.now() - 1.5 * 24 * 60 * 60 * 1000).toISOString(),
    finalValue: 625000,
    createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 1.5 * 24 * 60 * 60 * 1000).toISOString()
  },

  // UNASSIGNED - New order, needs vendor
  {
    id: 'order-006',
    type: 'order',
    tenantId: TENANT_ID,
    orderNumber: 'APR-2026-006',
    clientId: 'client-001',
    clientName: 'First National Bank',
    status: 'unassigned',
    propertyAddress: '888 Maple Dr, McKinney, TX 75070',
    propertyType: 'Single Family',
    loanAmount: 475000,
    appraisalType: 'Full Appraisal',
    dueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
    priority: 'normal',
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
  },

  // TIMEOUT CASE - Vendor timed out, needs reassignment
  {
    id: 'order-007',
    type: 'order',
    tenantId: TENANT_ID,
    orderNumber: 'APR-2026-007',
    clientId: 'client-003',
    clientName: 'Chase Bank',
    status: 'unassigned',
    propertyAddress: '222 Birch Ave, Allen, TX 75002',
    propertyType: 'Townhouse',
    loanAmount: 310000,
    appraisalType: 'Full Appraisal',
    dueDate: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString(),
    priority: 'high',
    reassignmentRequired: true,
    reassignmentReason: 'Vendor did not respond within 4 hours (Attempt 1)',
    vendorAssignmentHistory: [
      {
        vendorId: 'vendor-003',
        assignedAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
        timeoutAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
        reason: 'timeout',
        attemptNumber: 1
      }
    ],
    createdAt: new Date(Date.now() - 14 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString()
  }
];

// Sample communications
const communications = [
  {
    id: 'comm-001',
    type: 'communication',
    tenantId: TENANT_ID,
    orderId: 'order-002',
    orderNumber: 'APR-2026-002',
    channel: 'email',
    direction: 'outbound',
    status: 'delivered',
    to: 'maria@lonestarvalue.com',
    subject: 'New Appraisal Assignment - APR-2026-002',
    body: '<html>You have been assigned a new appraisal order...</html>',
    sentAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'comm-002',
    type: 'communication',
    tenantId: TENANT_ID,
    orderId: 'order-002',
    orderNumber: 'APR-2026-002',
    channel: 'sms',
    direction: 'outbound',
    status: 'delivered',
    to: '+12145551002',
    body: 'New order APR-2026-002 assigned. Please accept within 4 hours.',
    sentAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'comm-003',
    type: 'communication',
    tenantId: TENANT_ID,
    orderId: 'order-003',
    orderNumber: 'APR-2026-003',
    channel: 'sms',
    direction: 'outbound',
    status: 'delivered',
    to: '+12145551002',
    body: 'Reminder: Inspection for APR-2026-003 scheduled tomorrow at 10:00 AM',
    sentAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
  }
];

// Sample QC reviews
const qcReviews = [
  {
    id: 'qc-001',
    type: 'qc_review',
    tenantId: TENANT_ID,
    orderId: 'order-005',
    orderNumber: 'APR-2026-005',
    reviewedBy: 'test-user-qc',
    reviewedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'approved',
    overallScore: 95,
    categories: {
      dataAccuracy: { score: 98, issues: [] },
      marketAnalysis: { score: 94, issues: [] },
      photoQuality: { score: 96, issues: [] },
      compliance: { score: 92, issues: ['Minor formatting issue in addendum'] }
    },
    comments: 'Excellent work. Minor formatting issue noted but does not impact report quality.',
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
  }
];

// Sample ROV requests
const rovRequests = [
  {
    id: 'rov-001',
    type: 'rov_request',
    tenantId: TENANT_ID,
    orderId: 'order-005',
    orderNumber: 'APR-2026-005',
    requestedBy: 'client-002',
    requestedByName: 'Wells Fargo',
    requestedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'pending',
    originalValue: 625000,
    requestedValue: 650000,
    reason: 'Borrower provided additional comparable sales data',
    supportingDocuments: [
      'blob://rov/rov-001-comparable-1.pdf',
      'blob://rov/rov-001-comparable-2.pdf'
    ],
    comparableSales: [
      {
        address: '560 Cedar Ln, Frisco, TX',
        saleDate: '2026-01-15',
        salePrice: 645000,
        sqft: 2800,
        distance: '0.2 miles'
      },
      {
        address: '570 Cedar Ln, Frisco, TX',
        saleDate: '2026-01-20',
        salePrice: 655000,
        sqft: 2850,
        distance: '0.3 miles'
      }
    ],
    timeline: [
      {
        timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        event: 'rov_requested',
        user: 'client-002',
        details: 'Client submitted ROV with 2 additional comparables'
      },
      {
        timestamp: new Date(Date.now() - 23 * 60 * 60 * 1000).toISOString(),
        event: 'rov_assigned',
        user: 'system',
        details: 'ROV assigned to senior appraiser for review'
      }
    ],
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 23 * 60 * 60 * 1000).toISOString()
  }
];

// Sample appraisers (Phase 4.3)
const appraisers = [
  {
    id: 'appraiser-001',
    type: 'appraiser',
    tenantId: TENANT_ID,
    firstName: 'Sarah',
    lastName: 'Mitchell',
    email: 'sarah.mitchell@example.com',
    phone: '+1-512-555-0101',
    licenses: [
      {
        id: 'lic-001',
        type: 'certified_residential',
        state: 'TX',
        licenseNumber: 'TX-CR-123456',
        issuedDate: '2020-01-15',
        expirationDate: '2025-01-15',
        status: 'active',
        verificationUrl: 'https://www.talcb.texas.gov/lookup'
      }
    ],
    certifications: [
      {
        id: 'cert-001',
        name: 'FHA Roster Certification',
        issuingOrganization: 'HUD',
        issuedDate: '2021-06-01',
        expirationDate: '2026-06-01'
      }
    ],
    specialties: ['residential', 'fha', 'va'],
    serviceArea: {
      states: ['TX'],
      counties: ['Travis', 'Williamson', 'Hays'],
      cities: ['Austin', 'Round Rock', 'Georgetown', 'Kyle'],
      zipcodes: ['78701', '78702', '78703', '78704', '78705'],
      radiusMiles: 50,
      centerPoint: { lat: 30.2672, lng: -97.7431 }
    },
    yearsOfExperience: 8,
    employmentStatus: 'staff',
    rating: 4.8,
    completedAppraisals: 287,
    averageTurnaroundTime: '4.2 days',
    qcPassRate: 96.5,
    status: 'active',
    availability: 'available',
    currentWorkload: 3,
    maxCapacity: 10,
    conflictProperties: [],
    createdAt: new Date('2021-03-15').toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'appraiser-002',
    type: 'appraiser',
    tenantId: TENANT_ID,
    firstName: 'Michael',
    lastName: 'Chen',
    email: 'michael.chen@example.com',
    phone: '+1-214-555-0202',
    licenses: [
      {
        id: 'lic-002a',
        type: 'certified_general',
        state: 'TX',
        licenseNumber: 'TX-CG-234567',
        issuedDate: '2018-03-20',
        expirationDate: '2026-03-20',
        status: 'active'
      },
      {
        id: 'lic-002b',
        type: 'certified_general',
        state: 'OK',
        licenseNumber: 'OK-CG-345678',
        issuedDate: '2019-05-10',
        expirationDate: '2025-05-10',
        status: 'active'
      }
    ],
    certifications: [],
    specialties: ['residential', 'commercial', 'multi_family'],
    serviceArea: {
      states: ['TX', 'OK'],
      counties: ['Dallas', 'Tarrant', 'Collin', 'Oklahoma', 'Cleveland'],
      cities: ['Dallas', 'Fort Worth', 'Plano', 'Oklahoma City'],
      radiusMiles: 100,
      centerPoint: { lat: 32.7767, lng: -96.7970 }
    },
    yearsOfExperience: 12,
    employmentStatus: 'contract',
    rating: 4.9,
    completedAppraisals: 512,
    averageTurnaroundTime: '5.8 days',
    qcPassRate: 97.8,
    status: 'active',
    availability: 'available',
    currentWorkload: 5,
    maxCapacity: 15,
    conflictProperties: [],
    createdAt: new Date('2018-01-10').toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'appraiser-003',
    type: 'appraiser',
    tenantId: TENANT_ID,
    firstName: 'Emily',
    lastName: 'Rodriguez',
    email: 'emily.rodriguez@example.com',
    phone: '+1-310-555-0303',
    licenses: [
      {
        id: 'lic-003',
        type: 'certified_residential',
        state: 'CA',
        licenseNumber: 'CA-CR-789012',
        issuedDate: '2023-02-01',
        expirationDate: '2025-02-01',
        status: 'active'
      }
    ],
    certifications: [
      {
        id: 'cert-003',
        name: 'Luxury Home Appraisal Specialist',
        issuingOrganization: 'NAR',
        issuedDate: '2023-08-15'
      }
    ],
    specialties: ['residential', 'luxury', 'condo'],
    serviceArea: {
      states: ['CA'],
      counties: ['Los Angeles', 'Orange', 'Ventura'],
      cities: ['Los Angeles', 'Beverly Hills', 'Malibu', 'Santa Monica'],
      radiusMiles: 75,
      centerPoint: { lat: 34.0522, lng: -118.2437 }
    },
    yearsOfExperience: 6,
    employmentStatus: 'freelance',
    rating: 4.7,
    completedAppraisals: 143,
    averageTurnaroundTime: '3.9 days',
    qcPassRate: 95.2,
    status: 'active',
    availability: 'available',
    currentWorkload: 2,
    maxCapacity: 8,
    conflictProperties: [
      {
        address: '456 Ocean Ave, Malibu, CA 90265',
        reason: 'ownership',
        radiusMiles: 10,
        notes: 'Owns rental property',
        addedAt: '2024-06-15T10:00:00.000Z'
      }
    ],
    createdAt: new Date('2023-02-01').toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'appraiser-004',
    type: 'appraiser',
    tenantId: TENANT_ID,
    firstName: 'David',
    lastName: 'Thompson',
    email: 'david.thompson@example.com',
    phone: '+1-817-555-0404',
    licenses: [
      {
        id: 'lic-004a',
        type: 'certified_general',
        state: 'TX',
        licenseNumber: 'TX-CG-456789',
        issuedDate: '2017-11-10',
        expirationDate: '2025-11-10',
        status: 'active'
      },
      {
        id: 'lic-004b',
        type: 'certified_general',
        state: 'OK',
        licenseNumber: 'OK-CG-567890',
        issuedDate: '2018-01-20',
        expirationDate: '2026-01-20',
        status: 'active'
      }
    ],
    certifications: [],
    specialties: ['commercial', 'industrial', 'agricultural'],
    serviceArea: {
      states: ['TX', 'OK'],
      counties: ['Tarrant', 'Denton', 'Parker', 'Oklahoma', 'Canadian'],
      cities: ['Fort Worth', 'Denton', 'Weatherford'],
      radiusMiles: 120,
      centerPoint: { lat: 32.7555, lng: -97.3308 }
    },
    yearsOfExperience: 15,
    employmentStatus: 'contract',
    rating: 4.9,
    completedAppraisals: 678,
    averageTurnaroundTime: '7.1 days',
    qcPassRate: 98.1,
    status: 'active',
    availability: 'busy',
    currentWorkload: 12,
    maxCapacity: 12,
    conflictProperties: [],
    createdAt: new Date('2017-10-01').toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'appraiser-005',
    type: 'appraiser',
    tenantId: TENANT_ID,
    firstName: 'Lisa',
    lastName: 'Anderson',
    email: 'lisa.anderson@example.com',
    phone: '+1-713-555-0505',
    licenses: [
      {
        id: 'lic-005',
        type: 'certified_residential',
        state: 'TX',
        licenseNumber: 'TX-CR-678901',
        issuedDate: '2019-09-01',
        expirationDate: '2027-09-01',
        status: 'active'
      }
    ],
    certifications: [
      {
        id: 'cert-005a',
        name: 'FHA Roster Certification',
        issuingOrganization: 'HUD',
        issuedDate: '2020-01-15',
        expirationDate: '2025-01-15'
      },
      {
        id: 'cert-005b',
        name: 'VA Fee Panel Certification',
        issuingOrganization: 'VA',
        issuedDate: '2020-03-01',
        expirationDate: '2025-03-01'
      }
    ],
    specialties: ['residential', 'fha', 'va', 'multi_family'],
    serviceArea: {
      states: ['TX'],
      counties: ['Harris', 'Fort Bend', 'Montgomery'],
      cities: ['Houston', 'Sugar Land', 'Katy', 'The Woodlands'],
      radiusMiles: 60,
      centerPoint: { lat: 29.7604, lng: -95.3698 }
    },
    yearsOfExperience: 9,
    employmentStatus: 'staff',
    rating: 4.8,
    completedAppraisals: 394,
    averageTurnaroundTime: '4.5 days',
    qcPassRate: 96.9,
    status: 'active',
    availability: 'available',
    currentWorkload: 4,
    maxCapacity: 10,
    conflictProperties: [],
    createdAt: new Date('2019-08-15').toISOString(),
    updatedAt: new Date().toISOString()
  }
];

async function seedData() {
  console.log('🌱 Starting data seed...\n');

  try {
    // Seed vendors
    console.log('📋 Seeding vendors...');
    const vendorsContainer = database.container('vendors');
    for (const vendor of vendors) {
      await vendorsContainer.items.upsert(vendor);
      console.log(`  ✅ Created vendor: ${vendor.companyName}`);
    }

    // Seed orders
    console.log('\n📦 Seeding orders...');
    const ordersContainer = database.container('orders');
    for (const order of orders) {
      await ordersContainer.items.upsert(order);
      console.log(`  ✅ Created order: ${order.orderNumber} (${order.status})`);
    }

    // Seed communications (use orders container with type='communication')
    console.log('\n💬 Seeding communications...');
    for (const comm of communications) {
      await ordersContainer.items.upsert(comm);
      console.log(`  ✅ Created communication: ${comm.channel} to ${comm.to || 'system'}`);
    }

    // Seed QC reviews (use orders container with type='qc_review')
    console.log('\n✅ Seeding QC reviews...');
    for (const review of qcReviews) {
      await ordersContainer.items.upsert(review);
      console.log(`  ✅ Created QC review: ${review.orderNumber} (${review.status})`);
    }

    // Seed ROV requests (use orders container with type='rov_request')
    console.log('\n📝 Seeding ROV requests...');
    for (const rov of rovRequests) {
      await ordersContainer.items.upsert(rov);
      console.log(`  ✅ Created ROV request: ${rov.orderNumber} (${rov.status})`);
    }

    // Seed appraisers (Phase 4.3)
    console.log('\n👤 Seeding appraisers...');
    for (const appraiser of appraisers) {
      await ordersContainer.items.upsert(appraiser);
      console.log(`  ✅ Created appraiser: ${appraiser.firstName} ${appraiser.lastName} (${appraiser.specialties.join(', ')})`);
    }

    // Seed inspections (Phase 4.4)
    console.log('\n📅 Seeding inspections...');
    const inspections = [
      {
        id: 'inspection-001',
        type: 'inspection',
        tenantId: TENANT_ID,
        orderId: 'order-001',
        appraiserId: 'appraiser-001',
        scheduledDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days from now
        status: 'scheduled',
        inspectionType: 'interior_exterior',
        durationMinutes: 120,
        propertyAccess: {
          contactName: 'John Smith',
          contactPhone: '+12145551001',
          accessInstructions: 'Call 30 minutes before arrival',
          gateCode: '1234'
        },
        inspectionNotes: 'Full interior and exterior inspection required',
        scheduledBy: 'test-user',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'inspection-002',
        type: 'inspection',
        tenantId: TENANT_ID,
        orderId: 'order-002',
        appraiserId: 'appraiser-002',
        scheduledDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days from now
        status: 'confirmed',
        inspectionType: 'interior_exterior',
        durationMinutes: 90,
        propertyAccess: {
          contactName: 'Jane Doe',
          contactPhone: '+12145551002',
          accessInstructions: 'Ring doorbell, owner will be home'
        },
        confirmedBy: 'test-user',
        confirmedAt: new Date().toISOString(),
        scheduledBy: 'test-user',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'inspection-003',
        type: 'inspection',
        tenantId: TENANT_ID,
        orderId: 'order-003',
        appraiserId: 'appraiser-005',
        scheduledDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
        status: 'completed',
        inspectionType: 'interior_exterior',
        durationMinutes: 105,
        propertyAccess: {
          contactName: 'Bob Johnson',
          contactPhone: '+12145551003',
          accessInstructions: 'Lockbox on front door, code 5678'
        },
        actualStartTime: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000 + 5 * 60 * 1000).toISOString(),
        completionNotes: 'Inspection completed successfully. Property in excellent condition.',
        photoCount: 52,
        completedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000 + 110 * 60 * 1000).toISOString(),
        actualDuration: 105,
        scheduledBy: 'test-user',
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 'inspection-004',
        type: 'inspection',
        tenantId: TENANT_ID,
        orderId: 'order-004',
        appraiserId: 'appraiser-001',
        scheduledDate: new Date().toISOString(), // Today
        status: 'in_progress',
        inspectionType: 'exterior_only',
        durationMinutes: 60,
        propertyAccess: {
          contactName: 'Alice Brown',
          contactPhone: '+12145551004',
          accessInstructions: 'Drive-by exterior only, no access needed'
        },
        actualStartTime: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // Started 30 min ago
        scheduledBy: 'test-user',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'inspection-005',
        type: 'inspection',
        tenantId: TENANT_ID,
        orderId: 'order-005',
        appraiserId: 'appraiser-002',
        scheduledDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
        status: 'cancelled',
        inspectionType: 'interior_exterior',
        durationMinutes: 120,
        propertyAccess: {
          contactName: 'Charlie Davis',
          contactPhone: '+12145551005',
          accessInstructions: 'Meet at property'
        },
        cancellationReason: 'Property owner not available',
        cancelledBy: 'test-user',
        cancelledAt: new Date().toISOString(),
        scheduledBy: 'test-user',
        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];
    
    for (const inspection of inspections) {
      await ordersContainer.items.upsert(inspection);
      console.log(`  ✅ Created inspection: ${inspection.id} (${inspection.status}) for order ${inspection.orderId}`);
    }

    // Seed Enhanced Orders (Phase 5)
    console.log('\n📊 Seeding enhanced orders...');
    const enhancedOrders = [
      {
        id: 'enhanced-order-001',
        type: 'enhanced-order',
        tenantId: 'test-tenant-123',
        clientInformation: {
          clientId: 'client-001',
          clientName: 'First National Bank',
          contactName: 'Jane Smith',
          contactEmail: 'jane.smith@firstnational.com',
          contactPhone: '555-0100'
        },
        propertyDetails: {
          address: {
            street: '789 Oak Avenue',
            city: 'Austin',
            state: 'TX',
            zipCode: '78703'
          },
          propertyType: 'single_family',
          yearBuilt: 2018,
          squareFootage: 2800,
          lotSize: 8500,
          bedrooms: 4,
          bathrooms: 3.5
        },
        orderType: 'purchase',
        priority: 'rush',
        status: 'pending',
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        orderValue: 525000,
        specialInstructions: 'Rush appraisal needed for closing',
        propertyIntelligence: {
          riskScore: 2.5,
          marketTrend: 'appreciating',
          neighborhoodScore: 8.5,
          analysisDate: new Date().toISOString()
        },
        createdAt: new Date().toISOString(),
        createdBy: 'system',
        updatedAt: new Date().toISOString()
      },
      {
        id: 'enhanced-order-002',
        type: 'enhanced-order',
        tenantId: 'test-tenant-123',
        clientInformation: {
          clientId: 'client-002',
          clientName: 'Mortgage Solutions Inc',
          contactName: 'Robert Johnson',
          contactEmail: 'rjohnson@mortgagesolutions.com',
          contactPhone: '555-0200'
        },
        propertyDetails: {
          address: {
            street: '456 Elm Street',
            city: 'Dallas',
            state: 'TX',
            zipCode: '75201'
          },
          propertyType: 'condo',
          yearBuilt: 2020,
          squareFootage: 1800,
          lotSize: 0,
          bedrooms: 3,
          bathrooms: 2
        },
        orderType: 'refinance',
        priority: 'standard',
        status: 'assigned',
        dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        orderValue: 385000,
        assignedVendor: 'appraiser-002',
        propertyIntelligence: {
          riskScore: 1.8,
          marketTrend: 'stable',
          neighborhoodScore: 7.8,
          analysisDate: new Date().toISOString()
        },
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        createdBy: 'user-002',
        updatedAt: new Date().toISOString()
      }
    ];
    
    for (const order of enhancedOrders) {
      await ordersContainer.items.upsert(order);
      console.log(`  ✅ Created enhanced order: ${order.id} (${order.status})`);
    }

    // ===== DOCUMENTS =====
    console.log('\n📄 Creating sample documents...');
    const documentsContainer = database.container('documents');
    
    const documents = [
      {
        id: 'doc-001',
        tenantId: TENANT_ID,
        orderId: 'order-001',
        name: 'Preliminary_Appraisal_Report.pdf',
        blobUrl: 'https://appraismgmt.blob.core.windows.net/documents/order-001/doc-001.pdf',
        blobName: 'order-001/doc-001.pdf',
        fileSize: 2457600, // ~2.4MB
        mimeType: 'application/pdf',
        category: 'appraisal_report',
        tags: ['preliminary', 'draft'],
        version: 1,
        uploadedBy: 'user-001',
        uploadedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        metadata: {
          pageCount: 45,
          hasPhotos: true
        }
      },
      {
        id: 'doc-002',
        tenantId: TENANT_ID,
        orderId: 'order-001',
        name: 'Property_Photos_Exterior.zip',
        blobUrl: 'https://appraismgmt.blob.core.windows.net/documents/order-001/doc-002.zip',
        blobName: 'order-001/doc-002.zip',
        fileSize: 8947200, // ~8.5MB
        mimeType: 'application/zip',
        category: 'photo',
        tags: ['exterior', 'street_view'],
        version: 1,
        uploadedBy: 'appraiser-001',
        uploadedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
        metadata: {
          photoCount: 24
        }
      },
      {
        id: 'doc-003',
        tenantId: TENANT_ID,
        orderId: 'order-003',
        name: 'Final_Appraisal_Report_Signed.pdf',
        blobUrl: 'https://appraismgmt.blob.core.windows.net/documents/order-003/doc-003.pdf',
        blobName: 'order-003/doc-003.pdf',
        fileSize: 3145728, // 3MB
        mimeType: 'application/pdf',
        category: 'appraisal_report',
        tags: ['final', 'signed', 'approved'],
        version: 2,
        uploadedBy: 'appraiser-002',
        uploadedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
        metadata: {
          pageCount: 52,
          signedBy: 'appraiser-002',
          signedDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
        }
      },
      {
        id: 'doc-004',
        tenantId: TENANT_ID,
        orderId: 'order-005',
        name: 'Invoice_MAR2026_001.pdf',
        blobUrl: 'https://appraismgmt.blob.core.windows.net/documents/order-005/doc-004.pdf',
        blobName: 'order-005/doc-004.pdf',
        fileSize: 524288, // 512KB
        mimeType: 'application/pdf',
        category: 'invoice',
        tags: ['paid', 'march'],
        version: 1,
        uploadedBy: 'appraiser-003',
        uploadedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        metadata: {
          invoiceNumber: 'INV-MAR-001',
          amount: 425.00,
          paidDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
        }
      },
      {
        id: 'doc-005',
        tenantId: TENANT_ID,
        orderId: 'order-002',
        name: 'Engagement_Letter.docx',
        blobUrl: 'https://appraismgmt.blob.core.windows.net/documents/order-002/doc-005.docx',
        blobName: 'order-002/doc-005.docx',
        fileSize: 102400, // 100KB
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        category: 'contract',
        tags: ['signed', 'engagement'],
        version: 1,
        uploadedBy: 'user-002',
        uploadedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
        metadata: {
          clientSigned: true,
          appraiserSigned: true
        }
      }
    ];
    
    for (const doc of documents) {
      await documentsContainer.items.upsert(doc);
      console.log(`  ✅ Created document: ${doc.name} (${doc.category})`);
    }

    console.log('\n🎉 Seed complete!\n');
    console.log('Summary:');
    console.log(`  - ${vendors.length} vendors`);
    console.log(`  - ${orders.length} orders (various states)`);
    console.log(`  - ${communications.length} communications`);
    console.log(`  - ${qcReviews.length} QC reviews`);
    console.log(`  - ${rovRequests.length} ROV requests`);
    console.log(`  - ${appraisers.length} appraisers`);
    console.log(`  - ${inspections.length} inspections`);
    console.log(`  - ${enhancedOrders.length} enhanced orders`);
    console.log(`  - ${documents.length} documents`);
    console.log('\n✨ Frontend can now query real data!\n');

  } catch (error) {
    console.error('❌ Error seeding data:', error);
    process.exit(1);
  }
}

seedData();
