/**
 * Seed QC Test Documents
 *
 * Creates document metadata in Cosmos AND uploads simple test PDFs to Blob Storage
 * for the document IDs referenced in QC review citations.
 *
 * The QC review seed scripts (add-review-results-to-existing.js) create citations
 * referencing:
 *   - `doc-appraisal-${qcReview.id}` → e.g. doc-appraisal-qc_review_20260208_001
 *   - `doc-uspap`
 *
 * Without these records + blobs, the QC UI shows 404 when trying to view documents.
 *
 * Usage: node scripts/seed-qc-test-documents.js
 */

require('dotenv').config();
const { CosmosClient } = require('@azure/cosmos');
const { BlobServiceClient } = require('@azure/storage-blob');
const { DefaultAzureCredential } = require('@azure/identity');

const COSMOS_ENDPOINT = process.env.AZURE_COSMOS_ENDPOINT || 'https://appraisal-mgmt-staging-cosmos.documents.azure.com:443/';
const DATABASE_ID = 'appraisal-management';
const DOCUMENTS_CONTAINER = 'documents';
const BLOB_CONTAINER = process.env.STORAGE_CONTAINER_DOCUMENTS || 'appraisal-documents';
const TENANT_ID = 'test-tenant-123';
const STORAGE_ACCOUNT = process.env.AZURE_STORAGE_ACCOUNT_NAME;

if (!STORAGE_ACCOUNT) {
  console.error('❌ AZURE_STORAGE_ACCOUNT_NAME is required');
  process.exit(1);
}

const BLOB_BASE_URL = `https://${STORAGE_ACCOUNT}.blob.core.windows.net/${BLOB_CONTAINER}`;

const credential = new DefaultAzureCredential();
const cosmosClient = new CosmosClient({ endpoint: COSMOS_ENDPOINT, aadCredentials: credential });
const database = cosmosClient.database(DATABASE_ID);

const blobServiceClient = new BlobServiceClient(
  `https://${STORAGE_ACCOUNT}.blob.core.windows.net`,
  credential
);

// ──────────────────────────────────────────────────────────────
// Minimal PDF generator — creates a valid PDF without any deps
// ──────────────────────────────────────────────────────────────

function generateMinimalPdf(title, bodyLines) {
  // Build a minimal, valid PDF 1.4 with one page of text
  const objects = [];
  let nextObj = 1;

  // 1 – Catalog
  const catalogId = nextObj++;
  objects.push(`${catalogId} 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj`);

  // 2 – Pages
  const pagesId = nextObj++;
  objects.push(`${pagesId} 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj`);

  // 3 – Page
  const pageId = nextObj++;
  objects.push(`${pageId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj`);

  // Build content stream
  const lines = [`BT`, `/F1 16 Tf`, `50 740 Td`, `(${escapePdf(title)}) Tj`];
  let y = 710;
  for (const line of bodyLines) {
    lines.push(`0 -20 Td`, `/F1 11 Tf`, `(${escapePdf(line)}) Tj`);
    y -= 20;
  }
  lines.push(`ET`);
  const streamContent = lines.join('\n');

  // 4 – Content stream
  const contentId = nextObj++;
  objects.push(`${contentId} 0 obj\n<< /Length ${streamContent.length} >>\nstream\n${streamContent}\nendstream\nendobj`);

  // 5 – Font
  const fontId = nextObj++;
  objects.push(`${fontId} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj`);

  // Assemble
  let pdf = `%PDF-1.4\n%\xE2\xE3\xCF\xD3\n`;
  const offsets = [];
  for (const obj of objects) {
    offsets.push(pdf.length);
    pdf += obj + '\n';
  }

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${nextObj}\n`;
  pdf += `0000000000 65535 f \n`;
  for (const offset of offsets) {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  }

  pdf += `trailer\n<< /Size ${nextObj} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(pdf, 'binary');
}

