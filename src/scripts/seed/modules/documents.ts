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
