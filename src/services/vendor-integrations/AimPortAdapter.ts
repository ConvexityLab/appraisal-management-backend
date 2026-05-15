import type { IncomingHttpHeaders } from 'http';
import type {
  AimPortAckResponse,
  AimPortFile,
  AimPortOrderDetails,
  AimPortRequestType,
} from '../../types/aim-port.types.js';
import { AIM_PORT_PRODUCT_NAMES, detectAimPortRequestType, getAimPortEnvelope } from '../../types/aim-port.types.js';
import type {
  AdapterInboundResult,
  OutboundCall,
  VendorConnection,
  VendorDomainEvent,
  VendorFile,
  VendorInspectionPropertyAccess,
  VendorInspectionRequestedBy,
  VendorOrderReceivedPayload,
  VendorOrderScheduledPayload,
  VendorOrderUpdatedPayload,
  VendorProductsListedPayload,
} from '../../types/vendor-integration.types.js';
import type { InboundAdapterContext, OutboundAdapterContext, VendorAdapter } from './VendorAdapter.js';
import { appInsightsMetrics } from '../app-insights-metrics.service.js';

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function numberValue(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function definedProps<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, propValue]) => propValue !== undefined),
  ) as T;
}

// AIM-Port sends login.client_id as either a string or an integer depending on
// the calling system. Normalise to a trimmed string so connection lookup and
// authentication work regardless of the JSON type.
function coerceClientId(value: unknown): string | undefined {
  if (typeof value === 'string') return value.trim() || undefined;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return undefined;
}

function booleanValue(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.trim().toLowerCase() === 'true';
  return false;
}

function stringArrayValue(value: unknown): string[] | undefined {
  if (Array.isArray(value)) {
    const items = value
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter(Boolean);
    return items.length > 0 ? items : undefined;
  }

  if (typeof value === 'string' && value.trim()) {
    const items = value
      .split(/[;,|]/)
      .map((item) => item.trim())
      .filter(Boolean);
    return items.length > 0 ? items : undefined;
  }

  return undefined;
}

function parseInspectionRequestedBy(value: unknown): VendorInspectionRequestedBy | undefined {
  const normalized = stringValue(value)?.toLowerCase();
  switch (normalized) {
    case 'appraiser':
    case 'client':
    case 'system':
    case 'homeowner':
      return normalized;
    default:
      return undefined;
  }
}

function mapAimPortPropertyAccess(propertyAccess: Record<string, unknown> | null): VendorInspectionPropertyAccess | undefined {
  if (!propertyAccess) {
    return undefined;
  }

  const contactName = stringValue(propertyAccess.name);
  const contactPhone = stringValue(propertyAccess.cell_phone)
    ?? stringValue(propertyAccess.home_phone)
    ?? stringValue(propertyAccess.work_phone);
  const contactEmail = stringValue(propertyAccess.email);
  const accessInstructions = stringValue(propertyAccess.access_instructions)
    ?? stringValue(propertyAccess.other_description);
  const petWarning = stringValue(propertyAccess.pet_warning);
  const parkingInstructions = stringValue(propertyAccess.parking_instructions);
  const specialRequirements = stringArrayValue(propertyAccess.special_requirements);

  if (!contactName || !contactPhone) {
    return undefined;
  }

  const mapped: VendorInspectionPropertyAccess = {
    contactName,
    contactPhone,
    requiresEscort: booleanValue(propertyAccess.requires_escort),
  };

  if (contactEmail) mapped.contactEmail = contactEmail;
  if (accessInstructions) mapped.accessInstructions = accessInstructions;
  if (petWarning) mapped.petWarning = petWarning;
  if (parkingInstructions) mapped.parkingInstructions = parkingInstructions;
  if (specialRequirements) mapped.specialRequirements = specialRequirements;

  return mapped;
}

