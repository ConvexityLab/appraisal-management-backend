import { Logger } from '../utils/logger.js';
import { CosmosDbService } from './cosmos-db.service.js';
import { 
  OrderNegotiation, 
  NegotiationStatus, 
  ProposedTerms 
} from '../types/vendor-marketplace.types.js';
import { ApiResponse } from '../types/index.js';

interface NegotiationRound {
  roundNumber: number;
  timestamp: Date;
  actor: 'VENDOR' | 'CLIENT' | 'SYSTEM';
  action: 'OFFER' | 'COUNTER' | 'ACCEPT' | 'REJECT';
  proposedTerms: {
    fee: number;
    dueDate: Date;
    notes: string;
  };
  reason?: string;
}

/**
 * Order Negotiation Service
 * Handles vendor acceptance, rejection, counter-offers, and AMC responses
 * Implements full negotiation state machine with audit trail
 */
export class OrderNegotiationService {
  private logger: Logger;
  private dbService: CosmosDbService;

  // Business Rules
  private readonly DEFAULT_MAX_ROUNDS = 3;
  private readonly DEFAULT_EXPIRATION_HOURS = 4;
  private readonly DEFAULT_FEE_AUTO_ACCEPT_THRESHOLD = 5; // % delta
  private readonly DEFAULT_DATE_AUTO_ACCEPT_THRESHOLD = 2; // days

  constructor() {
    this.logger = new Logger();
    this.dbService = new CosmosDbService();
  }

  /**
   * Vendor accepts order assignment
   */
  async acceptOrder(orderId: string, vendorId: string, tenantId: string): Promise<any> {
    try {
      this.logger.info('Vendor accepting order', { orderId, vendorId });

      // Get order
      const orderResponse = await this.dbService.getItem('orders', orderId, tenantId) as ApiResponse<any>;
      const order = orderResponse.data;
      if (!order) {
        throw new Error('Order not found');
      }

      // Verify vendor is assigned
      if (order.assignedVendorId !== vendorId) {
        throw new Error('Vendor not assigned to this order');
      }

      // Update order status
      const updatedOrder = await this.dbService.updateItem('orders', orderId, {
        ...order,
        status: 'ACCEPTED',
        acceptedAt: new Date().toISOString(),
        acceptedBy: vendorId,
        updatedAt: new Date().toISOString()
      }, tenantId);

      // Create negotiation record for audit trail
      const negotiation: OrderNegotiation = {
        id: `negotiation-${orderId}-${Date.now()}`,
        orderId,
        vendorId,
        clientId: order.clientId,
        tenantId,
        status: 'ACCEPTED',
        originalTerms: {
          fee: order.fee || 0,
          dueDate: new Date(order.dueDate),
          rushFee: order.urgency === 'RUSH',
          specialInstructions: order.specialInstructions || ''
        },
        currentTerms: {
          fee: order.fee || 0,
          dueDate: new Date(order.dueDate),
          additionalConditions: []
        },
        rounds: [{
          roundNumber: 1,
          timestamp: new Date(),
          actor: 'VENDOR',
          action: 'ACCEPT',
          proposedTerms: {
            fee: order.fee || 0,
            dueDate: new Date(order.dueDate),
            notes: 'Order accepted'
          }
        }],
        maxRounds: this.DEFAULT_MAX_ROUNDS,
        expirationTime: this.calculateExpiration(this.DEFAULT_EXPIRATION_HOURS),
        createdAt: new Date(),
        updatedAt: new Date(),
        decidedAt: new Date(),
        decidedBy: vendorId
      };

      await this.dbService.createItem('negotiations', negotiation);

      this.logger.info('Order accepted by vendor', { orderId, vendorId });
      return updatedOrder;

    } catch (error: any) {
      this.logger.error('Failed to accept order', error as Record<string, any>);
      throw error;
    }
  }

