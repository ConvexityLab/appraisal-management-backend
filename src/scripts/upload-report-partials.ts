/**
 * upload-report-partials.ts
 *
 * R-18: uploads all Handlebars partial files from src/templates/partials/ to
 * the 'pdf-report-templates' blob container under the prefix 'partials/'.
 *
 * Usage:
 *   pnpm ts-node src/scripts/upload-report-partials.ts
 *
 * Prerequisites:
 *   - The 'pdf-report-templates' container must already exist (provisioned by Bicep).
 *   - A local directory src/templates/partials/ containing *.hbs files.
 *   - Managed identity (DefaultAzureCredential) or AZURE_STORAGE_ACCOUNT_NAME env var.
 *
 * Each partial is uploaded at path: partials/<filename>.hbs
 * The HtmlRenderStrategy.loadPartials() method expects exactly this prefix.
 */

import * as fs from 'fs';
import * as path from 'path';
import { BlobServiceClient } from '@azure/storage-blob';
import { DefaultAzureCredential } from '@azure/identity';

const CONTAINER_NAME = 'pdf-report-templates';
const PARTIALS_PREFIX = 'partials/';
const LOCAL_PARTIALS_DIR = path.resolve(__dirname, '../../templates/partials');

async function main(): Promise<void> {
  const accountName = process.env['AZURE_STORAGE_ACCOUNT_NAME'];
  if (!accountName) {
    throw new Error(
      'Missing required environment variable AZURE_STORAGE_ACCOUNT_NAME. ' +
      'Set it to the storage account that hosts the pdf-report-templates container.',
    );
  }

  if (!fs.existsSync(LOCAL_PARTIALS_DIR)) {
    throw new Error(
      `Partials directory not found: ${LOCAL_PARTIALS_DIR}\n` +
      `Create the directory and place your .hbs partial files inside it before running this script.`,
    );
  }

  const hbsFiles = fs
    .readdirSync(LOCAL_PARTIALS_DIR)
    .filter((f) => f.endsWith('.hbs'));

  if (hbsFiles.length === 0) {
    console.warn(`No .hbs files found in ${LOCAL_PARTIALS_DIR}. Nothing to upload.`);
    return;
  }

  const credential = new DefaultAzureCredential();
  const blobServiceClient = new BlobServiceClient(
    `https://${accountName}.blob.core.windows.net`,
    credential,
  );
  const containerClient = blobServiceClient.getContainerClient(CONTAINER_NAME);

  console.log(`Uploading ${hbsFiles.length} partial(s) to ${CONTAINER_NAME}/${PARTIALS_PREFIX}`);

  for (const fileName of hbsFiles) {
    const localPath = path.join(LOCAL_PARTIALS_DIR, fileName);
    const blobName = `${PARTIALS_PREFIX}${fileName}`;
    const content = fs.readFileSync(localPath);

    const blockBlobClient = containerClient.getBlockBlobClient(blobName);
    await blockBlobClient.upload(content, content.length, {
      blobHTTPHeaders: { blobContentType: 'text/x-handlebars-template' },
    });
    console.log(`  ✓ ${blobName}`);
  }

  console.log('Done.');
}

main().catch((err) => {
  console.error('upload-report-partials failed:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
