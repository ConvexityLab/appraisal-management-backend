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
import { 
  CommunicationRecord, 
  CommunicationChannel,
  CommunicationCategory,
  CommunicationEntity,
  CommunicationParticipantInfo 
} from '../types/communication.types.js';

const logger = new Logger();
const acsService = new AzureCommunicationService();
const teamsService = new TeamsService();
const cosmosService = new CosmosDbService();

/**
 * Store communication record in Cosmos DB with rich structure
 */
async function storeCommunication(params: {
  channel: CommunicationChannel;
  primaryEntity: CommunicationEntity;
  relatedEntities?: CommunicationEntity[];
  from: CommunicationParticipantInfo;
  to: CommunicationParticipantInfo | CommunicationParticipantInfo[];
  subject?: string;
  body: string;
  status: 'pending' | 'sent' | 'failed';
  tenantId: string;
  createdBy: string;
  category: CommunicationCategory;
  threadId?: string;
  metadata?: any;
}): Promise<CommunicationRecord> {
  try {
    const toArray = Array.isArray(params.to) ? params.to : [params.to];
    
    const record: CommunicationRecord = {
      id: `${params.channel}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      tenantId: params.tenantId,
      type: 'communication',
      
      primaryEntity: params.primaryEntity,
      relatedEntities: params.relatedEntities || [],
      
      ...(params.threadId ? { threadId: params.threadId } : {}),
      conversationContext: params.category,
      
      channel: params.channel,
      direction: 'outbound' as const,
      
      from: params.from,
      to: toArray,
      
      ...(params.subject ? { subject: params.subject } : {}),
      body: params.body,
      bodyFormat: 'html' as const,
      
      status: params.status,
      ...(params.status === 'sent' ? { sentAt: new Date() } : {}),
      ...(params.status === 'failed' ? { failedAt: new Date() } : {}),
      
      ...(params.metadata ? { deliveryStatus: params.metadata } : {}),
      
      category: params.category,
      priority: 'normal' as const,
      
      createdBy: params.createdBy,
      createdAt: new Date()
    };
    
    await cosmosService.createItem('communications', record);
    
    logger.info('Communication record stored', { 
      id: record.id, 
      channel: record.channel,
      primaryEntity: record.primaryEntity,
      category: record.category
    });
    
    return record;
  } catch (error) {
    logger.error('Failed to store communication record', { error, params });
    throw error;
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
      body('to').isEmail().withMessage('Valid email address is required'),
      body('subject').notEmpty().withMessage('Subject is required'),
      body('body').notEmpty().withMessage('Email body is required'),
      body('primaryEntity').optional().isObject(),
      body('primaryEntity.type').optional().isString(),
      body('primaryEntity.id').optional().isString(),
      body('category').optional().isString()
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
        const userId = (req as any).user?.id || 'system';
        const { to, subject, body, primaryEntity, relatedEntities, category = 'general', threadId } = req.body;

        // Determine primary entity - default to general if not provided
        const entity: CommunicationEntity = primaryEntity || {
          type: 'general' as const,
          id: 'general',
          name: 'General Communication'
        };

        logger.info('Sending email', { to, subject, primaryEntity: entity });

        const fromAddress = process.env.AZURE_COMMUNICATION_EMAIL_DOMAIN || 'noreply@appraisal.platform';

        // Send email via ACS
        const emailClient = acsService.getEmailClient();
        // Create communication record
        const message = await storeCommunication({
          tenantId,
          channel: 'email',
          from: { name: 'System', email: fromAddress },
          to: { name: to, email: to },
          subject,
          body,
          primaryEntity: entity,
          relatedEntities: relatedEntities || [],
          category,
          threadId,
          status: 'pending',
          createdBy: userId
        });

        const emailMessage = {
          senderAddress: fromAddress,
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

        // Update stored communication
        await cosmosService.createItem('communications', message);

        logger.info('Email sent successfully', { messageId: message.id, to, entity });

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
        
        const failedFromAddress = process.env.AZURE_COMMUNICATION_EMAIL_DOMAIN || 'noreply@appraisal.platform';
        const failedUserId = (req as any).user?.id || 'system';
        const failedEntity = req.body.primaryEntity || {
          type: 'general' as const,
          id: 'general',
          name: 'General Communication'
        };
        
        // Store failed message
        const messageId = `email-${Date.now()}`;
        const failedMessage = await storeCommunication({
          tenantId: (req as any).user?.tenantId || 'default',
          channel: 'email',
          from: { name: 'System', email: failedFromAddress },
          to: { name: req.body.to, email: req.body.to },
          subject: req.body.subject,
          body: req.body.body || '',
          primaryEntity: failedEntity,
          relatedEntities: req.body.relatedEntities || [],
          category: req.body.category || 'general',
          threadId: req.body.threadId,
          status: 'failed',
          createdBy: failedUserId
        });
        await cosmosService.createItem('communications', failedMessage);

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
      body('to').notEmpty().withMessage('Phone number is required'),
      body('body').notEmpty().withMessage('Message body is required'),
      body('primaryEntity').optional().isObject(),
      body('category').optional().isString()
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
        const userId = (req as any).user?.id || 'system';
        const { to, body, primaryEntity, relatedEntities, category = 'general', threadId } = req.body;

        const entity: CommunicationEntity = primaryEntity || {
          type: 'general' as const,
          id: 'general',
          name: 'General Communication'
        };

        const smsFromNumber = process.env.AZURE_COMMUNICATION_SMS_NUMBER || '';
        if (!smsFromNumber) {
          throw new Error('AZURE_COMMUNICATION_SMS_NUMBER is not configured. Cannot send SMS.');
        }

        logger.info('Sending SMS', { to, primaryEntity: entity });

        // Create communication record
        const message = await storeCommunication({
          tenantId,
          channel: 'sms',
          from: { name: 'System', phone: smsFromNumber },
          to: { name: to, phone: to },
          body,
          primaryEntity: entity,
          relatedEntities: relatedEntities || [],
          category,
          threadId,
          status: 'pending',
          createdBy: userId
        });

        // Send SMS via ACS
        const smsClient = acsService.getSmsClient();
        const sendResults = await smsClient.send({
          from: smsFromNumber,
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

        // Update stored communication
        await cosmosService.createItem('communications', message);

        if (!result.successful) {
          logger.error('SMS failed', { messageId: message.id, error: result.errorMessage });
          return res.status(500).json({
            success: false,
            error: result.errorMessage || 'Failed to send SMS'
          });
        }

        logger.info('SMS sent successfully', { messageId: message.id, to });

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
        const failedEntity = req.body.primaryEntity || {
          type: 'general' as const,
          id: 'general',
          name: 'General Communication'
        };
        const failedMessage = await storeCommunication({
          tenantId: (req as any).user?.tenantId || 'default',
          channel: 'sms',
          from: { name: 'System', phone: process.env.AZURE_COMMUNICATION_SMS_NUMBER || '' },
          to: { name: req.body.to, phone: req.body.to },
          body: req.body.body || '',
          primaryEntity: failedEntity,
          relatedEntities: req.body.relatedEntities || [],
          category: req.body.category || 'general',
          threadId: req.body.threadId,
          status: 'failed',
          createdBy: (req as any).user?.id || 'system'
        });
        await cosmosService.createItem('communications', failedMessage);

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
        const userId = (req as any).user?.id || 'system';
        const { orderId, channelId, teamId, subject, body, primaryEntity, relatedEntities, category = 'order_discussion', threadId } = req.body;

        const entity: CommunicationEntity = primaryEntity || {
          type: 'order' as const,
          id: orderId,
          name: `Order ${orderId}`
        };

        logger.info('Sending Teams message', { orderId, channelId, teamId, subject });

        // Create communication record
        const message = await storeCommunication({
          tenantId,
          channel: 'teams',
          from: { name: 'System' },
          to: { name: `Teams Channel`, id: `${teamId}/${channelId}` },
          subject,
          body,
          primaryEntity: entity,
          relatedEntities: relatedEntities || [],
          category,
          threadId,
          status: 'pending',
          createdBy: userId
        });

        // Send message via Teams service (args: teamId, channelId, message, subject)
        const teamsResult = await teamsService.sendChannelMessage(
          teamId,
          channelId,
          body,
          subject
        );

        // Update message status
        message.status = 'sent';
        message.sentAt = new Date();
        message.deliveryStatus = { messageId: teamsResult.messageId, provider: 'teams' };

        // Update stored communication
        await cosmosService.createItem('communications', message);

        logger.info('Teams message sent successfully', { messageId: message.id, teamsMessageId: teamsResult.messageId, orderId });

        return res.json({
          success: true,
          data: {
            messageId: message.id,
            teamsMessageId: teamsResult.messageId,
            status: message.status,
            sentAt: message.sentAt
          }
        });

      } catch (error: any) {
        logger.error('Failed to send Teams message', { error: error.message });
        
        // Store failed message
        const failedEntity: CommunicationEntity = req.body.primaryEntity || {
          type: 'order' as const,
          id: req.body.orderId,
          name: `Order ${req.body.orderId}`
        };
        await storeCommunication({
          tenantId: (req as any).user?.tenantId || 'default',
          channel: 'teams',
          from: { name: 'System' },
          to: { name: `Teams Channel`, id: `${req.body.teamId}/${req.body.channelId}` },
          subject: req.body.subject,
          body: req.body.body || '',
          primaryEntity: failedEntity,
          relatedEntities: req.body.relatedEntities || [],
          category: req.body.category || 'order_discussion',
          threadId: req.body.threadId,
          status: 'failed',
          createdBy: (req as any).user?.id || 'system',
          metadata: { error: error.message }
        });

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

        // Query communications container for all messages related to this order
        const query = `
          SELECT * FROM c 
          WHERE c.type = 'communication'
            AND c.tenantId = @tenantId
            AND (c.primaryEntity.type = 'order' AND c.primaryEntity.id = @orderId)
          ORDER BY c.createdAt DESC
        `;

        const result = await cosmosService.queryItems<CommunicationRecord>('communications', query, [
          { name: '@tenantId', value: tenantId },
          { name: '@orderId', value: orderId }
        ]);

        const messages = result.data || [];

        logger.info('Communication history retrieved', { 
          orderId, 
          messageCount: messages.length 
        });

        return res.json({
          success: true,
          data: {
            orderId,
            messageCount: messages.length,
            messages: messages.map((m: CommunicationRecord) => ({
              id: m.id,
              channel: m.channel,
              direction: m.direction,
              to: m.to,
              from: m.from,
              subject: m.subject,
              body: m.body,
              status: m.status,
              sentAt: m.sentAt,
              createdAt: m.createdAt,
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

        // Build query - search by primaryEntity or relatedEntities
        let query = `
          SELECT * FROM c 
          WHERE c.type = 'communication'
            AND c.tenantId = @tenantId
            AND (
              (c.primaryEntity.type = @entityType AND c.primaryEntity.id = @entityId)
              OR ARRAY_CONTAINS(c.relatedEntities, {type: @entityType, id: @entityId}, true)
            )
        `;

        const params: { name: string; value: string }[] = [
          { name: '@tenantId', value: tenantId },
          { name: '@entityType', value: entityType },
          { name: '@entityId', value: entityId }
        ];

        if (channel) {
          query += ' AND c.channel = @channel';
          params.push({ name: '@channel', value: channel as string });
        }

        query += ' ORDER BY c.createdAt DESC';

        const result = await cosmosService.queryItems<CommunicationRecord>('communications', query, params);
        const messages = result.data || [];

        logger.info('Entity communication history retrieved', { 
          entityType,
          entityId,
          messageCount: messages.length 
        });

        return res.json({
          success: true,
          data: messages.map((m: CommunicationRecord) => ({
            id: m.id,
            channel: m.channel,
            direction: m.direction,
            to: m.to,
            from: m.from,
            subject: m.subject,
            body: m.body,
            status: m.status,
            timestamp: m.sentAt || m.createdAt,
            sentAt: m.sentAt,
            createdAt: m.createdAt,
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

  /**
   * GET /api/communications/order/:orderId
   * Get all communications for a specific order
   */
  router.get(
    '/order/:orderId',
    [param('orderId').notEmpty()],
    async (req: Request, res: Response) => {
      try {
        const { orderId } = req.params;
        const { includeRelated } = req.query;

        let query = `
          SELECT * FROM c 
          WHERE c.type = 'communication'
        `;

        const params: any[] = [
          { name: '@orderId', value: orderId }
        ];

        if (includeRelated === 'true') {
          query += ` AND (
            (c.primaryEntity.type = 'order' AND c.primaryEntity.id = @orderId)
            OR ARRAY_CONTAINS(c.relatedEntities, {type: 'order', id: @orderId}, true)
          )`;
        } else {
          query += ` AND c.primaryEntity.type = 'order' AND c.primaryEntity.id = @orderId`;
        }

        query += ` ORDER BY c.createdAt DESC`;

        const result = await cosmosService.queryItems<CommunicationRecord>('communications', query, params);

        return res.json({
          success: true,
          data: result.data || [],
          count: result.data?.length || 0
        });
      } catch (error: any) {
        logger.error('Failed to get order communications', { error: error.message, orderId: req.params.orderId });
        return res.status(500).json({
          success: false,
          error: error.message || 'Failed to retrieve communications'
        });
      }
    }
  );

  /**
   * GET /api/communications/vendor/:vendorId
   * Get all communications with/about a vendor
   */
  router.get(
    '/vendor/:vendorId',
    [param('vendorId').notEmpty()],
    async (req: Request, res: Response) => {
      try {
        const tenantId = (req as any).user?.tenantId || 'default';
        const { vendorId } = req.params;
        const { category, excludeOrderSpecific } = req.query;

        let query = `
          SELECT * FROM c 
          WHERE c.type = 'communication'
            AND c.tenantId = @tenantId
            AND (
              (c.primaryEntity.type = 'vendor' AND c.primaryEntity.id = @vendorId)
              OR ARRAY_CONTAINS(c.relatedEntities, {type: 'vendor', id: @vendorId}, true)
            )
        `;

        const params: any[] = [
          { name: '@tenantId', value: tenantId },
          { name: '@vendorId', value: vendorId }
        ];

        if (excludeOrderSpecific === 'true') {
          query += ` AND c.primaryEntity.type != 'order'`;
        }

        if (category) {
          query += ` AND c.category = @category`;
          params.push({ name: '@category', value: category });
        }

        query += ` ORDER BY c.createdAt DESC`;

        const result = await cosmosService.queryItems<CommunicationRecord>('communications', query, params);

        return res.json({
          success: true,
          data: result.data || [],
          count: result.data?.length || 0
        });
      } catch (error: any) {
        logger.error('Failed to get vendor communications', { error: error.message, vendorId: req.params.vendorId });
        return res.status(500).json({
          success: false,
          error: error.message || 'Failed to retrieve communications'
        });
      }
    }
  );

  /**
   * GET /api/communications/appraiser/:appraiserId
   * Get all communications with/about an appraiser
   */
  router.get(
    '/appraiser/:appraiserId',
    [param('appraiserId').notEmpty()],
    async (req: Request, res: Response) => {
      try {
        const tenantId = (req as any).user?.tenantId || 'default';
        const { appraiserId } = req.params;
        const { category, excludeOrderSpecific } = req.query;

        let query = `
          SELECT * FROM c 
          WHERE c.type = 'communication'
            AND c.tenantId = @tenantId
            AND (
              (c.primaryEntity.type = 'appraiser' AND c.primaryEntity.id = @appraiserId)
              OR ARRAY_CONTAINS(c.relatedEntities, {type: 'appraiser', id: @appraiserId}, true)
            )
        `;

        const params: any[] = [
          { name: '@tenantId', value: tenantId },
          { name: '@appraiserId', value: appraiserId }
        ];

        if (excludeOrderSpecific === 'true') {
          query += ` AND c.primaryEntity.type != 'order'`;
        }

        if (category) {
          query += ` AND c.category = @category`;
          params.push({ name: '@category', value: category });
        }

        query += ` ORDER BY c.createdAt DESC`;

        const result = await cosmosService.queryItems<CommunicationRecord>('communications', query, params);

        return res.json({
          success: true,
          data: result.data || [],
          count: result.data?.length || 0
        });
      } catch (error: any) {
        logger.error('Failed to get appraiser communications', { error: error.message, appraiserId: req.params.appraiserId });
        return res.status(500).json({
          success: false,
          error: error.message || 'Failed to retrieve communications'
        });
      }
    }
  );

  /**
   * GET /api/communications/thread/:threadId
   * Get entire conversation thread
   */
  router.get(
    '/thread/:threadId',
    [param('threadId').notEmpty()],
    async (req: Request, res: Response) => {
      try {
        const tenantId = (req as any).user?.tenantId || 'default';
        const { threadId } = req.params;

        const query = `
          SELECT * FROM c 
          WHERE c.type = 'communication'
            AND c.threadId = @threadId
            AND c.tenantId = @tenantId
          ORDER BY c.createdAt ASC
        `;

        const result = await cosmosService.queryItems<CommunicationRecord>('communications', query, [
          { name: '@tenantId', value: tenantId },
          { name: '@threadId', value: threadId }
        ]);

        return res.json({
          success: true,
          data: result.data || [],
          count: result.data?.length || 0
        });
      } catch (error: any) {
        logger.error('Failed to get thread communications', { error: error.message, threadId: req.params.threadId });
        return res.status(500).json({
          success: false,
          error: error.message || 'Failed to retrieve communications'
        });
      }
    }
  );

  /**
   * POST /api/communications/search
   * Advanced search with multiple criteria
   */
  router.post(
    '/search',
    async (req: Request, res: Response) => {
      try {
        const tenantId = (req as any).user?.tenantId || 'default';
        const {
          entityType,
          entityId,
          category,
          channel,
          dateFrom,
          dateTo,
          searchTerm,
          requiresAction,
          status
        } = req.body;

        let conditions = ['c.type = \'communication\'', 'c.tenantId = @tenantId'];
        const params: any[] = [{ name: '@tenantId', value: tenantId }];

        if (entityType && entityId) {
          conditions.push('(c.primaryEntity.type = @entityType AND c.primaryEntity.id = @entityId)');
          params.push(
            { name: '@entityType', value: entityType },
            { name: '@entityId', value: entityId }
          );
        }

        if (category) {
          conditions.push('c.category = @category');
          params.push({ name: '@category', value: category });
        }

        if (channel) {
          conditions.push('c.channel = @channel');
          params.push({ name: '@channel', value: channel });
        }

        if (status) {
          conditions.push('c.status = @status');
          params.push({ name: '@status', value: status });
        }

        if (dateFrom) {
          conditions.push('c.createdAt >= @dateFrom');
          params.push({ name: '@dateFrom', value: dateFrom });
        }

        if (dateTo) {
          conditions.push('c.createdAt <= @dateTo');
          params.push({ name: '@dateTo', value: dateTo });
        }

        if (searchTerm) {
          conditions.push('(CONTAINS(LOWER(c.subject), LOWER(@searchTerm)) OR CONTAINS(LOWER(c.body), LOWER(@searchTerm)))');
          params.push({ name: '@searchTerm', value: searchTerm });
        }

        if (requiresAction) {
          conditions.push('c.businessImpact.requiresAction = true');
        }

        const query = `SELECT * FROM c WHERE ${conditions.join(' AND ')} ORDER BY c.createdAt DESC`;

        const result = await cosmosService.queryItems<CommunicationRecord>('communications', query, params);

        return res.json({
          success: true,
          data: result.data || [],
          count: result.data?.length || 0
        });
      } catch (error: any) {
        logger.error('Failed to search communications', { error: error.message });
        return res.status(500).json({
          success: false,
          error: error.message || 'Failed to search communications'
        });
      }
    }
  );

  return router;
};

