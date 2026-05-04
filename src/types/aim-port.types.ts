/**
 * AIM-Port raw API request/response types.
 *
 * These mirror the vendor contract as closely as practical so the adapter can
 * parse/validate vendor payloads without leaking AIM-Port field names into the
 * rest of the application.
 */

export interface AimPortLogin {
  client_id: string;
  api_key: string;
  order_id?: string;
  aimport_order_id?: string;
}

export interface AimPortFile {
  file_id: string;
  content: string;
  filename: string;
  category: string;
  category_label?: string;
  description?: string;
}

export interface AimPortMessageBody {
  subject: string;
  content: string;
}

export interface AimPortBorrower {
  name: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  email?: string;
  phone?: string;
}

export interface AimPortPropertyAccess {
  type: string;
  name: string;
  home_phone?: string;
  cell_phone?: string;
  work_phone?: string;
  email?: string;
  other_description?: string;
  access_instructions?: string;
  requires_escort?: boolean | string;
  pet_warning?: string;
  parking_instructions?: string;
  special_requirements?: string[] | string;
}

export interface AimPortOrderDetails {
  order_id?: string;
  order_type: 'residential' | 'commercial' | string;
  address: string;
  address2?: string;
  city: string;
  state: string;
  zip_code: string;
  county?: string;
  loan_number?: string;
  case_number?: string;
  purchase_price?: string | number;
  disclosed_fee?: string | number;
  loan_amount?: string | number;
  anticipated_value?: string | number;
  seller_concessions?: string | number;
  property_type: string;
  loan_type?: string;
  occupancy?: string;
  intended_use?: string;
  property_rights?: string;
  property_owner?: string;
  loan_purpose?: string;
  intended_users?: string;
  borrower: AimPortBorrower;
  coborrower?: Partial<AimPortBorrower>;
  property_access?: AimPortPropertyAccess;
  notification_emails?: string[] | Record<string, string>;
  reports?: Array<{ id?: number; report_type?: number; name?: string }>;
  payment_method?: string;
  due_date?: string;
  settlement_date?: string;
  itp_date?: string;
  investor?: string;
  special_instructions?: string;
  rush?: boolean | string;
  client_name?: string;
  client_address?: string;
  client_address2?: string;
  client_city?: string;
  client_state?: string;
  client_zip?: string;
  branch_name?: string;
  hold_message?: string;
  resume_message?: string;
  cancellation_message?: string;
  inspection_date?: string;
  appraiser_id?: string;
  scheduled_start_time?: string;
  scheduled_end_time?: string;
  scheduled_timezone?: string;
  requested_by?: string;
  inspection_notes?: string;
  appointment_type?: 'property_inspection' | 'appraisal_appointment' | 'bpo_site_visit' | string;
  due_date_change?: string;
  due_date_updated?: string;
  fee?: string | number;
  paid_amount?: string | number;
  new_files?: AimPortFile[];
  vendor_first_name?: string;
  vendor_last_name?: string;
  vendor_license_number?: string;
  vendor_license_expiration?: string;
}

export interface AimPortOrderRequestEnvelope {
  login: AimPortLogin;
  order: AimPortOrderDetails;
  files?: AimPortFile[];
}

export interface AimPortMessageRequestEnvelope {
  login: AimPortLogin;
  message: AimPortMessageBody;
}

export interface AimPortFilesRequestEnvelope {
  login: AimPortLogin;
  files?: AimPortFile[];
  order?: { new_files?: AimPortFile[] };
}

export interface AimPortSimpleOrderUpdateEnvelope {
  login: AimPortLogin;
  order: Partial<AimPortOrderDetails>;
}

export interface AimPortProductListRequestEnvelope {
  login: AimPortLogin;
}

