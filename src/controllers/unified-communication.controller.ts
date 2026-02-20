/**
 * Unified Communication Controller
 * REST API for chat, calls, and meetings with AI insights
 */

import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { UnifiedCommunicationService } from '../services/unified-communication.service';
import { UnifiedAuthRequest } from '../middleware/unified-auth.middleware';
import { Logger } from '../utils/logger';
import { createApiResponse, createApiError, ErrorCodes } from '../utils/api-response.util';

const logger = new Logger();
const communicationService = new UnifiedCommunicationService();

export const createUnifiedCommunicationRouter = () => {
  const router = Router();

  /**
   * Create a new communication context
   * POST /api/communication/contexts
   */
  router.post(
    '/contexts',
    [
      body('type').isIn(['order', 'qc_review', 'general']).withMessage('Invalid context type'),
      body('entityId').notEmpty().withMessage('Entity ID is required'),
      body('tenantId').notEmpty().withMessage('Tenant ID is required'),
      body('createdBy').notEmpty().withMessage('Creator user ID is required'),
      body('participants').isArray({ min: 1 }).withMessage('At least one participant required'),
      body('participants.*.userId').notEmpty().withMessage('Participant user ID required'),
      body('participants.*.displayName').notEmpty().withMessage('Participant display name required'),
      body('participants.*.email').isEmail().withMessage('Valid participant email required'),
      body('participants.*.role').notEmpty().withMessage('Participant role required'),
      body('autoCreateChat').optional().isBoolean()
    ],
    async (req: Request, res: Response): Promise<void> => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          res.status(400).json(createApiError(
            'VALIDATION_ERROR',
            'Invalid request parameters',
            errors.array()
          ));
          return;
        }

        const context = await communicationService.createContext(req.body);
        
        logger.info('Communication context created via API', {
          contextId: context.id,
          type: context.type,
          entityId: context.entityId,
          participantCount: context.participants.length
        });

        res.status(201).json(createApiResponse(context));
      } catch (error: any) {
        logger.error('Failed to create communication context', {
          error: error.message,
          body: req.body
        });
        res.status(500).json(createApiError(
          ErrorCodes.DATABASE_ERROR,
          'Failed to create communication context',
          error.message
        ));
      }
    }
  );

  /**
   * Get context by entity type and ID
   * GET /api/communication/contexts/:type/:entityId
   */
  router.get(
    '/contexts/:type/:entityId',
    [
      param('type').isIn(['order', 'qc_review', 'general']),
      param('entityId').notEmpty(),
      query('tenantId').notEmpty().withMessage('Tenant ID query parameter required')
    ],
    async (req: Request, res: Response): Promise<void> => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          res.status(400).json(createApiError(
            'VALIDATION_ERROR',
            'Invalid request parameters',
            errors.array()
          ));
          return;
        }

        const { type, entityId } = req.params;
        const { tenantId } = req.query;

        const context = await communicationService.getContextByEntity(
          type as string,
          entityId as string,
          tenantId as string
        );

        if (!context) {
          res.status(404).json(createApiError(
            'CONTEXT_NOT_FOUND',
            'Communication context not found for this entity'
          ));
          return;
        }

        res.json(createApiResponse(context));
      } catch (error: any) {
        logger.error('Failed to get communication context', {
          error: error.message,
          params: req.params
        });
        res.status(500).json(createApiError(
          ErrorCodes.DATABASE_ERROR,
          'Failed to get communication context',
          error.message
        ));
      }
    }
  );

  /**
   * Get context by ID
   * GET /api/communication/contexts/:contextId
   */
  router.get(
    '/contexts/:contextId',
    [
      param('contextId').isUUID().withMessage('Invalid context ID')
    ],
    async (req: Request, res: Response): Promise<void> => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          res.status(400).json(createApiError(
            'VALIDATION_ERROR',
            'Invalid context ID',
            errors.array()
          ));
          return;
        }

        const { contextId } = req.params;
        const context = await communicationService.getContext(contextId as string);

        if (!context) {
          res.status(404).json(createApiError(
            'CONTEXT_NOT_FOUND',
            'Communication context not found'
          ));
          return;
        }

        res.json(createApiResponse(context));
      } catch (error: any) {
        logger.error('Failed to get communication context', {
          error: error.message,
          contextId: req.params.contextId
        });
        res.status(500).json(createApiError(
          ErrorCodes.DATABASE_ERROR,
          'Failed to get communication context',
          error.message
        ));
      }
    }
  );

  /**
   * List user's communication contexts
   * GET /api/communication/contexts
   */
  router.get(
    '/contexts',
    [
      query('userId').notEmpty().withMessage('User ID query parameter required'),
      query('tenantId').notEmpty().withMessage('Tenant ID query parameter required')
    ],
    async (req: Request, res: Response): Promise<void> => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          res.status(400).json(createApiError(
            'VALIDATION_ERROR',
            'Invalid query parameters',
            errors.array()
          ));
          return;
        }

        const { userId, tenantId } = req.query;
        
        const contexts = await communicationService.listUserContexts(
          userId as string,
          tenantId as string
        );

        res.json(createApiResponse({
          contexts,
          count: contexts.length
        }));
      } catch (error: any) {
        logger.error('Failed to list user contexts', {
          error: error.message,
          query: req.query
        });
        res.status(500).json(createApiError(
          ErrorCodes.DATABASE_ERROR,
          'Failed to list user contexts',
          error.message
        ));
      }
    }
  );

  /**
   * Initialize chat thread for context
   * POST /api/communication/contexts/:contextId/chat
   */
  router.post(
    '/contexts/:contextId/chat',
    [
      param('contextId').isUUID().withMessage('Invalid context ID'),
      body('userId').notEmpty().withMessage('User ID required'),
      body('tenantId').notEmpty().withMessage('Tenant ID required')
    ],
    async (req: Request, res: Response): Promise<void> => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          res.status(400).json(createApiError(
            'VALIDATION_ERROR',
            'Invalid request parameters',
            errors.array()
          ));
          return;
        }

        const { contextId } = req.params;
        const { userId, tenantId } = req.body;

        const threadId = await communicationService.initializeChatThread(contextId as string, tenantId, userId);

        logger.info('Chat thread initialized via API', {
          contextId,
          threadId,
          userId
        });

        res.status(201).json(createApiResponse({
          threadId,
          contextId,
          message: 'Chat thread created successfully'
        }));
      } catch (error: any) {
        logger.error('Failed to initialize chat thread', {
          error: error.message,
          contextId: req.params.contextId
        });
        res.status(500).json(createApiError(
          ErrorCodes.DATABASE_ERROR,
          'Failed to initialize chat thread',
          error.message
        ));
      }
    }
  );

  /**
   * Start an ad-hoc call
   * POST /api/communication/contexts/:contextId/call
   */
  router.post(
    '/contexts/:contextId/call',
    [
      param('contextId').isUUID().withMessage('Invalid context ID'),
      body('participants').isArray({ min: 1 }).withMessage('At least one participant required')
    ],
    async (req: Request, res: Response): Promise<void> => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          res.status(400).json(createApiError(
            'VALIDATION_ERROR',
            'Invalid request parameters',
            errors.array()
          ));
          return;
        }

        const { contextId } = req.params;
        const { participants } = req.body;

        const callDetails = await communicationService.startCall(contextId as string, participants);

        logger.info('Call started via API', {
          contextId,
          callId: callDetails.id,
          groupCallId: callDetails.groupCallId,
          participantCount: participants.length
        });

        res.status(201).json(createApiResponse({
          ...callDetails,
          message: 'Call started successfully. Use groupCallId with ACS Calling SDK to join.'
        }));
      } catch (error: any) {
        logger.error('Failed to start call', {
          error: error.message,
          contextId: req.params.contextId
        });
        res.status(500).json(createApiError(
          ErrorCodes.DATABASE_ERROR,
          'Failed to start call',
          error.message
        ));
      }
    }
  );

  /**
   * Schedule a Teams meeting
   * POST /api/communication/contexts/:contextId/meeting
   */
  router.post(
    '/contexts/:contextId/meeting',
    [
      param('contextId').isUUID().withMessage('Invalid context ID'),
      body('subject').notEmpty().withMessage('Meeting subject required'),
      body('startTime').isISO8601().withMessage('Valid start time required'),
      body('endTime').isISO8601().withMessage('Valid end time required'),
      body('participants').isArray({ min: 1 }).withMessage('At least one participant required'),
      body('organizerUserId').notEmpty().withMessage('Organizer user ID required')
    ],
    async (req: Request, res: Response): Promise<void> => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          res.status(400).json(createApiError(
            'VALIDATION_ERROR',
            'Invalid request parameters',
            errors.array()
          ));
          return;
        }

        const { contextId } = req.params;
        const { subject, startTime, endTime, participants, organizerUserId, description } = req.body;

        // Use the authenticated user's Azure AD object ID as organizer.
        // Graph API POST /users/{id}/onlineMeetings requires an AAD user ID, not an ACS ID.
        const authReq = req as UnifiedAuthRequest;
        const resolvedOrganizerId = authReq.user?.id || organizerUserId;

        if (!resolvedOrganizerId) {
          res.status(400).json(createApiError(
            'VALIDATION_ERROR',
            'Could not determine organizer user ID from authentication context'
          ));
          return;
        }

        logger.info('Scheduling meeting with organizer', {
          resolvedOrganizerId,
          requestBodyOrganizerId: organizerUserId,
          authUserId: authReq.user?.id
        });

        const meetingDetails = await communicationService.scheduleMeeting(
          contextId as string,
          {
            subject,
            startTime: new Date(startTime),
            endTime: new Date(endTime),
            participants,
            description
          },
          resolvedOrganizerId
        );

        logger.info('Meeting scheduled via API', {
          contextId,
          callId: meetingDetails.id,
          subject,
          startTime
        });

        res.status(201).json(createApiResponse({
          ...meetingDetails,
          message: 'Meeting scheduled successfully'
        }));
      } catch (error: any) {
        logger.error('Failed to schedule meeting', {
          error: error.message,
          contextId: req.params.contextId
        });
        res.status(500).json(createApiError(
          ErrorCodes.DATABASE_ERROR,
          'Failed to schedule meeting',
          error.message
        ));
      }
    }
  );

  /**
   * Add participant to context
   * POST /api/communication/contexts/:contextId/participants
   */
  router.post(
    '/contexts/:contextId/participants',
    [
      param('contextId').isUUID().withMessage('Invalid context ID'),
      body('userId').notEmpty().withMessage('User ID required'),
      body('displayName').notEmpty().withMessage('Display name required'),
      body('email').isEmail().withMessage('Valid email required'),
      body('role').notEmpty().withMessage('Role required')
    ],
    async (req: Request, res: Response): Promise<void> => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          res.status(400).json(createApiError(
            'VALIDATION_ERROR',
            'Invalid request parameters',
            errors.array()
          ));
          return;
        }

        const { contextId } = req.params;
        await communicationService.addParticipant(contextId as string, req.body);

        logger.info('Participant added via API', {
          contextId,
          userId: req.body.userId
        });

        res.status(201).json(createApiResponse({
          message: 'Participant added successfully'
        }));
      } catch (error: any) {
        logger.error('Failed to add participant', {
          error: error.message,
          contextId: req.params.contextId
        });
        res.status(500).json(createApiError(
          ErrorCodes.DATABASE_ERROR,
          'Failed to add participant',
          error.message
        ));
      }
    }
  );

  /**
   * Remove participant from context
   * DELETE /api/communication/contexts/:contextId/participants/:userId
   */
  router.delete(
    '/contexts/:contextId/participants/:userId',
    [
      param('contextId').isUUID().withMessage('Invalid context ID'),
      param('userId').notEmpty().withMessage('User ID required')
    ],
    async (req: Request, res: Response): Promise<void> => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          res.status(400).json(createApiError(
            'VALIDATION_ERROR',
            'Invalid request parameters',
            errors.array()
          ));
          return;
        }

        const { contextId, userId } = req.params;
        await communicationService.removeParticipant(contextId as string, userId as string);

        logger.info('Participant removed via API', {
          contextId,
          userId
        });

        res.json(createApiResponse({
          message: 'Participant removed successfully'
        }));
      } catch (error: any) {
        logger.error('Failed to remove participant', {
          error: error.message,
          contextId: req.params.contextId,
          userId: req.params.userId
        });
        res.status(500).json(createApiError(
          ErrorCodes.DATABASE_ERROR,
          'Failed to remove participant',
          error.message
        ));
      }
    }
  );

  /**
   * End a call
   * POST /api/communication/contexts/:contextId/calls/:callId/end
   */
  router.post(
    '/contexts/:contextId/calls/:callId/end',
    [
      param('contextId').isUUID().withMessage('Invalid context ID'),
      param('callId').isUUID().withMessage('Invalid call ID')
    ],
    async (req: Request, res: Response): Promise<void> => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          res.status(400).json(createApiError(
            'VALIDATION_ERROR',
            'Invalid request parameters',
            errors.array()
          ));
          return;
        }

        const { contextId, callId } = req.params;
        await communicationService.endCall(contextId as string, callId as string);

        logger.info('Call ended via API', {
          contextId,
          callId
        });

        res.json(createApiResponse({
          message: 'Call ended successfully'
        }));
      } catch (error: any) {
        logger.error('Failed to end call', {
          error: error.message,
          contextId: req.params.contextId,
          callId: req.params.callId
        });
        res.status(500).json(createApiError(
          ErrorCodes.DATABASE_ERROR,
          'Failed to end call',
          error.message
        ));
      }
    }
  );

  return router;
};
