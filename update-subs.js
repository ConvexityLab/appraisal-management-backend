const fs = require('fs');
let code = fs.readFileSync('C:/source/appraisal-management-backend/src/services/communication-event-handler.service.ts', 'utf8');
const strToInsert =       this.subscriber.subscribe<PaymentInitiatedEvent>('payment.initiated', this.makeHandler('payment.initiated', this.onPaymentInitiated.bind(this))),
      this.subscriber.subscribe<PaymentCompletedEvent>('payment.completed', this.makeHandler('payment.completed', this.onPaymentCompleted.bind(this))),
      this.subscriber.subscribe<PaymentFailedEvent>('payment.failed', this.makeHandler('payment.failed', this.onPaymentFailed.bind(this))),
      this.subscriber.subscribe<SubmissionUploadedEvent>('submission.uploaded', this.makeHandler('submission.uploaded', this.onSubmissionUploaded.bind(this))),
      this.subscriber.subscribe<SubmissionApprovedEvent>('submission.approved', this.makeHandler('submission.approved', this.onSubmissionApproved.bind(this))),
      this.subscriber.subscribe<SubmissionRejectedEvent>('submission.rejected', this.makeHandler('submission.rejected', this.onSubmissionRejected.bind(this))),
      this.subscriber.subscribe<SubmissionRevisionRequestedEvent>('submission.revision.requested', this.makeHandler('submission.revision.requested', this.onSubmissionRevisionRequested.bind(this))),
      this.subscriber.subscribe<EscalationCreatedEvent>('escalation.created', this.makeHandler('escalation.created', this.onEscalationCreated.bind(this))),
      this.subscriber.subscribe<EscalationResolvedEvent>('escalation.resolved', this.makeHandler('escalation.resolved', this.onEscalationResolved.bind(this))),
      this.subscriber.subscribe<RovCreatedEvent>('rov.created', this.makeHandler('rov.created', this.onRovCreated.bind(this))),
      this.subscriber.subscribe<RovAssignedEvent>('rov.assigned', this.makeHandler('rov.assigned', this.onRovAssigned.bind(this))),
      this.subscriber.subscribe<RovDecisionIssuedEvent>('rov.decision.issued', this.makeHandler('rov.decision.issued', this.onRovDecisionIssued.bind(this))),
      this.subscriber.subscribe<DeliveryReceiptConfirmedEvent>('delivery.receipt.confirmed', this.makeHandler('delivery.receipt.confirmed', this.onDeliveryReceiptConfirmed.bind(this))),
      this.subscriber.subscribe<DeliveryReceiptOpenedEvent>('delivery.receipt.opened', this.makeHandler('delivery.receipt.opened', this.onDeliveryReceiptOpened.bind(this))),
      this.subscriber.subscribe<ConsentGivenEvent>('consent.given', this.makeHandler('consent.given', this.onConsentGiven.bind(this))),
      this.subscriber.subscribe<ConsentDeniedEvent>('consent.denied', this.makeHandler('consent.denied', this.onConsentDenied.bind(this))),
      this.subscriber.subscribe<ConsentWithdrawnEvent>('consent.withdrawn', this.makeHandler('consent.withdrawn', this.onConsentWithdrawn.bind(this))),
      this.subscriber.subscribe<NegotiationCounterOfferSubmittedEvent>('negotiation.counter_offer.submitted', this.makeHandler('negotiation.counter_offer.submitted', this.onNegotiationCounterOfferSubmitted.bind(this))),
      this.subscriber.subscribe<NegotiationAcceptedEvent>('negotiation.accepted', this.makeHandler('negotiation.accepted', this.onNegotiationAccepted.bind(this))),
      this.subscriber.subscribe<NegotiationRejectedEvent>('negotiation.rejected', this.makeHandler('negotiation.rejected', this.onNegotiationRejected.bind(this))),
      this.subscriber.subscribe<AxiomEvaluationTimedOutEvent>(;

code = code.replace('this.subscriber.subscribe<AxiomEvaluationTimedOutEvent>(', strToInsert)

const importsToInsert =   PaymentInitiatedEvent,
  PaymentCompletedEvent,
  PaymentFailedEvent,
  SubmissionUploadedEvent,
  SubmissionApprovedEvent,
  SubmissionRejectedEvent,
  SubmissionRevisionRequestedEvent,
  EscalationCreatedEvent,
  EscalationResolvedEvent,
  RovCreatedEvent,
  RovAssignedEvent,
  RovDecisionIssuedEvent,
  DeliveryReceiptConfirmedEvent,
  DeliveryReceiptOpenedEvent,
  ConsentGivenEvent,
  ConsentDeniedEvent,
  ConsentWithdrawnEvent,
  NegotiationCounterOfferSubmittedEvent,
  NegotiationAcceptedEvent,
  NegotiationRejectedEvent,
  AxiomEvaluationTimedOutEvent,;

code = code.replace('  AxiomEvaluationTimedOutEvent,', importsToInsert);

const unsubscribesToInsert =       this.subscriber.unsubscribe('payment.initiated'),
      this.subscriber.unsubscribe('payment.completed'),
      this.subscriber.unsubscribe('payment.failed'),
      this.subscriber.unsubscribe('submission.uploaded'),
      this.subscriber.unsubscribe('submission.approved'),
      this.subscriber.unsubscribe('submission.rejected'),
      this.subscriber.unsubscribe('submission.revision.requested'),
      this.subscriber.unsubscribe('escalation.created'),
      this.subscriber.unsubscribe('escalation.resolved'),
      this.subscriber.unsubscribe('rov.created'),
      this.subscriber.unsubscribe('rov.assigned'),
      this.subscriber.unsubscribe('rov.decision.issued'),
      this.subscriber.unsubscribe('delivery.receipt.confirmed'),
      this.subscriber.unsubscribe('delivery.receipt.opened'),
      this.subscriber.unsubscribe('consent.given'),
      this.subscriber.unsubscribe('consent.denied'),
      this.subscriber.unsubscribe('consent.withdrawn'),
      this.subscriber.unsubscribe('negotiation.counter_offer.submitted'),
      this.subscriber.unsubscribe('negotiation.accepted'),
      this.subscriber.unsubscribe('negotiation.rejected'),
      this.subscriber.unsubscribe('axiom.evaluation.timeout'),;

code = code.replace("      this.subscriber.unsubscribe('axiom.evaluation.timeout'),", unsubscribesToInsert);

const dummyMethods = 
  // -- Phase 1.2 stubs
  private async onPaymentInitiated(event: PaymentInitiatedEvent): Promise<void> { this.logger.info('onPaymentInitiated', { id: event.id }); }
  private async onPaymentCompleted(event: PaymentCompletedEvent): Promise<void> { this.logger.info('onPaymentCompleted', { id: event.id }); }
  private async onPaymentFailed(event: PaymentFailedEvent): Promise<void> { this.logger.info('onPaymentFailed', { id: event.id }); }
  
  private async onSubmissionUploaded(event: SubmissionUploadedEvent): Promise<void> { this.logger.info('onSubmissionUploaded', { id: event.id }); }
  private async onSubmissionApproved(event: SubmissionApprovedEvent): Promise<void> { this.logger.info('onSubmissionApproved', { id: event.id }); }
  private async onSubmissionRejected(event: SubmissionRejectedEvent): Promise<void> { this.logger.info('onSubmissionRejected', { id: event.id }); }
  private async onSubmissionRevisionRequested(event: SubmissionRevisionRequestedEvent): Promise<void> { this.logger.info('onSubmissionRevisionRequested', { id: event.id }); }
  
  private async onEscalationCreated(event: EscalationCreatedEvent): Promise<void> { this.logger.info('onEscalationCreated', { id: event.id }); }
  private async onEscalationResolved(event: EscalationResolvedEvent): Promise<void> { this.logger.info('onEscalationResolved', { id: event.id }); }
  
  private async onRovCreated(event: RovCreatedEvent): Promise<void> { this.logger.info('onRovCreated', { id: event.id }); }
  private async onRovAssigned(event: RovAssignedEvent): Promise<void> { this.logger.info('onRovAssigned', { id: event.id }); }
  private async onRovDecisionIssued(event: RovDecisionIssuedEvent): Promise<void> { this.logger.info('onRovDecisionIssued', { id: event.id }); }
  
  private async onDeliveryReceiptConfirmed(event: DeliveryReceiptConfirmedEvent): Promise<void> { this.logger.info('onDeliveryReceiptConfirmed', { id: event.id }); }
  private async onDeliveryReceiptOpened(event: DeliveryReceiptOpenedEvent): Promise<void> { this.logger.info('onDeliveryReceiptOpened', { id: event.id }); }
  
  private async onConsentGiven(event: ConsentGivenEvent): Promise<void> { this.logger.info('onConsentGiven', { id: event.id }); }
  private async onConsentDenied(event: ConsentDeniedEvent): Promise<void> { this.logger.info('onConsentDenied', { id: event.id }); }
  private async onConsentWithdrawn(event: ConsentWithdrawnEvent): Promise<void> { this.logger.info('onConsentWithdrawn', { id: event.id }); }

  private async onNegotiationCounterOfferSubmitted(event: NegotiationCounterOfferSubmittedEvent): Promise<void> { this.logger.info('onNegotiationCounterOfferSubmitted', { id: event.id }); }
  private async onNegotiationAccepted(event: NegotiationAcceptedEvent): Promise<void> { this.logger.info('onNegotiationAccepted', { id: event.id }); }
  private async onNegotiationRejected(event: NegotiationRejectedEvent): Promise<void> { this.logger.info('onNegotiationRejected', { id: event.id }); }

  // -- Handlers ---------------------------------------------------------------;

code = code.replace('// -- Handlers ---------------------------------------------------------------', dummyMethods);

fs.writeFileSync('C:/source/appraisal-management-backend/src/services/communication-event-handler.service.ts', code);