function escapePdf(str) {
  return str.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

// ──────────────────────────────────────────────────────────────
// Documents to seed
// ──────────────────────────────────────────────────────────────

async function getQCReviewIds() {
  const container = database.container('qc-reviews');
  const { resources } = await container.items
    .query('SELECT c.id, c.orderId, c.orderNumber, c.propertyAddress FROM c')
    .fetchAll();
  return resources;
}

function buildDocuments(qcReviews) {
  const docs = [];

  // For each QC review, the citations reference `doc-appraisal-${qcReview.id}`
  for (const review of qcReviews) {
    const docId = `doc-appraisal-${review.id}`;
    const blobName = `qc-test/${docId}.pdf`;
    docs.push({
      id: docId,
      tenantId: TENANT_ID,
      orderId: review.orderId || review.orderNumber,
      name: `Appraisal Report - ${review.orderNumber || review.orderId || review.id}.pdf`,
      blobName,
      blobUrl: `${BLOB_BASE_URL}/${blobName}`,
      fileSize: 0, // will be updated after upload
      mimeType: 'application/pdf',
      category: 'appraisal-report',
      tags: ['test', 'qc-citation', 'appraisal'],
      version: 1,
      uploadedBy: 'seed-script',
      uploadedAt: new Date().toISOString(),
      pdfTitle: `Appraisal Report`,
      pdfBody: [
        `Order: ${review.orderNumber || review.orderId || 'N/A'}`,
        `Property: ${review.propertyAddress || 'N/A'}`,
        `QC Review ID: ${review.id}`,
        '',
        'This is a test appraisal report PDF seeded for QC review testing.',
        'In production, this would be the actual appraisal report uploaded',
        'by the appraiser.',
        '',
        'Subject Property Information:',
        `  Address: ${review.propertyAddress || '9400 Atlantic Boulevard'}`,
        '  County: Duval',
        '  State: FL',
        '  Zip: 32225',
        '',
        'Borrower: John Smith',
        'Assignment Type: Purchase',
        'Appraised Value: $425,000',
        '',
        'Comparable Sales:',
        '  Comp 1: 123 Oak Lane - $420,000',
        '  Comp 2: 456 Pine Street - $435,000',
        '  Comp 3: 789 Elm Drive - $415,000',
      ]
    });
  }

  // USPAP Standards guideline document (hardcoded ID used in criteria.sourceDocument)
  const uspapBlobName = 'qc-test/doc-uspap.pdf';
  docs.push({
    id: 'doc-uspap',
    tenantId: TENANT_ID,
    name: 'USPAP Standards Reference.pdf',
    blobName: uspapBlobName,
    blobUrl: `${BLOB_BASE_URL}/${uspapBlobName}`,
    fileSize: 0,
    mimeType: 'application/pdf',
    category: 'guideline',
    tags: ['uspap', 'standards', 'reference', 'guideline'],
    version: 1,
    uploadedBy: 'seed-script',
    uploadedAt: new Date().toISOString(),
    pdfTitle: 'USPAP Standards',
    pdfBody: [
      'Uniform Standards of Professional Appraisal Practice',
      '2024-2025 Edition',
      '',
      'Standard 2: Real Property Appraisal, Reporting',
      '',
      'Standard 2-2: Content of a Real Property Appraisal Report',
      '',
      'Each written real property appraisal report must:',
      '  (a) Clearly and accurately set forth the appraisal in a manner',
      '      that will not be misleading.',
      '  (b) Contain sufficient information to enable the intended users',
      '      to understand the rationale for the opinions and conclusions.',
      '',
      'This is a test document seeded for QC review testing.',
      'In production, this would reference the actual USPAP guidelines.',
    ]
  });

  return docs;
}

async function seedDocuments() {
  console.log('🚀 Seeding QC test documents...\n');

  // 1. Find existing QC reviews to match citation IDs
  console.log('📋 Fetching existing QC reviews...');
  const qcReviews = await getQCReviewIds();
  if (qcReviews.length === 0) {
    console.log('⚠️  No QC reviews found — seeding only the doc-uspap guideline document.');
  } else {
    console.log(`✅ Found ${qcReviews.length} QC review(s):`);
    qcReviews.forEach(r => console.log(`   - ${r.id} (${r.orderNumber || r.orderId})`));
  }

  const documents = buildDocuments(qcReviews);
  console.log(`\n📦 Will seed ${documents.length} document(s)\n`);

  const docsContainer = database.container(DOCUMENTS_CONTAINER);
  const blobContainer = blobServiceClient.getContainerClient(BLOB_CONTAINER);

  for (const doc of documents) {
    const { pdfTitle, pdfBody, ...cosmosDoc } = doc;

    // Generate test PDF
    console.log(`📄 Generating test PDF: ${doc.name}`);
    const pdfBuffer = generateMinimalPdf(pdfTitle, pdfBody);
    cosmosDoc.fileSize = pdfBuffer.length;

    // Upload PDF to Blob Storage
    console.log(`   ☁️  Uploading to blob: ${doc.blobName}`);
    const blockBlobClient = blobContainer.getBlockBlobClient(doc.blobName);
    await blockBlobClient.upload(pdfBuffer, pdfBuffer.length, {
      blobHTTPHeaders: { blobContentType: 'application/pdf' }
    });
    console.log(`   ✅ Blob uploaded (${pdfBuffer.length} bytes)`);

    // Upsert document metadata to Cosmos
    console.log(`   💾 Upserting Cosmos metadata: ${doc.id}`);
    await docsContainer.items.upsert(cosmosDoc);
    console.log(`   ✅ Cosmos record created\n`);
  }

  console.log('─'.repeat(60));
  console.log('✨ Seeding complete!\n');
  console.log('📋 Seeded documents:');
  documents.forEach(d => {
    console.log(`   ID:   ${d.id}`);
    console.log(`   Name: ${d.name}`);
    console.log(`   Blob: ${d.blobName}`);
    console.log('');
  });
  console.log('🔗 To test:');
  console.log('   1. Open the QC page in the browser (http://localhost:3010)');
  console.log('   2. Navigate to a QC review');
  console.log('   3. Click on any evidence item with a document reference');
  console.log('   4. The PDF viewer should load the test document');
}

seedDocuments()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
