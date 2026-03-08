/**
 * Seed Module: Vendors + Appraisers
 *
 * Seeds 5 vendor companies + 3 appraisers into the `vendors` container.
 * Vendors cover TX, CA, FL markets with varied performance profiles.
 * Container: vendors (partition /tenantId)
 */

import type { SeedModule, SeedModuleResult, SeedContext } from '../seed-types.js';
import { upsert, cleanContainer, daysAgo, daysFromNow } from '../seed-types.js';
import { VENDOR_IDS, APPRAISER_IDS } from '../seed-ids.js';

const CONTAINER = 'vendors';

function buildVendors(tenantId: string): Record<string, unknown>[] {
  return [
    {
      id: VENDOR_IDS.PREMIER, type: 'vendor', tenantId,
      businessName: 'Premier Appraisal Group', contactName: 'John Smith',
      email: 'john@premierappraisal.com', phone: '+1-214-555-1001',
      status: 'ACTIVE', vendorType: 'AMC',
      specialties: ['FULL_APPRAISAL', 'DRIVE_BY', 'DESK_REVIEW'],
      serviceAreas: [{ state: 'TX', counties: ['Dallas', 'Collin', 'Denton', 'Tarrant'], zipCodes: [] }],
      rating: 4.8, averageQCScore: 91, onTimeDeliveryRate: 0.94, revisionRate: 0.06, performanceScore: 88,
      totalOrdersCompleted: 247, currentActiveOrders: 8, maxActiveOrders: 20, isBusy: false,
      standardFee: 500, rushFee: 700, averageTurnaroundDays: 5.2,
      certificationTypes: ['SRA', 'AI-RRS'], licenseExpiration: daysFromNow(300),
      createdAt: daysAgo(540), updatedAt: daysAgo(1),
    },
    {
      id: VENDOR_IDS.ROCKY_MOUNTAIN, type: 'vendor', tenantId,
      businessName: 'Rocky Mountain Valuations', contactName: 'Maria Garcia',
      email: 'maria@rmvaluations.com', phone: '+1-303-555-2002',
      status: 'ACTIVE', vendorType: 'INDEPENDENT',
      specialties: ['FULL_APPRAISAL', 'FIELD_REVIEW'],
      serviceAreas: [{ state: 'TX', counties: ['Dallas', 'Tarrant', 'Parker'], zipCodes: [] }],
      rating: 4.9, averageQCScore: 94, onTimeDeliveryRate: 0.97, revisionRate: 0.03, performanceScore: 95,
      totalOrdersCompleted: 312, currentActiveOrders: 5, maxActiveOrders: 15, isBusy: false,
      standardFee: 525, rushFee: 725, averageTurnaroundDays: 4.8,
      certificationTypes: ['MAI', 'SRA'], licenseExpiration: daysFromNow(180),
      createdAt: daysAgo(600), updatedAt: daysAgo(3),
    },
    {
      id: VENDOR_IDS.TX_PROPERTY, type: 'vendor', tenantId,
      businessName: 'Texas Property Experts LLC', contactName: 'David Johnson',
      email: 'david@txproperty.com', phone: '+1-972-555-3003',
      status: 'ACTIVE', vendorType: 'AMC',
      specialties: ['FULL_APPRAISAL', 'DRIVE_BY', 'EXTERIOR_ONLY'],
      serviceAreas: [{ state: 'TX', counties: ['Dallas', 'Collin', 'Rockwall', 'Hunt'], zipCodes: [] }],
      rating: 4.6, averageQCScore: 87, onTimeDeliveryRate: 0.89, revisionRate: 0.09, performanceScore: 82,
      totalOrdersCompleted: 158, currentActiveOrders: 12, maxActiveOrders: 18, isBusy: false,
      standardFee: 480, rushFee: 660, averageTurnaroundDays: 6.1,
      certificationTypes: ['SRA'], licenseExpiration: daysFromNow(240),
      createdAt: daysAgo(400), updatedAt: daysAgo(2),
    },
    {
      id: VENDOR_IDS.METROPLEX, type: 'vendor', tenantId,
      businessName: 'Metroplex Appraisal Services', contactName: 'Carla Washington',
      email: 'cwashington@metroplex-appraisal.com', phone: '+1-817-555-4004',
      status: 'ACTIVE', vendorType: 'INDEPENDENT',
      specialties: ['FULL_APPRAISAL', 'BPO'],
      serviceAreas: [{ state: 'TX', counties: ['Tarrant', 'Dallas', 'Wise', 'Hood'], zipCodes: [] }],
      rating: 4.7, averageQCScore: 90, onTimeDeliveryRate: 0.92, revisionRate: 0.07, performanceScore: 86,
      totalOrdersCompleted: 203, currentActiveOrders: 4, maxActiveOrders: 12, isBusy: false,
      standardFee: 510, rushFee: 710, averageTurnaroundDays: 5.5,
      certificationTypes: ['AI-RRS', 'SRA'], licenseExpiration: daysFromNow(365),
      createdAt: daysAgo(480), updatedAt: daysAgo(4),
    },
    {
      id: VENDOR_IDS.NVN, type: 'vendor', tenantId,
      businessName: 'National Valuation Network', contactName: 'Robert Chen',
      email: 'rchen@nvn.com', phone: '+1-469-555-5005',
      status: 'ACTIVE', vendorType: 'AMC',
      specialties: ['FULL_APPRAISAL', 'DRIVE_BY', 'DESK_REVIEW', 'FIELD_REVIEW'],
      serviceAreas: [{ state: 'TX', counties: ['Dallas', 'Collin', 'Denton', 'Tarrant', 'Rockwall', 'Kaufman'], zipCodes: [] }],
      rating: 4.5, averageQCScore: 85, onTimeDeliveryRate: 0.88, revisionRate: 0.11, performanceScore: 79,
      totalOrdersCompleted: 520, currentActiveOrders: 18, maxActiveOrders: 25, isBusy: false,
      standardFee: 465, rushFee: 645, averageTurnaroundDays: 6.8,
      certificationTypes: ['SRA'], licenseExpiration: daysFromNow(400),
      createdAt: daysAgo(720), updatedAt: daysAgo(1),
    },
  ];
}

