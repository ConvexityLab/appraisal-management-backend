/**
 * Communication Controller
 * Simple API for sending emails, SMS, and Teams notifications
 * Frontend handles all template rendering - backend just sends messages
 */

import express, { Request, Response, Router } from 'express';
import { body, param, validationResult } from 'express-validator';
import { AzureCommunicationService } from '../services/azure-communication.service.js';
import { TeamsService } from '../services/teams.service.js';
import { CosmosDbService } from '../services/cosmos-db.service.js';
import { Logger } from '../utils/logger.js';

const logger = new Logger();
const acsService = new AzureCommunicationService();
const teamsService = new TeamsService();
const cosmosService = new CosmosDbService();

interface CommunicationMessage {
  id: string;
  orderId: string;
  tenantId: string;
  channel: 'email' | 'sms' | 'teams';
  to: string;
  from?: string;
  subject?: string;
  body: string;
  status: 'pending' | 'sent' | 'failed';
  sentAt?: Date;
  failureReason?: string;
  metadata?: any;
  createdAt: Date;
}

/**
 * Store communication message in Cosmos DB
 */
async function storeCommunication(message: CommunicationMessage): Promise<void> {
  try {
    await cosmosService.createItem('communications', message);
    logger.info('Communication message stored', { 
      id: message.id, 
      channel: message.channel,
      orderId: message.orderId 
    });
  } catch (error) {
    logger.error('Failed to store communication message', { error, messageId: message.id });
  }
}