function buildScheduledPayload(order: Record<string, unknown> | null): VendorOrderScheduledPayload {
  const inspectionDate = stringValue(order?.inspection_date);
  const appraiserId = stringValue(order?.appraiser_id);
  const startTime = stringValue(order?.scheduled_start_time);
  const endTime = stringValue(order?.scheduled_end_time);
  const timezone = stringValue(order?.scheduled_timezone);
  const requestedBy = parseInspectionRequestedBy(order?.requested_by);
  const propertyAccess = mapAimPortPropertyAccess(asRecord(order?.property_access));

  const missingFields = [
    !inspectionDate ? 'inspection_date' : null,
    !appraiserId ? 'appraiser_id' : null,
    !startTime ? 'scheduled_start_time' : null,
    !endTime ? 'scheduled_end_time' : null,
    !timezone ? 'scheduled_timezone' : null,
    !requestedBy ? 'requested_by' : null,
    !propertyAccess ? 'property_access' : null,
  ].filter(Boolean);

  if (missingFields.length > 0) {
    throw new Error(`AIM-Port OrderScheduledRequest is missing required scheduling fields: ${missingFields.join(', ')}`);
  }

  const requiredInspectionDate = inspectionDate as string;
  const requiredAppraiserId = appraiserId as string;
  const requiredStartTime = startTime as string;
  const requiredEndTime = endTime as string;
  const requiredTimezone = timezone as string;
  const requiredRequestedBy = requestedBy as VendorInspectionRequestedBy;
  const requiredPropertyAccess = propertyAccess as VendorInspectionPropertyAccess;

  const payload: VendorOrderScheduledPayload = {
    inspectionDate: requiredInspectionDate,
    appraiserId: requiredAppraiserId,
    scheduledSlot: {
      date: requiredInspectionDate,
      startTime: requiredStartTime,
      endTime: requiredEndTime,
      timezone: requiredTimezone,
    },
    propertyAccess: requiredPropertyAccess,
    requestedBy: requiredRequestedBy,
  };

  const inspectionNotes = stringValue(order?.inspection_notes);
  const appointmentType = stringValue(order?.appointment_type) as VendorOrderScheduledPayload['appointmentType'] | undefined;

  if (inspectionNotes) {
    payload.inspectionNotes = inspectionNotes;
  }

  if (appointmentType) {
    payload.appointmentType = appointmentType;
  }

  return payload;
}

function toVendorFiles(files: AimPortFile[] | undefined): VendorFile[] {
  return (files ?? []).map((file) => definedProps({
    fileId: file.file_id,
    filename: file.filename,
    category: file.category,
    categoryLabel: file.category_label,
    description: file.description,
    content: file.content,
  })) as VendorFile[];
}

function makeLegacyOrderId(vendorOrderId: string): string {
  return `aim-port:${vendorOrderId}`;
}

export class AimPortAdapter implements VendorAdapter {
  readonly vendorType = 'aim-port' as const;
  readonly inboundTransport = 'sync-post' as const;
  readonly outboundTransport = 'sync-post' as const;

  canHandleInbound(body: unknown, _headers: IncomingHttpHeaders): boolean {
    return detectAimPortRequestType(body) !== null;
  }

  identifyInboundConnection(body: unknown, _headers: IncomingHttpHeaders): string | null {
    const requestType = detectAimPortRequestType(body);
    if (!requestType) return null;

    const envelope = getAimPortEnvelope(body, requestType);
    const login = envelope?.login;
    if (!login || typeof login !== 'object') return null;

    return coerceClientId((login as Record<string, unknown>).client_id) ?? null;
  }

