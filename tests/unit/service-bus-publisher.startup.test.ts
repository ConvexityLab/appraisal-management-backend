import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ServiceBusEventPublisher } from '../../src/services/service-bus-publisher.js';

/**
 * Covers E-01 (refuse mock Service Bus in production) and E-02
 * (verifyConnectivity no-ops for mock, exercises sender for real namespace).
 */

const ORIGINAL_ENV = { ...process.env };

function resetEnv() {
  process.env = { ...ORIGINAL_ENV };
  delete process.env.NODE_ENV;
  delete process.env.USE_MOCK_SERVICE_BUS;
  delete process.env.AZURE_SERVICE_BUS_NAMESPACE;
}

describe('ServiceBusEventPublisher startup guards', () => {
  beforeEach(() => {
    resetEnv();
  });

  afterEach(() => {
    resetEnv();
  });

  describe('E-01: production fail-fast', () => {
    it('throws when NODE_ENV=production and USE_MOCK_SERVICE_BUS=true', () => {
      process.env.NODE_ENV = 'production';
      process.env.USE_MOCK_SERVICE_BUS = 'true';
      process.env.AZURE_SERVICE_BUS_NAMESPACE = 'real-ns.servicebus.windows.net';
      expect(() => new ServiceBusEventPublisher()).toThrow(
        /refuses to start in production.*USE_MOCK_SERVICE_BUS=true/,
      );
    });

    it('throws when NODE_ENV=production and AZURE_SERVICE_BUS_NAMESPACE is unset', () => {
      process.env.NODE_ENV = 'production';
      expect(() => new ServiceBusEventPublisher()).toThrow(
        /refuses to start in production.*AZURE_SERVICE_BUS_NAMESPACE is not set/,
      );
    });

    it('throws when NODE_ENV=production and namespace is the local-emulator sentinel', () => {
      process.env.NODE_ENV = 'production';
      process.env.AZURE_SERVICE_BUS_NAMESPACE = 'local-emulator';
      expect(() => new ServiceBusEventPublisher()).toThrow(
        /refuses to start in production.*local-emulator/,
      );
    });

    it('allows mock bus outside production', () => {
      process.env.NODE_ENV = 'development';
      process.env.USE_MOCK_SERVICE_BUS = 'true';
      expect(() => new ServiceBusEventPublisher()).not.toThrow();
    });

    it('allows a real namespace in production', () => {
      process.env.NODE_ENV = 'production';
      process.env.AZURE_SERVICE_BUS_NAMESPACE = 'real-ns.servicebus.windows.net';
      // Constructing against a real namespace does not connect yet — it only
      // creates the client — so we expect no throw from the fail-fast guard.
      expect(() => new ServiceBusEventPublisher()).not.toThrow();
    });
  });

  describe('E-03: duplicate detection inputs', () => {
    it('sends messageId = event.id so Service Bus dedup drops replays within the 10-minute window', async () => {
      process.env.USE_MOCK_SERVICE_BUS = 'true';
      const publisher = new ServiceBusEventPublisher();

      // Replace the internal client with a spy so we capture the outbound message.
      const sendMessages = vi.fn().mockResolvedValue(undefined);
      (publisher as any).client = {
        createSender: () => ({ sendMessages, close: vi.fn().mockResolvedValue(undefined) }),
        close: vi.fn().mockResolvedValue(undefined),
      };
      (publisher as any).useMockBus = false; // force real-bus code path for assertion
      (publisher as any).topicName = 'appraisal-events';

      const event = {
        id: 'evt-abc-123',
        type: 'order.status.changed',
        category: 'order',
        source: 'unit-test',
        timestamp: new Date(),
        correlationId: 'corr-999',
        data: { orderId: 'order-1', tenantId: 't', newStatus: 'QC_REVIEW' },
      } as any;

      await publisher.publish(event);

      expect(sendMessages).toHaveBeenCalledOnce();
      const sent = sendMessages.mock.calls[0][0];
      expect(sent.messageId).toBe('evt-abc-123');
      expect(sent.correlationId).toBe('corr-999');
      expect(sent.subject).toBe('order.status.changed');
      await publisher.close();
    });
  });

  describe('E-02: verifyConnectivity', () => {
    it('is a no-op when using the mock bus', async () => {
      process.env.USE_MOCK_SERVICE_BUS = 'true';
      const publisher = new ServiceBusEventPublisher();
      await expect(publisher.verifyConnectivity()).resolves.toBeUndefined();
      await publisher.close();
    });

    it('creates a sender against a real namespace without sending a message', async () => {
      // Dev environment with a syntactically-valid namespace — verifyConnectivity
      // only calls getSender() which does not hit the network in the Azure SDK
      // until the first send. It must not throw in this case.
      process.env.NODE_ENV = 'development';
      process.env.AZURE_SERVICE_BUS_NAMESPACE = 'dev-ns.servicebus.windows.net';
      const publisher = new ServiceBusEventPublisher();
      await expect(publisher.verifyConnectivity()).resolves.toBeUndefined();
      await publisher.close();
    });
  });
});
