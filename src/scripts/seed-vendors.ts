/**
 * Seed Vendors Script
 * Creates realistic vendor data in Cosmos DB
 * 
 * Run with: npx tsx src/scripts/seed-vendors.ts
 */

import 'dotenv/config';
import { CosmosDbService } from '../services/cosmos-db.service.js';
import { Logger } from '../utils/logger.js';
import { 
  Vendor, 
  VendorStatus, 
  VendorPerformance,
  ServiceArea,
  Certification,
  InsuranceInfo,
  PaymentInfo,
  PaymentRecord,
  InvoiceRecord,
  VendorPreferences,
  ProductType,
  OrderType
} from '../types/index.js';

const logger = new Logger('SeedVendors');
const cosmosDb = new CosmosDbService();

// ============================================
// REALISTIC VENDOR DATA
// ============================================

const vendors: Omit<Vendor, 'id'>[] = [
  {
    name: 'James Williams',
    email: 'james.williams@eliteappraisal.com',
    phone: '(555) 111-2222',
    licenseNumber: 'CA-APR-12345',
    licenseState: 'CA',
    licenseExpiry: new Date('2026-12-31'),
    certifications: [
      {
        type: 'SRA',
        number: 'SRA-45678',
        issuingAuthority: 'Appraisal Institute',
        issueDate: new Date('2018-06-15'),
        expiryDate: new Date('2027-06-15'),
        status: 'active' as const
      },
      {
        type: 'MAI',
        number: 'MAI-12345',
        issuingAuthority: 'Appraisal Institute',
        issueDate: new Date('2020-03-20'),
        expiryDate: new Date('2028-03-20'),
        status: 'active' as const
      }
    ],
    serviceAreas: [
      {
        state: 'CA',
        counties: ['Los Angeles', 'Orange', 'Ventura', 'San Bernardino'],
        zipCodes: ['90001', '90002', '90003', '90004', '90005'],
        maxDistance: 60,
        travelFee: 75
      }
    ],
    productTypes: [ProductType.FULL_APPRAISAL, ProductType.BPO_EXTERIOR, ProductType.DESKTOP_APPRAISAL],
    specialties: [
      { type: 'Residential', description: 'Single family and condominiums', yearsExperience: 15, certification: 'SRA' },
      { type: 'Commercial', description: 'Small commercial properties', yearsExperience: 8, certification: 'MAI' }
    ],
    performance: {
      totalOrders: 1247,
      completedOrders: 1235,
      averageTurnTime: 96, // hours
      revisionRate: 3.8,
      onTimeDeliveryRate: 94.2,
      qualityScore: 4.6,
      clientSatisfactionScore: 4.7,
      cuRiskScore: 2.1,
      lastUpdated: new Date()
    },
    status: VendorStatus.ACTIVE,
    onboardingDate: new Date('2021-01-15'),
    lastActive: new Date(),
    insuranceInfo: {
      provider: 'LIA Administrators',
      policyNumber: 'EO-2024-45678',
      coverage: 2000000,
      expiryDate: new Date('2026-06-30'),
      status: 'active' as const
    },
    paymentInfo: {
      method: 'ach' as const,
      bankName: 'Chase Bank',
      accountNumber: '****4567',
      routingNumber: '****1234'
    },
    preferences: {
      orderTypes: [OrderType.PURCHASE, OrderType.REFINANCE, OrderType.CONSTRUCTION],
      productTypes: [ProductType.FULL_APPRAISAL, ProductType.BPO_EXTERIOR],
      maxOrdersPerDay: 3,
      workingHours: { start: '08:00', end: '18:00' },
      workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      notificationPreferences: { email: true, sms: true, portal: true }
    }
  },
  {
    name: 'Maria Rodriguez',
    email: 'maria.rodriguez@precisionvaluation.com',
    phone: '(555) 222-3333',
    licenseNumber: 'CA-APR-23456',
    licenseState: 'CA',
    licenseExpiry: new Date('2026-06-30'),
    certifications: [
      {
        type: 'SRA',
        number: 'SRA-56789',
        issuingAuthority: 'Appraisal Institute',
        issueDate: new Date('2019-04-10'),
        expiryDate: new Date('2027-04-10'),
        status: 'active' as const
      }
    ],
    serviceAreas: [
      {
        state: 'CA',
        counties: ['San Diego', 'Imperial', 'Riverside'],
        maxDistance: 50,
        travelFee: 50
      }
    ],
    productTypes: [ProductType.FULL_APPRAISAL, ProductType.BPO_EXTERIOR, ProductType.HYBRID_APPRAISAL],
    specialties: [
      { type: 'Residential', description: 'Single family homes', yearsExperience: 12 },
      { type: 'Luxury', description: 'High-value properties over $2M', yearsExperience: 6, certification: 'SRA' }
    ],
    performance: {
      totalOrders: 892,
      completedOrders: 889,
      averageTurnTime: 72,
      revisionRate: 2.1,
      onTimeDeliveryRate: 97.8,
      qualityScore: 4.8,
      clientSatisfactionScore: 4.9,
      cuRiskScore: 1.8,
      lastUpdated: new Date()
    },
    status: VendorStatus.ACTIVE,
    onboardingDate: new Date('2021-03-20'),
    lastActive: new Date(),
    insuranceInfo: {
      provider: 'CRES Insurance',
      policyNumber: 'EO-2024-67890',
      coverage: 2000000,
      expiryDate: new Date('2026-09-15'),
      status: 'active' as const
    },
    paymentInfo: {
      method: 'ach' as const,
      bankName: 'Bank of America',
      accountNumber: '****7890',
      routingNumber: '****5678'
    },
    preferences: {
      orderTypes: [OrderType.PURCHASE, OrderType.REFINANCE],
      productTypes: [ProductType.FULL_APPRAISAL, ProductType.HYBRID_APPRAISAL],
      maxOrdersPerDay: 4,
      workingHours: { start: '07:00', end: '17:00' },
      workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      notificationPreferences: { email: true, sms: false, portal: true }
    }
  },
  {
    name: 'David Chen',
    email: 'david.chen@coastalappraisal.com',
    phone: '(555) 333-4444',
    licenseNumber: 'CA-APR-34567',
    licenseState: 'CA',
    licenseExpiry: new Date('2027-03-31'),
    certifications: [
      {
        type: 'SRA',
        number: 'SRA-67890',
        issuingAuthority: 'Appraisal Institute',
        issueDate: new Date('2017-08-22'),
        expiryDate: new Date('2027-08-22'),
        status: 'active' as const
      },
      {
        type: 'AI-GRS',
        number: 'GRS-34567',
        issuingAuthority: 'Appraisal Institute',
        issueDate: new Date('2021-01-15'),
        expiryDate: new Date('2029-01-15'),
        status: 'active' as const
      }
    ],
    serviceAreas: [
      {
        state: 'CA',
        counties: ['Santa Barbara', 'San Luis Obispo', 'Monterey'],
        maxDistance: 75,
        travelFee: 100
      }
    ],
    productTypes: [ProductType.FULL_APPRAISAL, ProductType.DESKTOP_APPRAISAL, ProductType.AVM],
    specialties: [
      { type: 'Residential', description: 'Coastal properties', yearsExperience: 10 },
      { type: 'Green', description: 'Green/Sustainable homes', yearsExperience: 5, certification: 'AI-GRS' }
    ],
    performance: {
      totalOrders: 567,
      completedOrders: 561,
      averageTurnTime: 84,
      revisionRate: 4.2,
      onTimeDeliveryRate: 91.5,
      qualityScore: 4.5,
      clientSatisfactionScore: 4.6,
      cuRiskScore: 2.4,
      lastUpdated: new Date()
    },
    status: VendorStatus.ACTIVE,
    onboardingDate: new Date('2022-06-10'),
    lastActive: new Date(),
    insuranceInfo: {
      provider: 'LIA Administrators',
      policyNumber: 'EO-2024-11111',
      coverage: 1500000,
      expiryDate: new Date('2026-12-31'),
      status: 'active' as const
    },
    paymentInfo: {
      method: 'ach' as const,
      bankName: 'Wells Fargo',
      accountNumber: '****1111',
      routingNumber: '****9999'
    },
    preferences: {
      orderTypes: [OrderType.PURCHASE, OrderType.CONSTRUCTION],
      productTypes: [ProductType.FULL_APPRAISAL, ProductType.DESKTOP_APPRAISAL],
      maxOrdersPerDay: 2,
      workingHours: { start: '09:00', end: '17:00' },
      workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      notificationPreferences: { email: true, sms: true, portal: false }
    }
  },
  {
    name: 'Sarah Thompson',
    email: 'sarah.thompson@westcoastappraisals.com',
    phone: '(555) 444-5555',
    licenseNumber: 'CA-APR-45678',
    licenseState: 'CA',
    licenseExpiry: new Date('2025-09-30'),
    certifications: [
      {
        type: 'Certified Residential',
        number: 'CR-78901',
        issuingAuthority: 'BREA',
        issueDate: new Date('2020-09-01'),
        expiryDate: new Date('2025-09-01'),
        status: 'active' as const
      }
    ],
    serviceAreas: [
      {
        state: 'CA',
        counties: ['Sacramento', 'Placer', 'El Dorado', 'Yolo'],
        maxDistance: 45,
        travelFee: 60
      }
    ],
    productTypes: [ProductType.FULL_APPRAISAL, ProductType.BPO_EXTERIOR],
    specialties: [
      { type: 'Residential', description: 'Single family, townhomes', yearsExperience: 8 }
    ],
    performance: {
      totalOrders: 412,
      completedOrders: 410,
      averageTurnTime: 60,
      revisionRate: 1.8,
      onTimeDeliveryRate: 98.5,
      qualityScore: 4.9,
      clientSatisfactionScore: 4.8,
      cuRiskScore: 1.5,
      lastUpdated: new Date()
    },
    status: VendorStatus.ACTIVE,
    onboardingDate: new Date('2022-09-15'),
    lastActive: new Date(),
    insuranceInfo: {
      provider: 'CRES Insurance',
      policyNumber: 'EO-2024-22222',
      coverage: 1000000,
      expiryDate: new Date('2026-03-31'),
      status: 'active' as const
    },
    paymentInfo: {
      method: 'ach' as const,
      bankName: 'US Bank',
      accountNumber: '****2222',
      routingNumber: '****8888'
    },
    preferences: {
      orderTypes: [OrderType.PURCHASE, OrderType.REFINANCE],
      productTypes: [ProductType.FULL_APPRAISAL, ProductType.BPO_EXTERIOR],
      maxOrdersPerDay: 5,
      workingHours: { start: '06:00', end: '16:00' },
      workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      notificationPreferences: { email: true, sms: true, portal: true }
    }
  },
  {
    name: 'Robert Martinez',
    email: 'robert.martinez@bayareaappraisals.com',
    phone: '(555) 555-6666',
    licenseNumber: 'CA-APR-56789',
    licenseState: 'CA',
    licenseExpiry: new Date('2026-05-15'),
    certifications: [
      {
        type: 'SRA',
        number: 'SRA-89012',
        issuingAuthority: 'Appraisal Institute',
        issueDate: new Date('2016-05-01'),
        expiryDate: new Date('2026-05-01'),
        status: 'active' as const
      },
      {
        type: 'MAI',
        number: 'MAI-56789',
        issuingAuthority: 'Appraisal Institute',
        issueDate: new Date('2019-11-10'),
        expiryDate: new Date('2027-11-10'),
        status: 'active' as const
      }
    ],
    serviceAreas: [
      {
        state: 'CA',
        counties: ['San Francisco', 'San Mateo', 'Alameda', 'Contra Costa', 'Santa Clara'],
        maxDistance: 40,
        travelFee: 100
      }
    ],
    productTypes: [ProductType.FULL_APPRAISAL, ProductType.DESKTOP_APPRAISAL, ProductType.HYBRID_APPRAISAL],
    specialties: [
      { type: 'Residential', description: 'High-density urban properties', yearsExperience: 18, certification: 'SRA' },
      { type: 'Commercial', description: 'Mixed-use developments', yearsExperience: 12, certification: 'MAI' }
    ],
    performance: {
      totalOrders: 1892,
      completedOrders: 1875,
      averageTurnTime: 108,
      revisionRate: 5.1,
      onTimeDeliveryRate: 89.3,
      qualityScore: 4.4,
      clientSatisfactionScore: 4.5,
      cuRiskScore: 2.8,
      lastUpdated: new Date()
    },
    status: VendorStatus.ACTIVE,
    onboardingDate: new Date('2020-01-10'),
    lastActive: new Date(),
    insuranceInfo: {
      provider: 'LIA Administrators',
      policyNumber: 'EO-2024-33333',
      coverage: 3000000,
      expiryDate: new Date('2026-08-15'),
      status: 'active' as const
    },
    paymentInfo: {
      method: 'ach' as const,
      bankName: 'First Republic',
      accountNumber: '****3333',
      routingNumber: '****7777'
    },
    preferences: {
      orderTypes: [OrderType.PURCHASE, OrderType.REFINANCE, OrderType.CONSTRUCTION],
      productTypes: [ProductType.FULL_APPRAISAL, ProductType.DESKTOP_APPRAISAL, ProductType.HYBRID_APPRAISAL],
      maxOrdersPerDay: 2,
      workingHours: { start: '08:00', end: '19:00' },
      workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      notificationPreferences: { email: true, sms: false, portal: true }
    }
  },
  {
    name: 'Jennifer Lee',
    email: 'jennifer.lee@premierappraisals.com',
    phone: '(555) 666-7777',
    licenseNumber: 'TX-APR-11111',
    licenseState: 'TX',
    licenseExpiry: new Date('2026-11-30'),
    certifications: [
      {
        type: 'SRA',
        number: 'SRA-11111',
        issuingAuthority: 'Appraisal Institute',
        issueDate: new Date('2018-11-15'),
        expiryDate: new Date('2026-11-15'),
        status: 'active' as const
      }
    ],
    serviceAreas: [
      {
        state: 'TX',
        counties: ['Harris', 'Fort Bend', 'Montgomery', 'Brazoria', 'Galveston'],
        maxDistance: 55,
        travelFee: 50
      }
    ],
    productTypes: [ProductType.FULL_APPRAISAL, ProductType.BPO_EXTERIOR, ProductType.DESKTOP_APPRAISAL],
    specialties: [
      { type: 'Residential', description: 'Suburban single family', yearsExperience: 11, certification: 'SRA' }
    ],
    performance: {
      totalOrders: 756,
      completedOrders: 750,
      averageTurnTime: 72,
      revisionRate: 2.5,
      onTimeDeliveryRate: 96.2,
      qualityScore: 4.7,
      clientSatisfactionScore: 4.8,
      cuRiskScore: 1.9,
      lastUpdated: new Date()
    },
    status: VendorStatus.ACTIVE,
    onboardingDate: new Date('2021-08-01'),
    lastActive: new Date(),
    insuranceInfo: {
      provider: 'CRES Insurance',
      policyNumber: 'EO-2024-44444',
      coverage: 2000000,
      expiryDate: new Date('2026-07-31'),
      status: 'active' as const
    },
    paymentInfo: {
      method: 'ach' as const,
      bankName: 'Frost Bank',
      accountNumber: '****4444',
      routingNumber: '****6666'
    },
    preferences: {
      orderTypes: [OrderType.PURCHASE, OrderType.REFINANCE],
      productTypes: [ProductType.FULL_APPRAISAL, ProductType.BPO_EXTERIOR],
      maxOrdersPerDay: 4,
      workingHours: { start: '07:00', end: '17:00' },
      workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      notificationPreferences: { email: true, sms: true, portal: true }
    }
  },
  {
    name: 'Michael Johnson',
    email: 'michael.johnson@texasvaluations.com',
    phone: '(555) 777-8888',
    licenseNumber: 'TX-APR-22222',
    licenseState: 'TX',
    licenseExpiry: new Date('2027-02-28'),
    certifications: [
      {
        type: 'Certified General',
        number: 'CG-22222',
        issuingAuthority: 'TALCB',
        issueDate: new Date('2015-02-15'),
        expiryDate: new Date('2027-02-15'),
        status: 'active' as const
      },
      {
        type: 'MAI',
        number: 'MAI-88888',
        issuingAuthority: 'Appraisal Institute',
        issueDate: new Date('2018-06-20'),
        expiryDate: new Date('2028-06-20'),
        status: 'active' as const
      }
    ],
    serviceAreas: [
      {
        state: 'TX',
        counties: ['Dallas', 'Tarrant', 'Collin', 'Denton', 'Rockwall'],
        maxDistance: 60,
        travelFee: 75
      }
    ],
    productTypes: [ProductType.FULL_APPRAISAL, ProductType.DESKTOP_APPRAISAL, ProductType.AVM],
    specialties: [
      { type: 'Residential', description: 'New construction and luxury', yearsExperience: 14 },
      { type: 'Commercial', description: 'Retail and office', yearsExperience: 10, certification: 'MAI' }
    ],
    performance: {
      totalOrders: 1124,
      completedOrders: 1110,
      averageTurnTime: 96,
      revisionRate: 3.2,
      onTimeDeliveryRate: 93.8,
      qualityScore: 4.6,
      clientSatisfactionScore: 4.7,
      cuRiskScore: 2.2,
      lastUpdated: new Date()
    },
    status: VendorStatus.ACTIVE,
    onboardingDate: new Date('2020-06-15'),
    lastActive: new Date(),
    insuranceInfo: {
      provider: 'LIA Administrators',
      policyNumber: 'EO-2024-55555',
      coverage: 2500000,
      expiryDate: new Date('2026-10-31'),
      status: 'active' as const
    },
    paymentInfo: {
      method: 'ach' as const,
      bankName: 'Texas Capital Bank',
      accountNumber: '****5555',
      routingNumber: '****5555'
    },
    preferences: {
      orderTypes: [OrderType.PURCHASE, OrderType.REFINANCE, OrderType.CONSTRUCTION],
      productTypes: [ProductType.FULL_APPRAISAL, ProductType.DESKTOP_APPRAISAL],
      maxOrdersPerDay: 3,
      workingHours: { start: '08:00', end: '18:00' },
      workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      notificationPreferences: { email: true, sms: false, portal: true }
    }
  },
  {
    name: 'Amanda Wilson',
    email: 'amanda.wilson@sunshineappraisals.com',
    phone: '(555) 888-9999',
    licenseNumber: 'FL-APR-33333',
    licenseState: 'FL',
    licenseExpiry: new Date('2026-08-31'),
    certifications: [
      {
        type: 'Certified Residential',
        number: 'CR-33333',
        issuingAuthority: 'FREAB',
        issueDate: new Date('2019-08-01'),
        expiryDate: new Date('2026-08-01'),
        status: 'active' as const
      }
    ],
    serviceAreas: [
      {
        state: 'FL',
        counties: ['Miami-Dade', 'Broward', 'Palm Beach'],
        maxDistance: 50,
        travelFee: 60
      }
    ],
    productTypes: [ProductType.FULL_APPRAISAL, ProductType.BPO_EXTERIOR, ProductType.HYBRID_APPRAISAL],
    specialties: [
      { type: 'Residential', description: 'Condos and waterfront', yearsExperience: 9 },
      { type: 'REO', description: 'Bank-owned properties', yearsExperience: 6 }
    ],
    performance: {
      totalOrders: 623,
      completedOrders: 618,
      averageTurnTime: 84,
      revisionRate: 3.5,
      onTimeDeliveryRate: 92.1,
      qualityScore: 4.5,
      clientSatisfactionScore: 4.6,
      cuRiskScore: 2.3,
      lastUpdated: new Date()
    },
    status: VendorStatus.ACTIVE,
    onboardingDate: new Date('2022-02-01'),
    lastActive: new Date(),
    insuranceInfo: {
      provider: 'CRES Insurance',
      policyNumber: 'EO-2024-66666',
      coverage: 1500000,
      expiryDate: new Date('2026-05-31'),
      status: 'active' as const
    },
    paymentInfo: {
      method: 'ach' as const,
      bankName: 'Regions Bank',
      accountNumber: '****6666',
      routingNumber: '****4444'
    },
    preferences: {
      orderTypes: [OrderType.PURCHASE, OrderType.REFINANCE],
      productTypes: [ProductType.FULL_APPRAISAL, ProductType.BPO_EXTERIOR],
      maxOrdersPerDay: 4,
      workingHours: { start: '08:00', end: '17:00' },
      workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      notificationPreferences: { email: true, sms: true, portal: false }
    }
  }
];

