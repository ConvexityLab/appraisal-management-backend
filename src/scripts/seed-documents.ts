/**
 * Seed Documents Script
 * Creates document metadata records in the Cosmos DB documents container.
 * These records reference blobs in Azure Blob Storage — you'll need to upload
 * matching files to the blob paths shown in the console output.
 *
 * Covers three scopes:
 *   1. Order-scoped documents (appraisal reports, inspections, photos)
 *   2. Vendor-scoped documents (business license, insurance cert)
 *   3. Appraiser-scoped documents (appraiser license, compliance cert)
 *
 * Run with: npx tsx src/scripts/seed-documents.ts
 */

import 'dotenv/config';
import { CosmosDbService } from '../services/cosmos-db.service.js';
import { Logger } from '../utils/logger.js';

const logger = new Logger('SeedDocuments');
const cosmosDb = new CosmosDbService();

const TENANT_ID = 'test-tenant-123';
const STORAGE_ACCOUNT = process.env.AZURE_STORAGE_ACCOUNT_NAME || '<your-storage-account>';
const BLOB_BASE_URL = `https://${STORAGE_ACCOUNT}.blob.core.windows.net/documents`;

// Reference existing seeded entities
const ORDER_ID_1 = 'order-seed-pa-001';       // Pending assignment order
const ORDER_ID_2 = 'order-seed-pa-002';       // Another order
const VENDOR_ID = 'vendor-ca-apr-12345';       // Pacific Coast Appraisals
const APPRAISER_ID = 'appraiser-angela-reeves'; // Angela Reeves

interface DocumentSeed {
  id: string;
  tenantId: string;
  orderId?: string;
  entityType?: string;
  entityId?: string;
  name: string;
  blobName: string;
  blobUrl: string;
  fileSize: number;
  mimeType: string;
  category: string;
  tags?: string[];
  version: number;
  uploadedBy: string;
  uploadedAt: Date;
}

