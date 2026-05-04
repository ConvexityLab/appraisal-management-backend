/**
 * Client Config Controller
 *
 * Endpoints:
 *   GET  /api/tenant-automation-config        — get current config for the authenticated client
 *   PUT  /api/tenant-automation-config        — update config (partial)
 *   GET  /api/tenant-automation-config/schema — JSON schema for UI form rendering
 */

import express, { Request, Response, Router } from 'express';
import { TenantAutomationConfigService } from '../services/tenant-automation-config.service.js';
import { DEFAULT_CLIENT_AUTOMATION_CONFIG } from '../types/tenant-automation-config.types.js';
import { Logger } from '../utils/logger.js';

const router: Router = express.Router();
const service = new TenantAutomationConfigService();
const logger = new Logger('TenantAutomationConfigController');

// ── GET /api/tenant-automation-config/schema ─────────────────────────────────
// Must be declared BEFORE other routes to avoid shadowing.

router.get('/schema', (_req: Request, res: Response) => {
  const schema = {
    fields: [
      {
        key: 'autoAssignmentEnabled',
        label: 'Auto-Assignment Enabled',
        type: 'boolean',
        description: 'Automatically assign vendors when an order is created.',
      },
      {
        key: 'bidLoopEnabled',
        label: 'Bid Loop Enabled',
        type: 'boolean',
        description: 'Allow the system to cycle through ranked vendors when bids expire.',
      },
      {
        key: 'maxVendorAttempts',
        label: 'Max Vendor Attempts',
        type: 'number',
        min: 1,
        max: 20,
        description: 'Maximum number of vendor assignment attempts before escalation.',
      },
      {
        key: 'bidExpiryHours',
        label: 'Bid Expiry (hours)',
        type: 'number',
        min: 1,
        max: 168,
        description: 'Hours before an unanswered bid request expires.',
      },
      {
        key: 'reviewExpiryHours',
        label: 'Review Expiry (hours)',
        type: 'number',
        min: 1,
        max: 168,
        description: 'Hours before an in-progress review escalates.',
      },
      {
        key: 'preferredVendorIds',
        label: 'Preferred Vendor IDs',
        type: 'string[]',
        description: 'Vendor IDs that receive first-rank consideration during assignment.',
      },
      {
        key: 'defaultSupervisorId',
        label: 'Default Supervisor ID',
        type: 'string',
        description: 'Supervisor assigned when supervisory review is triggered without a specific assignee.',
      },
      {
        key: 'supervisoryReviewForAllOrders',
        label: 'Require Supervisor Co-Sign for All Orders',
        type: 'boolean',
        description: 'When enabled, every order requires a supervisory co-sign before delivery.',
      },
      {
        key: 'supervisoryReviewValueThreshold',
        label: 'Supervisory Review Value Threshold ($)',
        type: 'number',
        min: 0,
        description: 'Orders above this appraised value automatically require supervisory co-sign. 0 = disabled.',
      },
      {
        key: 'escalationRecipients',
        label: 'Escalation Recipients',
        type: 'string[]',
        description: 'Email address or user IDs to notify on automation failures and escalations.',
      },
      {
        key: 'axiomSubClientId',
        label: 'Axiom Sub-Client ID',
        type: 'string',
        description: 'Sub-client key used to build run-ledger schema/program keys for document orchestration.',
      },
      {
        key: 'axiomDocumentSchemaVersion',
        label: 'Axiom Document Schema Version',
        type: 'string',
        description: 'Schema version used for extraction run schemaKey.version (falls back to axiomProgramVersion when omitted).',
      },
      {
        key: 'axiomDefaultCriteriaStepKeys',
        label: 'Default Criteria Step Keys',
        type: 'string[]',
        description: 'Optional default step keys for auto-created criteria runs after extraction completion.',
      },
    ],
    defaults: DEFAULT_CLIENT_AUTOMATION_CONFIG,
  };

  return res.json({ success: true, data: schema });
});

// ── GET /api/tenant-automation-config ────────────────────────────────────────

router.get('/', async (req: Request, res: Response) => {
  try {
    const clientId = (req as any).user?.clientId as string | undefined;
    if (!clientId) {
      return res.status(400).json({ error: 'clientId not found in JWT claims — ensure the token includes the clientId claim' });
    }

    const config = await service.getConfig(clientId);
    return res.json({ success: true, data: config });
  } catch (err: any) {
    logger.error('GET client automation config failed', { error: err });
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ── PUT /api/tenant-automation-config ────────────────────────────────────────

router.put('/', async (req: Request, res: Response) => {
  try {
    const clientId = (req as any).user?.clientId as string | undefined;
    const updatedBy = (req as any).user?.id as string | undefined;

    if (!clientId) {
      return res.status(400).json({ error: 'clientId not found in JWT claims — ensure the token includes the clientId claim' });
    }
    if (!updatedBy) {
      return res.status(400).json({ error: 'user id not found in JWT claims' });
    }

    const update = req.body;
    if (!update || Object.keys(update).length === 0) {
      return res.status(400).json({ error: 'Request body must contain at least one field to update' });
    }

    const updated = await service.updateConfig(clientId, update, updatedBy);
    return res.json({ success: true, data: updated });
  } catch (err: any) {
    logger.error('PUT client automation config failed', { error: err });
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