  /**
   * Vendor rejects order assignment
   */
  async rejectOrder(
    orderId: string, 
    vendorId: string, 
    reason: string,
    tenantId: string
  ): Promise<void> {
    try {
      this.logger.info('Vendor rejecting order', { orderId, vendorId, reason });

      // Get order
      const orderResponse = await this.dbService.getItem('orders', orderId, tenantId) as ApiResponse<any>;
      const order = orderResponse.data;
      if (!order) {
        throw new Error('Order not found');
      }

      // Verify vendor is assigned
      if (order.assignedVendorId !== vendorId) {
        throw new Error('Vendor not assigned to this order');
      }

      // Update order status
      await this.dbService.updateItem('orders', orderId, {
        ...order,
        status: 'VENDOR_REJECTED',
        assignedVendorId: null,
        assignedVendorName: null,
        rejectedAt: new Date().toISOString(),
        rejectedBy: vendorId,
        rejectionReason: reason,
        updatedAt: new Date().toISOString()
      }, tenantId);

      // Create negotiation record for audit trail
      const negotiation: OrderNegotiation = {
        id: `negotiation-${orderId}-${Date.now()}`,
        orderId,
        vendorId,
        clientId: order.clientId,
        tenantId,
        status: 'REJECTED',
        originalTerms: {
          fee: order.fee || 0,
          dueDate: new Date(order.dueDate),
          rushFee: order.urgency === 'RUSH',
          specialInstructions: order.specialInstructions || ''
        },
        currentTerms: {
          fee: order.fee || 0,
          dueDate: new Date(order.dueDate),
          additionalConditions: [],
          vendorNotes: reason
        },
        rounds: [{
          roundNumber: 1,
          timestamp: new Date(),
          actor: 'VENDOR',
          action: 'REJECT',
          proposedTerms: {
            fee: order.fee || 0,
            dueDate: new Date(order.dueDate),
            notes: reason
          },
          reason
        }],
        maxRounds: this.DEFAULT_MAX_ROUNDS,
        expirationTime: this.calculateExpiration(this.DEFAULT_EXPIRATION_HOURS),
        createdAt: new Date(),
        updatedAt: new Date(),
        decidedAt: new Date(),
        decidedBy: vendorId
      };

      await this.dbService.createItem('negotiations', negotiation);

      this.logger.info('Order rejected by vendor', { orderId, vendorId });

    } catch (error: any) {
      this.logger.error('Failed to reject order', error as Record<string, any>);
      throw error;
    }
  }

  /**
   * Vendor submits counter-offer
   */
  async counterOffer(
    orderId: string,
    vendorId: string,
    terms: ProposedTerms,
    tenantId: string
  ): Promise<OrderNegotiation> {
    try {
      this.logger.info('Vendor submitting counter-offer', { orderId, vendorId, terms });

      // Get order
      const orderResponse = await this.dbService.getItem('orders', orderId, tenantId) as ApiResponse<any>;
      const order = orderResponse.data;
      if (!order) {
        throw new Error('Order not found');
      }

      // Verify vendor is assigned
      if (order.assignedVendorId !== vendorId) {
        throw new Error('Vendor not assigned to this order');
      }

      // Check if negotiation exists
      const existingNegotiation = await this.getActiveNegotiation(orderId, tenantId);

      if (existingNegotiation) {
        // Add round to existing negotiation
        return await this.addNegotiationRound(
          existingNegotiation,
          'VENDOR',
          'COUNTER',
          terms,
          tenantId
        );
      } else {
        // Create new negotiation
        const negotiation: OrderNegotiation = {
          id: `negotiation-${orderId}-${Date.now()}`,
          orderId,
          vendorId,
          clientId: order.clientId,
          tenantId,
          status: 'VENDOR_COUNTERED',
          originalTerms: {
            fee: order.fee || 0,
            dueDate: new Date(order.dueDate),
            rushFee: order.urgency === 'RUSH',
            specialInstructions: order.specialInstructions || ''
          },
          currentTerms: {
            fee: terms.fee,
            dueDate: new Date(terms.dueDate),
            additionalConditions: [],
            vendorNotes: terms.notes || ''
          },
          rounds: [{
            roundNumber: 1,
            timestamp: new Date(),
            actor: 'VENDOR',
            action: 'COUNTER',
            proposedTerms: {
              fee: terms.fee,
              dueDate: new Date(terms.dueDate),
              notes: terms.notes || ''
            }
          }],
          maxRounds: this.DEFAULT_MAX_ROUNDS,
          expirationTime: this.calculateExpiration(this.DEFAULT_EXPIRATION_HOURS),
          autoAcceptThreshold: {
            maxFeeDelta: this.DEFAULT_FEE_AUTO_ACCEPT_THRESHOLD,
            maxDateDelta: this.DEFAULT_DATE_AUTO_ACCEPT_THRESHOLD
          },
          createdAt: new Date(),
          updatedAt: new Date()
        };

        await this.dbService.createItem('negotiations', negotiation);

        // Update order status
        await this.dbService.updateItem('orders', orderId, {
          ...order,
          status: 'NEGOTIATING',
          updatedAt: new Date().toISOString()
        }, tenantId);

        this.logger.info('Counter-offer submitted', { negotiationId: negotiation.id });
        return negotiation;
      }

    } catch (error: any) {
      this.logger.error('Failed to submit counter-offer', error as Record<string, any>);
      throw error;
    }
  }

