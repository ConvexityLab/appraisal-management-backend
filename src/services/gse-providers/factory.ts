/**
 * GSE Provider Factory
 *
 * Returns a SubmissionProvider that dispatches to the correct concrete provider
 * based on the portal (UCDP → UcdpSoapProvider, EAD → EadRestProvider).
 *
 * Resolution logic:
 *   UCDP: UCDP_USERNAME + UCDP_PASSWORD                 → UcdpSoapProvider
 *   EAD:  EAD_API_KEY + EAD_CLIENT_ID + EAD_CLIENT_SECRET → EadRestProvider
 *   Either/both unconfigured → MockGseProvider for that portal
 *
 * Env vars:
 *   UCDP_USERNAME, UCDP_PASSWORD, UCDP_LENDER_ID, UCDP_ENV
 *   EAD_API_KEY, EAD_CLIENT_ID, EAD_CLIENT_SECRET, EAD_ENV
 */

import type {
  SubmissionProvider,
  SubmissionPortal,
  SubmissionStatus,
  SSRFinding,
} from '../ucdp-ead-submission.service.js';
import { UcdpSoapProvider } from './ucdp-soap.provider.js';
import { EadRestProvider } from './ead-rest.provider.js';
import { Logger } from '../../utils/logger.js';

const logger = new Logger('GseProviderFactory');

// ---------------------------------------------------------------------------
// Mock fallback — used when credentials are absent
// ---------------------------------------------------------------------------
class MockGseProvider implements SubmissionProvider {
  private readonly portal: SubmissionPortal;
  constructor(portal: SubmissionPortal) { this.portal = portal; }

  async submit(
    _portal: SubmissionPortal,
    _xmlContent: string,
    _lenderId: string,
  ): Promise<{ portalDocumentId: string; status: SubmissionStatus; findings: SSRFinding[] }> {
    const docId = `mock-${this.portal.toLowerCase()}-${Date.now()}`;
    console.log(`🧪 [MOCK GSE ${this.portal}] submit → ${docId}`);
    return { portalDocumentId: docId, status: 'ACCEPTED', findings: [] };
  }

  async checkStatus(
    _portal: SubmissionPortal,
    portalDocumentId: string,
  ): Promise<{ status: SubmissionStatus; findings: SSRFinding[] }> {
    console.log(`🧪 [MOCK GSE ${this.portal}] checkStatus ${portalDocumentId}`);
    return { status: 'ACCEPTED', findings: [] };
  }
}

// ---------------------------------------------------------------------------
// Composite provider — dispatches per portal
// ---------------------------------------------------------------------------
class CompositeGseProvider implements SubmissionProvider {
  constructor(
    private readonly ucdpProvider: SubmissionProvider,
    private readonly eadProvider: SubmissionProvider,
  ) {}

  async submit(
    portal: SubmissionPortal,
    xmlContent: string,
    lenderId: string,
  ): Promise<{ portalDocumentId: string; status: SubmissionStatus; findings: SSRFinding[] }> {
    return portal === 'UCDP'
      ? this.ucdpProvider.submit(portal, xmlContent, lenderId)
      : this.eadProvider.submit(portal, xmlContent, lenderId);
  }

  async checkStatus(
    portal: SubmissionPortal,
    portalDocumentId: string,
  ): Promise<{ status: SubmissionStatus; findings: SSRFinding[] }> {
    return portal === 'UCDP'
      ? this.ucdpProvider.checkStatus(portal, portalDocumentId)
      : this.eadProvider.checkStatus(portal, portalDocumentId);
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------
export function createGseProvider(): SubmissionProvider {
  const ucdpUser   = process.env.UCDP_USERNAME;
  const ucdpPass   = process.env.UCDP_PASSWORD;
  const ucdpLender = process.env.UCDP_LENDER_ID ?? '';
  const ucdpEnv    = process.env.UCDP_ENV ?? 'sandbox';

  const eadApiKey  = process.env.EAD_API_KEY;
  const eadClient  = process.env.EAD_CLIENT_ID;
  const eadSecret  = process.env.EAD_CLIENT_SECRET;
  const eadEnv     = process.env.EAD_ENV ?? 'sandbox';

  const ucdpProvider: SubmissionProvider = (ucdpUser && ucdpPass)
    ? (logger.info(`GSE UCDP provider: UcdpSoapProvider (env=${ucdpEnv})`), new UcdpSoapProvider(ucdpUser, ucdpPass, ucdpLender, ucdpEnv))
    : (logger.info('GSE UCDP provider: Mock (no UCDP_USERNAME/UCDP_PASSWORD configured)'), new MockGseProvider('UCDP'));

  const eadProvider: SubmissionProvider = (eadApiKey && eadClient && eadSecret)
    ? (logger.info(`GSE EAD provider: EadRestProvider (env=${eadEnv})`), new EadRestProvider(eadApiKey, eadClient, eadSecret, eadEnv))
    : (logger.info('GSE EAD provider: Mock (no EAD_API_KEY/EAD_CLIENT_ID/EAD_CLIENT_SECRET configured)'), new MockGseProvider('EAD'));

  return new CompositeGseProvider(ucdpProvider, eadProvider);
}