function buildAppraisers(tenantId: string): Record<string, unknown>[] {
  return [
    {
      id: APPRAISER_IDS.MICHAEL_THOMPSON, type: 'appraiser', tenantId, licenseState: 'TX',
      firstName: 'Michael', lastName: 'Thompson',
      email: 'mthompson@premierappraisal.com', phone: '+1-214-555-9001',
      employmentStatus: 'staff', status: 'active', availability: 'available',
      specialties: ['RESIDENTIAL', 'CONDO', 'TOWNHOME'], rating: 4.9,
      completedAppraisals: 186, qcPassRate: 0.96, currentWorkload: 3, maxCapacity: 10,
      averageTurnaroundTime: '4.5 days', yearsOfExperience: 14,
      licenses: [{
        id: 'lic-tx-mthompson', type: 'certified_residential', state: 'TX',
        licenseNumber: 'TX-CR-1234567', issuedDate: daysAgo(1825),
        expirationDate: daysFromNow(547), status: 'active',
      }],
      serviceArea: {
        states: ['TX'], counties: ['Dallas', 'Collin', 'Rockwall'],
        radiusMiles: 40, homeBase: { lat: 32.7767, lng: -96.7970 },
      },
      conflictProperties: [],
      createdAt: daysAgo(365), updatedAt: daysAgo(1),
    },
    {
      id: APPRAISER_IDS.PATRICIA_NGUYEN, type: 'appraiser', tenantId, licenseState: 'TX',
      firstName: 'Patricia', lastName: 'Nguyen',
      email: 'pnguyen@rmvaluations.com', phone: '+1-972-555-9002',
      employmentStatus: 'contract', status: 'active', availability: 'available',
      specialties: ['RESIDENTIAL', 'MULTI_FAMILY'], rating: 4.7,
      completedAppraisals: 241, qcPassRate: 0.94, currentWorkload: 5, maxCapacity: 12,
      averageTurnaroundTime: '5.1 days', yearsOfExperience: 18,
      licenses: [{
        id: 'lic-tx-pnguyen', type: 'certified_general', state: 'TX',
        licenseNumber: 'TX-CG-7654321', issuedDate: daysAgo(2190),
        expirationDate: daysFromNow(365), status: 'active',
      }],
      serviceArea: {
        states: ['TX'], counties: ['Tarrant', 'Dallas', 'Denton'],
        radiusMiles: 45, homeBase: { lat: 32.7555, lng: -97.3308 },
      },
      conflictProperties: [],
      createdAt: daysAgo(500), updatedAt: daysAgo(2),
    },
    {
      id: APPRAISER_IDS.KEVIN_OKAFOR, type: 'appraiser', tenantId, licenseState: 'TX',
      firstName: 'Kevin', lastName: 'Okafor',
      email: 'kokafor@txproperty.com', phone: '+1-469-555-9003',
      employmentStatus: 'freelance', status: 'active', availability: 'busy',
      specialties: ['RESIDENTIAL', 'LAND'], rating: 4.5,
      completedAppraisals: 97, qcPassRate: 0.91, currentWorkload: 8, maxCapacity: 9,
      averageTurnaroundTime: '6.2 days', yearsOfExperience: 7,
      licenses: [{
        id: 'lic-tx-kokafor', type: 'certified_residential', state: 'TX',
        licenseNumber: 'TX-CR-9988776', issuedDate: daysAgo(730),
        expirationDate: daysFromNow(200), status: 'active',
      }],
      serviceArea: {
        states: ['TX'], counties: ['Dallas', 'Collin', 'Kaufman'],
        radiusMiles: 35, homeBase: { lat: 32.9186, lng: -96.6376 },
      },
      conflictProperties: [],
      createdAt: daysAgo(200), updatedAt: daysAgo(3),
    },
  ];
}

export const module: SeedModule = {
  name: 'vendors',
  containers: [CONTAINER],

  async run(ctx: SeedContext): Promise<SeedModuleResult> {
    const result: SeedModuleResult = { created: 0, failed: 0, skipped: 0, cleaned: 0 };

    if (ctx.clean) {
      result.cleaned = await cleanContainer(ctx, CONTAINER);
    }

    for (const vendor of buildVendors(ctx.tenantId)) {
      await upsert(ctx, CONTAINER, vendor, result);
    }
    for (const appraiser of buildAppraisers(ctx.tenantId)) {
      await upsert(ctx, CONTAINER, appraiser, result);
    }

    return result;
  },
};