  async authenticateInbound(
    body: unknown,
    _headers: IncomingHttpHeaders,
    connection: VendorConnection,
    context: InboundAdapterContext,
  ): Promise<void> {
    const requestType = detectAimPortRequestType(body);
    if (!requestType) {
      throw new Error('AIM-Port request type not recognized');
    }

    const envelope = getAimPortEnvelope(body, requestType);
    const login = asRecord(envelope?.login);
    const clientId = coerceClientId(login?.client_id);
    const apiKey = stringValue(login?.api_key);

    if (!clientId || !apiKey) {
      throw new Error('AIM-Port login.client_id and login.api_key are required');
    }

    if (clientId !== connection.inboundIdentifier) {
      throw new Error(
        `AIM-Port client_id mismatch. Expected ${connection.inboundIdentifier}, received ${clientId}`,
      );
    }

    const inboundApiKeySecretName = connection.credentials.inboundApiKeySecretName;
    if (!inboundApiKeySecretName) {
      throw new Error(
        `Vendor connection ${connection.id} is missing credentials.inboundApiKeySecretName for AIM-Port`,
      );
    }

    const expectedApiKey = await context.resolveSecret(inboundApiKeySecretName);
    if (apiKey !== expectedApiKey) {
      throw new Error(`AIM-Port api_key authentication failed for client_id=${clientId}`);
    }
  }

  async handleInbound(
    body: unknown,
    _headers: IncomingHttpHeaders,
    connection: VendorConnection,
    context: InboundAdapterContext,
  ): Promise<AdapterInboundResult> {
    const requestType = detectAimPortRequestType(body);
    if (!requestType) {
      throw new Error('Unable to determine AIM-Port request type');
    }

    const envelope = getAimPortEnvelope(body, requestType);
    const login = asRecord(envelope?.login);
    const vendorOrderId = this.resolveVendorOrderId(requestType, envelope, login);
    const legacyOrderId = vendorOrderId ? makeLegacyOrderId(vendorOrderId) : null;
    const baseEvent = {
      id: crypto.randomUUID(),
      vendorType: this.vendorType,
      vendorOrderId: vendorOrderId ?? 'unknown',
      ourOrderId: legacyOrderId,
      lenderId: connection.lenderId,
      tenantId: connection.tenantId,
      occurredAt: new Date().toISOString(),
      origin: 'inbound' as const,
    };

    const events: VendorDomainEvent[] = this.mapInboundEvents(requestType, envelope, baseEvent, connection.productMappings);

    appInsightsMetrics.trackVendorInboundReceived({
      correlationId: baseEvent.id,
      requestType,
      vendorOrderId: baseEvent.vendorOrderId,
      connectionId: connection.id,
      vendorType: this.vendorType,
    });

    let resolvedOrderId = legacyOrderId;
    if (
      requestType === 'OrderRequest' &&
      context.createOrGetOrderReference &&
      events[0]?.eventType === 'vendor.order.received'
    ) {
      const reference = await context.createOrGetOrderReference(connection, events[0]);
      resolvedOrderId = reference.orderId;
      if (events[0]) {
        events[0] = {
          ...events[0],
          ourOrderId: reference.orderId,
        };
      }
    }

    const ack = this.buildAckResponse(requestType, login, vendorOrderId, resolvedOrderId, envelope, connection.productMappings);

    return { domainEvents: events, ack: { statusCode: 200, body: ack } };
  }

