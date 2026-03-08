/**
 * Seed Module: PDF Templates
 *
 * Seeds a document-template metadata record. Actual blob upload requires
 * a storage account — if AZURE_STORAGE_ACCOUNT_NAME is not set, the blob
 * upload is skipped and only the metadata record is seeded.
 * Container: document-templates (partition /tenantId)
 */

import type { SeedModule, SeedModuleResult, SeedContext } from '../seed-types.js';
import { upsert, cleanContainer, daysAgo } from '../seed-types.js';
import { PDF_TEMPLATE_IDS } from '../seed-ids.js';

const CONTAINER = 'document-templates';

function buildTemplates(tenantId: string): Record<string, unknown>[] {
  return [
    {
      id: PDF_TEMPLATE_IDS.FORM_1004, tenantId, type: 'document-template',
      templateName: 'Uniform Residential Appraisal Report (Form 1004)',
      formType: '1004',
      version: '2024-01',
      status: 'ACTIVE',
      fileFormat: 'PDF_ACROFORM',
      blobPath: `templates/${tenantId}/form-1004-v2024-01.pdf`,
      blobContainer: 'pdf-report-templates',
      fieldCount: 142,
      description: 'Standard Fannie Mae Form 1004 AcroForm template for residential appraisals. Contains all UAD-compliant fields for automated PDF generation.',
      supportedProducts: ['FULL_1004', 'RECERTIFICATION'],
      createdAt: daysAgo(365), updatedAt: daysAgo(90),
    },
  ];
}

export const module: SeedModule = {
  name: 'pdf-templates',
  containers: [CONTAINER],

  async run(ctx: SeedContext): Promise<SeedModuleResult> {
    const result: SeedModuleResult = { created: 0, failed: 0, skipped: 0, cleaned: 0 };

    if (ctx.clean) {
      result.cleaned = await cleanContainer(ctx, CONTAINER);
    }

    for (const tpl of buildTemplates(ctx.tenantId)) {
      await upsert(ctx, CONTAINER, tpl, result);
    }

    if (!ctx.storageAccountName) {
      console.log('\n   ℹ  Blob template upload skipped (AZURE_STORAGE_ACCOUNT_NAME not set)');
    }

    return result;
  },
};
