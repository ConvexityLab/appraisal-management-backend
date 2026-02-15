/**
 * Seed Orders Data - 2026 Schema
 * 
 * Populates Cosmos DB with test orders matching the AppraisalOrder schema
 * used by the frontend orders management UI
 * 
 * Schema matches: src/types/backend/order-management.types.ts
 * 
 * Creates:
 * - 20 orders across all statuses
 * - 5 vendors with various specialties
 * - Realistic property addresses and details
 * - QC integration data
 * - Timeline and audit trail
 * 
 * Usage: node scripts/seed-orders-2026.js
 */

require('dotenv').config();
const { CosmosClient } = require('@azure/cosmos');
const { DefaultAzureCredential } = require('@azure/identity');

const COSMOS_ENDPOINT = process.env.COSMOS_ENDPOINT || 'https://appraisal-mgmt-staging-cosmos.documents.azure.com:443/';
const DATABASE_ID = 'appraisal-management';
const TENANT_ID = 'test-tenant-001';

const credential = new DefaultAzureCredential();
const client = new CosmosClient({ endpoint: COSMOS_ENDPOINT, aadCredentials: credential });
const database = client.database(DATABASE_ID);

// Helper to generate IDs
function generateId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Sample vendors
const vendors = [
  {
    id: 'vendor-001',
    type: 'vendor',
    tenantId: TENANT_ID,
    businessName: 'Premier Appraisal Group',
    contactName: 'John Smith',
    email: 'john@premierappraisal.com',
    phone: '+1-214-555-1001',
    status: 'ACTIVE',
    specialties: ['PURCHASE', 'REFINANCE'],
    serviceAreas: ['Denver', 'Aurora', 'Lakewood'],
    rating: 4.8,
    totalOrders: 247,
    completedOrders: 235,
    averageCompletionDays: 5.2,
    createdAt: new Date('2024-01-15').toISOString(),
    updatedAt: new Date('2026-02-10').toISOString()
  },
  {
    id: 'vendor-002',
    type: 'vendor',
    tenantId: TENANT_ID,
    businessName: 'Rocky Mountain Valuations',
    contactName: 'Maria Garcia',
    email: 'maria@rmvaluations.com',
    phone: '+1-303-555-2002',
    status: 'ACTIVE',
    specialties: ['PURCHASE', 'HELOC', 'PMI_REMOVAL'],
    serviceAreas: ['Denver', 'Boulder', 'Fort Collins'],
    rating: 4.9,
    totalOrders: 312,
    completedOrders: 298,
    averageCompletionDays: 4.8,
    createdAt: new Date('2023-06-20').toISOString(),
    updatedAt: new Date('2026-02-12').toISOString()
  },
  {
    id: 'vendor-003',
    type: 'vendor',
    tenantId: TENANT_ID,
    businessName: 'Colorado Property Experts',
    contactName: 'David Johnson',
    email: 'david@coproperty.com',
    phone: '+1-720-555-3003',
    status: 'ACTIVE',
    specialties: ['REFINANCE', 'ESTATE'],
    serviceAreas: ['Colorado Springs', 'Pueblo'],
    rating: 4.6,
    totalOrders: 189,
    completedOrders: 175,
    averageCompletionDays: 6.1,
    createdAt: new Date('2024-03-10').toISOString(),
    updatedAt: new Date('2026-02-11').toISOString()
  },
  {
    id: 'vendor-004',
    type: 'vendor',
    tenantId: TENANT_ID,
    businessName: 'Rapid Appraisal Services',
    contactName: 'Sarah Williams',
    email: 'sarah@rapidappraisal.com',
    phone: '+1-303-555-4004',
    status: 'ACTIVE',
    specialties: ['PURCHASE', 'REFINANCE'],
    serviceAreas: ['Denver', 'Centennial', 'Highlands Ranch'],
    rating: 4.7,
    totalOrders: 156,
    completedOrders: 148,
    averageCompletionDays: 5.5,
    createdAt: new Date('2024-05-22').toISOString(),
    updatedAt: new Date('2026-02-13').toISOString()
  },
  {
    id: 'vendor-005',
    type: 'vendor',
    tenantId: TENANT_ID,
    businessName: 'Front Range Appraisals',
    contactName: 'Michael Chen',
    email: 'michael@frontrangeappraisals.com',
    phone: '+1-720-555-5005',
    status: 'ACTIVE',
    specialties: ['PURCHASE', 'REFINANCE', 'HELOC'],
    serviceAreas: ['Denver', 'Westminster', 'Thornton'],
    rating: 4.85,
    totalOrders: 223,
    completedOrders: 215,
    averageCompletionDays: 4.9,
    createdAt: new Date('2023-11-08').toISOString(),
    updatedAt: new Date('2026-02-14').toISOString()
  }
];