  /**
   * AMC/Client accepts vendor's counter-offer
   */
  async acceptCounterOffer(
    negotiationId: string,
    clientId: string,
    tenantId: string
  ): Promise<any> {
    try {
      this.logger.info('Client accepting counter-offer', { negotiationId, clientId });

      // Get negotiation
      const negotiationResponse = await this.dbService.getItem('negotiations', negotiationId, tenantId) as ApiResponse<OrderNegotiation>;
      const negotiation = negotiationResponse.data;
      if (!negotiation) {
        throw new Error('Negotiation not found');
      }

      // Verify client
      if (negotiation.clientId !== clientId) {
        throw new Error('Client not authorized for this negotiation');
      }

      // Verify status
      if (negotiation.status !== 'VENDOR_COUNTERED' && negotiation.status !== 'CLIENT_COUNTERED') {
        throw new Error('Negotiation not in counter-offer state');
      }

      // Update negotiation
      await this.dbService.updateItem('negotiations', negotiationId, {
        ...negotiation,
        status: 'ACCEPTED' as NegotiationStatus,
        decidedAt: new Date(),
        decidedBy: clientId,
        updatedAt: new Date(),
        rounds: [
          ...negotiation.rounds,
          {
            roundNumber: negotiation.rounds.length + 1,
            timestamp: new Date(),
            actor: 'CLIENT' as const,
            action: 'ACCEPT' as const,
            proposedTerms: {
              ...negotiation.currentTerms,
              notes: 'Counter-offer accepted'
            },
            reason: 'Counter-offer accepted'
          }
        ]
      }, tenantId);

      // Update order with accepted terms
      const orderResponse = await this.dbService.getItem('orders', negotiation.orderId, tenantId) as ApiResponse<any>;
      const updatedOrder = await this.dbService.updateItem('orders', negotiation.orderId, {
        ...orderResponse.data,
        status: 'ACCEPTED',
        fee: negotiation.currentTerms.fee,
        dueDate: negotiation.currentTerms.dueDate,
        acceptedAt: new Date().toISOString(),
        acceptedBy: negotiation.vendorId,
        updatedAt: new Date().toISOString()
      }, tenantId);

      this.logger.info('Counter-offer accepted', { negotiationId, orderId: negotiation.orderId });
      return updatedOrder;

    } catch (error: any) {
      this.logger.error('Failed to accept counter-offer', error as Record<string, any>);
      throw error;
    }
  }