  async buildOutboundCall(
    event: VendorDomainEvent,
    connection: VendorConnection,
    context: OutboundAdapterContext,
  ): Promise<OutboundCall | null> {
    const outboundApiKeySecretName = connection.credentials.outboundApiKeySecretName;
    if (!outboundApiKeySecretName) {
      throw new Error(
        `Vendor connection ${connection.id} is missing credentials.outboundApiKeySecretName for AIM-Port`,
      );
    }

    const clientId = connection.credentials.outboundClientId;
    if (!clientId) {
      throw new Error(
        `Vendor connection ${connection.id} is missing credentials.outboundClientId for AIM-Port`,
      );
    }

    const apiKey = await context.resolveSecret(outboundApiKeySecretName);
    const vendorOrderId = event.vendorOrderId;

    const login = {
      client_id: clientId,
      api_key: apiKey,
      order_id: vendorOrderId,
    };

    switch (event.eventType) {
      case 'vendor.order.assigned':
        return this.outbound(connection.outboundEndpointUrl, 'OrderAssignedRequest', { login }, event.eventType, vendorOrderId);
      case 'vendor.order.accepted': {
        const payload = event.payload;
        return this.outbound(connection.outboundEndpointUrl, 'OrderAcceptedRequest', {
          login,
          order: {
            vendor_first_name: 'vendorFirstName' in payload ? payload.vendorFirstName : undefined,
            vendor_last_name: 'vendorLastName' in payload ? payload.vendorLastName : undefined,
            vendor_license_number: 'vendorLicenseNumber' in payload ? payload.vendorLicenseNumber : undefined,
            vendor_license_expiration: 'vendorLicenseExpiration' in payload ? payload.vendorLicenseExpiration : undefined,
          },
        }, event.eventType, vendorOrderId);
      }
      case 'vendor.order.held':
        return this.outbound(connection.outboundEndpointUrl, 'OrderHoldRequest', { login, order: { hold_message: 'message' in event.payload ? event.payload.message : undefined } }, event.eventType, vendorOrderId);
      case 'vendor.order.resumed':
        return this.outbound(connection.outboundEndpointUrl, 'OrderResumeRequest', { login, order: { resume_message: 'message' in event.payload ? event.payload.message : undefined } }, event.eventType, vendorOrderId);
      case 'vendor.order.cancelled':
        return this.outbound(connection.outboundEndpointUrl, 'OrderCancelledRequest', { login, order: { cancellation_message: 'message' in event.payload ? event.payload.message : undefined } }, event.eventType, vendorOrderId);
      case 'vendor.order.scheduled':
        {
          const payload = event.payload as VendorOrderScheduledPayload;
        return this.outbound(connection.outboundEndpointUrl, 'OrderScheduledRequest', {
          login,
          order: {
            inspection_date: payload.inspectionDate,
            appraiser_id: payload.appraiserId,
            scheduled_start_time: payload.scheduledSlot.startTime,
            scheduled_end_time: payload.scheduledSlot.endTime,
            scheduled_timezone: payload.scheduledSlot.timezone,
            requested_by: payload.requestedBy,
            inspection_notes: payload.inspectionNotes,
            appointment_type: payload.appointmentType,
            property_access: {
                  name: payload.propertyAccess.contactName,
                  cell_phone: payload.propertyAccess.contactPhone,
                  email: payload.propertyAccess.contactEmail,
                  access_instructions: payload.propertyAccess.accessInstructions,
                  requires_escort: payload.propertyAccess.requiresEscort,
                  pet_warning: payload.propertyAccess.petWarning,
                  parking_instructions: payload.propertyAccess.parkingInstructions,
                  special_requirements: payload.propertyAccess.specialRequirements,
                  type: 'scheduled_access',
                },
          },
        }, event.eventType, vendorOrderId);
        }
      case 'vendor.order.inspected':
        return this.outbound(connection.outboundEndpointUrl, 'OrderInspectedRequest', { login, order: { inspection_date: 'inspectionDate' in event.payload ? event.payload.inspectionDate : undefined } }, event.eventType, vendorOrderId);
      case 'vendor.order.due_date_changed':
        return this.outbound(connection.outboundEndpointUrl, 'OrderDueDateRequest', { login, order: { due_date: 'dueDate' in event.payload ? event.payload.dueDate : undefined } }, event.eventType, vendorOrderId);
      case 'vendor.order.fee_changed':
        return this.outbound(connection.outboundEndpointUrl, 'OrderFeeChangeRequest', { login, order: { fee: 'fee' in event.payload ? event.payload.fee : undefined } }, event.eventType, vendorOrderId);
      case 'vendor.order.paid':
        return this.outbound(connection.outboundEndpointUrl, 'OrderPaidRequest', { login, order: { paid_amount: 'paidAmount' in event.payload ? event.payload.paidAmount : undefined } }, event.eventType, vendorOrderId);
      case 'vendor.file.received_no_completion':
        return this.outbound(connection.outboundEndpointUrl, 'DocsNoCompletionRequest', { login, files: 'files' in event.payload ? event.payload.files.map(this.fromVendorFile) : [] }, event.eventType, vendorOrderId);
      case 'vendor.order.completed':
        return this.outbound(connection.outboundEndpointUrl, 'OrderFilesRequest', { login, files: 'files' in event.payload ? event.payload.files.map(this.fromVendorFile) : [] }, event.eventType, vendorOrderId);
      case 'vendor.message.received':
        return this.outbound(connection.outboundEndpointUrl, 'MessageRequest', { login, message: { subject: 'subject' in event.payload ? event.payload.subject : '', content: 'content' in event.payload ? event.payload.content : '' } }, event.eventType, vendorOrderId);
      // NOTE: vendor.revision.requested is NOT valid outbound — RevisionRequest is documented as
      // "Client to Vendor" only in the AIM-Port spec (v2.9 p.11). It is an inbound-only event.
      // To notify AIM-Port of a revision from our QC side, use MessageRequest instead.
      default:
        return null;
    }
  }

