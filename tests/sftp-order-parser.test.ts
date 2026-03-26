/**
 * Unit tests for the pure functions exported from processSftpOrderFile.js
 * and writeStatebridgeDailyResults.js.
 *
 * These functions are tested in isolation — no Cosmos/Blob clients are
 * instantiated because the required env vars are stubbed before import.
 */

// Set required env vars BEFORE importing function modules (module-level checks run on load)
process.env.COSMOSDB_ENDPOINT = process.env.COSMOSDB_ENDPOINT || 'https://test.documents.azure.com:443/';
process.env.DATABASE_NAME = process.env.DATABASE_NAME || 'test-db';
process.env.SFTP_STORAGE_ACCOUNT_NAME = process.env.SFTP_STORAGE_ACCOUNT_NAME || 'teststorage';
process.env.STATEBRIDGE_CLIENT_ID = process.env.STATEBRIDGE_CLIENT_ID || 'statebridge';
process.env.STATEBRIDGE_CLIENT_NAME = process.env.STATEBRIDGE_CLIENT_NAME || 'Statebridge';
process.env.STATEBRIDGE_TENANT_ID = process.env.STATEBRIDGE_TENANT_ID || 'test-tenant-id';

import { describe, it, expect } from 'vitest';

// Import pure functions from the SFTP order file processor
const {
  IN,
  MIN_COLUMNS,
  parseOrderFile,
  validateRow,
  parseEventGridMessage,
  buildOrderDocument,
  deterministicId,
  generateEngagementId,
  generateOrderId,
  // eslint-disable-next-line @typescript-eslint/no-var-requires
} = require('../src/functions/src/processSftpOrderFile');

// Import pure functions from the daily results writer
const {
  formatDate,
  normaliseCondition,
  formatCurrency,
  escapeField,
  // eslint-disable-next-line @typescript-eslint/no-var-requires
} = require('../src/functions/src/writeStatebridgeDailyResults');

// ─── Sample data matching the 13-column Statebridge spec ────────────────────

const SAMPLE_HEADER = 'OrderID|LoanID|CollateralNumber|ProductType|Occupancy|PropertyType|AddressLine1|AddressLine2|City|State|Zip|BorrowerName|LockboxCode';

const SAMPLE_ROW_FULL =
  '1|6420340020|0|Appraisal|Owner Occupied|Single Family|4501 QUEENS RD||GASTONIA|NC|28052|MARIO SMITH|0020';

const SAMPLE_ROW_HYBRID =
  '2|6420639024|0|Hybrid BPO|Non-Owner Occupied|Other|8511 NORTH GRAY ST||INDIANAPOLIS|IN|46201|JERMEY DOE|9024';

const SAMPLE_ROW_MULTI_COLLATERAL =
  '3|6420639024|1|Hybrid BPO|Non-Owner Occupied|Other|8640 NORTH GRAY ST||INDIANAPOLIS|IN|46201|JERMEY DOE|9024';

const SAMPLE_FILE = [SAMPLE_HEADER, SAMPLE_ROW_FULL, SAMPLE_ROW_HYBRID, SAMPLE_ROW_MULTI_COLLATERAL, ''].join('\n');

// ─── processSftpOrderFile tests ──────────────────────────────────────────────

