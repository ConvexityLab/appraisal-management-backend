/**
 * Client delta for demo client "client-demo-001".
 *
 * Customisations:
 * - Override reportBranding with demo logo, accent colour, and footer text
 * - Add two client-specific fields to the `subject_property` section
 *   (`client_loan_ref` and `client_program_code`) so the client can
 *   capture their internal reference data directly in the report
 */
import type { ReportConfigDeltaDocument } from '@l1/shared-types';

export const DELTA_CLIENT_DEMO_001: ReportConfigDeltaDocument = {
  id: 'delta-client-demo-001',
  tier: 'client',
  clientId: 'client-demo-001',
  addFields: {
    subject_property: [
      {
        key: 'client_loan_ref',
        label: 'Client Loan Reference #',
        type: 'text',
        required: false,
        visible: true,
        order: 90,
      },
      {
        key: 'client_program_code',
        label: 'Program Code',
        type: 'text',
        required: false,
        visible: true,
        order: 91,
      },
    ],
  },
  reportBranding: {
    logoUrl: 'https://demo.example.com/assets/logo.png',
    primaryColor: '#1E40AF',
    footerText: 'Report prepared for Demo Lending Corp. — Confidential',
  },
  createdAt: '2026-05-11T00:00:00.000Z',
  updatedAt: '2026-05-11T00:00:00.000Z',
};
