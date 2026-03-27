/**
 * Seed Module: Clients
 *
 * Seeds 6 clients: 2 lenders, 2 AMCs, 1 broker, 1 credit union.
 * Container: clients (partition /tenantId)
 */

import type { SeedModule, SeedModuleResult, SeedContext } from '../seed-types.js';
import { upsert, cleanContainer } from '../seed-types.js';
import { CLIENT_IDS } from '../seed-ids.js';

const CONTAINER = 'clients';

function buildClients(tenantId: string, now: string): Record<string, unknown>[] {
  return [
    {
      id: CLIENT_IDS.FIRST_HORIZON,
      tenantId,
      clientName: 'First Horizon Bank',
      clientType: 'LENDER',
      contactName: 'Amanda Parsons',
      contactEmail: 'aparsons@firsthorizon.com',
      contactPhone: '+1-800-555-1101',
      loanOfficerName: 'James Whitfield',
      lenderName: 'First Horizon Bank',
      address: { street: '165 Madison Ave', city: 'Memphis', state: 'TN', zipCode: '38103' },
      notes: 'Primary correspondent lender; focus on SE residential.',
      status: 'ACTIVE',
      createdAt: now, updatedAt: now, createdBy: 'seed-orchestrator',
    },
    {
      id: CLIENT_IDS.PACIFIC_COAST,
      tenantId,
      clientName: 'Pacific Coast Mortgage',
      clientType: 'LENDER',
      contactName: 'Derek Tanaka',
      contactEmail: 'derek.tanaka@pcmortgage.com',
      contactPhone: '+1-800-555-1202',
      loanOfficerName: 'Derek Tanaka',
      lenderName: 'Pacific Coast Mortgage',
      address: { street: '2800 Lakeshore Ave', city: 'Oakland', state: 'CA', zipCode: '94610' },
      notes: 'West Coast jumbo and VA loan focus.',
      status: 'ACTIVE',
      createdAt: now, updatedAt: now, createdBy: 'seed-orchestrator',
    },
    {
      id: CLIENT_IDS.NATIONAL_AMC,
      tenantId,
      clientName: 'National AMC Services',
      clientType: 'AMC',
      contactName: 'Rachel Monroe',
      contactEmail: 'rmonroe@nationalamc.com',
      contactPhone: '+1-888-555-2001',
      address: { street: '1010 Corporate Way', city: 'Dallas', state: 'TX', zipCode: '75201' },
      notes: 'High-volume AMC; 48-hour order acknowledgement SLA.',
      status: 'ACTIVE',
      createdAt: now, updatedAt: now, createdBy: 'seed-orchestrator',
    },
    {
      id: CLIENT_IDS.CLEARPATH,
      tenantId,
      clientName: 'ClearPath Valuation Group',
      clientType: 'AMC',
      contactName: 'Steven Burke',
      contactEmail: 's.burke@clearpathval.com',
      contactPhone: '+1-855-555-2202',
      address: { street: '400 N Michigan Ave', city: 'Chicago', state: 'IL', zipCode: '60611' },
      notes: 'Midwest and Great Lakes coverage specialist.',
      status: 'ACTIVE',
      createdAt: now, updatedAt: now, createdBy: 'seed-orchestrator',
    },
    {
      id: CLIENT_IDS.SUNCOAST,
      tenantId,
      clientName: 'Suncoast Mortgage Brokers',
      clientType: 'BROKER',
      contactName: 'Lisa Hernandez',
      contactEmail: 'lisa.h@suncoastbrokers.com',
      contactPhone: '+1-727-555-3001',
      loanOfficerName: 'Lisa Hernandez',
      address: { street: '5800 Gulf Blvd', city: 'St. Pete Beach', state: 'FL', zipCode: '33706' },
      notes: 'Florida coastal residential and condo specialist.',
      status: 'ACTIVE',
      createdAt: now, updatedAt: now, createdBy: 'seed-orchestrator',
    },
    {
      id: CLIENT_IDS.FIRST_TECH_CU,
      tenantId,
      clientName: 'First Tech Federal Credit Union',
      clientType: 'CREDIT_UNION',
      contactName: 'Brian Yao',
      contactEmail: 'byao@firsttech.com',
      contactPhone: '+1-800-555-4001',
      lenderName: 'First Tech Federal Credit Union',
      address: { street: '3408 Hillview Ave', city: 'Palo Alto', state: 'CA', zipCode: '94304' },
      notes: 'Tech-industry membership; high share of jumbo purchase loans.',
      status: 'ACTIVE',
      createdAt: now, updatedAt: now, createdBy: 'seed-orchestrator',
    },
  ];
}

export const module: SeedModule = {
  name: 'clients',
  containers: [CONTAINER],

  async run(ctx: SeedContext): Promise<SeedModuleResult> {
    const result: SeedModuleResult = { created: 0, failed: 0, skipped: 0, cleaned: 0 };

    if (ctx.clean) {
      result.cleaned = await cleanContainer(ctx, CONTAINER);
    }

    const clients = buildClients(ctx.tenantId, ctx.now);
    for (const client of clients) {
      await upsert(ctx, CONTAINER, client, result);
    }

    return result;
  },
};