export interface AimPortOrderRequestBody { OrderRequest: AimPortOrderRequestEnvelope; }
export interface AimPortGetOrderRequestBody { GetOrderRequest: { login: AimPortLogin }; }
export interface AimPortMessageRequestBody { MessageRequest: AimPortMessageRequestEnvelope; }
export interface AimPortNewFilesRequestBody { NewFilesRequest: AimPortFilesRequestEnvelope; }
export interface AimPortLoanNumUpdateRequestBody { LoanNumUpdateRequest: AimPortSimpleOrderUpdateEnvelope; }
export interface AimPortFhaNumUpdateRequestBody { FHANumUpdateRequest: AimPortSimpleOrderUpdateEnvelope; }
export interface AimPortRevisionRequestBody { RevisionRequest: AimPortMessageRequestEnvelope; }
export interface AimPortProductListRequestBody { ProductListRequest: AimPortProductListRequestEnvelope; }
export interface AimPortOrderAssignedRequestBody { OrderAssignedRequest: { login: AimPortLogin }; }
export interface AimPortOrderAcceptedRequestBody { OrderAcceptedRequest: AimPortSimpleOrderUpdateEnvelope; }
export interface AimPortOrderHoldRequestBody { OrderHoldRequest: AimPortSimpleOrderUpdateEnvelope; }
export interface AimPortOrderResumeRequestBody { OrderResumeRequest: AimPortSimpleOrderUpdateEnvelope; }
export interface AimPortOrderCancelledRequestBody { OrderCancelledRequest: AimPortSimpleOrderUpdateEnvelope; }
export interface AimPortOrderScheduledRequestBody { OrderScheduledRequest: AimPortSimpleOrderUpdateEnvelope; }
export interface AimPortOrderInspectedRequestBody { OrderInspectedRequest: AimPortSimpleOrderUpdateEnvelope; }
export interface AimPortOrderDueDateRequestBody { OrderDueDateRequest: AimPortSimpleOrderUpdateEnvelope; }
export interface AimPortOrderFeeChangeRequestBody { OrderFeeChangeRequest: AimPortSimpleOrderUpdateEnvelope; }
export interface AimPortOrderPaidRequestBody { OrderPaidRequest: AimPortSimpleOrderUpdateEnvelope; }
export interface AimPortDocsNoCompletionRequestBody { DocsNoCompletionRequest: AimPortFilesRequestEnvelope; }
export interface AimPortOrderFilesRequestBody { OrderFilesRequest: AimPortFilesRequestEnvelope; }
export interface AimPortOrderUpdateRequestBody {
  OrderUpdateRequest: {
    login: AimPortLogin;
    order: Partial<AimPortOrderDetails> & {
      aimport_order_id?: string;
      tracking_num?: string;
    };
    files?: AimPortFile[];
  };
}

export type AimPortInboundRequest =
  | AimPortOrderRequestBody
  | AimPortGetOrderRequestBody
  | AimPortMessageRequestBody
  | AimPortNewFilesRequestBody
  | AimPortLoanNumUpdateRequestBody
  | AimPortFhaNumUpdateRequestBody
  | AimPortRevisionRequestBody
  | AimPortProductListRequestBody
  | AimPortOrderAssignedRequestBody
  | AimPortOrderAcceptedRequestBody
  | AimPortOrderHoldRequestBody
  | AimPortOrderResumeRequestBody
  | AimPortOrderCancelledRequestBody
  | AimPortOrderScheduledRequestBody
  | AimPortOrderInspectedRequestBody
  | AimPortOrderDueDateRequestBody
  | AimPortOrderFeeChangeRequestBody
  | AimPortOrderPaidRequestBody
  | AimPortDocsNoCompletionRequestBody
  | AimPortOrderFilesRequestBody
  | AimPortOrderUpdateRequestBody;

export type AimPortRequestType =
  | 'OrderRequest'
  | 'GetOrderRequest'
  | 'MessageRequest'
  | 'NewFilesRequest'
  | 'LoanNumUpdateRequest'
  | 'FHANumUpdateRequest'
  | 'RevisionRequest'
  | 'ProductListRequest'
  | 'OrderAssignedRequest'
  | 'OrderAcceptedRequest'
  | 'OrderHoldRequest'
  | 'OrderResumeRequest'
  | 'OrderCancelledRequest'
  | 'OrderScheduledRequest'
  | 'OrderInspectedRequest'
  | 'OrderDueDateRequest'
  | 'OrderFeeChangeRequest'
  | 'OrderPaidRequest'
  | 'DocsNoCompletionRequest'
  | 'OrderFilesRequest'
  | 'OrderUpdateRequest';

export const AIM_PORT_REQUEST_TYPES: AimPortRequestType[] = [
  'OrderRequest',
  'GetOrderRequest',
  'MessageRequest',
  'NewFilesRequest',
  'LoanNumUpdateRequest',
  'FHANumUpdateRequest',
  'RevisionRequest',
  'ProductListRequest',
  'OrderAssignedRequest',
  'OrderAcceptedRequest',
  'OrderHoldRequest',
  'OrderResumeRequest',
  'OrderCancelledRequest',
  'OrderScheduledRequest',
  'OrderInspectedRequest',
  'OrderDueDateRequest',
  'OrderFeeChangeRequest',
  'OrderPaidRequest',
  'DocsNoCompletionRequest',
  'OrderFilesRequest',
  'OrderUpdateRequest',
];

export interface AimPortAckResponse {
  client_id: string;
  success: 'true' | 'false';
  order_id?: string;
  message?: string;
  fee?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function detectAimPortRequestType(body: unknown): AimPortRequestType | null {
  if (!isRecord(body)) return null;
  for (const key of AIM_PORT_REQUEST_TYPES) {
    if (key in body && isRecord(body[key])) {
      return key;
    }
  }
  return null;
}

export function getAimPortEnvelope<T extends AimPortRequestType>(
  body: unknown,
  type: T,
): Record<string, unknown> | null {
  if (!isRecord(body)) return null;
  const envelope = body[type];
  return isRecord(envelope) ? envelope : null;
}
