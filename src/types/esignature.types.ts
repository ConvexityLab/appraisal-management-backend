/**
 * E-Signature Types
 * Provider-agnostic abstraction for document e-signing workflows.
 * Supports DocuSign, Adobe Sign, or custom integrations via the provider field.
 */

/** Supported e-signature providers */
export type ESignatureProvider = 'docusign' | 'adobe_sign' | 'manual' | 'internal';

/** Lifecycle status of a signing request */
export enum ESignatureStatus {
  /** Request created, not yet sent to signer(s) */
  DRAFT = 'DRAFT',
  /** Sent to signer(s), waiting for signatures */
  SENT = 'SENT',
  /** At least one signer has viewed the document */
  VIEWED = 'VIEWED',
  /** All required signatures collected */
  COMPLETED = 'COMPLETED',
  /** Signing declined by a signer */
  DECLINED = 'DECLINED',
  /** Signing voided by requestor */
  VOIDED = 'VOIDED',
  /** Signing expired before completion */
  EXPIRED = 'EXPIRED',
}

/** Valid transitions for the signing request state machine */
export const VALID_ESIGNATURE_TRANSITIONS: Record<ESignatureStatus, ReadonlySet<ESignatureStatus>> = {
  [ESignatureStatus.DRAFT]: new Set([ESignatureStatus.SENT, ESignatureStatus.VOIDED]),
  [ESignatureStatus.SENT]: new Set([ESignatureStatus.VIEWED, ESignatureStatus.COMPLETED, ESignatureStatus.DECLINED, ESignatureStatus.VOIDED, ESignatureStatus.EXPIRED]),
  [ESignatureStatus.VIEWED]: new Set([ESignatureStatus.COMPLETED, ESignatureStatus.DECLINED, ESignatureStatus.VOIDED, ESignatureStatus.EXPIRED]),
  [ESignatureStatus.COMPLETED]: new Set([]), // terminal
  [ESignatureStatus.DECLINED]: new Set([ESignatureStatus.SENT]), // can re-send after decline
  [ESignatureStatus.VOIDED]: new Set([]),    // terminal
  [ESignatureStatus.EXPIRED]: new Set([ESignatureStatus.SENT]), // can re-send after expiry
};

/** A party that needs to sign the document */
export interface SigningParty {
  name: string;
  email: string;
  role: 'appraiser' | 'borrower' | 'lender' | 'vendor' | 'reviewer' | 'client';
  /** Order in which this party should sign (1-based) */
  signingOrder: number;
  /** Current status of this party's signature */
  status: 'pending' | 'sent' | 'viewed' | 'signed' | 'declined';
  signedAt?: string;
  declinedAt?: string;
  declineReason?: string;
}

/** Tracks an e-signature request stored in Cosmos DB */
export interface ESignatureRequest {
  id: string;
  tenantId: string;
  orderId: string;
  /** The document being signed */
  documentId: string;
  documentName: string;

  /** Provider used for this signing (defaults to 'internal') */
  provider: ESignatureProvider;
  /** External envelope/agreement ID from the provider (e.g. DocuSign envelope ID) */
  externalEnvelopeId?: string;
  /** URL for the provider's embedded signing ceremony */
  signingUrl?: string;

  /** Current status */
  status: ESignatureStatus;
  /** Parties required to sign */
  signers: SigningParty[];

  /** Who requested the signatures */
  requestedBy: string;
  requestedByEmail: string;
  requestedAt: string;

  /** Optional message to include in signing request */
  message?: string;
  /** When the signing request expires */
  expiresAt?: string;

  /** Completion tracking */
  completedAt?: string;
  /** Signed document blob URL (after completion) */
  signedDocumentUrl?: string;
  signedDocumentId?: string;

  createdAt: string;
  updatedAt: string;

  /** Audit trail */
  events: ESignatureEvent[];
}

/** Audit event for a signing request */
export interface ESignatureEvent {
  id: string;
  action: string;
  performedBy: string;
  details?: string;
  timestamp: string;
}

/** Input for creating a new signing request */
export interface CreateESignatureInput {
  orderId: string;
  documentId: string;
  documentName: string;
  provider?: ESignatureProvider;
  signers: Array<Pick<SigningParty, 'name' | 'email' | 'role' | 'signingOrder'>>;
  message?: string;
  expiresAt?: string;
}

/** Input for updating signing status (e.g. from provider webhook) */
export interface UpdateESignatureStatusInput {
  status: ESignatureStatus;
  externalEnvelopeId?: string;
  signingUrl?: string;
  signedDocumentUrl?: string;
  signedDocumentId?: string;
  /** Updated signer statuses */
  signerUpdates?: Array<{
    email: string;
    status: SigningParty['status'];
    signedAt?: string;
    declinedAt?: string;
    declineReason?: string;
  }>;
}
