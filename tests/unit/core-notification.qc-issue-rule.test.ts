/**
 * Regression test for the qc-critical-issue-notification rule.
 *
 * Background: the publisher (axiom.service.ts) sends qc.issue.detected events
 * with `severity: 'CRITICAL' | 'MAJOR' | 'MINOR'` (uppercase), but the rule
 * was checking `severity === 'critical'` (lowercase). The rule never fired.
 * This test locks in the casing fix.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/services/service-bus-subscriber', () => ({
  ServiceBusEventSubscriber: vi.fn().mockImplementation(() => ({
    subscribe: vi.fn().mockResolvedValue(undefined),
    unsubscribe: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock('../../src/services/service-bus-publisher', () => ({
  ServiceBusEventPublisher: vi.fn().mockImplementation(() => ({
    publish: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock('../../src/services/email-notification.service.js', () => ({
  EmailNotificationService: vi.fn().mockImplementation(() => ({
    send: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock('../../src/services/sms-notification.service.js', () => ({
  SmsNotificationService: vi.fn().mockImplementation(() => ({
    send: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock('../../src/services/in-app-notification.service.js', () => ({
  InAppNotificationService: vi.fn().mockImplementation(() => ({
    send: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock('../../src/services/web-pubsub.service.js', () => ({
  WebPubSubService: vi.fn().mockImplementation(() => ({
    publish: vi.fn().mockResolvedValue(undefined),
  })),
}));

import { NotificationService, type NotificationRule } from '../../src/services/core-notification.service.js';
import { EventCategory, EventPriority, type AppEvent, type QCIssueDetectedEvent } from '../../src/types/events.js';

function getRule(service: NotificationService, ruleId: string): NotificationRule {
  const rulesMap = (service as unknown as { rules: Map<string, NotificationRule[]> }).rules;
  for (const ruleList of rulesMap.values()) {
    const rule = ruleList.find((r) => r.id === ruleId);
    if (rule) return rule;
  }
  throw new Error(`Rule '${ruleId}' is not registered`);
}

function buildIssueEvent(severity: QCIssueDetectedEvent['data']['severity']): AppEvent {
  return {
    id: 'evt-1',
    type: 'qc.issue.detected',
    timestamp: new Date(),
    source: 'axiom-service',
    version: '1.0',
    category: EventCategory.QC,
    data: {
      orderId: 'order-1',
      tenantId: 'tenant-1',
      criterionId: 'CRIT-1',
      issueSummary: 'Insufficient comparable sales',
      issueType: 'criterion-fail',
      severity,
      priority: EventPriority.HIGH,
    },
  } as unknown as AppEvent;
}

describe('qc-critical-issue-notification rule', () => {
  let service: NotificationService;
  let rule: NotificationRule;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new NotificationService();
    rule = getRule(service, 'qc-critical-issue-notification');
  });

  it('is registered against qc.issue.detected', () => {
    expect(rule.eventType).toBe('qc.issue.detected');
  });

  it('fires when severity is CRITICAL (uppercase, matches the publisher contract)', () => {
    const fired = rule.condition?.(buildIssueEvent('CRITICAL'));
    expect(fired).toBe(true);
  });

  it('does not fire for MAJOR or MINOR severities', () => {
    expect(rule.condition?.(buildIssueEvent('MAJOR'))).toBe(false);
    expect(rule.condition?.(buildIssueEvent('MINOR'))).toBe(false);
  });

  it('does not fire for the lowercase severities used by the old (incorrect) type definition', () => {
    // Guard against regressing back to lowercase comparison: the publisher
    // never sends lowercase severities, so a match here would mean someone
    // restored the old buggy condition.
    expect(rule.condition?.(buildIssueEvent('critical' as unknown as 'CRITICAL'))).toBe(false);
  });

  it('uses {{issueSummary}} (not the obsolete {{description}}) in the alert template', () => {
    expect(rule.template.message).toContain('{{issueSummary}}');
    expect(rule.template.message).not.toContain('{{description}}');
  });
});
