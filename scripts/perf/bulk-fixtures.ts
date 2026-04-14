import { promises as fs } from 'node:fs';
import path from 'node:path';

export type BulkPerfProfile = 'P-SMALL' | 'P-MEDIUM' | 'P-LARGE';

export interface BulkFixtureItem {
  rowIndex: number;
  loanNumber: string;
  externalId: string;
  documentFileName: string;
}

export interface BulkFixture {
  profile: BulkPerfProfile;
  itemCount: number;
  documentCount: number;
  dataFilePath: string;
  documentPaths: string[];
  items: BulkFixtureItem[];
}

const PROFILE_CONFIG: Record<BulkPerfProfile, { itemCount: number; documentCount: number }> = {
  'P-SMALL': { itemCount: 100, documentCount: 20 },
  'P-MEDIUM': { itemCount: 1000, documentCount: 200 },
  'P-LARGE': { itemCount: 5000, documentCount: 500 },
};

function buildCsv(items: BulkFixtureItem[]): string {
  const header = 'rowIndex,loanNumber,externalId,documentFileName,borrowerName,streetAddress,city,state,postalCode';
  const rows = items.map((item, index) => {
    const borrowerName = `Borrower ${index + 1}`;
    const streetAddress = `${100 + index} Main St`;
    return [
      item.rowIndex,
      item.loanNumber,
      item.externalId,
      item.documentFileName,
      borrowerName,
      streetAddress,
      'Austin',
      'TX',
      '78701',
    ].join(',');
  });

  return [header, ...rows].join('\n');
}

function buildMinimalPdfContent(label: string): Buffer {
  const body = `%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 144]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj\n4 0 obj<</Length 56>>stream\nBT /F1 12 Tf 20 100 Td (${label}) Tj ET\nendstream endobj\n5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\nxref\n0 6\n0000000000 65535 f \n0000000010 00000 n \n0000000064 00000 n \n0000000121 00000 n \n0000000243 00000 n \n0000000350 00000 n \ntrailer<</Size 6/Root 1 0 R>>\nstartxref\n420\n%%EOF`;
  return Buffer.from(body, 'utf-8');
}

export async function generateBulkFixture(profile: BulkPerfProfile, outputRoot: string): Promise<BulkFixture> {
  const profileConfig = PROFILE_CONFIG[profile];
  const fixtureDir = path.join(outputRoot, profile.toLowerCase());
  const docsDir = path.join(fixtureDir, 'documents');

  await fs.rm(fixtureDir, { recursive: true, force: true });
  await fs.mkdir(docsDir, { recursive: true });

  const documentFileNames = Array.from({ length: profileConfig.documentCount }, (_, i) => `doc-${String(i + 1).padStart(4, '0')}.pdf`);

  const items: BulkFixtureItem[] = Array.from({ length: profileConfig.itemCount }, (_, index) => {
    const documentFileName = documentFileNames[index % documentFileNames.length];
    return {
      rowIndex: index + 1,
      loanNumber: `LN-${profile.replace('P-', '')}-${String(index + 1).padStart(6, '0')}`,
      externalId: `EXT-${profile.replace('P-', '')}-${String(index + 1).padStart(6, '0')}`,
      documentFileName,
    };
  });

  const csv = buildCsv(items);
  const dataFilePath = path.join(fixtureDir, `bulk-${profile.toLowerCase()}.csv`);
  await fs.writeFile(dataFilePath, csv, 'utf-8');

  const documentPaths: string[] = [];
  for (const fileName of documentFileNames) {
    const filePath = path.join(docsDir, fileName);
    const buffer = buildMinimalPdfContent(fileName);
    await fs.writeFile(filePath, buffer);
    documentPaths.push(filePath);
  }

  return {
    profile,
    itemCount: profileConfig.itemCount,
    documentCount: profileConfig.documentCount,
    dataFilePath,
    documentPaths,
    items,
  };
}
