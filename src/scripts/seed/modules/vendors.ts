/**
 * Seed Module: Vendors + Appraisers
 *
 * Seeds vendor companies + appraisers into the `vendors` container.
 * Includes 5 TX-focused vendors, 8 multi-state vendors (CA, TX, FL),
 * 3 TX-focused appraisers, and 6 multi-state appraisers.
 * Container: vendors (partition /tenantId)
 */

import type { SeedModule, SeedModuleResult, SeedContext } from '../seed-types.js';
import { upsert, cleanContainer, daysAgo, daysFromNow } from '../seed-types.js';
import { VENDOR_IDS, APPRAISER_IDS, INTERNAL_STAFF_IDS } from '../seed-ids.js';

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

// ─── Multi-state vendors (CA, TX extended, FL) from standalone seed-vendors ───

function buildMultiStateVendors(tenantId: string): Record<string, unknown>[] {
  return [
    {
      id: VENDOR_IDS.JAMES_WILLIAMS_CA, type: 'vendor', tenantId,
      businessName: 'Elite Appraisal Services', contactName: 'James Williams',
      email: 'james.williams@eliteappraisal.com', phone: '(555) 111-2222',
      status: 'ACTIVE', vendorType: 'AMC',
      licenseNumber: 'CA-APR-12345', licenseState: 'CA', licenseExpiration: daysFromNow(600),
      certificationTypes: ['SRA', 'MAI'],
      specialties: ['FULL_APPRAISAL', 'BPO', 'DESK_REVIEW'],
      serviceAreas: [{ state: 'CA', counties: ['Los Angeles', 'Orange', 'Ventura', 'San Bernardino'], zipCodes: ['90001', '90002', '90003', '90004', '90005'], maxDistance: 60, travelFee: 75 }],
      rating: 4.6, averageQCScore: 87, onTimeDeliveryRate: 0.942, revisionRate: 0.038, performanceScore: 86,
      totalOrdersCompleted: 1235, currentActiveOrders: 6, maxActiveOrders: 15, isBusy: false,
      standardFee: 550, rushFee: 750, averageTurnaroundDays: 4.0,
      insuranceInfo: { provider: 'LIA Administrators', policyNumber: 'EO-2024-45678', coverage: 2_000_000, expiryDate: daysFromNow(300), status: 'active' },
      createdAt: daysAgo(1500), updatedAt: daysAgo(1),
    },
    {
      id: VENDOR_IDS.MARIA_RODRIGUEZ_CA, type: 'vendor', tenantId,
      businessName: 'Precision Valuation Group', contactName: 'Maria Rodriguez',
      email: 'maria.rodriguez@precisionvaluation.com', phone: '(555) 222-3333',
      status: 'ACTIVE', vendorType: 'INDEPENDENT',
      licenseNumber: 'CA-APR-23456', licenseState: 'CA', licenseExpiration: daysFromNow(400),
      certificationTypes: ['SRA'],
      specialties: ['FULL_APPRAISAL', 'BPO', 'HYBRID'],
      serviceAreas: [{ state: 'CA', counties: ['San Diego', 'Imperial', 'Riverside'], maxDistance: 50, travelFee: 50 }],
      rating: 4.8, averageQCScore: 93, onTimeDeliveryRate: 0.978, revisionRate: 0.021, performanceScore: 94,
      totalOrdersCompleted: 889, currentActiveOrders: 4, maxActiveOrders: 12, isBusy: false,
      standardFee: 525, rushFee: 725, averageTurnaroundDays: 3.0,
      insuranceInfo: { provider: 'CRES Insurance', policyNumber: 'EO-2024-67890', coverage: 2_000_000, expiryDate: daysFromNow(450), status: 'active' },
      createdAt: daysAgo(1400), updatedAt: daysAgo(2),
    },
    {
      id: VENDOR_IDS.DAVID_CHEN_CA, type: 'vendor', tenantId,
      businessName: 'Coastal Appraisal Group', contactName: 'David Chen',
      email: 'david.chen@coastalappraisal.com', phone: '(555) 333-4444',
      status: 'ACTIVE', vendorType: 'INDEPENDENT',
      licenseNumber: 'CA-APR-34567', licenseState: 'CA', licenseExpiration: daysFromNow(700),
      certificationTypes: ['SRA', 'AI-GRS'],
      specialties: ['FULL_APPRAISAL', 'DESK_REVIEW', 'AVM'],
      serviceAreas: [{ state: 'CA', counties: ['Santa Barbara', 'San Luis Obispo', 'Monterey'], maxDistance: 75, travelFee: 100 }],
      rating: 4.5, averageQCScore: 85, onTimeDeliveryRate: 0.915, revisionRate: 0.042, performanceScore: 81,
      totalOrdersCompleted: 561, currentActiveOrders: 3, maxActiveOrders: 10, isBusy: false,
      standardFee: 575, rushFee: 775, averageTurnaroundDays: 3.5,
      insuranceInfo: { provider: 'LIA Administrators', policyNumber: 'EO-2024-11111', coverage: 1_500_000, expiryDate: daysFromNow(600), status: 'active' },
      createdAt: daysAgo(1100), updatedAt: daysAgo(1),
    },
    {
      id: VENDOR_IDS.SARAH_THOMPSON_CA, type: 'vendor', tenantId,
      businessName: 'West Coast Appraisals Inc.', contactName: 'Sarah Thompson',
      email: 'sarah.thompson@westcoastappraisals.com', phone: '(555) 444-5555',
      status: 'ACTIVE', vendorType: 'INDEPENDENT',
      licenseNumber: 'CA-APR-45678', licenseState: 'CA', licenseExpiration: daysFromNow(800),
      certificationTypes: ['Certified Residential'],
      specialties: ['FULL_APPRAISAL', 'BPO'],
      serviceAreas: [{ state: 'CA', counties: ['Sacramento', 'Placer', 'El Dorado', 'Yolo'], maxDistance: 45, travelFee: 60 }],
      rating: 4.9, averageQCScore: 96, onTimeDeliveryRate: 0.985, revisionRate: 0.018, performanceScore: 97,
      totalOrdersCompleted: 410, currentActiveOrders: 5, maxActiveOrders: 15, isBusy: false,
      standardFee: 490, rushFee: 690, averageTurnaroundDays: 2.5,
      insuranceInfo: { provider: 'CRES Insurance', policyNumber: 'EO-2024-22222', coverage: 1_000_000, expiryDate: daysFromNow(200), status: 'active' },
      createdAt: daysAgo(1000), updatedAt: daysAgo(3),
    },
    {
      id: VENDOR_IDS.ROBERT_MARTINEZ_CA, type: 'vendor', tenantId,
      businessName: 'Bay Area Appraisals LLC', contactName: 'Robert Martinez',
      email: 'robert.martinez@bayareaappraisals.com', phone: '(555) 555-6666',
      status: 'ACTIVE', vendorType: 'AMC',
      licenseNumber: 'CA-APR-56789', licenseState: 'CA', licenseExpiration: daysFromNow(350),
      certificationTypes: ['SRA', 'MAI'],
      specialties: ['FULL_APPRAISAL', 'DESK_REVIEW', 'HYBRID'],
      serviceAreas: [{ state: 'CA', counties: ['San Francisco', 'San Mateo', 'Alameda', 'Contra Costa', 'Santa Clara'], maxDistance: 40, travelFee: 100 }],
      rating: 4.4, averageQCScore: 83, onTimeDeliveryRate: 0.893, revisionRate: 0.051, performanceScore: 78,
      totalOrdersCompleted: 1875, currentActiveOrders: 10, maxActiveOrders: 20, isBusy: false,
      standardFee: 600, rushFee: 850, averageTurnaroundDays: 4.5,
      insuranceInfo: { provider: 'LIA Administrators', policyNumber: 'EO-2024-33333', coverage: 3_000_000, expiryDate: daysFromNow(400), status: 'active' },
      createdAt: daysAgo(1800), updatedAt: daysAgo(1),
    },
    {
      id: VENDOR_IDS.JENNIFER_LEE_TX, type: 'vendor', tenantId,
      businessName: 'Premier Appraisals Houston', contactName: 'Jennifer Lee',
      email: 'jennifer.lee@premierappraisals.com', phone: '(555) 666-7777',
      status: 'ACTIVE', vendorType: 'INDEPENDENT',
      licenseNumber: 'TX-APR-11111', licenseState: 'TX', licenseExpiration: daysFromNow(500),
      certificationTypes: ['SRA'],
      specialties: ['FULL_APPRAISAL', 'BPO', 'DESK_REVIEW'],
      serviceAreas: [{ state: 'TX', counties: ['Harris', 'Fort Bend', 'Montgomery', 'Brazoria', 'Galveston'], maxDistance: 55, travelFee: 50 }],
      rating: 4.7, averageQCScore: 90, onTimeDeliveryRate: 0.962, revisionRate: 0.025, performanceScore: 91,
      totalOrdersCompleted: 750, currentActiveOrders: 4, maxActiveOrders: 12, isBusy: false,
      standardFee: 475, rushFee: 675, averageTurnaroundDays: 3.0,
      insuranceInfo: { provider: 'CRES Insurance', policyNumber: 'EO-2024-44444', coverage: 2_000_000, expiryDate: daysFromNow(350), status: 'active' },
      createdAt: daysAgo(1600), updatedAt: daysAgo(2),
    },
    {
      id: VENDOR_IDS.MICHAEL_JOHNSON_TX, type: 'vendor', tenantId,
      businessName: 'Texas Valuations Group', contactName: 'Michael Johnson',
      email: 'michael.johnson@texasvaluations.com', phone: '(555) 777-8888',
      status: 'ACTIVE', vendorType: 'AMC',
      licenseNumber: 'TX-APR-22222', licenseState: 'TX', licenseExpiration: daysFromNow(650),
      certificationTypes: ['Certified General', 'MAI'],
      specialties: ['FULL_APPRAISAL', 'DESK_REVIEW', 'AVM'],
      serviceAreas: [{ state: 'TX', counties: ['Dallas', 'Tarrant', 'Collin', 'Denton', 'Rockwall'], maxDistance: 60, travelFee: 75 }],
      rating: 4.6, averageQCScore: 88, onTimeDeliveryRate: 0.938, revisionRate: 0.032, performanceScore: 87,
      totalOrdersCompleted: 1110, currentActiveOrders: 7, maxActiveOrders: 15, isBusy: false,
      standardFee: 530, rushFee: 730, averageTurnaroundDays: 4.0,
      insuranceInfo: { provider: 'LIA Administrators', policyNumber: 'EO-2024-55555', coverage: 2_500_000, expiryDate: daysFromNow(500), status: 'active' },
      createdAt: daysAgo(1700), updatedAt: daysAgo(1),
    },
    {
      id: VENDOR_IDS.AMANDA_WILSON_FL, type: 'vendor', tenantId,
      businessName: 'Sunshine Appraisals LLC', contactName: 'Amanda Wilson',
      email: 'amanda.wilson@sunshineappraisals.com', phone: '(555) 888-9999',
      status: 'ACTIVE', vendorType: 'INDEPENDENT',
      licenseNumber: 'FL-APR-33333', licenseState: 'FL', licenseExpiration: daysFromNow(250),
      certificationTypes: ['Certified Residential'],
      specialties: ['FULL_APPRAISAL', 'BPO', 'HYBRID'],
      serviceAreas: [{ state: 'FL', counties: ['Miami-Dade', 'Broward', 'Palm Beach'], maxDistance: 50, travelFee: 60 }],
      rating: 4.5, averageQCScore: 86, onTimeDeliveryRate: 0.921, revisionRate: 0.035, performanceScore: 84,
      totalOrdersCompleted: 618, currentActiveOrders: 4, maxActiveOrders: 12, isBusy: false,
      standardFee: 500, rushFee: 700, averageTurnaroundDays: 3.5,
      insuranceInfo: { provider: 'CRES Insurance', policyNumber: 'EO-2024-66666', coverage: 1_500_000, expiryDate: daysFromNow(200), status: 'active' },
      createdAt: daysAgo(1200), updatedAt: daysAgo(2),
    },
  ];
}

