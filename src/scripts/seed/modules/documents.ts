/**
 * Seed Module: Documents
 *
 * Seeds document metadata records linked to orders. These represent
 * appraisal reports, engagement letters, and photo sets.
 * Container: documents (partition /tenantId)
 *
 * Also uploads stub PDF blobs for order report documents so the
 * PDF viewer works end-to-end in dev/staging environments.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { BlobServiceClient } from '@azure/storage-blob';
import { DefaultAzureCredential } from '@azure/identity';
import type { SeedModule, SeedModuleResult, SeedContext } from '../seed-types.js';
import { upsert, cleanContainer, daysAgo } from '../seed-types.js';
import { DOCUMENT_IDS, ORDER_IDS, ORDER_NUMBERS, VENDOR_IDS, APPRAISER_IDS, CLIENT_IDS, SUB_CLIENT_SLUGS } from '../seed-ids.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SAMPLES_DIR = join(__dirname, '../../../../docs/samples');

// Real sample PDFs — loaded once at module initialisation
const PDF_1004_SAMPLE = readFileSync(join(SAMPLES_DIR, '1004_Appraisal_Report_Sample.pdf'));
const PDF_17_DAVID_DR = readFileSync(join(SAMPLES_DIR, '17 David Dr.pdf'));

const CONTAINER = 'documents';

/**
 * Upload real sample PDF blobs for order report documents so the
 * PDF viewer works end-to-end in dev/staging environments.
 */
async function seedBlobs(ctx: SeedContext, tenantId: string): Promise<void> {
  if (!ctx.storageAccountName) {
    console.warn('\n  ⚠️  AZURE_STORAGE_ACCOUNT_NAME not set — skipping blob uploads');
    return;
  }

  const blobContainerName = process.env.STORAGE_CONTAINER_DOCUMENTS;
  if (!blobContainerName) {
    console.warn('\n  ⚠️  STORAGE_CONTAINER_DOCUMENTS not set — skipping blob uploads');
    return;
  }

  const credential = new DefaultAzureCredential();
  const blobServiceClient = new BlobServiceClient(
    `https://${ctx.storageAccountName}.blob.core.windows.net`,
    credential
  );
  const containerClient = blobServiceClient.getContainerClient(blobContainerName);

  // Each entry: the blob path in storage and which PDF buffer to upload.
  // PDF_17_DAVID_DR is the richer report used for the QC order (seed-order-003).
  const blobsToSeed: Array<{ blobName: string; label: string; content: Buffer }> = [
    {
      blobName: `${tenantId}/${ORDER_IDS.COMPLETED_001}/SEED-2026-00101_Full_1004_Report.pdf`,
      label: 'REPORT_ORDER_001',
      content: PDF_1004_SAMPLE,
    },
    {
      blobName: `${tenantId}/${ORDER_IDS.IN_PROGRESS_003}/SEED-2026-00103_Rush_1004_Report.pdf`,
      label: 'REPORT_ORDER_003',
      content: PDF_17_DAVID_DR,
    },
    {
      blobName: `${tenantId}/${ORDER_IDS.SUBMITTED_009}/SEED-2026-00109_MultiFam_1025_Report.pdf`,
      label: 'REPORT_ORDER_009',
      content: PDF_1004_SAMPLE,
    },
    {
      blobName: `${tenantId}/${ORDER_IDS.COMPLETED_DRIVEBY_012}/SEED-2026-00112_DriveBy_2055_Report.pdf`,
      label: 'REPORT_ORDER_012',
      content: PDF_1004_SAMPLE,
    },
  ];

  for (const { blobName, label, content } of blobsToSeed) {
    try {
      const blockBlobClient = containerClient.getBlockBlobClient(blobName);
      // Always overwrite — ensures real PDF replaces any previously uploaded stub
      await blockBlobClient.upload(content, content.length, {
        blobHTTPHeaders: { blobContentType: 'application/pdf' },
        metadata: { seedGenerated: 'true', label },
      });
      process.stdout.write('b');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`\n  ⚠️  Blob upload failed for ${label}: ${msg}`);
    }
  }
}