  private outbound(url: string, requestType: string, payload: Record<string, unknown>, eventType: VendorDomainEvent['eventType'], vendorOrderId: string): OutboundCall {
    return {
      url,
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: { [requestType]: payload },
      eventType,
      vendorOrderId,
    };
  }

  private fromVendorFile(file: VendorFile): AimPortFile {
    return definedProps({
      file_id: file.fileId,
      filename: file.filename,
      category: file.category,
      category_label: file.categoryLabel,
      description: file.description,
      content: file.content,
    }) as AimPortFile;
  }

  private resolveVendorOrderId(
    requestType: AimPortRequestType,
    envelope: Record<string, unknown> | null,
    login: Record<string, unknown> | null,
  ): string | undefined {
    // AIM-Port sends order_id as a string in sandbox but as an integer in
    // production payloads — coerce both forms to a string.
    const loginOrderId = coerceClientId(login?.order_id) ?? coerceClientId(login?.aimport_order_id);
    if (loginOrderId) return loginOrderId;

    if (requestType === 'OrderRequest') {
      const order = asRecord(envelope?.order);
      return coerceClientId(order?.order_id);
    }

    if (requestType === 'OrderUpdateRequest') {
      const order = asRecord(envelope?.order);
      return coerceClientId(order?.aimport_order_id) ?? coerceClientId(order?.tracking_num);
    }

    return undefined;
  }

