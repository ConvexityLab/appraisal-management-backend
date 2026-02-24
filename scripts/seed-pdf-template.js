/**
 * Seed PDF Report Template
 *
 * Generates a minimal Form 1004 (URAR) AcroForm PDF and seeds it into the platform:
 *   1. Builds an AcroForm PDF with all fields that FinalReportService._assembleFieldMap() produces
 *   2. Uploads the PDF to the 'pdf-report-templates' Azure Blob container
 *   3. Upserts a ReportTemplate metadata document to the 'document-templates' Cosmos container
 *
 * This enables end-to-end smoke-testing of the final report generation pipeline.
 *
 * Prerequisites:
 *   - AZURE_COSMOS_ENDPOINT and AZURE_STORAGE_ACCOUNT_NAME must be set in .env
 *   - The 'pdf-report-templates' blob container must already exist
 *   - The 'document-templates' Cosmos container must already exist
 *
 * Usage:
 *   node scripts/seed-pdf-template.js
 */

require('dotenv').config();

const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const { BlobServiceClient } = require('@azure/storage-blob');
const { CosmosClient } = require('@azure/cosmos');
const { DefaultAzureCredential } = require('@azure/identity');

// ---------------------------------------------------------------------------
// Config — fail fast on missing required env vars
// ---------------------------------------------------------------------------
const COSMOS_ENDPOINT = process.env.AZURE_COSMOS_ENDPOINT;
if (!COSMOS_ENDPOINT) {
  throw new Error('AZURE_COSMOS_ENDPOINT is required. Set it in your .env file.');
}

const STORAGE_ACCOUNT_NAME = process.env.AZURE_STORAGE_ACCOUNT_NAME;
if (!STORAGE_ACCOUNT_NAME) {
  throw new Error('AZURE_STORAGE_ACCOUNT_NAME is required. Set it in your .env file.');
}

const DATABASE_ID = process.env.AZURE_COSMOS_DATABASE || 'appraisal-management';

const TEMPLATE_CONTAINER = 'pdf-report-templates';
const DOCUMENT_TEMPLATES_CONTAINER = 'document-templates';

/** Stable ID — rerunning the script is idempotent */
const TEMPLATE_ID    = 'template-form-1004-urar-v1';
const TEMPLATE_BLOB  = 'form-1004-urar-v1.pdf';

// ---------------------------------------------------------------------------
// Azure clients (DefaultAzureCredential — no connection strings / keys)
// ---------------------------------------------------------------------------
const credential = new DefaultAzureCredential();

const cosmosClient = new CosmosClient({ endpoint: COSMOS_ENDPOINT, aadCredentials: credential });
const database     = cosmosClient.database(DATABASE_ID);

const blobServiceClient = new BlobServiceClient(
  `https://${STORAGE_ACCOUNT_NAME}.blob.core.windows.net`,
  credential
);

// ---------------------------------------------------------------------------
// AcroForm field definitions
// All names match what FinalReportService._assembleFieldMap() writes.
// ---------------------------------------------------------------------------
const FORM_FIELDS = [
  // Subject property
  { name: 'SubjectAddress', label: 'Subject Property Address', x: 160, y: 710, w: 370, h: 14 },
  { name: 'SubjectCity',    label: 'City',                     x: 160, y: 692, w: 160, h: 14 },
  { name: 'SubjectState',   label: 'State',                    x: 335, y: 692, w:  40, h: 14 },
  { name: 'SubjectZip',     label: 'Zip',                      x: 390, y: 692, w:  80, h: 14 },
  { name: 'SubjectCounty',  label: 'County',                   x: 485, y: 692, w: 110, h: 14 },

  // Borrower / loan
  { name: 'BorrowerName',   label: 'Borrower Name',            x: 160, y: 670, w: 260, h: 14 },
  { name: 'BorrowerEmail',  label: 'Borrower Email',           x: 160, y: 652, w: 260, h: 14 },
  { name: 'LoanNumber',     label: 'Loan Number',              x: 160, y: 634, w: 200, h: 14 },
  { name: 'LoanAmount',     label: 'Loan Amount ($)',          x: 160, y: 616, w: 120, h: 14 },
  { name: 'LoanType',       label: 'Loan Type',                x: 340, y: 616, w: 100, h: 14 },

  // Product
  { name: 'FormType',       label: 'Form / Product Type',      x: 160, y: 598, w: 160, h: 14 },

  // Valuation
  { name: 'AppraisedValue', label: 'Appraised Value ($)',      x: 160, y: 576, w: 160, h: 14 },

  // QC results
  { name: 'QCScore',        label: 'QC Score (0–100)',         x: 160, y: 554, w:  80, h: 14 },
  { name: 'QCDecision',     label: 'QC Decision',              x: 300, y: 554, w: 160, h: 14 },
  { name: 'QCSummary',      label: 'QC Summary',               x: 160, y: 520, w: 380, h: 28 },
];