function buildDocuments(tenantId: string, clientId: string): Record<string, unknown>[] {
  return [
    {
      id: DOCUMENT_IDS.REPORT_ORDER_001, tenantId, type: 'document',
      clientId, subClientId: SUB_CLIENT_SLUGS[CLIENT_IDS.FIRST_HORIZON], clientRecordId: CLIENT_IDS.FIRST_HORIZON,
      orderId: ORDER_IDS.COMPLETED_001,
      orderNumber: ORDER_NUMBERS[ORDER_IDS.COMPLETED_001],
      category: 'appraisal-report',
      // documentType uses the Axiom document-type registry id so review-program
      // criteria can match this doc by its acceptableDocuments / oneOf list.
      // (See review-requirement-resolution.service.ts hasDocumentType().)
      documentType: 'uniform-residential-appraisal-report',
      name: 'SEED-2026-00101_Full_1004_Report.pdf',
      mimeType: 'application/pdf', fileSize: 2_450_000,
      blobName: `${tenantId}/${ORDER_IDS.COMPLETED_001}/SEED-2026-00101_Full_1004_Report.pdf`,
      blobUrl: '',
      isLatestVersion: true,
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
      clientId, subClientId: SUB_CLIENT_SLUGS[CLIENT_IDS.FIRST_HORIZON], clientRecordId: CLIENT_IDS.FIRST_HORIZON,
      orderId: ORDER_IDS.COMPLETED_001,
      orderNumber: ORDER_NUMBERS[ORDER_IDS.COMPLETED_001],
      category: 'engagement-letter',
      name: 'SEED-2026-00101_Engagement_Letter.pdf',
      mimeType: 'application/pdf', fileSize: 185_000,
      blobName: `${tenantId}/${ORDER_IDS.COMPLETED_001}/SEED-2026-00101_Engagement_Letter.pdf`,
      blobUrl: '',
      isLatestVersion: true,
      uploadedBy: 'system',
      uploadedAt: daysAgo(30),
      status: 'FINAL',
      version: 1,
      createdAt: daysAgo(30), updatedAt: daysAgo(30),
    },
    {
      id: DOCUMENT_IDS.PHOTOS_ORDER_003, tenantId, type: 'document',
      clientId, subClientId: SUB_CLIENT_SLUGS[CLIENT_IDS.PACIFIC_COAST], clientRecordId: CLIENT_IDS.PACIFIC_COAST,
      orderId: ORDER_IDS.IN_PROGRESS_003,
      orderNumber: ORDER_NUMBERS[ORDER_IDS.IN_PROGRESS_003],
      category: 'property-photos',
      name: 'SEED-2026-00103_Inspection_Photos.zip',
      mimeType: 'application/zip', fileSize: 15_200_000,
      blobName: `${tenantId}/${ORDER_IDS.IN_PROGRESS_003}/SEED-2026-00103_Inspection_Photos.zip`,
      blobUrl: '',
      isLatestVersion: true,
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
      id: DOCUMENT_IDS.REPORT_ORDER_003, tenantId, type: 'document',
      clientId, subClientId: SUB_CLIENT_SLUGS[CLIENT_IDS.PACIFIC_COAST], clientRecordId: CLIENT_IDS.PACIFIC_COAST,
      orderId: ORDER_IDS.IN_PROGRESS_003,
      orderNumber: ORDER_NUMBERS[ORDER_IDS.IN_PROGRESS_003],
      category: 'appraisal-report',
      // documentType uses the Axiom document-type registry id so review-program
      // criteria can match this doc by its acceptableDocuments / oneOf list.
      // (See review-requirement-resolution.service.ts hasDocumentType().)
      documentType: 'uniform-residential-appraisal-report',
      name: 'SEED-2026-00103_Rush_1004_Report.pdf',
      mimeType: 'application/pdf', fileSize: 2_180_000,
      blobName: `${tenantId}/${ORDER_IDS.IN_PROGRESS_003}/SEED-2026-00103_Rush_1004_Report.pdf`,
      blobUrl: '',
      isLatestVersion: true,
      uploadedBy: VENDOR_IDS.PREMIER,
      uploadedAt: daysAgo(3),
      status: 'SUBMITTED',
      version: 1,
      metadata: {
        formType: '1004', pageCount: 24,
        appraisedValue: 525000, effectiveDate: daysAgo(5),
      },
      createdAt: daysAgo(3), updatedAt: daysAgo(3),
    },
    {
      id: DOCUMENT_IDS.REPORT_ORDER_009, tenantId, type: 'document',
      clientId, subClientId: SUB_CLIENT_SLUGS[CLIENT_IDS.CLEARPATH], clientRecordId: CLIENT_IDS.CLEARPATH,
      orderId: ORDER_IDS.SUBMITTED_009,
      orderNumber: ORDER_NUMBERS[ORDER_IDS.SUBMITTED_009],
      category: 'appraisal-report',
      // documentType uses the Axiom document-type registry id so review-program
      // criteria can match this doc by its acceptableDocuments / oneOf list.
      // (See review-requirement-resolution.service.ts hasDocumentType().)
      documentType: 'uniform-residential-appraisal-report',
      name: 'SEED-2026-00109_MultiFam_1025_Report.pdf',
      mimeType: 'application/pdf', fileSize: 3_800_000,
      blobName: `${tenantId}/${ORDER_IDS.SUBMITTED_009}/SEED-2026-00109_MultiFam_1025_Report.pdf`,
      blobUrl: '',
      isLatestVersion: true,
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
      clientId, subClientId: SUB_CLIENT_SLUGS[CLIENT_IDS.FIRST_HORIZON], clientRecordId: CLIENT_IDS.FIRST_HORIZON,
      orderId: ORDER_IDS.COMPLETED_DRIVEBY_012,
      orderNumber: ORDER_NUMBERS[ORDER_IDS.COMPLETED_DRIVEBY_012],
      category: 'appraisal-report',
      // documentType uses the Axiom document-type registry id so review-program
      // criteria can match this doc by its acceptableDocuments / oneOf list.
      // (See review-requirement-resolution.service.ts hasDocumentType().)
      documentType: 'uniform-residential-appraisal-report',
      name: 'SEED-2026-00112_DriveBy_2055_Report.pdf',
      mimeType: 'application/pdf', fileSize: 1_100_000,
      blobName: `${tenantId}/${ORDER_IDS.COMPLETED_DRIVEBY_012}/SEED-2026-00112_DriveBy_2055_Report.pdf`,
      blobUrl: '',
      isLatestVersion: true,
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
      clientId,
      vendorId: VENDOR_IDS.PREMIER,
      category: 'business-license',
      name: 'Premier_Appraisal_Business_License_2025.pdf',
      mimeType: 'application/pdf', fileSize: 450_000,
      blobName: `${tenantId}/vendors/${VENDOR_IDS.PREMIER}/Premier_Appraisal_Business_License_2025.pdf`,
      blobUrl: '',
      isLatestVersion: true,
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
      clientId,
      vendorId: VENDOR_IDS.PREMIER,
      category: 'insurance-certificate',
      name: 'Premier_Appraisal_E_and_O_Certificate_2025.pdf',
      mimeType: 'application/pdf', fileSize: 380_000,
      blobName: `${tenantId}/vendors/${VENDOR_IDS.PREMIER}/Premier_Appraisal_E_and_O_Certificate_2025.pdf`,
      blobUrl: '',
      isLatestVersion: true,
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
      clientId,
      vendorId: VENDOR_IDS.PREMIER,
      category: 'w9-tax-form',
      name: 'Premier_Appraisal_W9_2025.pdf',
      mimeType: 'application/pdf', fileSize: 220_000,
      blobName: `${tenantId}/vendors/${VENDOR_IDS.PREMIER}/Premier_Appraisal_W9_2025.pdf`,
      blobUrl: '',
      isLatestVersion: true,
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
      clientId,
      appraiserId: APPRAISER_IDS.MICHAEL_THOMPSON,
      category: 'appraiser-license',
      name: 'Thompson_Michael_TX_Certified_General_License.pdf',
      mimeType: 'application/pdf', fileSize: 520_000,
      blobName: `${tenantId}/appraisers/${APPRAISER_IDS.MICHAEL_THOMPSON}/Thompson_TX_License.pdf`,
      blobUrl: '',
      isLatestVersion: true,
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
      clientId,
      appraiserId: APPRAISER_IDS.MICHAEL_THOMPSON,
      category: 'compliance-certificate',
      name: 'Thompson_Michael_USPAP_CE_2025.pdf',
      mimeType: 'application/pdf', fileSize: 310_000,
      blobName: `${tenantId}/appraisers/${APPRAISER_IDS.MICHAEL_THOMPSON}/Thompson_USPAP_CE_2025.pdf`,
      blobUrl: '',
      isLatestVersion: true,
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

    for (const doc of buildDocuments(ctx.tenantId, ctx.clientId)) {
      await upsert(ctx, CONTAINER, doc, result);
    }

    // Upload stub PDF blobs so the PDF viewer works end-to-end in dev/staging
    await seedBlobs(ctx, ctx.tenantId);

    return result;
  },
};
