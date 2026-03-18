/**
 * E-Consent and Delivery Receipt Types
 *
 * E-Consent: tracks whether a borrower has given/denied/withdrawn
 * consent to receive the appraisal electronically under RESPA/ECOA rules.
 *
 * DeliveryReceipt: structured record of when/how/by-whom an appraisal
 * delivery package was received, opened, and downloaded.
 */

// ── E-Consent ──────────────────────────────────────────────────────────────

export type ConsentStatus = 'pending' | 'given' | 'denied' | 'withdrawn';

export type ConsentMethod = 'portal' | 'email_link' | 'esign';

export interface EConsentRecord {
  id: string;
  tenantId: string;
  orderId: string;
  /** Email address of the borrower whose consent is being tracked. */
  borrowerEmail: string;
  consentStatus: ConsentStatus;
  consentGivenAt?: string;
  /** Method used to obtain consent (only set when consentStatus = 'given'). */
  consentMethod?: ConsentMethod;
  /**
   * Version string of the RESPA/ECOA disclosure shown to the borrower.
   * Must be incremented whenever the disclosure text changes.
   */
  disclosureVersion: string;
  ipAddress?: string;
  createdAt: string;
  updatedAt: string;
  type: 'econsent';
}

export interface RecordConsentRequest {
  orderId: string;
  borrowerEmail: string;
  consentStatus: 'given' | 'denied';
  consentMethod?: ConsentMethod;
  disclosureVersion: string;
  ipAddress?: string;
}

export interface WithdrawConsentRequest {
  consentId: string;
  orderId: string;
}

// ── Delivery Receipt ───────────────────────────────────────────────────────

export type DeliveryChannel = 'portal' | 'email' | 'api' | 'fax';

export interface DeliveryReceipt {
  id: string;
  orderId: string;
  tenantId: string;
  /** The delivery package this receipt belongs to. */
  packageId: string;
  deliveredAt: string;
  /** User ID or email of the recipient. */
  deliveredTo: string;
  /** User ID of the staff member who sent the delivery. */
  deliveredBy: string;
  channel: DeliveryChannel;
  /** Document version string or hash for audit. */
  reportVersionId: string;
  /** ISO timestamp when the recipient first opened the delivery. */
  openedAt?: string;
  /** ISO timestamp when the recipient first downloaded the package. */
  downloadedAt?: string;
  ipAddress?: string;
  userAgent?: string;
  type: 'delivery-receipt';
}

export interface RecordDeliveryReceiptRequest {
  orderId: string;
  packageId: string;
  deliveredTo: string;
  channel: DeliveryChannel;
  reportVersionId: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface RecordOpenedRequest {
  receiptId: string;
  orderId: string;
  ipAddress?: string;
  userAgent?: string;
}