describe('processSftpOrderFile — pure functions', () => {
  describe('IN column mapping', () => {
    it('should map PropertyType at index 5 (13-column format)', () => {
      expect(IN.PropertyType).toBe(5);
    });

    it('should map AddressLine1 at index 6', () => {
      expect(IN.AddressLine1).toBe(6);
    });

    it('should map LockboxCode at index 12', () => {
      expect(IN.LockboxCode).toBe(12);
    });

    it('should have MIN_COLUMNS of 12', () => {
      expect(MIN_COLUMNS).toBe(12);
    });
  });

  describe('parseOrderFile', () => {
    it('should skip the header row', () => {
      const rows = parseOrderFile(SAMPLE_FILE);
      expect(rows.length).toBe(3);
      // First row should be the data row, not the header
      expect(rows[0][IN.OrderID]).toBe('1');
    });

    it('should NOT skip data rows whose OrderID starts with "OrderID" prefix', () => {
      const row = 'OrderID-001|6420340020|0|BPO|Owner Occupied|Single Family|123 Main|Suite A|Austin|TX|78701|Smith|0001';
      const rows = parseOrderFile(row);
      expect(rows.length).toBe(1);
      expect(rows[0][IN.OrderID]).toBe('OrderID-001');
    });

    it('should skip blank lines', () => {
      const content = '\n\n' + SAMPLE_ROW_FULL + '\n\n';
      const rows = parseOrderFile(content);
      expect(rows.length).toBe(1);
    });

    it('should split on pipe delimiter', () => {
      const rows = parseOrderFile(SAMPLE_ROW_FULL);
      expect(rows.length).toBe(1);
      expect(rows[0]).toHaveLength(13);
    });

    it('should parse all 13 columns correctly', () => {
      const rows = parseOrderFile(SAMPLE_ROW_FULL);
      const fields = rows[0];
      expect(fields[IN.OrderID]).toBe('1');
      expect(fields[IN.LoanID]).toBe('6420340020');
      expect(fields[IN.CollateralNumber]).toBe('0');
      expect(fields[IN.ProductType]).toBe('Appraisal');
      expect(fields[IN.Occupancy]).toBe('Owner Occupied');
      expect(fields[IN.PropertyType]).toBe('Single Family');
      expect(fields[IN.AddressLine1]).toBe('4501 QUEENS RD');
      expect(fields[IN.AddressLine2]).toBe('');
      expect(fields[IN.City]).toBe('GASTONIA');
      expect(fields[IN.State]).toBe('NC');
      expect(fields[IN.Zip]).toBe('28052');
      expect(fields[IN.BorrowerName]).toBe('MARIO SMITH');
      expect(fields[IN.LockboxCode]).toBe('0020');
    });

    it('should handle Windows-style line endings', () => {
      const content = SAMPLE_ROW_FULL + '\r\n' + SAMPLE_ROW_HYBRID + '\r\n';
      const rows = parseOrderFile(content);
      expect(rows.length).toBe(2);
    });
  });

  describe('validateRow', () => {
    it('should return no warnings for a valid row', () => {
      const fields = SAMPLE_ROW_FULL.split('|');
      const warnings = validateRow(fields, 0);
      expect(warnings).toHaveLength(0);
    });

    it('should warn on invalid state code', () => {
      const fields = SAMPLE_ROW_FULL.split('|');
      fields[IN.State] = 'XX';
      const warnings = validateRow(fields, 0);
      expect(warnings.some((w: string) => w.includes('Invalid state code'))).toBe(true);
    });

    it('should warn on invalid zip code', () => {
      const fields = SAMPLE_ROW_FULL.split('|');
      fields[IN.Zip] = 'ABCDE';
      const warnings = validateRow(fields, 0);
      expect(warnings.some((w: string) => w.includes('Invalid zip code'))).toBe(true);
    });

    it('should warn on empty LoanID', () => {
      const fields = SAMPLE_ROW_FULL.split('|');
      fields[IN.LoanID] = '';
      const warnings = validateRow(fields, 0);
      expect(warnings.some((w: string) => w.includes('LoanID is empty'))).toBe(true);
    });

    it('should warn on empty AddressLine1', () => {
      const fields = SAMPLE_ROW_FULL.split('|');
      fields[IN.AddressLine1] = '';
      const warnings = validateRow(fields, 0);
      expect(warnings.some((w: string) => w.includes('AddressLine1 is empty'))).toBe(true);
    });

    it('should warn on empty City', () => {
      const fields = SAMPLE_ROW_FULL.split('|');
      fields[IN.City] = '';
      const warnings = validateRow(fields, 0);
      expect(warnings.some((w: string) => w.includes('City is empty'))).toBe(true);
    });

    it('should accept 5-digit and 5+4 zip codes', () => {
      const fields = SAMPLE_ROW_FULL.split('|');
      fields[IN.Zip] = '28052-1234';
      const warnings = validateRow(fields, 0);
      expect(warnings).toHaveLength(0);
    });
  });

  describe('buildOrderDocument', () => {
    it('should build an order with correct address fields from 13-column row', () => {
      const fields = SAMPLE_ROW_FULL.split('|');
      const doc = buildOrderDocument(fields, 'eng-123', 'loan-1', 'prod-1', 'test.txt', 0);

      expect(doc.streetAddress).toBe('4501 QUEENS RD');
      expect(doc.city).toBe('GASTONIA');
      expect(doc.state).toBe('NC');
      expect(doc.zip).toBe('28052');
      expect(doc.borrowerName).toBe('MARIO SMITH');
      expect(doc.lockboxCode).toBe('0020');
    });

    it('should preserve the ProductType from the file', () => {
      const fields = SAMPLE_ROW_FULL.split('|');
      const doc = buildOrderDocument(fields, 'eng-123', 'loan-1', 'prod-1', 'test.txt', 0);
      expect(doc.productType).toBe('Appraisal');
    });

    it('should store propertyType from the file', () => {
      const fields = SAMPLE_ROW_FULL.split('|');
      const doc = buildOrderDocument(fields, 'eng-123', 'loan-1', 'prod-1', 'test.txt', 0);
      expect(doc.propertyType).toBe('Single Family');
    });

    it('should pad LoanID to 10 characters', () => {
      const fields = SAMPLE_ROW_FULL.split('|');
      const doc = buildOrderDocument(fields, 'eng-123', 'loan-1', 'prod-1', 'test.txt', 0);
      expect(doc.loanId).toBe('6420340020');
      expect(doc.loanId).toHaveLength(10);
    });

    it('should pad short LoanID with leading zeros', () => {
      const fields = SAMPLE_ROW_FULL.split('|');
      fields[IN.LoanID] = '12345';
      const doc = buildOrderDocument(fields, 'eng-123', 'loan-1', 'prod-1', 'test.txt', 0);
      expect(doc.loanId).toBe('0000012345');
    });

    it('should set expected PDF prefix for result naming', () => {
      const fields = SAMPLE_ROW_FULL.split('|');
      const doc = buildOrderDocument(fields, 'eng-123', 'loan-1', 'prod-1', 'test.txt', 0);
      expect(doc.expectedPdfPrefix).toBe('6420340020_BPO_0');
    });

    it('should set type=order for Cosmos query compatibility', () => {
      const fields = SAMPLE_ROW_FULL.split('|');
      const doc = buildOrderDocument(fields, 'eng-123', 'loan-1', 'prod-1', 'test.txt', 0);
      expect(doc.type).toBe('order');
    });
  });

  describe('deterministicId', () => {
    it('should produce the same ID for the same inputs', () => {
      const a = deterministicId('pfx', 'a', 'b', 'c');
      const b = deterministicId('pfx', 'a', 'b', 'c');
      expect(a).toBe(b);
    });

    it('should produce different IDs for different inputs', () => {
      const a = deterministicId('pfx', 'a', 'b', 'c');
      const b = deterministicId('pfx', 'x', 'y', 'z');
      expect(a).not.toBe(b);
    });

    it('should include the prefix', () => {
      const id = deterministicId('sftp-ord', 'seed');
      expect(id).toMatch(/^sftp-ord-/);
    });
  });

  describe('parseEventGridMessage', () => {
    it('should extract blob name from a standard Event Grid message', () => {
      const msg = {
        subject: '/blobServices/default/containers/statebridge/blobs/uploads/orders_20260325.txt',
        data: { url: 'https://storage.blob.core.windows.net/statebridge/uploads/orders_20260325.txt' },
      };
      const { blobName } = parseEventGridMessage(msg);
      expect(blobName).toBe('uploads/orders_20260325.txt');
    });

    it('should handle array-wrapped Event Grid messages', () => {
      const msg = [{
        subject: '/blobServices/default/containers/statebridge/blobs/uploads/test.txt',
        data: { url: 'https://storage.blob.core.windows.net/statebridge/uploads/test.txt' },
      }];
      const { blobName } = parseEventGridMessage(msg);
      expect(blobName).toBe('uploads/test.txt');
    });

    it('should throw on missing data.url', () => {
      expect(() => parseEventGridMessage({ data: {} })).toThrow('missing data.url');
    });

    it('should throw on unparseable JSON string', () => {
      expect(() => parseEventGridMessage('not-json{')).toThrow('Failed to parse');
    });
  });
});