  private mapInboundEvents(
    requestType: AimPortRequestType,
    envelope: Record<string, unknown> | null,
    baseEvent: Omit<VendorDomainEvent, 'eventType' | 'payload'>,
    productMappings?: Record<string, string>,
  ): VendorDomainEvent[] {
    switch (requestType) {
      case 'OrderRequest': {
        const order = (envelope?.order as AimPortOrderDetails | undefined);
        const files = toVendorFiles((envelope?.files as AimPortFile[] | undefined));
        const borrower: VendorOrderReceivedPayload['borrower'] = {
          name: order?.borrower?.name ?? '',
          ...(order?.borrower?.address ? { address: order.borrower.address } : {}),
          ...(order?.borrower?.city ? { city: order.borrower.city } : {}),
          ...(order?.borrower?.state ? { state: order.borrower.state } : {}),
          ...(order?.borrower?.zip_code ? { zipCode: order.borrower.zip_code } : {}),
          ...(order?.borrower?.email ? { email: order.borrower.email } : {}),
          ...(order?.borrower?.phone ? { phone: order.borrower.phone } : {}),
        };
        const coborrower: VendorOrderReceivedPayload['coborrower'] = order?.coborrower
          ? {
              ...(order.coborrower.name ? { name: order.coborrower.name } : {}),
              ...(order.coborrower.email ? { email: order.coborrower.email } : {}),
              ...(order.coborrower.phone ? { phone: order.coborrower.phone } : {}),
            }
          : undefined;
        const propertyAccess: VendorOrderReceivedPayload['propertyAccess'] = order?.property_access
          ? {
              type: order.property_access.type,
              name: order.property_access.name,
              ...(order.property_access.home_phone ? { homePhone: order.property_access.home_phone } : {}),
              ...(order.property_access.cell_phone ? { cellPhone: order.property_access.cell_phone } : {}),
              ...(order.property_access.work_phone ? { workPhone: order.property_access.work_phone } : {}),
              ...(order.property_access.email ? { email: order.property_access.email } : {}),
            }
          : undefined;
        const products: VendorOrderReceivedPayload['products'] = (order?.reports ?? []).map((report) => ({
          id: report.id ?? report.report_type ?? 0,
          ...(report.name ? { name: report.name } : {}),
        }));
        const purchasePrice = numberValue(order?.purchase_price);
        const disclosedFee = numberValue(order?.disclosed_fee);
        const loanAmount = numberValue(order?.loan_amount);
        const anticipatedValue = numberValue(order?.anticipated_value);
        const payload: VendorOrderReceivedPayload = {
          orderType: order?.order_type === 'commercial' ? 'commercial' : 'residential',
          address: order?.address ?? '',
          ...(order?.address2 ? { address2: order.address2 } : {}),
          city: order?.city ?? '',
          state: order?.state ?? '',
          zipCode: order?.zip_code ?? '',
          ...(order?.county ? { county: order.county } : {}),
          ...(order?.loan_number ? { loanNumber: order.loan_number } : {}),
          ...(order?.case_number ? { caseNumber: order.case_number } : {}),
          ...(purchasePrice !== undefined ? { purchasePrice } : {}),
          ...(disclosedFee !== undefined ? { disclosedFee } : {}),
          ...(loanAmount !== undefined ? { loanAmount } : {}),
          ...(anticipatedValue !== undefined ? { anticipatedValue } : {}),
          propertyType: order?.property_type ?? '',
          ...(order?.loan_type ? { loanType: order.loan_type } : {}),
          ...(order?.loan_purpose ? { loanPurpose: order.loan_purpose } : {}),
          ...(order?.occupancy ? { occupancy: order.occupancy } : {}),
          ...(order?.intended_use ? { intendedUse: order.intended_use } : {}),
          borrower,
          ...(coborrower ? { coborrower } : {}),
          ...(propertyAccess ? { propertyAccess } : {}),
          products,
          ...(order?.payment_method ? { paymentMethod: order.payment_method } : {}),
          ...(order?.due_date ? { dueDate: order.due_date } : {}),
          ...(order?.settlement_date ? { settlementDate: order.settlement_date } : {}),
          ...(order?.itp_date ? { itpDate: order.itp_date } : {}),
          rush: booleanValue(order?.rush),
          ...(order?.special_instructions ? { specialInstructions: order.special_instructions } : {}),
          ...(order?.client_name ? { clientName: order.client_name } : {}),
          files,
        };
        return [{
          ...baseEvent,
          eventType: 'vendor.order.received',
          payload,
        }];
      }
      case 'MessageRequest': {
        const message = asRecord(envelope?.message);
        return [{ ...baseEvent, eventType: 'vendor.message.received', payload: { subject: stringValue(message?.subject) ?? '', content: stringValue(message?.content) ?? '' } }];
      }
      case 'NewFilesRequest': {
        const order = asRecord(envelope?.order);
        const files = toVendorFiles((order?.new_files as AimPortFile[] | undefined) ?? (envelope?.files as AimPortFile[] | undefined));
        return [{ ...baseEvent, eventType: 'vendor.file.received', payload: { files } }];
      }
      case 'LoanNumUpdateRequest': {
        const order = asRecord(envelope?.order);
        return [{ ...baseEvent, eventType: 'vendor.loan_number.updated', payload: { loanNumber: stringValue(order?.loan_number) ?? '' } }];
      }
      case 'FHANumUpdateRequest': {
        const order = asRecord(envelope?.order);
        return [{ ...baseEvent, eventType: 'vendor.fha_case_number.updated', payload: { caseNumber: stringValue(order?.case_number) ?? '' } }];
      }
      case 'RevisionRequest': {
        const message = asRecord(envelope?.message);
        return [{ ...baseEvent, eventType: 'vendor.revision.requested', payload: { subject: stringValue(message?.subject) ?? '', content: stringValue(message?.content) ?? '' } }];
      }
      case 'ProductListRequest': {
        // AIM-Port is requesting our product catalogue. Build the payload from
        // the productMappings on this VendorConnection (vendor ID → internal type).
        const products: VendorProductsListedPayload['products'] = Object.entries(productMappings ?? {}).map(
          ([vendorId, internalType]) => ({
            productId: Number(vendorId),
            productName: AIM_PORT_PRODUCT_NAMES[Number(vendorId)] ?? internalType,
            formType: internalType,
            orderType: 'residential',
          }),
        );
        return [{ ...baseEvent, eventType: 'vendor.products.listed', payload: { products } }];
      }
      case 'OrderAssignedRequest':
      case 'OrderAcceptedRequest':
        // These are "Vendor to Client" events per the AIM-Port spec (v2.9).
        // We are the vendor — we SEND these outbound; AIM-Port never sends them to us.
        // If received (data error, test harness, etc.) produce no domain events so we
        // cannot accidentally trigger a second assignment/acceptance cycle.
        return [];
      case 'OrderHoldRequest':
      case 'OrderResumeRequest':
      case 'OrderCancelledRequest':
        // These are "Vendor to Client" events per the AIM-Port spec (v2.9 pp. 8-10).
        // We are the vendor — we SEND hold/resume/cancel outbound to the lender's AIM-Port system.
        // AIM-Port reflects these back to our inbound URL as an echo-confirmation of receipt.
        // Producing domain events for them would re-trigger outbound notifications, creating
        // an infinite hold→echo→hold→echo loop. Return empty so they are fully suppressed.
        return [];
      case 'OrderScheduledRequest': {
        const order = asRecord(envelope?.order);
        return [{ ...baseEvent, eventType: 'vendor.order.scheduled', payload: buildScheduledPayload(order) }];
      }
      case 'OrderInspectedRequest': {
        const order = asRecord(envelope?.order);
        return [{ ...baseEvent, eventType: 'vendor.order.inspected', payload: { inspectionDate: stringValue(order?.inspection_date) ?? '' } }];
      }
      case 'OrderDueDateRequest': {
        const order = asRecord(envelope?.order);
        return [{ ...baseEvent, eventType: 'vendor.order.due_date_changed', payload: { dueDate: stringValue(order?.due_date) ?? '' } }];
      }
      case 'OrderFeeChangeRequest': {
        const order = asRecord(envelope?.order);
        return [{ ...baseEvent, eventType: 'vendor.order.fee_changed', payload: { fee: numberValue(order?.fee) ?? 0 } }];
      }
      case 'OrderPaidRequest': {
        const order = asRecord(envelope?.order);
        return [{ ...baseEvent, eventType: 'vendor.order.paid', payload: { paidAmount: numberValue(order?.paid_amount) ?? 0 } }];
      }
      case 'DocsNoCompletionRequest': {
        const files = toVendorFiles((envelope?.files as AimPortFile[] | undefined) ?? []);
        return [{ ...baseEvent, eventType: 'vendor.file.received_no_completion', payload: { files } }];
      }
      case 'OrderFilesRequest': {
        const files = toVendorFiles((envelope?.files as AimPortFile[] | undefined) ?? []);
        return [{ ...baseEvent, eventType: 'vendor.order.completed', payload: { files } }];
      }
      case 'GetOrderRequest': {
        // AIM-Port is polling the current status of this order.
        // We emit a domain event so downstream services can react (e.g. enriching
        // the ACK with live order state via a service-layer lookup).
        return [{ ...baseEvent, eventType: 'vendor.order.status_queried', payload: { vendorOrderId: baseEvent.vendorOrderId } }];
      }
      case 'OrderUpdateRequest': {
        // AIM-Port is notifying us of lender-side edits to a placed order
        // (address change, product change, financial update, etc.).
        const order = asRecord(envelope?.order);
        const files = toVendorFiles((envelope?.files as AimPortFile[] | undefined) ?? []);
        const loanNumber = stringValue(order?.loan_number);
        const caseNumber = stringValue(order?.case_number);
        const address = stringValue(order?.address);
        const address2 = stringValue(order?.address2);
        const city = stringValue(order?.city);
        const state = stringValue(order?.state);
        const zipCode = stringValue(order?.zip_code);
        const county = stringValue(order?.county);
        const dueDate = stringValue(order?.due_date);
        const purchasePrice = numberValue(order?.purchase_price);
        const loanAmount = numberValue(order?.loan_amount);
        const disclosedFee = numberValue(order?.disclosed_fee);
        const anticipatedValue = numberValue(order?.anticipated_value);
        const fee = numberValue(order?.fee);
        const payload: VendorOrderUpdatedPayload = {
          ...(loanNumber !== undefined ? { loanNumber } : {}),
          ...(caseNumber !== undefined ? { caseNumber } : {}),
          ...(address !== undefined ? { address } : {}),
          ...(address2 !== undefined ? { address2 } : {}),
          ...(city !== undefined ? { city } : {}),
          ...(state !== undefined ? { state } : {}),
          ...(zipCode !== undefined ? { zipCode } : {}),
          ...(county !== undefined ? { county } : {}),
          ...(purchasePrice !== undefined ? { purchasePrice } : {}),
          ...(loanAmount !== undefined ? { loanAmount } : {}),
          ...(disclosedFee !== undefined ? { disclosedFee } : {}),
          ...(anticipatedValue !== undefined ? { anticipatedValue } : {}),
          ...(dueDate !== undefined ? { dueDate } : {}),
          ...(fee !== undefined ? { fee } : {}),
          ...(files.length > 0 ? { files } : {}),
        };
        return [{ ...baseEvent, eventType: 'vendor.order.updated', payload }];
      }
      default:
        return [];
    }
  }