export const createCommunicationRouter = (): Router => {
  const router = express.Router();

  /**
   * POST /api/communications/email
   * Send email via Azure Communication Services
   * Frontend sends pre-rendered HTML body
   */
  router.post(
    '/email',
    [
      body('orderId').notEmpty().withMessage('Order ID is required'),
      body('to').isEmail().withMessage('Valid email address is required'),
      body('subject').notEmpty().withMessage('Subject is required'),
      body('body').notEmpty().withMessage('Email body is required')
    ],
    async (req: Request, res: Response) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({
            success: false,
            errors: errors.array()
          });
        }

        const tenantId = (req as any).user?.tenantId || 'default';
        const { orderId, to, subject, body } = req.body;

        logger.info('Sending email', { orderId, to, subject });

        // Create communication record
        const messageId = `email-${orderId}-${Date.now()}`;
        const message: CommunicationMessage = {
          id: messageId,
          orderId,
          tenantId,
          channel: 'email',
          to,
          from: process.env.AZURE_COMMUNICATION_EMAIL_DOMAIN || 'noreply@appraisal.platform',
          subject,
          body,
          status: 'pending',
          createdAt: new Date()
        };

        // Send email via ACS
        const emailClient = acsService.getEmailClient();
        const emailMessage = {
          senderAddress: message.from || process.env.AZURE_COMMUNICATION_EMAIL_FROM || 'noreply@appraisal.com',
          content: {
            subject: subject,
            html: body
          },
          recipients: {
            to: [{ address: to }]
          }
        };

        const poller = await emailClient.beginSend(emailMessage);
        const response = await poller.pollUntilDone();

        // Update message status
        message.status = 'sent';
        message.sentAt = new Date();
        message.metadata = { messageId: response.id };

        // Store in Cosmos
        await storeCommunication(message);

        logger.info('Email sent successfully', { messageId, to, orderId });

        return res.json({
          success: true,
          data: {
            messageId: message.id,
            status: message.status,
            sentAt: message.sentAt
          }
        });

      } catch (error: any) {
        logger.error('Failed to send email', { error: error.message });
        
        // Store failed message
        const messageId = `email-${req.body.orderId}-${Date.now()}`;
        const failedMessage: CommunicationMessage = {
          id: messageId,
          orderId: req.body.orderId,
          tenantId: (req as any).user?.tenantId || 'default',
          channel: 'email',
          to: req.body.to,
          subject: req.body.subject,
          body: req.body.body || '',
          status: 'failed',
          failureReason: error.message,
          createdAt: new Date()
        };
        await storeCommunication(failedMessage);

        return res.status(500).json({
          success: false,
          error: error.message || 'Failed to send email'
        });
      }
    }
  );

  /**
   * POST /api/communications/sms
   * Send SMS via Azure Communication Services
   */
  router.post(
    '/sms',
    [
      body('orderId').notEmpty().withMessage('Order ID is required'),
      body('to').notEmpty().withMessage('Phone number is required'),
      body('body').notEmpty().withMessage('Message body is required')
    ],
    async (req: Request, res: Response) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({
            success: false,
            errors: errors.array()
          });
        }

        const tenantId = (req as any).user?.tenantId || 'default';
        const { orderId, to, body } = req.body;

        logger.info('Sending SMS', { orderId, to });

        // Create communication record
        const messageId = `sms-${orderId}-${Date.now()}`;
        const message: CommunicationMessage = {
          id: messageId,
          orderId,
          tenantId,
          channel: 'sms',
          to,
          from: process.env.AZURE_COMMUNICATION_SMS_NUMBER || '',
          body,
          status: 'pending',
          createdAt: new Date()
        };

        // Send SMS via ACS
        const smsClient = acsService.getSmsClient();
        const sendResults = await smsClient.send({
          from: message.from!,
          to: [to],
          message: body
        });

        // Update message status
        const result = sendResults[0];
        if (!result) {
          throw new Error('No SMS send result returned');
        }
        message.status = result.successful ? 'sent' : 'failed';
        message.sentAt = new Date();
        message.metadata = { messageId: result.messageId };
        if (!result.successful) {
          message.failureReason = result.errorMessage || 'Unknown error';
        }

        // Store in Cosmos
        await storeCommunication(message);

        if (!result.successful) {
          logger.error('SMS failed', { messageId, error: result.errorMessage });
          return res.status(500).json({
            success: false,
            error: result.errorMessage || 'Failed to send SMS'
          });
        }

        logger.info('SMS sent successfully', { messageId, to, orderId });

        return res.json({
          success: true,
          data: {
            messageId: message.id,
            status: message.status,
            sentAt: message.sentAt
          }
        });

      } catch (error: any) {
        logger.error('Failed to send SMS', { error: error.message });
        
        // Store failed message
        const messageId = `sms-${req.body.orderId}-${Date.now()}`;
        const failedMessage: CommunicationMessage = {
          id: messageId,
          orderId: req.body.orderId,
          tenantId: (req as any).user?.tenantId || 'default',
          channel: 'sms',
          to: req.body.to,
          body: req.body.body,
          status: 'failed',
          failureReason: error.message,
          createdAt: new Date()
        };
        await storeCommunication(failedMessage);

        return res.status(500).json({
          success: false,
          error: error.message || 'Failed to send SMS'
        });
      }
    }
  );

  /**
   * POST /api/communications/teams
   * Send Teams notification via Microsoft Graph API
   */
  router.post(
    '/teams',
    [
      body('orderId').notEmpty().withMessage('Order ID is required'),
      body('channelId').notEmpty().withMessage('Channel ID is required'),
      body('teamId').notEmpty().withMessage('Team ID is required'),
      body('subject').notEmpty().withMessage('Subject is required'),
      body('body').notEmpty().withMessage('Message body is required')
    ],
    async (req: Request, res: Response) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({
            success: false,
            errors: errors.array()
          });
        }

        const tenantId = (req as any).user?.tenantId || 'default';
        const { orderId, channelId, teamId, subject, body } = req.body;

        logger.info('Sending Teams message', { orderId, channelId, teamId, subject });

        // Create communication record
        const messageId = `teams-${orderId}-${Date.now()}`;
        const message: CommunicationMessage = {
          id: messageId,
          orderId,
          tenantId,
          channel: 'teams',
          to: `${teamId}/${channelId}`,
          subject,
          body,
          status: 'pending',
          createdAt: new Date()
        };

        // Send message via Teams service
        const teamsMessageId = await teamsService.sendChannelMessage(
          teamId,
          channelId,
          subject,
          body
        );

        // Update message status
        message.status = 'sent';
        message.sentAt = new Date();
        message.metadata = { teamsMessageId };

        // Store in Cosmos
        await storeCommunication(message);

        logger.info('Teams message sent successfully', { messageId, teamsMessageId, orderId });

        return res.json({
          success: true,
          data: {
            messageId: message.id,
            teamsMessageId,
            status: message.status,
            sentAt: message.sentAt
          }
        });

      } catch (error: any) {
        logger.error('Failed to send Teams message', { error: error.message });
        
        // Store failed message
        const messageId = `teams-${req.body.orderId}-${Date.now()}`;
        const failedMessage: CommunicationMessage = {
          id: messageId,
          orderId: req.body.orderId,
          tenantId: (req as any).user?.tenantId || 'default',
          channel: 'teams',
          to: `${req.body.teamId}/${req.body.channelId}`,
          subject: req.body.subject,
          body: req.body.body,
          status: 'failed',
          failureReason: error.message,
          createdAt: new Date()
        };
        await storeCommunication(failedMessage);

        return res.status(500).json({
          success: false,
          error: error.message || 'Failed to send Teams message'
        });
      }
    }
  );

  /**
   * GET /api/communications/history/:orderId
   * Retrieve all communication history for an order
   */
  router.get(
    '/history/:orderId',
    [
      param('orderId').notEmpty().withMessage('Order ID is required')
    ],
    async (req: Request, res: Response) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({
            success: false,
            errors: errors.array()
          });
        }

        const tenantId = (req as any).user?.tenantId || 'default';
        const { orderId } = req.params;

        logger.info('Retrieving communication history', { orderId });

        // Query Cosmos DB for all messages related to this order
        const ordersContainer = cosmosService.getContainer('orders');
        const querySpec = {
          query: 'SELECT * FROM c WHERE c.orderId = @orderId AND c.type = @type ORDER BY c.createdAt DESC',
          parameters: [
            { name: '@orderId', value: orderId as string },
            { name: '@type', value: 'communication' }
          ]
        };

        const { resources: messages } = await ordersContainer.items.query<CommunicationMessage>(querySpec).fetchAll();

        logger.info('Communication history retrieved', { 
          orderId, 
          messageCount: messages.length 
        });

        return res.json({
          success: true,
          data: {
            orderId,
            messageCount: messages.length,
            messages: messages.map((m: CommunicationMessage) => ({
              id: m.id,
              channel: m.channel,
              to: m.to,
              from: m.from,
              subject: m.subject,
              body: m.body,
              status: m.status,
              sentAt: m.sentAt,
              createdAt: m.createdAt,
              failureReason: m.failureReason,
              metadata: m.metadata
            }))
          }
        });

      } catch (error: any) {
        logger.error('Failed to retrieve communication history', { 
          error: error.message,
          orderId: req.params.orderId
        });
        return res.status(500).json({
          success: false,
          error: error.message || 'Failed to retrieve communication history'
        });
      }
    }
  );

  /**
   * GET /api/communications/entity/:entityType/:entityId
   * Retrieve all communication history for any entity (vendor, appraiser, order, etc.)
   */
  router.get(
    '/entity/:entityType/:entityId',
    async (req: Request, res: Response) => {
      try {
        const tenantId = (req as any).user?.tenantId || 'default';
        const { entityType, entityId } = req.params;
        const { channel } = req.query;

        logger.info('Retrieving entity communication history', { entityType, entityId, channel });

        // Build query based on entity type
        let querySpec: any;
        if (entityType === 'order') {
          querySpec = {
            query: channel 
              ? 'SELECT * FROM c WHERE c.orderId = @entityId AND c.channel = @channel ORDER BY c.createdAt DESC'
              : 'SELECT * FROM c WHERE c.orderId = @entityId ORDER BY c.createdAt DESC',
            parameters: channel
              ? [
                  { name: '@entityId', value: entityId },
                  { name: '@channel', value: channel }
                ]
              : [{ name: '@entityId', value: entityId }]
          };
        } else {
          // For vendor, appraiser, etc - search by recipient or metadata
          querySpec = {
            query: channel
              ? 'SELECT * FROM c WHERE (c.to LIKE @entityId OR c.metadata.entityId = @entityId) AND c.channel = @channel ORDER BY c.createdAt DESC'
              : 'SELECT * FROM c WHERE (c.to LIKE @entityId OR c.metadata.entityId = @entityId) ORDER BY c.createdAt DESC',
            parameters: channel
              ? [
                  { name: '@entityId', value: `%${entityId}%` },
                  { name: '@channel', value: channel }
                ]
              : [{ name: '@entityId', value: `%${entityId}%` }]
          };
        }

        // Query communications container (stored separately)
        const container = cosmosService.getContainer('orders'); // Messages stored in orders container
        const { resources: messages } = await container.items.query<CommunicationMessage>(querySpec).fetchAll();

        logger.info('Entity communication history retrieved', { 
          entityType,
          entityId,
          messageCount: messages.length 
        });

        return res.json({
          success: true,
          data: messages.map((m: CommunicationMessage) => ({
            id: m.id,
            channel: m.channel,
            direction: 'outbound', // All messages sent from system are outbound
            to: m.to,
            from: m.from,
            subject: m.subject,
            body: m.body,
            status: m.status,
            timestamp: m.sentAt || m.createdAt,
            sentAt: m.sentAt,
            createdAt: m.createdAt,
            failureReason: m.failureReason,
            metadata: m.metadata
          }))
        });

      } catch (error: any) {
        logger.error('Failed to retrieve entity communication history', { 
          error: error.message,
          entityType: req.params.entityType,
          entityId: req.params.entityId
        });
        return res.status(500).json({
          success: false,
          error: error.message || 'Failed to retrieve communication history'
        });
      }
    }
  );

  return router;
};