  /**
   * AMC/Client rejects vendor's counter-offer
   */
  async rejectCounterOffer(
    negotiationId: string,
    clientId: string,
    reason: string,
    tenantId: string
  ): Promise<void> {
    try {
      this.logger.info('Client rejecting counter-offer', { negotiationId, clientId, reason });

      // Get negotiation
      const negotiationResponse = await this.dbService.getItem('negotiations', negotiationId, tenantId) as ApiResponse<OrderNegotiation>;
      const negotiation = negotiationResponse.data;
      if (!negotiation) {
        throw new Error('Negotiation not found');
      }

      // Verify client
      if (negotiation.clientId !== clientId) {
        throw new Error('Client not authorized for this negotiation');
      }

      // Update negotiation
      await this.dbService.updateItem('negotiations', negotiationId, {
        ...negotiation,
        status: 'REJECTED' as NegotiationStatus,
        decidedAt: new Date(),
        decidedBy: clientId,
        updatedAt: new Date(),
        rounds: [
          ...negotiation.rounds,
          {
            roundNumber: negotiation.rounds.length + 1,
            timestamp: new Date(),
            actor: 'CLIENT' as const,
            action: 'REJECT' as const,
            proposedTerms: {
              ...negotiation.currentTerms,
              notes: reason
            },
            reason
          }
        ]
      }, tenantId);

      // Update order status
      const orderResponse = await this.dbService.getItem('orders', negotiation.orderId, tenantId) as ApiResponse<any>;
      await this.dbService.updateItem('orders', negotiation.orderId, {
        ...orderResponse.data,
        status: 'NEGOTIATION_FAILED',
        assignedVendorId: null,
        assignedVendorName: null,
        updatedAt: new Date().toISOString()
      }, tenantId);

      this.logger.info('Counter-offer rejected', { negotiationId });

    } catch (error: any) {
      this.logger.error('Failed to reject counter-offer', error as Record<string, any>);
      throw error;
    }
  }

  /**
   * AMC/Client submits counter to vendor's counter-offer
   */
  async counterVendorOffer(
    negotiationId: string,
    terms: ProposedTerms,
    clientId: string,
    tenantId: string
  ): Promise<OrderNegotiation> {
    try {
      this.logger.info('Client countering vendor offer', { negotiationId, terms });

      // Get negotiation
      const negotiationResponse = await this.dbService.getItem('negotiations', negotiationId, tenantId) as ApiResponse<OrderNegotiation>;
      const negotiation = negotiationResponse.data;
      if (!negotiation) {
        throw new Error('Negotiation not found');
      }

      // Verify client
      if (negotiation.clientId !== clientId) {
        throw new Error('Client not authorized for this negotiation');
      }

      // Check max rounds
      if (negotiation.rounds.length >= negotiation.maxRounds) {
        throw new Error('Maximum negotiation rounds exceeded');
      }

      // Add counter-offer round
      return await this.addNegotiationRound(
        negotiation,
        'CLIENT',
        'COUNTER',
        terms,
        tenantId
      );

    } catch (error: any) {
      this.logger.error('Failed to counter vendor offer', error as Record<string, any>);
      throw error;
    }
  }