// ============================================
// SEEDING LOGIC
// ============================================

function generatePaymentHistory(vendorId: string, totalOrders: number): { payments: PaymentRecord[], invoices: InvoiceRecord[] } {
  const payments: PaymentRecord[] = [];
  const invoices: InvoiceRecord[] = [];
  const now = Date.now();
  
  // Generate 3-5 recent payments (last 6 months)
  const paymentCount = Math.min(totalOrders, Math.floor(Math.random() * 3) + 3);
  
  for (let i = 0; i < paymentCount; i++) {
    const daysAgo = Math.floor(Math.random() * 180); // Last 6 months
    const paymentDate = new Date(now - daysAgo * 24 * 60 * 60 * 1000);
    const amount = Math.floor(Math.random() * 400) + 400; // $400-$800
    
    const invoiceId = `inv-${vendorId}-${paymentDate.getTime()}`;
    const paymentId = `pay-${vendorId}-${paymentDate.getTime()}`;
    const orderId = `ord_${paymentDate.getFullYear()}_${String(Math.floor(Math.random() * 100000)).padStart(8, '0')}`;
    
    // Invoice
    const issueDate = new Date(paymentDate.getTime() - 35 * 24 * 60 * 60 * 1000); // 35 days before payment
    const dueDate = new Date(issueDate.getTime() + 30 * 24 * 60 * 60 * 1000); // Net 30
    
    invoices.push({
      id: invoiceId,
      invoiceNumber: `INV-2026-${String(i + 1).padStart(5, '0')}`,
      orderId,
      totalAmount: amount,
      amountPaid: amount,
      amountDue: 0,
      status: 'paid',
      issueDate,
      dueDate,
      paidDate: paymentDate
    });
    
    // Payment
    payments.push({
      id: paymentId,
      orderId,
      invoiceId,
      amount,
      paymentMethod: 'ach',
      status: 'completed',
      transactionId: `TXN${Date.now()}${Math.floor(Math.random() * 10000)}`,
      processedAt: paymentDate,
      createdAt: new Date(paymentDate.getTime() - 2 * 24 * 60 * 60 * 1000) // 2 days before
    });
  }
  
  return { payments, invoices };
}