// Sample orders - matching AppraisalOrder interface
const orders = [
  // PENDING - New order, unassigned
  {
    id: generateId('ord'),
    type: 'order',
    orderNumber: 'ORD-2026-001',
    tenantId: TENANT_ID,
    
    propertyAddress: {
      street: '1234 Main Street',
      city: 'Denver',
      state: 'CO',
      zipCode: '80202',
      county: 'Denver',
      apn: '12-345-67-890'
    },
    propertyDetails: {
      propertyType: 'SINGLE_FAMILY',
      yearBuilt: 2018,
      squareFeet: 2450,
      bedrooms: 4,
      bathrooms: 3,
      lotSize: 8500,
      garage: 'TWO_CAR'
    },
    
    status: 'PENDING',
    priority: 'NORMAL',
    orderType: 'PURCHASE',
    productType: 'FULL_APPRAISAL',
    
    clientId: 'client-001',
    clientInformation: {
      clientName: 'First National Bank',
      loanOfficer: 'Jane Doe',
      loanOfficerEmail: 'jane.doe@firstnational.com',
      loanOfficerPhone: '+1-303-555-9001',
      loanNumber: 'LN-2026-001234',
      borrowerName: 'Robert Johnson',
      borrowerEmail: 'robert.j@email.com',
      borrowerPhone: '+1-720-555-6001'
    },
    
    requestedDate: new Date('2026-02-10T09:00:00Z').toISOString(),
    dueDate: new Date('2026-02-24T17:00:00Z').toISOString(),
    
    orderFee: 550.00,
    totalFee: 550.00,
    
    documents: [],
    specialInstructions: 'Please include exterior photos of all sides of the property',
    
    createdAt: new Date('2026-02-10T09:15:00Z').toISOString(),
    createdBy: 'admin-user-001',
    updatedAt: new Date('2026-02-10T09:15:00Z').toISOString(),
    updatedBy: 'admin-user-001'
  },

  // ASSIGNED - Vendor assigned, awaiting acceptance
  {
    id: generateId('ord'),
    type: 'order',
    orderNumber: 'ORD-2026-002',
    tenantId: TENANT_ID,
    
    propertyAddress: {
      street: '5678 Oak Avenue',
      city: 'Aurora',
      state: 'CO',
      zipCode: '80012',
      county: 'Arapahoe',
      apn: '56-789-01-234'
    },
    propertyDetails: {
      propertyType: 'CONDO',
      yearBuilt: 2015,
      squareFeet: 1650,
      bedrooms: 3,
      bathrooms: 2,
      lotSize: null,
      garage: 'ONE_CAR'
    },
    
    status: 'ASSIGNED',
    priority: 'RUSH',
    orderType: 'REFINANCE',
    productType: 'FULL_APPRAISAL',
    
    clientId: 'client-002',
    clientInformation: {
      clientName: 'Wells Fargo Home Mortgage',
      loanOfficer: 'Tom Wilson',
      loanOfficerEmail: 'tom.wilson@wellsfargo.com',
      loanOfficerPhone: '+1-303-555-9002',
      loanNumber: 'LN-2026-002345',
      borrowerName: 'Emily Martinez',
      borrowerEmail: 'emily.m@email.com',
      borrowerPhone: '+1-303-555-6002'
    },
    
    assignedVendorId: 'vendor-002',
    assignedVendorName: 'Rocky Mountain Valuations',
    
    requestedDate: new Date('2026-02-11T10:30:00Z').toISOString(),
    dueDate: new Date('2026-02-18T17:00:00Z').toISOString(),
    
    orderFee: 650.00,
    rushFee: 150.00,
    totalFee: 800.00,
    
    documents: [],
    specialInstructions: 'Rush order - borrower closing date is 2/20/2026',
    
    createdAt: new Date('2026-02-11T10:30:00Z').toISOString(),
    createdBy: 'admin-user-001',
    updatedAt: new Date('2026-02-11T11:45:00Z').toISOString(),
    updatedBy: 'admin-user-001'
  },

  // ACCEPTED - Vendor accepted, inspection scheduled
  {
    id: generateId('ord'),
    type: 'order',
    orderNumber: 'ORD-2026-003',
    tenantId: TENANT_ID,
    
    propertyAddress: {
      street: '9101 Pine Street',
      city: 'Lakewood',
      state: 'CO',
      zipCode: '80226',
      county: 'Jefferson',
      apn: '91-012-34-567'
    },
    propertyDetails: {
      propertyType: 'SINGLE_FAMILY',
      yearBuilt: 2005,
      squareFeet: 3200,
      bedrooms: 5,
      bathrooms: 4,
      lotSize: 12000,
      garage: 'THREE_CAR'
    },
    
    status: 'ACCEPTED',
    priority: 'NORMAL',
    orderType: 'PURCHASE',
    productType: 'FULL_APPRAISAL',
    
    clientId: 'client-003',
    clientInformation: {
      clientName: 'Chase Home Finance',
      loanOfficer: 'Lisa Anderson',
      loanOfficerEmail: 'lisa.anderson@chase.com',
      loanOfficerPhone: '+1-720-555-9003',
      loanNumber: 'LN-2026-003456',
      borrowerName: 'David Kim',
      borrowerEmail: 'david.kim@email.com',
      borrowerPhone: '+1-720-555-6003'
    },
    
    assignedVendorId: 'vendor-001',
    assignedVendorName: 'Premier Appraisal Group',
    acceptedDate: new Date('2026-02-12T14:20:00Z').toISOString(),
    
    requestedDate: new Date('2026-02-12T08:00:00Z').toISOString(),
    dueDate: new Date('2026-02-26T17:00:00Z').toISOString(),
    
    orderFee: 700.00,
    totalFee: 700.00,
    
    documents: [],
    specialInstructions: 'Property has solar panels - please note in report',
    internalNotes: 'Vendor has high rating, expect timely completion',
    
    createdAt: new Date('2026-02-12T08:00:00Z').toISOString(),
    createdBy: 'admin-user-002',
    updatedAt: new Date('2026-02-12T14:20:00Z').toISOString(),
    updatedBy: 'vendor-001'
  },

  // IN_PROGRESS - Inspection completed, report in progress
  {
    id: generateId('ord'),
    type: 'order',
    orderNumber: 'ORD-2026-004',
    tenantId: TENANT_ID,
    
    propertyAddress: {
      street: '2468 Maple Drive',
      city: 'Denver',
      state: 'CO',
      zipCode: '80210',
      county: 'Denver',
      apn: '24-680-13-579'
    },
    propertyDetails: {
      propertyType: 'TOWNHOUSE',
      yearBuilt: 2019,
      squareFeet: 1850,
      bedrooms: 3,
      bathrooms: 2.5,
      lotSize: 3500,
      garage: 'TWO_CAR'
    },
    
    status: 'IN_PROGRESS',
    priority: 'NORMAL',
    orderType: 'HELOC',
    productType: 'DESKTOP_APPRAISAL',
    
    clientId: 'client-001',
    clientInformation: {
      clientName: 'First National Bank',
      loanOfficer: 'Mark Thompson',
      loanOfficerEmail: 'mark.thompson@firstnational.com',
      loanOfficerPhone: '+1-303-555-9004',
      loanNumber: 'LN-2026-004567',
      borrowerName: 'Sarah Patel',
      borrowerEmail: 'sarah.p@email.com',
      borrowerPhone: '+1-303-555-6004'
    },
    
    assignedVendorId: 'vendor-004',
    assignedVendorName: 'Rapid Appraisal Services',
    acceptedDate: new Date('2026-02-09T09:30:00Z').toISOString(),
    
    requestedDate: new Date('2026-02-09T08:00:00Z').toISOString(),
    dueDate: new Date('2026-02-20T17:00:00Z').toISOString(),
    
    orderFee: 450.00,
    totalFee: 450.00,
    
    documents: [
      {
        id: 'doc-001',
        name: 'inspection_photos.zip',
        type: 'INSPECTION_PHOTOS',
        url: 'https://storage.example.com/docs/doc-001',
        uploadedAt: new Date('2026-02-13T10:15:00Z').toISOString(),
        uploadedBy: 'vendor-004'
      }
    ],
    
    createdAt: new Date('2026-02-09T08:00:00Z').toISOString(),
    createdBy: 'admin-user-001',
    updatedAt: new Date('2026-02-13T10:15:00Z').toISOString(),
    updatedBy: 'vendor-004'
  },

  // SUBMITTED - Report submitted, awaiting QC
  {
    id: generateId('ord'),
    type: 'order',
    orderNumber: 'ORD-2026-005',
    tenantId: TENANT_ID,
    
    propertyAddress: {
      street: '1357 Elm Court',
      city: 'Boulder',
      state: 'CO',
      zipCode: '80301',
      county: 'Boulder',
      apn: '13-579-24-680'
    },
    propertyDetails: {
      propertyType: 'SINGLE_FAMILY',
      yearBuilt: 2010,
      squareFeet: 2800,
      bedrooms: 4,
      bathrooms: 3,
      lotSize: 10000,
      garage: 'TWO_CAR'
    },
    
    status: 'SUBMITTED',
    priority: 'NORMAL',
    orderType: 'PURCHASE',
    productType: 'FULL_APPRAISAL',
    
    clientId: 'client-002',
    clientInformation: {
      clientName: 'Wells Fargo Home Mortgage',
      loanOfficer: 'Jennifer Lee',
      loanOfficerEmail: 'jennifer.lee@wellsfargo.com',
      loanOfficerPhone: '+1-303-555-9005',
      loanNumber: 'LN-2026-005678',
      borrowerName: 'Michael Brown',
      borrowerEmail: 'michael.b@email.com',
      borrowerPhone: '+1-303-555-6005'
    },
    
    assignedVendorId: 'vendor-005',
    assignedVendorName: 'Front Range Appraisals',
    acceptedDate: new Date('2026-02-08T11:00:00Z').toISOString(),
    
    requestedDate: new Date('2026-02-08T10:00:00Z').toISOString(),
    dueDate: new Date('2026-02-22T17:00:00Z').toISOString(),
    
    orderFee: 625.00,
    totalFee: 625.00,
    
    reportId: 'report-' + generateId('rpt'),
    
    documents: [
      {
        id: 'doc-002',
        name: 'appraisal_report_final.pdf',
        type: 'APPRAISAL_REPORT',
        url: 'https://storage.example.com/docs/doc-002',
        uploadedAt: new Date('2026-02-14T08:30:00Z').toISOString(),
        uploadedBy: 'vendor-005'
      }
    ],
    
    createdAt: new Date('2026-02-08T10:00:00Z').toISOString(),
    createdBy: 'admin-user-002',
    updatedAt: new Date('2026-02-14T08:30:00Z').toISOString(),
    updatedBy: 'vendor-005'
  },

  // QC_REVIEW - In QC review
  {
    id: generateId('ord'),
    type: 'order',
    orderNumber: 'ORD-2026-006',
    tenantId: TENANT_ID,
    
    propertyAddress: {
      street: '7890 Birch Lane',
      city: 'Centennial',
      state: 'CO',
      zipCode: '80112',
      county: 'Arapahoe',
      apn: '78-901-23-456'
    },
    propertyDetails: {
      propertyType: 'SINGLE_FAMILY',
      yearBuilt: 2020,
      squareFeet: 3500,
      bedrooms: 5,
      bathrooms: 4,
      lotSize: 15000,
      garage: 'THREE_CAR'
    },
    
    status: 'QC_REVIEW',
    priority: 'HIGH',
    orderType: 'REFINANCE',
    productType: 'FULL_APPRAISAL',
    
    clientId: 'client-003',
    clientInformation: {
      clientName: 'Chase Home Finance',
      loanOfficer: 'Robert Davis',
      loanOfficerEmail: 'robert.davis@chase.com',
      loanOfficerPhone: '+1-720-555-9006',
      loanNumber: 'LN-2026-006789',
      borrowerName: 'Jessica Wilson',
      borrowerEmail: 'jessica.w@email.com',
      borrowerPhone: '+1-720-555-6006'
    },
    
    assignedVendorId: 'vendor-003',
    assignedVendorName: 'Colorado Property Experts',
    acceptedDate: new Date('2026-02-07T13:15:00Z').toISOString(),
    
    requestedDate: new Date('2026-02-07T12:00:00Z').toISOString(),
    dueDate: new Date('2026-02-21T17:00:00Z').toISOString(),
    
    orderFee: 750.00,
    totalFee: 750.00,
    
    qcReportId: 'qc-review-' + generateId('qc'),
    qcStatus: 'PENDING',
    
    reportId: 'report-' + generateId('rpt'),
    
    documents: [
      {
        id: 'doc-003',
        name: 'appraisal_report.pdf',
        type: 'APPRAISAL_REPORT',
        url: 'https://storage.example.com/docs/doc-003',
        uploadedAt: new Date('2026-02-13T16:45:00Z').toISOString(),
        uploadedBy: 'vendor-003'
      }
    ],
    
    createdAt: new Date('2026-02-07T12:00:00Z').toISOString(),
    createdBy: 'admin-user-001',
    updatedAt: new Date('2026-02-14T09:00:00Z').toISOString(),
    updatedBy: 'qc-analyst-001'
  },

  // REVISION_REQUESTED - QC found issues, revision needed
  {
    id: generateId('ord'),
    type: 'order',
    orderNumber: 'ORD-2026-007',
    tenantId: TENANT_ID,
    
    propertyAddress: {
      street: '4321 Cedar Street',
      city: 'Denver',
      state: 'CO',
      zipCode: '80218',
      county: 'Denver',
      apn: '43-210-98-765'
    },
    propertyDetails: {
      propertyType: 'CONDO',
      yearBuilt: 2017,
      squareFeet: 1400,
      bedrooms: 2,
      bathrooms: 2,
      lotSize: null,
      garage: 'ONE_CAR'
    },
    
    status: 'REVISION_REQUESTED',
    priority: 'NORMAL',
    orderType: 'PURCHASE',
    productType: 'FULL_APPRAISAL',
    
    clientId: 'client-001',
    clientInformation: {
      clientName: 'First National Bank',
      loanOfficer: 'Amanda Green',
      loanOfficerEmail: 'amanda.green@firstnational.com',
      loanOfficerPhone: '+1-303-555-9007',
      loanNumber: 'LN-2026-007890',
      borrowerName: 'Daniel Rodriguez',
      borrowerEmail: 'daniel.r@email.com',
      borrowerPhone: '+1-303-555-6007'
    },
    
    assignedVendorId: 'vendor-001',
    assignedVendorName: 'Premier Appraisal Group',
    acceptedDate: new Date('2026-02-06T10:00:00Z').toISOString(),
    
    requestedDate: new Date('2026-02-06T09:00:00Z').toISOString(),
    dueDate: new Date('2026-02-20T17:00:00Z').toISOString(),
    
    orderFee: 575.00,
    revisionFee: 100.00,
    totalFee: 675.00,
    
    qcReportId: 'qc-review-' + generateId('qc'),
    qcStatus: 'REQUIRES_REVISION',
    
    reportId: 'report-' + generateId('rpt'),
    
    documents: [
      {
        id: 'doc-004',
        name: 'appraisal_report_v1.pdf',
        type: 'APPRAISAL_REPORT',
        url: 'https://storage.example.com/docs/doc-004',
        uploadedAt: new Date('2026-02-12T14:20:00Z').toISOString(),
        uploadedBy: 'vendor-001'
      }
    ],
    
    specialInstructions: 'Comparable sales need verification',
    internalNotes: 'QC found issues with comp adjustments - vendor notified',
    
    createdAt: new Date('2026-02-06T09:00:00Z').toISOString(),
    createdBy: 'admin-user-002',
    updatedAt: new Date('2026-02-13T11:30:00Z').toISOString(),
    updatedBy: 'qc-analyst-002'
  },

  // COMPLETED - Passed QC, delivered
  {
    id: generateId('ord'),
    type: 'order',
    orderNumber: 'ORD-2026-008',
    tenantId: TENANT_ID,
    
    propertyAddress: {
      street: '6543 Spruce Avenue',
      city: 'Fort Collins',
      state: 'CO',
      zipCode: '80525',
      county: 'Larimer',
      apn: '65-432-10-987'
    },
    propertyDetails: {
      propertyType: 'SINGLE_FAMILY',
      yearBuilt: 2012,
      squareFeet: 2600,
      bedrooms: 4,
      bathrooms: 3,
      lotSize: 9500,
      garage: 'TWO_CAR'
    },
    
    status: 'COMPLETED',
    priority: 'NORMAL',
    orderType: 'REFINANCE',
    productType: 'FULL_APPRAISAL',
    
    clientId: 'client-002',
    clientInformation: {
      clientName: 'Wells Fargo Home Mortgage',
      loanOfficer: 'Brian Miller',
      loanOfficerEmail: 'brian.miller@wellsfargo.com',
      loanOfficerPhone: '+1-970-555-9008',
      loanNumber: 'LN-2026-008901',
      borrowerName: 'Nicole Taylor',
      borrowerEmail: 'nicole.t@email.com',
      borrowerPhone: '+1-970-555-6008'
    },
    
    assignedVendorId: 'vendor-002',
    assignedVendorName: 'Rocky Mountain Valuations',
    acceptedDate: new Date('2026-02-03T11:30:00Z').toISOString(),
    completedDate: new Date('2026-02-13T15:00:00Z').toISOString(),
    deliveredDate: new Date('2026-02-13T15:30:00Z').toISOString(),
    
    requestedDate: new Date('2026-02-03T10:00:00Z').toISOString(),
    dueDate: new Date('2026-02-17T17:00:00Z').toISOString(),
    
    orderFee: 600.00,
    totalFee: 600.00,
    
    qcReportId: 'qc-review-' + generateId('qc'),
    qcStatus: 'PASSED',
    qcScore: 92,
    
    reportId: 'report-' + generateId('rpt'),
    
    documents: [
      {
        id: 'doc-005',
        name: 'appraisal_report_final.pdf',
        type: 'APPRAISAL_REPORT',
        url: 'https://storage.example.com/docs/doc-005',
        uploadedAt: new Date('2026-02-13T14:45:00Z').toISOString(),
        uploadedBy: 'vendor-002'
      }
    ],
    
    createdAt: new Date('2026-02-03T10:00:00Z').toISOString(),
    createdBy: 'admin-user-001',
    updatedAt: new Date('2026-02-13T15:30:00Z').toISOString(),
    updatedBy: 'system'
  },

  // CANCELLED - Client cancelled request
  {
    id: generateId('ord'),
    type: 'order',
    orderNumber: 'ORD-2026-009',
    tenantId: TENANT_ID,
    
    propertyAddress: {
      street: '3210 Aspen Way',
      city: 'Highlands Ranch',
      state: 'CO',
      zipCode: '80126',
      county: 'Douglas',
      apn: '32-109-87-654'
    },
    propertyDetails: {
      propertyType: 'SINGLE_FAMILY',
      yearBuilt: 2008,
      squareFeet: 3100,
      bedrooms: 5,
      bathrooms: 3.5,
      lotSize: 11000,
      garage: 'THREE_CAR'
    },
    
    status: 'CANCELLED',
    priority: 'NORMAL',
    orderType: 'PURCHASE',
    productType: 'FULL_APPRAISAL',
    
    clientId: 'client-003',
    clientInformation: {
      clientName: 'Chase Home Finance',
      loanOfficer: 'Steven White',
      loanOfficerEmail: 'steven.white@chase.com',
      loanOfficerPhone: '+1-720-555-9009',
      loanNumber: 'LN-2026-009012',
      borrowerName: 'Christopher Lee',
      borrowerEmail: 'chris.lee@email.com',
      borrowerPhone: '+1-720-555-6009'
    },
    
    assignedVendorId: 'vendor-004',
    assignedVendorName: 'Rapid Appraisal Services',
    acceptedDate: new Date('2026-02-10T14:00:00Z').toISOString(),
    
    requestedDate: new Date('2026-02-10T13:00:00Z').toISOString(),
    dueDate: new Date('2026-02-24T17:00:00Z').toISOString(),
    
    orderFee: 650.00,
    totalFee: 650.00,
    
    documents: [],
    
    specialInstructions: 'Buyer backed out of contract - cancel order',
    internalNotes: 'Client called to cancel - no fee charged',
    
    createdAt: new Date('2026-02-10T13:00:00Z').toISOString(),
    createdBy: 'admin-user-002',
    updatedAt: new Date('2026-02-11T10:15:00Z').toISOString(),
    updatedBy: 'admin-user-002'
  },

  // Additional orders for testing pagination and various scenarios
  ...Array.from({ length: 11 }, (_, i) => {
    const orderNum = 10 + i;
    const statuses = ['PENDING', 'ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'SUBMITTED'];
    const priorities = ['NORMAL', 'HIGH', 'RUSH', 'SUPER_RUSH'];
    const orderTypes = ['PURCHASE', 'REFINANCE', 'HELOC', 'PMI_REMOVAL', 'ESTATE'];
    const productTypes = ['FULL_APPRAISAL', 'DESKTOP_APPRAISAL', 'BPO', 'HYBRID'];
    
    const randomStatus = statuses[i % statuses.length];
    const randomPriority = priorities[i % priorities.length];
    const randomOrderType = orderTypes[i % orderTypes.length];
    const randomProductType = productTypes[i % productTypes.length];
    
    return {
      id: generateId('ord'),
      type: 'order',
      orderNumber: `ORD-2026-${String(orderNum).padStart(3, '0')}`,
      tenantId: TENANT_ID,
      
      propertyAddress: {
        street: `${1000 + i * 100} Test Street ${i}`,
        city: ['Denver', 'Aurora', 'Lakewood', 'Boulder'][i % 4],
        state: 'CO',
        zipCode: `80${String(200 + i).padStart(3, '0')}`,
        county: ['Denver', 'Arapahoe', 'Jefferson', 'Boulder'][i % 4]
      },
      propertyDetails: {
        propertyType: ['SINGLE_FAMILY', 'CONDO', 'TOWNHOUSE'][i % 3],
        yearBuilt: 2000 + (i % 24),
        squareFeet: 1500 + (i * 100),
        bedrooms: 2 + (i % 4),
        bathrooms: 1 + (i % 3),
        lotSize: i % 2 === 0 ? 8000 + (i * 500) : null,
        garage: ['ONE_CAR', 'TWO_CAR', 'THREE_CAR', null][i % 4]
      },
      
      status: randomStatus,
      priority: randomPriority,
      orderType: randomOrderType,
      productType: randomProductType,
      
      clientId: `client-${String((i % 3) + 1).padStart(3, '0')}`,
      clientInformation: {
        clientName: ['First National Bank', 'Wells Fargo Home Mortgage', 'Chase Home Finance'][i % 3],
        loanOfficer: `Officer ${i}`,
        loanOfficerEmail: `officer${i}@example.com`,
        loanOfficerPhone: `+1-303-555-${String(9000 + i).padStart(4, '0')}`,
        loanNumber: `LN-2026-${String(orderNum * 1000 + i).padStart(6, '0')}`,
        borrowerName: `Borrower ${i}`,
        borrowerEmail: `borrower${i}@email.com`,
        borrowerPhone: `+1-303-555-${String(6000 + i).padStart(4, '0')}`
      },
      
      assignedVendorId: randomStatus !== 'PENDING' ? vendors[i % vendors.length].id : undefined,
      assignedVendorName: randomStatus !== 'PENDING' ? vendors[i % vendors.length].businessName : undefined,
      acceptedDate: randomStatus !== 'PENDING' && randomStatus !== 'ASSIGNED' 
        ? new Date(Date.now() - (i + 5) * 24 * 60 * 60 * 1000).toISOString() 
        : undefined,
      
      requestedDate: new Date(Date.now() - (i + 7) * 24 * 60 * 60 * 1000).toISOString(),
      dueDate: new Date(Date.now() + (14 - i) * 24 * 60 * 60 * 1000).toISOString(),
      
      orderFee: 500 + (i * 25),
      totalFee: 500 + (i * 25),
      
      documents: [],
      
      createdAt: new Date(Date.now() - (i + 7) * 24 * 60 * 60 * 1000).toISOString(),
      createdBy: `admin-user-${String((i % 2) + 1).padStart(3, '0')}`,
      updatedAt: new Date(Date.now() - i * 12 * 60 * 60 * 1000).toISOString(),
      updatedBy: `user-${String((i % 3) + 1).padStart(3, '0')}`
    };
  })
];

async function seedDatabase() {
  console.log('🌱 Starting database seeding with 2026 schema...\n');

  try {
    // Seed vendors
    console.log('📦 Seeding vendors...');
    const vendorsContainer = database.container('vendors');
    for (const vendor of vendors) {
      try {
        await vendorsContainer.items.upsert(vendor);
        console.log(`  ✓ Vendor: ${vendor.businessName} (${vendor.id})`);
      } catch (error) {
        console.error(`  ✗ Failed to seed vendor ${vendor.id}:`, error.message);
      }
    }

    // Seed orders
    console.log('\n📦 Seeding orders...');
    const ordersContainer = database.container('orders');
    let successCount = 0;
    let failCount = 0;

    for (const order of orders) {
      try {
        await ordersContainer.items.upsert(order);
        console.log(`  ✓ Order: ${order.orderNumber} - ${order.status} (${order.priority})`);
        successCount++;
      } catch (error) {
        console.error(`  ✗ Failed to seed order ${order.orderNumber}:`, error.message);
        failCount++;
      }
    }

    console.log('\n✅ Seeding complete!');
    console.log(`   Vendors: ${vendors.length} seeded`);
    console.log(`   Orders: ${successCount} seeded, ${failCount} failed`);
    console.log(`\n🎯 Test data ready for Phase 1.1 testing`);

  } catch (error) {
    console.error('\n❌ Seeding failed:', error);
    throw error;
  }
}

// Run the seed script
seedDatabase()
  .then(() => {
    console.log('\n👍 All done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Error:', error);
    process.exit(1);
  });