// ---------------------------------------------------------------------------
// Build the AcroForm PDF
// ---------------------------------------------------------------------------
async function buildAcroformPdf() {
  const pdfDoc = await PDFDocument.create();

  // Use a standard letter-size page (8.5" × 11" at 72 dpi)
  const page = pdfDoc.addPage([612, 792]);
  const font  = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold  = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const form  = pdfDoc.getForm();

  const black = rgb(0, 0, 0);
  const grey  = rgb(0.35, 0.35, 0.35);
  const blue  = rgb(0.08, 0.24, 0.55);

  // --- Title block ---
  page.drawRectangle({ x: 30, y: 752, width: 552, height: 30, color: blue });
  page.drawText('UNIFORM RESIDENTIAL APPRAISAL REPORT  (Form 1004 — URAR)', {
    x: 40, y: 761, size: 11, font: bold, color: rgb(1, 1, 1),
  });
  page.drawText('Test Template — Generated by seed-pdf-template.js · Appraisal Management Platform', {
    x: 40, y: 747, size: 7, font, color: grey,
  });

  // --- Section headers ---
  const drawSection = (label, y) =>
    page.drawText(label, { x: 30, y, size: 8, font: bold, color: blue });

  drawSection('SUBJECT PROPERTY', 725);
  drawSection('BORROWER / LOAN INFORMATION', 685);
  drawSection('VALUATION & QC SUMMARY', 590);

  // --- Separator lines ---
  [748, 722, 683, 588].forEach(y =>
    page.drawLine({ start: { x: 30, y }, end: { x: 582, y }, thickness: 0.5, color: rgb(0.75, 0.75, 0.75) })
  );

  // --- Fields ---
  for (const f of FORM_FIELDS) {
    // Label
    page.drawText(f.label + ':', {
      x: 30, y: f.y + 2, size: 7, font, color: grey,
    });

    // AcroForm text field
    const tf = form.createTextField(f.name);
    tf.addToPage(page, {
      x: f.x,
      y: f.y - 1,
      width: f.w,
      height: f.h,
      borderWidth: 0.5,
      borderColor: rgb(0.6, 0.6, 0.6),
      backgroundColor: rgb(0.97, 0.97, 1.0),
    });

    // Allow multi-line for summary field
    if (f.name === 'QCSummary') {
      tf.setFontSize(8);
      tf.enableMultiline();
    }
  }

  // --- Footer ---
  page.drawLine({ start: { x: 30, y: 40 }, end: { x: 582, y: 40 }, thickness: 0.5, color: grey });
  page.drawText(
    'This is a machine-generated test template for development/smoke-testing purposes only. Not for production appraisal use.',
    { x: 30, y: 28, size: 6.5, font, color: grey }
  );
  page.drawText(`Generated: ${new Date().toISOString()}`, { x: 30, y: 18, size: 6, font, color: grey });

  return pdfDoc.save(); // Returns Uint8Array
}

