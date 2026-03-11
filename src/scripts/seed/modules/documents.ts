/**
 * Seed Module: Documents
 *
 * Seeds document metadata records linked to orders. These represent
 * appraisal reports, engagement letters, and photo sets.
 * Container: documents (partition /tenantId)
 */

import type { SeedModule, SeedModuleResult, SeedContext } from '../seed-types.js';
import { upsert, cleanContainer, daysAgo } from '../seed-types.js';
import { DOCUMENT_IDS, ORDER_IDS, ORDER_NUMBERS, VENDOR_IDS, APPRAISER_IDS } from '../seed-ids.js';

const CONTAINER = 'documents';

function buildDocuments(tenantId: string): Record<string, unknown>[] {
  return [
    {
      id: DOCUMENT_IDS.REPORT_ORDER_001, tenantId, type: 'document',
      orderId: ORDER_IDS.COMPLETED_001,
      orderNumber: ORDER_NUMBERS[ORDER_IDS.COMPLETED_001],
      documentType: 'APPRAISAL_REPORT',
      fileName: 'SEED-2026-00101_Full_1004_Report.pdf',
      mimeType: 'application/pdf', fileSize: 2_450_000,
      blobPath: `${tenantId}/${ORDER_IDS.COMPLETED_001}/SEED-2026-00101_Full_1004_Report.pdf`,
      uploadedBy: APPRAISER_IDS.MICHAEL_THOMPSON,
      uploadedAt: daysAgo(18),
      status: 'FINAL',
      version: 1,
      metadata: {
        formType: '1004', pageCount: 28,
        appraisedValue: 425000, effectiveDate: daysAgo(22),
      },
      createdAt: daysAgo(18), updatedAt: daysAgo(10),
    },
    {
      id: DOCUMENT_IDS.ENGAGEMENT_ORDER_001, tenantId, type: 'document',
      orderId: ORDER_IDS.COMPLETED_001,
      orderNumber: ORDER_NUMBERS[ORDER_IDS.COMPLETED_001],
      documentType: 'ENGAGEMENT_LETTER',
      fileName: 'SEED-2026-00101_Engagement_Letter.pdf',
      mimeType: 'application/pdf', fileSize: 185_000,
      blobPath: `${tenantId}/${ORDER_IDS.COMPLETED_001}/SEED-2026-00101_Engagement_Letter.pdf`,
      uploadedBy: 'system',
      uploadedAt: daysAgo(30),
      status: 'FINAL',
      version: 1,
      createdAt: daysAgo(30), updatedAt: daysAgo(30),
    },
    {
      id: DOCUMENT_IDS.PHOTOS_ORDER_003, tenantId, type: 'document',
      orderId: ORDER_IDS.IN_PROGRESS_003,
      orderNumber: ORDER_NUMBERS[ORDER_IDS.IN_PROGRESS_003],
      documentType: 'PROPERTY_PHOTOS',
      fileName: 'SEED-2026-00103_Inspection_Photos.zip',
      mimeType: 'application/zip', fileSize: 15_200_000,
      blobPath: `${tenantId}/${ORDER_IDS.IN_PROGRESS_003}/SEED-2026-00103_Inspection_Photos.zip`,
      uploadedBy: APPRAISER_IDS.KEVIN_OKAFOR,
      uploadedAt: daysAgo(3),
      status: 'DRAFT',
      version: 1,
      metadata: {
        photoCount: 42, includesInterior: true, includesExterior: true,
      },
      createdAt: daysAgo(3), updatedAt: daysAgo(3),
    },
    {
      id: DOCUMENT_IDS.REPORT_ORDER_009, tenantId, type: 'document',
      orderId: ORDER_IDS.SUBMITTED_009,
      orderNumber: ORDER_NUMBERS[ORDER_IDS.SUBMITTED_009],
      documentType: 'APPRAISAL_REPORT',
      fileName: 'SEED-2026-00109_MultiFam_1025_Report.pdf',
      mimeType: 'application/pdf', fileSize: 3_800_000,
      blobPath: `${tenantId}/${ORDER_IDS.SUBMITTED_009}/SEED-2026-00109_MultiFam_1025_Report.pdf`,
      uploadedBy: APPRAISER_IDS.PATRICIA_NGUYEN,
      uploadedAt: daysAgo(2),
      status: 'SUBMITTED',
      version: 1,
      metadata: {
        formType: '1025', pageCount: 35,
        appraisedValue: 720000, effectiveDate: daysAgo(6),
      },
      createdAt: daysAgo(2), updatedAt: daysAgo(2),
    },
    {
      id: DOCUMENT_IDS.REPORT_ORDER_012, tenantId, type: 'document',
      orderId: ORDER_IDS.COMPLETED_DRIVEBY_012,
      orderNumber: ORDER_NUMBERS[ORDER_IDS.COMPLETED_DRIVEBY_012],
      documentType: 'APPRAISAL_REPORT',
      fileName: 'SEED-2026-00112_DriveBy_2055_Report.pdf',
      mimeType: 'application/pdf', fileSize: 1_100_000,
      blobPath: `${tenantId}/${ORDER_IDS.COMPLETED_DRIVEBY_012}/SEED-2026-00112_DriveBy_2055_Report.pdf`,
      uploadedBy: APPRAISER_IDS.MICHAEL_THOMPSON,
      uploadedAt: daysAgo(19),
      status: 'FINAL',
      version: 1,
      metadata: {
        formType: '2055', pageCount: 12,
        appraisedValue: 195000, effectiveDate: daysAgo(21),
      },
      createdAt: daysAgo(19), updatedAt: daysAgo(15),
    },
    // Vendor-scoped documents
    {
      id: DOCUMENT_IDS.VENDOR_LICENSE, tenantId, type: 'document',
      vendorId: VENDOR_IDS.PREMIER,
      documentType: 'BUSINESS_LICENSE',
      fileName: 'Premier_Appraisal_Business_License_2025.pdf',
      mimeType: 'application/pdf', fileSize: 450_000,
      blobPath: `${tenantId}/vendors/${VENDOR_IDS.PREMIER}/Premier_Appraisal_Business_License_2025.pdf`,
      uploadedBy: VENDOR_IDS.PREMIER,
      uploadedAt: daysAgo(90),
      status: 'VERIFIED',
      version: 1,
      metadata: {
        licenseNumber: 'TX-AMC-2019-0042', issuingAuthority: 'Texas Appraiser Licensing & Certification Board',
        expirationDate: daysAgo(-365), verifiedAt: daysAgo(85), verifiedBy: 'system',
      },
      createdAt: daysAgo(90), updatedAt: daysAgo(85),
    },
    {
      id: DOCUMENT_IDS.VENDOR_INSURANCE, tenantId, type: 'document',
      vendorId: VENDOR_IDS.PREMIER,
      documentType: 'INSURANCE_CERTIFICATE',
      fileName: 'Premier_Appraisal_E_and_O_Certificate_2025.pdf',
      mimeType: 'application/pdf', fileSize: 380_000,
      blobPath: `${tenantId}/vendors/${VENDOR_IDS.PREMIER}/Premier_Appraisal_E_and_O_Certificate_2025.pdf`,
      uploadedBy: VENDOR_IDS.PREMIER,
      uploadedAt: daysAgo(60),
      status: 'VERIFIED',
      version: 1,
      metadata: {
        policyNumber: 'EO-2025-PRE-001', carrier: 'Appraisers Professional Liability Insurance',
        coverageAmount: 1_000_000, expirationDate: daysAgo(-300), verifiedAt: daysAgo(55),
      },
      createdAt: daysAgo(60), updatedAt: daysAgo(55),
    },
    {
      id: DOCUMENT_IDS.VENDOR_W9, tenantId, type: 'document',
      vendorId: VENDOR_IDS.PREMIER,
      documentType: 'W9_TAX_FORM',
      fileName: 'Premier_Appraisal_W9_2025.pdf',
      mimeType: 'application/pdf', fileSize: 220_000,
      blobPath: `${tenantId}/vendors/${VENDOR_IDS.PREMIER}/Premier_Appraisal_W9_2025.pdf`,
      uploadedBy: VENDOR_IDS.PREMIER,
      uploadedAt: daysAgo(90),
      status: 'RECEIVED',
      version: 1,
      metadata: { taxYear: 2025, einProvided: true },
      createdAt: daysAgo(90), updatedAt: daysAgo(90),
    },
    // Appraiser-scoped documents
    {
      id: DOCUMENT_IDS.APPRAISER_LICENSE, tenantId, type: 'document',
      appraiserId: APPRAISER_IDS.MICHAEL_THOMPSON,
      documentType: 'APPRAISER_LICENSE',
      fileName: 'Thompson_Michael_TX_Certified_General_License.pdf',
      mimeType: 'application/pdf', fileSize: 520_000,
      blobPath: `${tenantId}/appraisers/${APPRAISER_IDS.MICHAEL_THOMPSON}/Thompson_TX_License.pdf`,
      uploadedBy: APPRAISER_IDS.MICHAEL_THOMPSON,
      uploadedAt: daysAgo(120),
      status: 'VERIFIED',
      version: 1,
      metadata: {
        licenseNumber: 'TX-CG-2018-1234', licenseType: 'Certified General',
        issuingState: 'TX', expirationDate: daysAgo(-400),
        verifiedAt: daysAgo(115), verifiedBy: 'system', verificationSource: 'ASC National Registry',
      },
      createdAt: daysAgo(120), updatedAt: daysAgo(115),
    },
    {
      id: DOCUMENT_IDS.APPRAISER_COMPLIANCE, tenantId, type: 'document',
      appraiserId: APPRAISER_IDS.MICHAEL_THOMPSON,
      documentType: 'COMPLIANCE_CERTIFICATE',
      fileName: 'Thompson_Michael_USPAP_CE_2025.pdf',
      mimeType: 'application/pdf', fileSize: 310_000,
      blobPath: `${tenantId}/appraisers/${APPRAISER_IDS.MICHAEL_THOMPSON}/Thompson_USPAP_CE_2025.pdf`,
      uploadedBy: APPRAISER_IDS.MICHAEL_THOMPSON,
      uploadedAt: daysAgo(45),
      status: 'VERIFIED',
      version: 1,
      metadata: {
        certificationType: 'USPAP Continuing Education', completionDate: daysAgo(50),
        provider: 'Appraisal Institute', ceHours: 7,
        verifiedAt: daysAgo(40), verifiedBy: 'admin-user-001',
      },
      createdAt: daysAgo(45), updatedAt: daysAgo(40),
    },
  ];
}

export const module: SeedModule = {
  name: 'documents',
  containers: [CONTAINER],

  async run(ctx: SeedContext): Promise<SeedModuleResult> {
    const result: SeedModuleResult = { created: 0, failed: 0, skipped: 0, cleaned: 0 };

    if (ctx.clean) {
      result.cleaned = await cleanContainer(ctx, CONTAINER);
    }

    for (const doc of buildDocuments(ctx.tenantId)) {
      await upsert(ctx, CONTAINER, doc, result);
    }

    return result;
  },
};