  /**
   * Expire negotiation (system action)
   */
  async expireNegotiation(negotiationId: string, tenantId: string): Promise<void> {
    try {
      this.logger.info('Expiring negotiation', { negotiationId });

      // Get negotiation
      const negotiationResponse = await this.dbService.getItem('negotiations', negotiationId, tenantId) as ApiResponse<OrderNegotiation>;
      const negotiation = negotiationResponse.data;
      if (!negotiation) {
        throw new Error('Negotiation not found');
      }

      // Update negotiation
      await this.dbService.updateItem('negotiations', negotiationId, {
        ...negotiation,
        status: 'EXPIRED' as NegotiationStatus,
        decidedAt: new Date(),
        decidedBy: 'SYSTEM',
        updatedAt: new Date(),
        rounds: [
          ...negotiation.rounds,
          {
            roundNumber: negotiation.rounds.length + 1,
            timestamp: new Date(),
            actor: 'SYSTEM' as const,
            action: 'REJECT' as const,
            proposedTerms: {
              ...negotiation.currentTerms,
              notes: 'Negotiation expired'
            },
            reason: 'Negotiation expired'
          }
        ]
      }, tenantId);

      // Update order status
      const orderResponse = await this.dbService.getItem('orders', negotiation.orderId, tenantId) as ApiResponse<any>;
      await this.dbService.updateItem('orders', negotiation.orderId, {
        ...orderResponse.data,
        status: 'NEGOTIATION_EXPIRED',
        assignedVendorId: null,
        assignedVendorName: null,
        updatedAt: new Date().toISOString()
      }, tenantId);

      this.logger.info('Negotiation expired', { negotiationId });

    } catch (error: any) {
      this.logger.error('Failed to expire negotiation', error as Record<string, any>);
      throw error;
    }
  }

  /**
   * Auto-accept if terms meet threshold
   */
  async autoAcceptIfThresholdMet(
    negotiationId: string,
    tenantId: string
  ): Promise<any | null> {
    try {
      // Get negotiation
      const negotiationResponse = await this.dbService.getItem('negotiations', negotiationId, tenantId) as ApiResponse<OrderNegotiation>;
      const negotiation = negotiationResponse.data;
      if (!negotiation || !negotiation.autoAcceptThreshold) {
        return null;
      }

      // Calculate deltas
      const feeDelta = Math.abs(
        (negotiation.currentTerms.fee - negotiation.originalTerms.fee) / 
        negotiation.originalTerms.fee * 100
      );

      const dateDelta = Math.abs(
        (new Date(negotiation.currentTerms.dueDate).getTime() - 
         new Date(negotiation.originalTerms.dueDate).getTime()) / 
        (1000 * 60 * 60 * 24)
      );

      // Check thresholds
      if (feeDelta <= negotiation.autoAcceptThreshold.maxFeeDelta &&
          dateDelta <= negotiation.autoAcceptThreshold.maxDateDelta) {
        
        this.logger.info('Auto-accepting negotiation', { 
          negotiationId, 
          feeDelta, 
          dateDelta 
        });

        // Auto-accept
        await this.dbService.updateItem('negotiations', negotiationId, {
          ...negotiation,
          status: 'ACCEPTED' as NegotiationStatus,
          decidedAt: new Date(),
          decidedBy: 'SYSTEM',
          updatedAt: new Date(),
          rounds: [
            ...negotiation.rounds,
            {
              roundNumber: negotiation.rounds.length + 1,
              timestamp: new Date(),
              actor: 'SYSTEM' as const,
              action: 'ACCEPT' as const,
              proposedTerms: {
                ...negotiation.currentTerms,
                notes: `Auto-accepted: Fee delta ${feeDelta.toFixed(1)}%, Date delta ${dateDelta.toFixed(1)} days`
              },
              reason: `Auto-accepted: Fee delta ${feeDelta.toFixed(1)}%, Date delta ${dateDelta.toFixed(1)} days`
            }
          ]
        }, tenantId);

        // Update order
        const orderResponse = await this.dbService.getItem('orders', negotiation.orderId, tenantId) as ApiResponse<any>;
        const updatedOrder = await this.dbService.updateItem('orders', negotiation.orderId, {
          ...orderResponse.data,
          status: 'ACCEPTED',
          fee: negotiation.currentTerms.fee,
          dueDate: negotiation.currentTerms.dueDate,
          acceptedAt: new Date().toISOString(),
          acceptedBy: 'SYSTEM',
          updatedAt: new Date().toISOString()
        }, tenantId);

        return updatedOrder;
      }

      return null;

    } catch (error: any) {
      this.logger.error('Failed to auto-accept negotiation', error as Record<string, any>);
      return null;
    }
  }

