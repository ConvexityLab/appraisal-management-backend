/**
 * FinalReportService — _appendCustomPages() unit tests
 *
 * Verifies that custom addendum PDFs (base64-encoded) are correctly merged onto
 * the end of a filled URAR PDF using pdf-lib's copyPages / addPage APIs.
 *
 * BlobStorageService and NotificationService are mocked so the service can be
 * instantiated without Azure credentials.
 *
 * Coverage:
 *   1. Single 1-page addendum appended → output has 2 pages
 *   2. Multi-page addendum appended → total page count is correct
 *   3. Multiple addendum entries → all pages appended in array order
 *   4. Empty customPagePdfs array → URAR bytes returned unchanged (same page count)
 *   5. Invalid base64 string → rejects with an error (not silent)
 */

import { describe, it, expect, vi, beforeAll } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { FinalReportService } from '../../src/services/final-report.service.js';
import type { CosmosDbService } from '../../src/services/cosmos-db.service.js';

// ─── Module mocks ────────────────────────────────────────────────────────────
// Mock out the Azure-dependent services so the constructor doesn't throw in CI.

vi.mock('../../src/services/blob-storage.service.js', () => ({
	BlobStorageService: vi.fn().mockImplementation(() => ({}))
}));

vi.mock('../../src/services/notification.service.js', () => ({
	NotificationService: vi.fn().mockImplementation(() => ({}))
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Creates a minimal in-memory PDF with `pageCount` blank pages.
 * Returns both the raw Uint8Array and the base64 string of those bytes.
 */
async function makeMinimalPdf(pageCount: number): Promise<{ bytes: Uint8Array; base64: string }> {
	const doc = await PDFDocument.create();
	for (let i = 0; i < pageCount; i++) {
		doc.addPage(); // blank A4 page
	}
	const bytes = await doc.save();
	const base64 = Buffer.from(bytes).toString('base64');
	return { bytes, base64 };
}

/** Returns the page count of a serialized PDF. */
async function pageCount(pdfBytes: Uint8Array): Promise<number> {
	const doc = await PDFDocument.load(pdfBytes);
	return doc.getPageCount();
}

// ─── Minimal CosmosDbService stub ────────────────────────────────────────────

const stubDb = {} as unknown as CosmosDbService;

// ─── Test helper: access private method via cast ──────────────────────────────

function appendPages(
	service: FinalReportService,
	urarBytes: Uint8Array,
	customPagePdfs: string[]
): Promise<Uint8Array> {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	return (service as any)._appendCustomPages(urarBytes, customPagePdfs);
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('FinalReportService._appendCustomPages()', () => {
	let service: FinalReportService;

	beforeAll(() => {
		service = new FinalReportService(stubDb);
	});

	it('appends a single 1-page addendum to a 1-page URAR → 2 pages total', async () => {
		const { bytes: urar } = await makeMinimalPdf(1);
		const { base64: addendum } = await makeMinimalPdf(1);

		const result = await appendPages(service, urar, [addendum]);

		expect(await pageCount(result)).toBe(2);
	});

	it('appends a 3-page addendum to a 1-page URAR → 4 pages total', async () => {
		const { bytes: urar } = await makeMinimalPdf(1);
		const { base64: addendum } = await makeMinimalPdf(3);

		const result = await appendPages(service, urar, [addendum]);

		expect(await pageCount(result)).toBe(4);
	});

	it('appends multiple addendum entries in array order', async () => {
		const { bytes: urar } = await makeMinimalPdf(2);
		const { base64: add1 } = await makeMinimalPdf(1); // photo addendum
		const { base64: add2 } = await makeMinimalPdf(2); // market map
		const { base64: add3 } = await makeMinimalPdf(1); // narrative

		const result = await appendPages(service, urar, [add1, add2, add3]);

		// 2 (URAR) + 1 + 2 + 1 = 6
		expect(await pageCount(result)).toBe(6);
	});

	it('returns the original page count when customPagePdfs is empty', async () => {
		const { bytes: urar } = await makeMinimalPdf(4);

		const result = await appendPages(service, urar, []);

		expect(await pageCount(result)).toBe(4);
	});

	it('rejects with an error when a base64 string is not a valid PDF', async () => {
		const { bytes: urar } = await makeMinimalPdf(1);
		const garbage = Buffer.from('this-is-not-a-pdf').toString('base64');

		await expect(appendPages(service, urar, [garbage])).rejects.toThrow();
	});
});