// ---------------------------------------------------------------------------
// Upload PDF to Blob
// ---------------------------------------------------------------------------
async function uploadTemplatePdf(pdfBytes) {
  console.log(`\n📤 Uploading '${TEMPLATE_BLOB}' to blob container '${TEMPLATE_CONTAINER}'...`);

  const containerClient = blobServiceClient.getContainerClient(TEMPLATE_CONTAINER);

  // Verify the container exists — do NOT create it (infrastructure must be pre-provisioned)
  const exists = await containerClient.exists();
  if (!exists) {
    throw new Error(
      `Blob container '${TEMPLATE_CONTAINER}' does not exist. ` +
      `Create it via your Bicep/infrastructure deployment before running this script.`
    );
  }

  const blobClient = containerClient.getBlockBlobClient(TEMPLATE_BLOB);
  await blobClient.upload(pdfBytes, pdfBytes.length, {
    blobHTTPHeaders: {
      blobContentType: 'application/pdf',
      blobCacheControl: 'no-cache',
    },
    metadata: {
      generatedBy: 'seed-pdf-template.js',
      templateId: TEMPLATE_ID,
      formType: '1004',
    },
  });

  const blobUrl = blobClient.url;
  console.log(`✅ Uploaded: ${blobUrl}`);
  return blobUrl;
}

// ---------------------------------------------------------------------------
// Upsert ReportTemplate metadata in Cosmos
// ---------------------------------------------------------------------------
async function upsertTemplateMetadata() {
  console.log(`\n📝 Upserting ReportTemplate metadata in Cosmos container '${DOCUMENT_TEMPLATES_CONTAINER}'...`);

  const container = database.container(DOCUMENT_TEMPLATES_CONTAINER);

  // Verify the container exists
  try {
    await container.read();
  } catch (err) {
    if (err.code === 404) {
      throw new Error(
        `Cosmos container '${DOCUMENT_TEMPLATES_CONTAINER}' does not exist in database '${DATABASE_ID}'. ` +
        `Create it via your Bicep/infrastructure deployment before running this script.`
      );
    }
    throw err;
  }

  /** @type {import('../src/types/final-report.types').ReportTemplate} */
  const templateDoc = {
    id: TEMPLATE_ID,
    // Cosmos requires a partition key — reuse id (single-partition, low volume)
    type: 'pdf-report-template',
    name: 'Form 1004 — Uniform Residential Appraisal Report (URAR) v1',
    formType: '1004',
    blobName: TEMPLATE_BLOB,
    description:
      'Standard FNMA/FHLMC Form 1004 for single-family residential properties. ' +
      'AcroForm fields: SubjectAddress, SubjectCity, SubjectState, SubjectZip, SubjectCounty, ' +
      'BorrowerName, BorrowerEmail, LoanNumber, LoanAmount, LoanType, FormType, ' +
      'AppraisedValue, QCScore, QCDecision, QCSummary.',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    seededBy: 'seed-pdf-template.js',
  };

  await container.items.upsert(templateDoc);
  console.log(`✅ Template metadata upserted: id=${TEMPLATE_ID}`);

  return templateDoc;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log('🚀 Seeding Form 1004 PDF template...\n');
  console.log(`   Cosmos endpoint : ${COSMOS_ENDPOINT}`);
  console.log(`   Storage account : ${STORAGE_ACCOUNT_NAME}`);
  console.log(`   Database        : ${DATABASE_ID}`);
  console.log(`   Template ID     : ${TEMPLATE_ID}`);

  console.log('\n📄 Building AcroForm PDF...');
  const pdfBytes = await buildAcroformPdf();
  console.log(`✅ PDF built — ${pdfBytes.length.toLocaleString()} bytes, ${FORM_FIELDS.length} AcroForm fields`);

  await uploadTemplatePdf(pdfBytes);
  const doc = await upsertTemplateMetadata();

  console.log('\n🎉 Done! Template ready for final-report generation pipeline.');
  console.log('\n   Use this templateId when calling POST /api/final-reports/orders/:orderId/generate:');
  console.log(`   "templateId": "${TEMPLATE_ID}"`);
  console.log('\n   ReportTemplate document:');
  console.log(JSON.stringify(doc, null, 2));
}

main().catch((err) => {
  console.error('\n❌ Seed script failed:', err.message ?? err);
  process.exit(1);
});