  /**
   * Get active negotiation for order
   */
  async getActiveNegotiation(orderId: string, tenantId: string): Promise<OrderNegotiation | null> {
    try {
      const query = `
        SELECT * FROM c 
        WHERE c.orderId = @orderId 
        AND c.tenantId = @tenantId
        AND c.status IN ('PENDING_VENDOR', 'VENDOR_COUNTERED', 'CLIENT_COUNTERED')
        ORDER BY c.createdAt DESC
      `;

      const resultResponse = await this.dbService.queryItems('negotiations', query, [
        { name: '@orderId', value: orderId },
        { name: '@tenantId', value: tenantId }
      ]) as ApiResponse<OrderNegotiation[]>;

      const result = resultResponse.data || [];
      return result.length > 0 && result[0] ? result[0] : null;

    } catch (error: any) {
      this.logger.error('Failed to get active negotiation', error as Record<string, any>);
      return null;
    }
  }

  /**
   * Get negotiation history for order
   */
  async getNegotiationHistory(orderId: string, tenantId: string): Promise<OrderNegotiation[]> {
    try {
      const query = `
        SELECT * FROM c 
        WHERE c.orderId = @orderId 
        AND c.tenantId = @tenantId
        ORDER BY c.createdAt DESC
      `;

      const historyResponse = await this.dbService.queryItems('negotiations', query, [
        { name: '@orderId', value: orderId },
        { name: '@tenantId', value: tenantId }
      ]) as ApiResponse<OrderNegotiation[]>;

      return historyResponse.data || [];

    } catch (error: any) {
      this.logger.error('Failed to get negotiation history', error as Record<string, any>);
      return [];
    }
  }

  /**
   * Check and expire stale negotiations
   */
  async checkExpiredNegotiations(tenantId: string): Promise<number> {
    try {
      const query = `
        SELECT * FROM c 
        WHERE c.tenantId = @tenantId
        AND c.status IN ('PENDING_VENDOR', 'VENDOR_COUNTERED', 'CLIENT_COUNTERED')
        AND c.expirationTime < @now
      `;

      const expiredResponse = await this.dbService.queryItems('negotiations', query, [
        { name: '@tenantId', value: tenantId },
        { name: '@now', value: new Date().toISOString() }
      ]) as ApiResponse<OrderNegotiation[]>;

      const expired = expiredResponse.data || [];

      for (const negotiation of expired) {
        await this.expireNegotiation(negotiation.id, tenantId);
      }

      return expired.length;

    } catch (error: any) {
      this.logger.error('Failed to check expired negotiations', error as Record<string, any>);
      return 0;
    }
  }

  // Private helper methods

  private async addNegotiationRound(
    negotiation: OrderNegotiation,
    actor: 'VENDOR' | 'CLIENT',
    action: 'COUNTER',
    terms: ProposedTerms,
    tenantId: string
  ): Promise<OrderNegotiation> {
    const newRound = {
      roundNumber: negotiation.rounds.length + 1,
      timestamp: new Date(),
      actor,
      action,
      proposedTerms: {
        fee: terms.fee,
        dueDate: new Date(terms.dueDate),
        notes: terms.notes || ''
      }
    };

    const updatedResponse = await this.dbService.updateItem('negotiations', negotiation.id, {
      ...negotiation,
      status: (actor === 'VENDOR' ? 'VENDOR_COUNTERED' : 'CLIENT_COUNTERED') as NegotiationStatus,
      currentTerms: {
        fee: terms.fee,
        dueDate: new Date(terms.dueDate),
        additionalConditions: negotiation.currentTerms.additionalConditions,
        vendorNotes: actor === 'VENDOR' ? terms.notes : negotiation.currentTerms.vendorNotes
      },
      rounds: [...negotiation.rounds, newRound],
      updatedAt: new Date()
    }, tenantId) as any;

    return updatedResponse.data || updatedResponse;
  }

  private calculateExpiration(hours: number): Date {
    const expiration = new Date();
    expiration.setHours(expiration.getHours() + hours);
    return expiration;
  }
}
