import { describe, expect, it, vi } from 'vitest';

import { BulkIngestionAdapterConfigService } from '../../src/services/bulk-ingestion-adapter-config.service.js';

describe('BulkIngestionAdapterConfigService', () => {
  it('returns an exact adapter config match before considering prefix matches', async () => {
    const db = {
      queryItems: vi.fn().mockResolvedValue({
        success: true,
        data: [
          {
            id: 'cfg-statebridge',
            type: 'bulk-ingestion-adapter-config',
            tenantId: 'tenant-001',
            adapterKey: 'statebridge',
            engagementFieldMapping: { borrowerName: 'borrower_name' },
            createdAt: '2026-04-24T00:00:00.000Z',
            updatedAt: '2026-04-24T00:00:00.000Z',
          },
          {
            id: 'cfg-statebridge-run',
            type: 'bulk-ingestion-adapter-config',
            tenantId: 'tenant-001',
            adapterKey: 'statebridge-run123',
            engagementFieldMapping: { borrowerName: 'borrower_full_name' },
            createdAt: '2026-04-24T00:00:00.000Z',
            updatedAt: '2026-04-24T00:00:00.000Z',
          },
        ],
      }),
    } as any;

    const service = new BulkIngestionAdapterConfigService(db);
    const config = await service.getConfig('tenant-001', 'statebridge-run123');

    expect(config?.id).toBe('cfg-statebridge-run');
  });

  it('falls back to a prefix adapter config for run-suffixed adapter keys', async () => {
    const db = {
      queryItems: vi.fn().mockResolvedValue({
        success: true,
        data: [
          {
            id: 'cfg-statebridge',
            type: 'bulk-ingestion-adapter-config',
            tenantId: 'tenant-001',
            adapterKey: 'statebridge',
            engagementFieldMapping: { borrowerName: 'borrower_name' },
            createdAt: '2026-04-24T00:00:00.000Z',
            updatedAt: '2026-04-24T00:00:00.000Z',
          },
        ],
      }),
    } as any;

    const service = new BulkIngestionAdapterConfigService(db);
    const config = await service.getConfig('tenant-001', 'statebridge-run123');

    expect(config?.id).toBe('cfg-statebridge');
  });

  it('resolves mapped engagement fields from normalized raw spreadsheet columns', () => {
    const service = new BulkIngestionAdapterConfigService({} as any);

    const resolved = service.resolveEngagementFields(
      {
        rawColumns: {
          borrowerfullname: 'Ada Lovelace',
          borroweremailaddress: 'ada@example.com',
          borrowerphonenumber: '555-0100',
          unpaidprincipalbalance: '$450,000.25',
        },
      },
      {
        id: 'cfg-1',
        type: 'bulk-ingestion-adapter-config',
        tenantId: 'tenant-001',
        adapterKey: 'bridge-standard',
        engagementFieldMapping: {
          borrowerName: 'Borrower Full Name',
          email: 'Borrower Email Address',
          phone: 'Borrower Phone Number',
          loanAmount: 'Unpaid Principal Balance',
        },
        createdAt: '2026-04-24T00:00:00.000Z',
        updatedAt: '2026-04-24T00:00:00.000Z',
      },
    );

    expect(resolved).toEqual({
      borrowerName: 'Ada Lovelace',
      email: 'ada@example.com',
      phone: '555-0100',
      loanAmount: 450000.25,
    });
  });

  it('throws when a configured mapped column is missing from the uploaded row', () => {
    const service = new BulkIngestionAdapterConfigService({} as any);

    expect(() =>
      service.resolveEngagementFields(
        {
          rawColumns: {
            othercolumn: 'value',
          },
        },
        {
          id: 'cfg-1',
          type: 'bulk-ingestion-adapter-config',
          tenantId: 'tenant-001',
          adapterKey: 'bridge-standard',
          engagementFieldMapping: {
            borrowerName: 'Borrower Name',
          },
          createdAt: '2026-04-24T00:00:00.000Z',
          updatedAt: '2026-04-24T00:00:00.000Z',
        },
        { jobId: 'job-001', itemId: 'item-001', rowIndex: 7 },
      ),
    ).toThrow(/maps engagement field 'borrowerName' to column 'Borrower Name'/);
  });
});