const documents: DocumentSeed[] = [
  // ───────────────────────────────────────────
  // ORDER-SCOPED DOCUMENTS (for order detail pages)
  // ───────────────────────────────────────────
  {
    id: 'doc-seed-order1-appraisal',
    tenantId: TENANT_ID,
    orderId: ORDER_ID_1,
    name: 'Appraisal_Report_1004_Oak_Lane.pdf',
    blobName: `${ORDER_ID_1}/appraisal-report-1004.pdf`,
    blobUrl: `${BLOB_BASE_URL}/${ORDER_ID_1}/appraisal-report-1004.pdf`,
    fileSize: 2_450_000, // ~2.4 MB
    mimeType: 'application/pdf',
    category: 'appraisal-report',
    tags: ['URAR', 'Form 1004', 'residential'],
    version: 1,
    uploadedBy: APPRAISER_ID,
    uploadedAt: new Date('2026-02-10T14:30:00Z'),
  },
  {
    id: 'doc-seed-order1-inspection',
    tenantId: TENANT_ID,
    orderId: ORDER_ID_1,
    name: 'Property_Inspection_Report.pdf',
    blobName: `${ORDER_ID_1}/inspection-report.pdf`,
    blobUrl: `${BLOB_BASE_URL}/${ORDER_ID_1}/inspection-report.pdf`,
    fileSize: 1_850_000, // ~1.8 MB
    mimeType: 'application/pdf',
    category: 'inspection-report',
    tags: ['interior', 'exterior', 'condition'],
    version: 1,
    uploadedBy: APPRAISER_ID,
    uploadedAt: new Date('2026-02-10T15:00:00Z'),
  },
  {
    id: 'doc-seed-order1-photo-front',
    tenantId: TENANT_ID,
    orderId: ORDER_ID_1,
    name: 'Front_Exterior_Photo.jpg',
    blobName: `${ORDER_ID_1}/photo-front.jpg`,
    blobUrl: `${BLOB_BASE_URL}/${ORDER_ID_1}/photo-front.jpg`,
    fileSize: 3_200_000, // ~3.2 MB
    mimeType: 'image/jpeg',
    category: 'property-photo',
    tags: ['front', 'exterior', 'street-view'],
    version: 1,
    uploadedBy: APPRAISER_ID,
    uploadedAt: new Date('2026-02-10T15:10:00Z'),
  },
  {
    id: 'doc-seed-order1-photo-rear',
    tenantId: TENANT_ID,
    orderId: ORDER_ID_1,
    name: 'Rear_Exterior_Photo.jpg',
    blobName: `${ORDER_ID_1}/photo-rear.jpg`,
    blobUrl: `${BLOB_BASE_URL}/${ORDER_ID_1}/photo-rear.jpg`,
    fileSize: 2_800_000, // ~2.8 MB
    mimeType: 'image/jpeg',
    category: 'property-photo',
    tags: ['rear', 'exterior', 'backyard'],
    version: 1,
    uploadedBy: APPRAISER_ID,
    uploadedAt: new Date('2026-02-10T15:12:00Z'),
  },
  {
    id: 'doc-seed-order1-comparable',
    tenantId: TENANT_ID,
    orderId: ORDER_ID_1,
    name: 'Comparable_Sales_Analysis.xlsx',
    blobName: `${ORDER_ID_1}/comparable-analysis.xlsx`,
    blobUrl: `${BLOB_BASE_URL}/${ORDER_ID_1}/comparable-analysis.xlsx`,
    fileSize: 485_000, // ~485 KB
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    category: 'comparable-analysis',
    tags: ['comps', 'sales', 'MLS'],
    version: 1,
    uploadedBy: APPRAISER_ID,
    uploadedAt: new Date('2026-02-10T15:20:00Z'),
  },
  {
    id: 'doc-seed-order2-appraisal',
    tenantId: TENANT_ID,
    orderId: ORDER_ID_2,
    name: 'Appraisal_Report_BPO_Sunset.pdf',
    blobName: `${ORDER_ID_2}/appraisal-bpo.pdf`,
    blobUrl: `${BLOB_BASE_URL}/${ORDER_ID_2}/appraisal-bpo.pdf`,
    fileSize: 1_200_000, // ~1.2 MB
    mimeType: 'application/pdf',
    category: 'appraisal-report',
    tags: ['BPO', 'drive-by'],
    version: 1,
    uploadedBy: APPRAISER_ID,
    uploadedAt: new Date('2026-02-12T10:00:00Z'),
  },

  // ───────────────────────────────────────────
  // VENDOR-SCOPED DOCUMENTS (for vendor detail page)
  // ───────────────────────────────────────────
  {
    id: 'doc-seed-vendor-license',
    tenantId: TENANT_ID,
    entityType: 'vendor',
    entityId: VENDOR_ID,
    name: 'Pacific_Coast_Business_License_2026.pdf',
    blobName: `vendor/${VENDOR_ID}/business-license-2026.pdf`,
    blobUrl: `${BLOB_BASE_URL}/vendor/${VENDOR_ID}/business-license-2026.pdf`,
    fileSize: 650_000, // ~650 KB
    mimeType: 'application/pdf',
    category: 'business-license',
    tags: ['CA', '2026', 'active'],
    version: 1,
    uploadedBy: 'admin-user-001',
    uploadedAt: new Date('2026-01-15T09:00:00Z'),
  },
  {
    id: 'doc-seed-vendor-insurance',
    tenantId: TENANT_ID,
    entityType: 'vendor',
    entityId: VENDOR_ID,
    name: 'E_and_O_Insurance_Certificate.pdf',
    blobName: `vendor/${VENDOR_ID}/insurance-eo-cert.pdf`,
    blobUrl: `${BLOB_BASE_URL}/vendor/${VENDOR_ID}/insurance-eo-cert.pdf`,
    fileSize: 890_000, // ~890 KB
    mimeType: 'application/pdf',
    category: 'insurance-certificate',
    tags: ['E&O', 'liability', 'current'],
    version: 1,
    uploadedBy: 'admin-user-001',
    uploadedAt: new Date('2026-01-15T09:15:00Z'),
  },
  {
    id: 'doc-seed-vendor-w9',
    tenantId: TENANT_ID,
    entityType: 'vendor',
    entityId: VENDOR_ID,
    name: 'W9_Pacific_Coast_Appraisals.pdf',
    blobName: `vendor/${VENDOR_ID}/w9-form.pdf`,
    blobUrl: `${BLOB_BASE_URL}/vendor/${VENDOR_ID}/w9-form.pdf`,
    fileSize: 320_000, // ~320 KB
    mimeType: 'application/pdf',
    category: 'tax-form',
    tags: ['W-9', '2026'],
    version: 1,
    uploadedBy: 'admin-user-001',
    uploadedAt: new Date('2026-01-15T09:30:00Z'),
  },

  // ───────────────────────────────────────────
  // APPRAISER-SCOPED DOCUMENTS (for appraiser detail page)
  // ───────────────────────────────────────────
  {
    id: 'doc-seed-appraiser-license',
    tenantId: TENANT_ID,
    entityType: 'appraiser',
    entityId: APPRAISER_ID,
    name: 'CA_Certified_Residential_License.pdf',
    blobName: `appraiser/${APPRAISER_ID}/license-ca-cr.pdf`,
    blobUrl: `${BLOB_BASE_URL}/appraiser/${APPRAISER_ID}/license-ca-cr.pdf`,
    fileSize: 520_000, // ~520 KB
    mimeType: 'application/pdf',
    category: 'appraiser-license',
    tags: ['CA', 'certified-residential', 'active'],
    version: 1,
    uploadedBy: APPRAISER_ID,
    uploadedAt: new Date('2026-01-10T11:00:00Z'),
  },
  {
    id: 'doc-seed-appraiser-compliance',
    tenantId: TENANT_ID,
    entityType: 'appraiser',
    entityId: APPRAISER_ID,
    name: 'USPAP_Compliance_Certificate_2026.pdf',
    blobName: `appraiser/${APPRAISER_ID}/uspap-compliance-2026.pdf`,
    blobUrl: `${BLOB_BASE_URL}/appraiser/${APPRAISER_ID}/uspap-compliance-2026.pdf`,
    fileSize: 410_000, // ~410 KB
    mimeType: 'application/pdf',
    category: 'compliance-certificate',
    tags: ['USPAP', '2026', 'continuing-education'],
    version: 1,
    uploadedBy: APPRAISER_ID,
    uploadedAt: new Date('2026-01-10T11:15:00Z'),
  },
];