  private buildAckResponse(
    requestType: AimPortRequestType,
    login: Record<string, unknown> | null,
    vendorOrderId: string | undefined,
    ourOrderId: string | null,
    envelope: Record<string, unknown> | null,
    productMappings?: Record<string, string>,
  ): AimPortAckResponse {
    const clientId = stringValue(login?.client_id) ?? '';
    if (requestType === 'OrderRequest') {
      const order = asRecord(envelope?.order);
      return definedProps({
        client_id: clientId,
        success: 'true',
        order_id: ourOrderId ?? vendorOrderId,
        fee: numberValue(order?.disclosed_fee) ?? 0,
      }) as AimPortAckResponse;
    }

    if (requestType === 'GetOrderRequest') {
      // AIM-Port is polling order status. Return our internal order ID for correlation.
      // Callers that need to enrich `order_status` should do so in the service layer
      // after this ACK is returned (adapter has no DB access).
      return definedProps({
        client_id: clientId,
        success: 'true',
        order_id: ourOrderId ?? vendorOrderId,
      }) as AimPortAckResponse;
    }

    if (requestType === 'ProductListRequest') {
      // Respond with our supported product catalogue so AIM-Port knows what
      // to present in their ordering UI for this lender connection.
      const products = Object.keys(productMappings ?? {}).map((vendorId) => ({
        id: Number(vendorId),
        name: AIM_PORT_PRODUCT_NAMES[Number(vendorId)] ?? vendorId,
      }));
      return definedProps({
        client_id: clientId,
        success: 'true',
        products,
      }) as AimPortAckResponse;
    }

    return definedProps({
      client_id: clientId,
      success: 'true',
      order_id: vendorOrderId,
    }) as AimPortAckResponse;
  }
}