// ─── Multi-state appraisers (CA, TX, FL) from standalone seed-vendors ─────────

function buildMultiStateAppraisers(tenantId: string): Record<string, unknown>[] {
  return [
    {
      id: APPRAISER_IDS.ANGELA_REEVES_CA, type: 'appraiser', tenantId, licenseState: 'CA',
      firstName: 'Angela', lastName: 'Reeves',
      email: 'angela.reeves@appraisalpros.com', phone: '(555) 901-1001',
      employmentStatus: 'staff', status: 'active', availability: 'available',
      specialties: ['RESIDENTIAL', 'CONDO'], rating: 4.7,
      completedAppraisals: 845, qcPassRate: 0.962, currentWorkload: 3, maxCapacity: 6,
      averageTurnaroundTime: '3.5 days', yearsOfExperience: 12,
      licenses: [{ id: 'lic-ar-1', type: 'certified_residential', state: 'CA', licenseNumber: 'CA-CR-90001', issuedDate: daysAgo(2555), expirationDate: daysFromNow(365), status: 'active' }],
      certifications: [{ id: 'cert-ar-1', name: 'SRA', issuingOrganization: 'Appraisal Institute', certificationNumber: 'SRA-90001', issuedDate: daysAgo(2190), expirationDate: daysFromNow(500) }],
      serviceArea: { states: ['CA'], counties: ['Los Angeles', 'Orange'], cities: ['Los Angeles', 'Irvine', 'Anaheim'], zipcodes: ['90001', '90002', '92602', '92618'], radiusMiles: 50 },
      conflictProperties: [],
      createdAt: daysAgo(1600), updatedAt: daysAgo(1),
    },
    {
      id: APPRAISER_IDS.BRIAN_KOWALSKI_CA, type: 'appraiser', tenantId, licenseState: 'CA',
      firstName: 'Brian', lastName: 'Kowalski',
      email: 'brian.kowalski@preciseval.com', phone: '(555) 901-2002',
      employmentStatus: 'contract', status: 'active', availability: 'busy',
      specialties: ['COMMERCIAL', 'INDUSTRIAL', 'MULTI_FAMILY'], rating: 4.5,
      completedAppraisals: 1320, qcPassRate: 0.938, currentWorkload: 5, maxCapacity: 5,
      averageTurnaroundTime: '5 days', yearsOfExperience: 18,
      licenses: [{ id: 'lic-bk-1', type: 'certified_general', state: 'CA', licenseNumber: 'CA-CG-90002', issuedDate: daysAgo(3650), expirationDate: daysFromNow(580), status: 'active' }],
      certifications: [{ id: 'cert-bk-1', name: 'MAI', issuingOrganization: 'Appraisal Institute', certificationNumber: 'MAI-90002', issuedDate: daysAgo(2555), expirationDate: daysFromNow(900) }],
      serviceArea: { states: ['CA'], counties: ['San Francisco', 'San Mateo', 'Santa Clara'], cities: ['San Francisco', 'San Jose', 'Palo Alto'], zipcodes: ['94102', '94103', '95110'], radiusMiles: 40 },
      conflictProperties: [{ address: '123 Market St, San Francisco, CA 94102', reason: 'prior_appraisal', radiusMiles: 0.5, notes: 'Appraised within last 12 months', addedAt: daysAgo(30) }],
      createdAt: daysAgo(2000), updatedAt: daysAgo(1),
    },
    {
      id: APPRAISER_IDS.CARMEN_DELGADO_TX, type: 'appraiser', tenantId, licenseState: 'TX',
      firstName: 'Carmen', lastName: 'Delgado',
      email: 'carmen.delgado@texaspropertyexperts.com', phone: '(555) 901-3003',
      employmentStatus: 'freelance', status: 'active', availability: 'available',
      specialties: ['RESIDENTIAL', 'FHA', 'VA'], rating: 4.8,
      completedAppraisals: 567, qcPassRate: 0.975, currentWorkload: 2, maxCapacity: 7,
      averageTurnaroundTime: '2.5 days', yearsOfExperience: 9,
      licenses: [{ id: 'lic-cd-1', type: 'certified_residential', state: 'TX', licenseNumber: 'TX-CR-80001', issuedDate: daysAgo(2190), expirationDate: daysFromNow(365), status: 'active' }],
      certifications: [{ id: 'cert-cd-1', name: 'FHA Roster Appraiser', issuingOrganization: 'HUD', issuedDate: daysAgo(1825) }],
      serviceArea: { states: ['TX'], counties: ['Harris', 'Fort Bend', 'Montgomery'], cities: ['Houston', 'Sugar Land', 'The Woodlands'], zipcodes: ['77001', '77002', '77478', '77381'], radiusMiles: 55 },
      conflictProperties: [],
      createdAt: daysAgo(1200), updatedAt: daysAgo(2),
    },
    {
      id: APPRAISER_IDS.DANIEL_PARK_TX, type: 'appraiser', tenantId, licenseState: 'TX',
      firstName: 'Daniel', lastName: 'Park',
      email: 'daniel.park@dallasappraisals.com', phone: '(555) 901-4004',
      employmentStatus: 'contract', status: 'active', availability: 'available',
      specialties: ['COMMERCIAL', 'LUXURY', 'LAND'], rating: 4.6,
      completedAppraisals: 1050, qcPassRate: 0.941, currentWorkload: 4, maxCapacity: 6,
      averageTurnaroundTime: '4 days', yearsOfExperience: 16,
      licenses: [{ id: 'lic-dp-1', type: 'certified_general', state: 'TX', licenseNumber: 'TX-CG-80002', issuedDate: daysAgo(4000), expirationDate: daysFromNow(300), status: 'active' }],
      certifications: [
        { id: 'cert-dp-1', name: 'MAI', issuingOrganization: 'Appraisal Institute', certificationNumber: 'MAI-80002', issuedDate: daysAgo(3100), expirationDate: daysFromNow(500) },
        { id: 'cert-dp-2', name: 'AI-GRS', issuingOrganization: 'Appraisal Institute', certificationNumber: 'GRS-80002', issuedDate: daysAgo(1600), expirationDate: daysFromNow(1000) },
      ],
      serviceArea: { states: ['TX'], counties: ['Dallas', 'Tarrant', 'Collin', 'Denton'], cities: ['Dallas', 'Fort Worth', 'Plano', 'Frisco'], zipcodes: ['75201', '75202', '76102', '75024'], radiusMiles: 60 },
      conflictProperties: [],
      createdAt: daysAgo(1700), updatedAt: daysAgo(1),
    },
    {
      id: APPRAISER_IDS.ELENA_VASQUEZ_FL, type: 'appraiser', tenantId, licenseState: 'FL',
      firstName: 'Elena', lastName: 'Vasquez',
      email: 'elena.vasquez@floridacoastval.com', phone: '(555) 901-5005',
      employmentStatus: 'staff', status: 'active', availability: 'available',
      specialties: ['RESIDENTIAL', 'CONDO'], rating: 4.4,
      completedAppraisals: 312, qcPassRate: 0.918, currentWorkload: 1, maxCapacity: 5,
      averageTurnaroundTime: '3 days', yearsOfExperience: 7,
      licenses: [{ id: 'lic-ev-1', type: 'certified_residential', state: 'FL', licenseNumber: 'FL-CR-70001', issuedDate: daysAgo(1825), expirationDate: daysFromNow(180), status: 'active' }],
      certifications: [],
      serviceArea: { states: ['FL'], counties: ['Miami-Dade', 'Broward', 'Palm Beach'], cities: ['Miami', 'Fort Lauderdale', 'Boca Raton'], zipcodes: ['33101', '33301', '33431'], radiusMiles: 45 },
      conflictProperties: [],
      createdAt: daysAgo(800), updatedAt: daysAgo(3),
    },
    {
      id: APPRAISER_IDS.FRANK_MORRISON_CA, type: 'appraiser', tenantId, licenseState: 'CA',
      firstName: 'Frank', lastName: 'Morrison',
      email: 'frank.morrison@northerncalval.com', phone: '(555) 901-6006',
      employmentStatus: 'freelance', status: 'active', availability: 'available',
      specialties: ['RESIDENTIAL'], rating: 4.2,
      completedAppraisals: 145, qcPassRate: 0.895, currentWorkload: 2, maxCapacity: 8,
      averageTurnaroundTime: '2 days', yearsOfExperience: 4,
      licenses: [{ id: 'lic-fm-1', type: 'state_license', state: 'CA', licenseNumber: 'CA-SL-90003', issuedDate: daysAgo(1100), expirationDate: daysFromNow(250), status: 'active' }],
      certifications: [],
      serviceArea: { states: ['CA'], counties: ['Sacramento', 'Placer', 'El Dorado'], cities: ['Sacramento', 'Roseville', 'Folsom'], zipcodes: ['95814', '95661', '95630'], radiusMiles: 35 },
      conflictProperties: [],
      createdAt: daysAgo(500), updatedAt: daysAgo(2),
    },
  ];
}