async function seedDocuments(): Promise<void> {
  logger.info('=== Seed Documents ===');
  logger.info(`Target: Cosmos DB "documents" container`);
  logger.info(`Tenant: ${TENANT_ID}`);
  logger.info(`Documents to seed: ${documents.length}`);
  logger.info('');

  const container = cosmosDb.getContainer('documents');
  let upserted = 0;
  let failed = 0;

  for (const doc of documents) {
    try {
      await container.items.upsert(doc);
      const scope = doc.orderId
        ? `order:${doc.orderId}`
        : `${doc.entityType}:${doc.entityId}`;
      logger.info(`  ✅ ${doc.name} (${doc.id}) → ${scope}`);
      upserted++;
    } catch (error: any) {
      logger.error(`  ❌ ${doc.name}: ${error.message || error}`);
      failed++;
    }
  }

  logger.info('');
  logger.info(`Done. ${upserted} upserted, ${failed} failed.`);

  logger.info('');
  logger.info('=== Blob paths to upload files to ===');
  logger.info(`Storage account: ${STORAGE_ACCOUNT}`);
  logger.info(`Container: documents`);
  logger.info('');
  for (const doc of documents) {
    logger.info(`  📁 ${doc.blobName}`);
    logger.info(`     → ${doc.name} (${doc.mimeType}, ${(doc.fileSize / 1024).toFixed(0)} KB)`);
  }
  logger.info('');
  logger.info('Upload matching files to these blob paths in Azure Storage Explorer');
  logger.info('or use: az storage blob upload --account-name <account> --container-name documents --name <blobName> --file <localFile>');
}

seedDocuments()
  .then(() => process.exit(0))
  .catch((err) => {
    logger.error('Seed failed:', err);
    process.exit(1);
  });
