/**
 * Seed Module: HTML Report Templates
 *
 * Seeds ReportTemplate metadata documents (type='pdf-report-template') into
 * the `document-templates` Cosmos container for the two html-render strategy
 * templates: URAR Form 1004 and DVR/BPO.
 *
 * When AZURE_STORAGE_ACCOUNT_NAME is configured the module also uploads the
 * compiled `.hbs` files from `src/templates/` to the `pdf-report-templates`
 * blob container so they are discoverable by HtmlRenderStrategy at runtime.
 *
 * Container:      document-templates   (partition /tenantId)
 * Blob container: pdf-report-templates
 */

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { BlobServiceClient } from '@azure/storage-blob';
import { DefaultAzureCredential } from '@azure/identity';
import type { SeedModule, SeedModuleResult, SeedContext } from '../seed-types.js';
import { upsert, cleanContainer, daysAgo } from '../seed-types.js';
import { REPORT_TEMPLATE_IDS } from '../seed-ids.js';
import type { ReportTemplate } from '../../../types/final-report.types.js';

const CONTAINER   = 'document-templates';
const BLOB_CONTAINER = 'pdf-report-templates';

// templates live at src/templates/ — resolve from project root (cwd when running seed)
const TEMPLATES_DIR = resolve(process.cwd(), 'src', 'templates');

// ─── Template Documents ──────────────────────────────────────────────────────

function buildDocuments(tenantId: string): ReportTemplate[] {
  return [
    // ── URAR Form 1004 ──────────────────────────────────────────────────────
    {
      id: REPORT_TEMPLATE_IDS.URAR_1004_V1,
      name: 'Uniform Residential Appraisal Report (Form 1004) — v1',
      formType: 'URAR_1004',
      renderStrategy: 'html-render',
      hbsTemplateName: 'urar-v1.hbs',
      mapperKey: 'urar-1004',
      isActive: true,
      description:
        'Three-page URAR Form 1004 rendered via Handlebars + Playwright headless Chromium. ' +
        'Includes Subject, Neighborhood, Site, Improvements (p.1), Sales Comparison Grid (p.2), ' +
        'and Reconciliation / Cost / Income / Signature block (p.3).',
      sectionConfig: {
        requiresSubjectPhotos: true,
        requiresCompPhotos:    true,
        requiresAerialMap:     true,
        requiresMarketConditionsAddendum: true,
        requiresLocationMap:   false,
        requiresFloorPlan:     false,
      },
    },
    // ── URAR Form 1004 v2 (Vision VMC brand + UAD 3.6) ──────────────────────
    {
      id: REPORT_TEMPLATE_IDS.URAR_1004_V2,
      name: 'Uniform Residential Appraisal Report (Form 1004) — v2 Vision VMC',
      formType: 'URAR_1004',
      renderStrategy: 'html-render',
      hbsTemplateName: 'urar-v2.hbs',
      mapperKey: 'urar-1004',
      isActive: true,
      description:
        'Four-page Vision VMC-branded URAR with full UAD 3.6 conditional sections: ' +
        'H&BU 4-test framework, multi-value-type block, Extraordinary Assumptions / Hypothetical Conditions, ' +
        'Cost approach depreciation breakdown, Income approach rent comps, approach weighting + confidence.',
      sectionConfig: {
        requiresSubjectPhotos: true,
        requiresCompPhotos:    true,
        requiresAerialMap:     true,
        requiresMarketConditionsAddendum: true,
        requiresLocationMap:   false,
        requiresFloorPlan:     false,
      },
    },
    // ── DVR / Vision BPO ────────────────────────────────────────────────────
    {
      id: REPORT_TEMPLATE_IDS.DVR_BPO_V1,
      name: 'Drive-By Valuation / Broker Price Opinion Report — v1',
      formType: 'DVR',
      renderStrategy: 'html-render',
      hbsTemplateName: 'dvr-v1.hbs',
      mapperKey: 'dvr-bpo',
      isActive: true,
      description:
        'Two-page DVR/BPO rendered via Handlebars + Playwright headless Chromium. ' +
        'Includes Subject Property, Condition Ratings, Neighborhood, drive-by photos (p.1), ' +
        'and Sales Comparison table, comp photos, Opinion of Value, Signature (p.2).',
      sectionConfig: {
        requiresSubjectPhotos: true,
        requiresCompPhotos:    true,
        requiresAerialMap:     true,
        requiresMarketConditionsAddendum: false,
        requiresLocationMap:   false,
        requiresFloorPlan:     false,
      },
    },
  ];
}

// ─── Upload .hbs files to Blob Storage ──────────────────────────────────────

interface TemplateBlob {
  fileName: string;
  localPath: string;
}

const TEMPLATE_BLOBS: TemplateBlob[] = [
  { fileName: 'urar-v1.hbs', localPath: resolve(TEMPLATES_DIR, 'urar-v1.hbs') },
  { fileName: 'urar-v2.hbs', localPath: resolve(TEMPLATES_DIR, 'urar-v2.hbs') },
  { fileName: 'dvr-v1.hbs',  localPath: resolve(TEMPLATES_DIR, 'dvr-v1.hbs') },
];

async function uploadTemplateBlobs(storageAccountName: string): Promise<void> {
  const credential = new DefaultAzureCredential();
  const blobServiceClient = new BlobServiceClient(
    `https://${storageAccountName}.blob.core.windows.net`,
    credential,
  );
  const containerClient = blobServiceClient.getContainerClient(BLOB_CONTAINER);

  const containerExists = await containerClient.exists();
  if (!containerExists) {
    throw new Error(
      `Blob container '${BLOB_CONTAINER}' does not exist. ` +
      `Create it via your Bicep/infrastructure deployment before running the seed.`,
    );
  }

  for (const tpl of TEMPLATE_BLOBS) {
    const content = await readFile(tpl.localPath, 'utf-8');
    const buffer  = Buffer.from(content, 'utf-8');
    const blobClient = containerClient.getBlockBlobClient(tpl.fileName);
    await blobClient.upload(buffer, buffer.length, {
      blobHTTPHeaders: {
        blobContentType:  'text/html; charset=utf-8',
        blobCacheControl: 'no-cache',
      },
      metadata: {
        generatedBy:       'seed-orchestrator',
        templateType:      'hbs',
        uploadedAt:        new Date().toISOString(),
      },
    });
    console.log(
      `   ✅ Uploaded ${tpl.fileName} (${buffer.length.toLocaleString()} bytes) → ${BLOB_CONTAINER}`,
    );
  }
}

// ─── Module ──────────────────────────────────────────────────────────────────

export const module: SeedModule = {
  name: 'report-templates',
  containers: [CONTAINER],

  async run(ctx: SeedContext): Promise<SeedModuleResult> {
    const result: SeedModuleResult = { created: 0, failed: 0, skipped: 0, cleaned: 0 };

    if (ctx.clean) {
      result.cleaned = await cleanContainer(ctx, CONTAINER);
    }

    for (const doc of buildDocuments(ctx.tenantId)) {
      await upsert(ctx, CONTAINER, { ...doc, tenantId: ctx.tenantId }, result);
    }

    if (ctx.storageAccountName) {
      console.log(`\n   📄 Uploading Handlebars templates to blob storage...`);
      await uploadTemplateBlobs(ctx.storageAccountName);
    } else {
      console.log('\n   ℹ  Blob template upload skipped (AZURE_STORAGE_ACCOUNT_NAME not set)');
    }

    return result;
  },
};