// ── Phase 1.5.5 — Internal Staff (stored in vendors container, staffType='internal') ──
function buildInternalStaff(tenantId: string): Record<string, unknown>[] {
  return [
    {
      id: INTERNAL_STAFF_IDS.SARAH_CHEN_TX_APPRAISER,
      type: 'vendor', tenantId,
      businessName: 'Sarah Chen (Internal Appraiser)',
      contactName: 'Sarah Chen',
      email: 'sarah.chen@internal.com',
      phone: '(555) 100-0001',
      status: 'ACTIVE',
      vendorType: 'INTERNAL',
      staffType: 'internal',
      staffRole: 'appraiser_internal',
      licenseNumber: 'TX-INT-APR-001',
      licenseState: 'TX',
      licenseExpiration: daysFromNow(730),
      certificationTypes: ['Certified Residential'],
      specialties: ['FULL_APPRAISAL', 'DESK_REVIEW', 'HYBRID'],
      serviceAreas: [{ state: 'TX', counties: ['Dallas', 'Tarrant', 'Collin', 'Denton'], maxDistance: 50, travelFee: 0 }],
      rating: 4.8, averageQCScore: 94, onTimeDeliveryRate: 0.97, revisionRate: 0.02, performanceScore: 95,
      totalOrdersCompleted: 340, currentActiveOrders: 2, maxActiveOrders: 8,
      activeOrderCount: 2, maxConcurrentOrders: 8, isBusy: false,
      standardFee: 0, rushFee: 0, averageTurnaroundDays: 3.0,
      workSchedule: [
        { dayOfWeek: 1, startTime: '08:00', endTime: '17:00' },
        { dayOfWeek: 2, startTime: '08:00', endTime: '17:00' },
        { dayOfWeek: 3, startTime: '08:00', endTime: '17:00' },
        { dayOfWeek: 4, startTime: '08:00', endTime: '17:00' },
        { dayOfWeek: 5, startTime: '08:00', endTime: '17:00' },
      ],
      timezone: 'America/Chicago',
      createdAt: daysAgo(900), updatedAt: daysAgo(1),
    },
    {
      id: INTERNAL_STAFF_IDS.JAMES_OKONKWO_TX_REVIEWER,
      type: 'vendor', tenantId,
      businessName: 'James Okonkwo (Internal Reviewer)',
      contactName: 'James Okonkwo',
      email: 'james.okonkwo@internal.com',
      phone: '(555) 100-0002',
      status: 'ACTIVE',
      vendorType: 'INTERNAL',
      staffType: 'internal',
      staffRole: 'reviewer',
      licenseNumber: 'TX-INT-REV-001',
      licenseState: 'TX',
      licenseExpiration: daysFromNow(730),
      certificationTypes: ['MAI'],
      specialties: ['DESK_REVIEW', 'FIELD_REVIEW'],
      serviceAreas: [{ state: 'TX', counties: ['Dallas', 'Tarrant', 'Collin', 'Denton', 'Rockwall'], maxDistance: 60, travelFee: 0 }],
      rating: 4.9, averageQCScore: 97, onTimeDeliveryRate: 0.99, revisionRate: 0.01, performanceScore: 98,
      totalOrdersCompleted: 520, currentActiveOrders: 3, maxActiveOrders: 10,
      activeOrderCount: 3, maxConcurrentOrders: 10, isBusy: false,
      standardFee: 0, rushFee: 0, averageTurnaroundDays: 2.0,
      workSchedule: [
        { dayOfWeek: 1, startTime: '08:00', endTime: '17:00' },
        { dayOfWeek: 2, startTime: '08:00', endTime: '17:00' },
        { dayOfWeek: 3, startTime: '08:00', endTime: '17:00' },
        { dayOfWeek: 4, startTime: '08:00', endTime: '17:00' },
        { dayOfWeek: 5, startTime: '08:00', endTime: '17:00' },
      ],
      timezone: 'America/Chicago',
      createdAt: daysAgo(1100), updatedAt: daysAgo(1),
    },
    {
      id: INTERNAL_STAFF_IDS.DIANA_MORALES_TX_SUPERVISOR,
      type: 'vendor', tenantId,
      businessName: 'Diana Morales (Internal Supervisor)',
      contactName: 'Diana Morales',
      email: 'diana.morales@internal.com',
      phone: '(555) 100-0003',
      status: 'ACTIVE',
      vendorType: 'INTERNAL',
      staffType: 'internal',
      staffRole: 'supervisor',
      licenseNumber: 'TX-INT-SUP-001',
      licenseState: 'TX',
      licenseExpiration: daysFromNow(730),
      certificationTypes: ['SRA', 'MAI'],
      specialties: ['FULL_APPRAISAL', 'DESK_REVIEW', 'FIELD_REVIEW', 'SUPERVISORY'],
      serviceAreas: [{ state: 'TX', counties: ['Dallas', 'Tarrant', 'Collin', 'Denton', 'Rockwall', 'Ellis'], maxDistance: 65, travelFee: 0 }],
      rating: 5.0, averageQCScore: 99, onTimeDeliveryRate: 1.0, revisionRate: 0.005, performanceScore: 99,
      totalOrdersCompleted: 820, currentActiveOrders: 1, maxActiveOrders: 6,
      activeOrderCount: 1, maxConcurrentOrders: 6, isBusy: false,
      standardFee: 0, rushFee: 0, averageTurnaroundDays: 2.5,
      workSchedule: [
        { dayOfWeek: 1, startTime: '08:00', endTime: '18:00' },
        { dayOfWeek: 2, startTime: '08:00', endTime: '18:00' },
        { dayOfWeek: 3, startTime: '08:00', endTime: '18:00' },
        { dayOfWeek: 4, startTime: '08:00', endTime: '18:00' },
        { dayOfWeek: 5, startTime: '08:00', endTime: '18:00' },
      ],
      timezone: 'America/Chicago',
      createdAt: daysAgo(1200), updatedAt: daysAgo(1),
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
    for (const vendor of buildMultiStateVendors(ctx.tenantId)) {
      await upsert(ctx, CONTAINER, vendor, result);
    }
    for (const appraiser of buildAppraisers(ctx.tenantId)) {
      await upsert(ctx, CONTAINER, appraiser, result);
    }
    for (const appraiser of buildMultiStateAppraisers(ctx.tenantId)) {
      await upsert(ctx, CONTAINER, appraiser, result);
    }
    for (const staff of buildInternalStaff(ctx.tenantId)) {
      await upsert(ctx, CONTAINER, staff, result);
    }

    return result;
  },
};
