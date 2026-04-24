import type { IncomingHttpHeaders } from 'http';
import type {
  AdapterInboundResult,
  InboundTransport,
  OutboundCall,
  OutboundTransport,
  VendorConnection,
  VendorDomainEvent,
  VendorOrderReference,
  VendorType,
} from '../../types/vendor-integration.types.js';

export interface InboundAdapterContext {
  rawBody?: Buffer;
  resolveSecret: (secretName: string) => Promise<string>;
  createOrGetOrderReference?: (
    connection: VendorConnection,
    event: VendorDomainEvent,
  ) => Promise<VendorOrderReference>;
}

export interface OutboundAdapterContext {
  resolveSecret: (secretName: string) => Promise<string>;
}

export interface VendorAdapter {
  readonly vendorType: VendorType;
  readonly inboundTransport: InboundTransport;
  readonly outboundTransport: OutboundTransport;

  canHandleInbound(body: unknown, headers: IncomingHttpHeaders): boolean;
  identifyInboundConnection(body: unknown, headers: IncomingHttpHeaders): string | null;
  authenticateInbound(
    body: unknown,
    headers: IncomingHttpHeaders,
    connection: VendorConnection,
    context: InboundAdapterContext,
  ): Promise<void>;
  handleInbound(
    body: unknown,
    headers: IncomingHttpHeaders,
    connection: VendorConnection,
    context: InboundAdapterContext,
  ): Promise<AdapterInboundResult>;
  buildOutboundCall(
    event: VendorDomainEvent,
    connection: VendorConnection,
    context: OutboundAdapterContext,
  ): Promise<OutboundCall | null>;
}