// ─── writeStatebridgeDailyResults tests ──────────────────────────────────────

describe('writeStatebridgeDailyResults — pure functions', () => {
  describe('formatDate', () => {
    it('should format ISO date to M/DD/YYYY', () => {
      expect(formatDate('2024-03-11T00:00:00.000Z')).toBe('3/11/2024');
    });

    it('should return empty string for null', () => {
      expect(formatDate(null)).toBe('');
    });

    it('should return empty string for undefined', () => {
      expect(formatDate(undefined)).toBe('');
    });

    it('should pass through unparseable dates', () => {
      expect(formatDate('not-a-date')).toBe('not-a-date');
    });

    it('should handle single-digit months without leading zero', () => {
      expect(formatDate('2024-01-05T12:00:00Z')).toBe('1/05/2024');
    });
  });

  describe('normaliseCondition', () => {
    it('should map C1 to Excellent', () => {
      expect(normaliseCondition('C1')).toBe('Excellent');
    });

    it('should map C2 to Good', () => {
      expect(normaliseCondition('C2')).toBe('Good');
    });

    it('should map C3 to Average', () => {
      expect(normaliseCondition('C3')).toBe('Average');
    });

    it('should map C4 to Fair', () => {
      expect(normaliseCondition('C4')).toBe('Fair');
    });

    it('should map C5 and C6 to Poor', () => {
      expect(normaliseCondition('C5')).toBe('Poor');
      expect(normaliseCondition('C6')).toBe('Poor');
    });

    it('should capitalise free-text conditions', () => {
      expect(normaliseCondition('FAIR')).toBe('Fair');
      expect(normaliseCondition('good')).toBe('Good');
    });

    it('should return empty string for null/undefined', () => {
      expect(normaliseCondition(null)).toBe('');
      expect(normaliseCondition(undefined)).toBe('');
    });
  });

  describe('formatCurrency', () => {
    it('should format integers as plain strings', () => {
      expect(formatCurrency(70000)).toBe('70000');
    });

    it('should round decimals', () => {
      expect(formatCurrency(82900.5)).toBe('82901');
    });

    it('should return empty string for null/undefined', () => {
      expect(formatCurrency(null)).toBe('');
      expect(formatCurrency(undefined)).toBe('');
    });

    it('should return empty string for NaN input', () => {
      expect(formatCurrency('not-a-number')).toBe('');
    });

    it('should handle string numbers', () => {
      expect(formatCurrency('150000')).toBe('150000');
    });
  });

  describe('escapeField', () => {
    it('should replace tabs with spaces', () => {
      expect(escapeField('hello\tworld')).toBe('hello world');
    });

    it('should trim whitespace', () => {
      expect(escapeField('  hello  ')).toBe('hello');
    });

    it('should return empty string for null/undefined', () => {
      expect(escapeField(null)).toBe('');
      expect(escapeField(undefined)).toBe('');
    });
  });
});