async function seedVendors(): Promise<void> {
  logger.info('🚀 Starting vendor seeding...');

  // Initialize CosmosDbService (handles connection)
  await cosmosDb.initialize();
  logger.info('✅ Connected to Cosmos DB');

  // Seed each vendor
  let created = 0;
  let skipped = 0;

  for (const vendorData of vendors) {
    const vendorId = `vendor-${vendorData.licenseNumber.replace(/[^A-Za-z0-9]/g, '-').toLowerCase()}`;
    
    try {
      // Check if vendor already exists
      const existingResult = await cosmosDb.findVendorById(vendorId);

      if (existingResult.success && existingResult.data) {
        // FORCE UPDATE: Always regenerate payment history
        const existing = existingResult.data;
        const { payments, invoices } = generatePaymentHistory(vendorId, vendorData.performance.totalOrders);
        
        const updatedVendor = {
          ...existing,
          certifications: vendorData.certifications, // Force certifications too
          paymentHistory: payments,
          invoiceHistory: invoices
        };
        
        const container = (cosmosDb as any)['vendorsContainer'];
        if (!container) {
          throw new Error('Vendors container not initialized');
        }
        await container.items.upsert(updatedVendor);
        logger.info(`✅ FORCE Updated ${vendorData.name} with certifications and payment history`);
        created++;
        continue;
      }

      // Create vendor with explicit id
      const { payments, invoices } = generatePaymentHistory(vendorId, vendorData.performance.totalOrders);
      
      const vendor: Vendor = {
        id: vendorId,
        ...vendorData,
        onboardingDate: new Date('2020-01-01'), // Consistent date for testing
        lastActive: new Date(),
        paymentHistory: payments,
        invoiceHistory: invoices
      };

      // We can't use createVendor because it expects Omit<Vendor, 'id'|'onboardingDate'|'lastActive'>
      // Instead, we'll use the raw container insert
      const container = (cosmosDb as any)['vendorsContainer'];
      
      if (!container) {
        throw new Error('Vendors container not initialized');
      }

      await container.items.create(vendor);
      logger.info(`✅ Created ${vendorData.name} (${vendorId})`);
      created++;

    } catch (error: any) {
      logger.error(`❌ Failed to create ${vendorData.name}:`, error instanceof Error ? error.message : String(error));
    }
  }

  logger.info('📊 Seeding Summary:');
  logger.info(`   Created: ${created}`);
  logger.info(`   Skipped: ${skipped}`);
  logger.info(`   Total:   ${vendors.length}`);
}

// Run
seedVendors()
  .then(() => {
    logger.info('✅ Vendor seeding complete!');
    process.exit(0);
  })
  .catch((error) => {
    logger.error('❌ Vendor seeding failed:', error);
    process.exit(1);
  });
