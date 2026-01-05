/**
 * Microsoft Teams Integration Controller
 * 
 * REST API for Teams meeting creation and management
 * Enables Teams interoperability for external users via ACS
 */

import { Router, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { TeamsService } from '../services/teams.service.js';
import { UnifiedAuthRequest } from '../middleware/unified-auth.middleware.js';
import { Logger } from '../utils/logger.js';

const logger = new Logger();
const teamsService = new TeamsService();

/**
 * Validation middleware for handling validation errors
 */
const handleValidationErrors = (req: UnifiedAuthRequest, res: Response, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array()
    });
  }
  return next();
};

/**
 * Create Teams meeting router
 */
export const createTeamsRouter = (): Router => {
  const router = Router();

  /**
   * POST /api/teams/meetings
   * Create a new Teams meeting for order collaboration
   */
  router.post(
    '/meetings',
    [
      body('orderId').notEmpty().withMessage('Order ID is required'),
      body('subject').notEmpty().withMessage('Subject is required'),
      body('startDateTime').isISO8601().withMessage('Valid start date/time is required'),
      body('endDateTime').isISO8601().withMessage('Valid end date/time is required'),
      body('participants').isArray().withMessage('Participants array is required'),
      body('participants.*.userId').notEmpty().withMessage('Participant userId is required'),
      body('participants.*.displayName').notEmpty().withMessage('Participant displayName is required'),
      body('participants.*.role').isIn(['organizer', 'presenter', 'attendee']).withMessage('Invalid role'),
      body('recordingEnabled').optional().isBoolean(),
      body('transcriptionEnabled').optional().isBoolean()
    ],
    handleValidationErrors,
    async (req: UnifiedAuthRequest, res: Response) => {
      try {
        if (!teamsService.isServiceConfigured()) {
          return res.status(503).json({
            success: false,
            error: 'SERVICE_NOT_CONFIGURED',
            message: 'Teams service is not configured. Please set AZURE_TENANT_ID.'
          });
        }

        const userId = req.user?.id;
        const tenantId = req.headers['x-tenant-id'] as string;

        if (!userId) {
          return res.status(401).json({
            success: false,
            error: 'UNAUTHORIZED',
            message: 'User authentication required'
          });
        }

        if (!tenantId) {
          return res.status(400).json({
            success: false,
            error: 'TENANT_ID_REQUIRED',
            message: 'x-tenant-id header is required'
          });
        }

        const {
          orderId,
          subject,
          startDateTime,
          endDateTime,
          participants,
          recordingEnabled,
          transcriptionEnabled
        } = req.body;

        const meeting = await teamsService.createOrderMeeting({
          orderId,
          subject,
          startDateTime: new Date(startDateTime),
          endDateTime: new Date(endDateTime),
          organizerId: userId,
          participants,
          recordingEnabled,
          transcriptionEnabled,
          tenantId
        });

        return res.json({
          success: true,
          data: meeting
        });
      } catch (error: any) {
        logger.error('Failed to create Teams meeting:', error);
        return res.status(500).json({
          success: false,
          error: 'MEETING_CREATION_FAILED',
          message: error.message || 'Failed to create meeting'
        });
      }
    }
  );

  /**
   * GET /api/teams/meetings/:meetingId
   * Get meeting details by ID
   */
  router.get(
    '/meetings/:meetingId',
    [
      param('meetingId').notEmpty().withMessage('Meeting ID is required'),
      query('tenantId').notEmpty().withMessage('tenantId query parameter is required')
    ],
    handleValidationErrors,
    async (req: UnifiedAuthRequest, res: Response) => {
      try {
        const { meetingId } = req.params;
        const tenantId = req.query.tenantId as string;

        if (!tenantId) {
          return res.status(400).json({
            success: false,
            error: 'TENANT_ID_REQUIRED',
            message: 'tenantId query parameter is required'
          });
        }

        const meeting = await teamsService.getMeetingById(meetingId!, tenantId!);

        if (!meeting) {
          return res.status(404).json({
            success: false,
            error: 'MEETING_NOT_FOUND',
            message: 'Meeting not found'
          });
        }

        return res.json({
          success: true,
          data: meeting
        });
      } catch (error: any) {
        logger.error('Failed to get meeting:', error);
        return res.status(500).json({
          success: false,
          error: 'MEETING_FETCH_FAILED',
          message: error.message || 'Failed to fetch meeting'
        });
      }
    }
  );

  /**
   * GET /api/teams/meetings/order/:orderId
   * Get all meetings for an order
   */
  router.get(
    '/meetings/order/:orderId',
    [
      param('orderId').notEmpty().withMessage('Order ID is required'),
      query('tenantId').notEmpty().withMessage('tenantId query parameter is required')
    ],
    handleValidationErrors,
    async (req: UnifiedAuthRequest, res: Response) => {
      try {
        const { orderId } = req.params;
        const tenantId = req.query.tenantId as string;

        if (!tenantId) {
          return res.status(400).json({
            success: false,
            error: 'TENANT_ID_REQUIRED',
            message: 'tenantId query parameter is required'
          });
        }

        const meetings = await teamsService.getOrderMeetings(orderId!, tenantId!);

        return res.json({
          success: true,
          data: meetings,
          count: meetings.length
        });
      } catch (error: any) {
        logger.error('Failed to get order meetings:', error);
        return res.status(500).json({
          success: false,
          error: 'MEETINGS_FETCH_FAILED',
          message: error.message || 'Failed to fetch meetings'
        });
      }
    }
  );

  /**
   * GET /api/teams/meetings/upcoming
   * Get upcoming meetings for authenticated user
   */
  router.get(
    '/meetings/upcoming',
    [
      query('tenantId').notEmpty().withMessage('tenantId query parameter is required')
    ],
    handleValidationErrors,
    async (req: UnifiedAuthRequest, res: Response) => {
      try {
        const userId = req.user?.id;
        const tenantId = req.query.tenantId as string;

        if (!tenantId) {
          return res.status(400).json({
            success: false,
            error: 'TENANT_ID_REQUIRED',
            message: 'tenantId query parameter is required'
          });
        }

        if (!userId) {
          return res.status(401).json({
            success: false,
            error: 'UNAUTHORIZED',
            message: 'User authentication required'
          });
        }

        const meetings = await teamsService.getUpcomingMeetings(userId, tenantId);

        return res.json({
          success: true,
          data: meetings,
          count: meetings.length
        });
      } catch (error: any) {
        logger.error('Failed to get upcoming meetings:', error);
        return res.status(500).json({
          success: false,
          error: 'MEETINGS_FETCH_FAILED',
          message: error.message || 'Failed to fetch meetings'
        });
      }
    }
  );

  /**
   * GET /api/teams/meetings/:meetingId/join-info
   * Get join information for external ACS user
   */
  router.get(
    '/meetings/:meetingId/join-info',
    [
      param('meetingId').notEmpty().withMessage('Meeting ID is required'),
      query('acsUserId').notEmpty().withMessage('acsUserId query parameter is required'),
      query('tenantId').notEmpty().withMessage('tenantId query parameter is required')
    ],
    handleValidationErrors,
    async (req: UnifiedAuthRequest, res: Response) => {
      try {
        const { meetingId } = req.params;
        const acsUserId = req.query.acsUserId as string;
        const tenantId = req.query.tenantId as string;

        if (!acsUserId || !tenantId) {
          return res.status(400).json({
            success: false,
            error: 'MISSING_PARAMETERS',
            message: 'acsUserId and tenantId query parameters are required'
          });
        }

        const joinInfo = await teamsService.getExternalJoinInfo(meetingId!, acsUserId!, tenantId!);

        return res.json({
          success: true,
          data: joinInfo
        });
      } catch (error: any) {
        logger.error('Failed to get join info:', error);
        return res.status(500).json({
          success: false,
          error: 'JOIN_INFO_FAILED',
          message: error.message || 'Failed to get join information'
        });
      }
    }
  );

  /**
   * POST /api/teams/meetings/:meetingId/participants
   * Add external participant to meeting
   */
  router.post(
    '/meetings/:meetingId/participants',
    [
      param('meetingId').notEmpty().withMessage('Meeting ID is required'),
      body('acsUserId').notEmpty().withMessage('ACS user ID is required'),
      body('displayName').notEmpty().withMessage('Display name is required'),
      body('tenantId').notEmpty().withMessage('Tenant ID is required')
    ],
    handleValidationErrors,
    async (req: UnifiedAuthRequest, res: Response) => {
      try {
        const { meetingId } = req.params;
        const { acsUserId, displayName, tenantId } = req.body;

        if (!tenantId) {
          return res.status(400).json({
            success: false,
            error: 'TENANT_ID_REQUIRED',
            message: 'tenantId is required in request body'
          });
        }

        await teamsService.addExternalParticipant(meetingId!, acsUserId, displayName, tenantId!);

        return res.json({
          success: true,
          message: 'Participant added successfully'
        });
      } catch (error: any) {
        logger.error('Failed to add participant:', error);
        return res.status(500).json({
          success: false,
          error: 'ADD_PARTICIPANT_FAILED',
          message: error.message || 'Failed to add participant'
        });
      }
    }
  );

  /**
   * PATCH /api/teams/meetings/:meetingId
   * Update meeting details
   */
  router.patch(
    '/meetings/:meetingId',
    [
      param('meetingId').notEmpty().withMessage('Meeting ID is required'),
      body('subject').optional().notEmpty(),
      body('startDateTime').optional().isISO8601(),
      body('endDateTime').optional().isISO8601(),
      body('tenantId').notEmpty().withMessage('Tenant ID is required')
    ],
    handleValidationErrors,
    async (req: UnifiedAuthRequest, res: Response) => {
      try {
        const { meetingId } = req.params;
        const { subject, startDateTime, endDateTime, tenantId } = req.body;

        if (!tenantId) {
          return res.status(400).json({
            success: false,
            error: 'TENANT_ID_REQUIRED',
            message: 'tenantId is required in request body'
          });
        }

        const updates: any = {};
        if (subject) updates.subject = subject;
        if (startDateTime) updates.startDateTime = new Date(startDateTime);
        if (endDateTime) updates.endDateTime = new Date(endDateTime);

        const updatedMeeting = await teamsService.updateMeeting(meetingId!, updates, tenantId!);

        return res.json({
          success: true,
          data: updatedMeeting
        });
      } catch (error: any) {
        logger.error('Failed to update meeting:', error);
        return res.status(500).json({
          success: false,
          error: 'UPDATE_MEETING_FAILED',
          message: error.message || 'Failed to update meeting'
        });
      }
    }
  );

  /**
   * DELETE /api/teams/meetings/:meetingId
   * Cancel a Teams meeting
   */
  router.delete(
    '/meetings/:meetingId',
    [
      param('meetingId').notEmpty().withMessage('Meeting ID is required'),
      query('tenantId').notEmpty().withMessage('tenantId query parameter is required')
    ],
    handleValidationErrors,
    async (req: UnifiedAuthRequest, res: Response) => {
      try {
        const { meetingId } = req.params;
        const tenantId = req.query.tenantId as string;

        if (!tenantId) {
          return res.status(400).json({
            success: false,
            error: 'TENANT_ID_REQUIRED',
            message: 'tenantId query parameter is required'
          });
        }

        await teamsService.cancelMeeting(meetingId!, tenantId!);

        return res.json({
          success: true,
          message: 'Meeting cancelled successfully'
        });
      } catch (error: any) {
        logger.error('Failed to cancel meeting:', error);
        return res.status(500).json({
          success: false,
          error: 'CANCEL_MEETING_FAILED',
          message: error.message || 'Failed to cancel meeting'
        });
      }
    }
  );

  return router;
};
