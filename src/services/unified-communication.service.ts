/**
 * Unified Communication Service
 * Central orchestration of chat, calls, and meetings with AI insights
 */

import { v4 as uuidv4 } from 'uuid';
import { CosmosDbService } from './cosmos-db.service';
import { AcsChatService } from './acs-chat.service';
import { AcsIdentityService } from './acs-identity.service';
import { TeamsService } from './teams.service';
import { Logger } from '../utils/logger';
import {
  CommunicationContext,
  CreateContextParams,
  CommunicationParticipant,
  CallDetails,
  MeetingParams
} from '../types/communication.types';

export class UnifiedCommunicationService {
  private dbService: CosmosDbService;
  private chatService: AcsChatService;
  private identityService: AcsIdentityService;
  private teamsService: TeamsService;
  private logger: Logger;
  private containerName = 'communicationContexts';

  constructor() {
    this.dbService = new CosmosDbService();
    this.chatService = new AcsChatService();
    this.identityService = new AcsIdentityService();
    this.teamsService = new TeamsService();
    this.logger = new Logger();
  }

  /**
   * Create a new communication context
   */
  async createContext(params: CreateContextParams): Promise<CommunicationContext> {
    try {
      // Generate ACS user IDs for all participants
      const participantsWithAcs: CommunicationParticipant[] = await Promise.all(
        params.participants.map(async (p) => {
          const acsResponse = await this.identityService.exchangeUserToken(p.userId, params.tenantId);
          
          if (!acsResponse.success || !acsResponse.data) {
            throw new Error(`Failed to create ACS identity for user ${p.userId}: ${acsResponse.error?.message || 'Unknown error'}`);
          }
          
          return {
            userId: p.userId,
            acsUserId: acsResponse.data.acsUserId,
            displayName: p.displayName,
            email: p.email,
            role: p.role,
            joinedAt: new Date(),
            permissions: {
              canStartCall: p.permissions?.canStartCall ?? true,
              canScheduleMeeting: p.permissions?.canScheduleMeeting ?? true,
              canInviteOthers: p.permissions?.canInviteOthers ?? false,
              canViewTranscripts: p.permissions?.canViewTranscripts ?? true
            }
          };
        })
      );

      // Create context document
      const context: CommunicationContext = {
        id: uuidv4(),
        type: params.type,
        entityId: params.entityId,
        tenantId: params.tenantId,
        calls: [],
        participants: participantsWithAcs,
        createdBy: params.createdBy,
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true
      };

      // Optionally create chat thread immediately
      if (params.autoCreateChat) {
        const threadId = await this._createChatThread(context);
        context.chatThreadId = threadId;
        context.chatCreatedAt = new Date();
      }

      // Save to Cosmos DB
      const createResponse = await this.dbService.createItem(this.containerName, context);
      
      if (!createResponse.success) {
        throw new Error(`Failed to save context to database: ${createResponse.error?.message || 'Unknown error'}`);
      }

      this.logger.info('Communication context created', {
        contextId: context.id,
        type: params.type,
        entityId: params.entityId,
        participantCount: participantsWithAcs.length,
        hasChatThread: !!context.chatThreadId
      });

      return context;
    } catch (error: any) {
      this.logger.error('Failed to create communication context', {
        error: error.message,
        params
      });
      throw error;
    }
  }

  /**
   * Get context by entity
   */
  async getContextByEntity(type: string, entityId: string, tenantId: string): Promise<CommunicationContext | null> {
    try {
      const query = 'SELECT * FROM c WHERE c.type = @type AND c.entityId = @entityId AND c.tenantId = @tenantId';
      const parameters = [
        { name: '@type', value: type },
        { name: '@entityId', value: entityId },
        { name: '@tenantId', value: tenantId }
      ];

      const response = await this.dbService.queryItems<CommunicationContext>(this.containerName, query, parameters);
      
      if (!response.success || !response.data || response.data.length === 0) {
        return null;
      }
      
      return response.data[0] || null;
    } catch (error: any) {
      this.logger.error('Failed to get context by entity', {
        error: error.message,
        type,
        entityId
      });
      throw error;
    }
  }

  /**
   * Get context by ID
   */
  async getContext(contextId: string, tenantId?: string): Promise<CommunicationContext | null> {
    try {
      const response = await this.dbService.getItem<CommunicationContext>(
        this.containerName,
        contextId,
        tenantId // Partition key - if not provided, Cosmos will scan (slower)
      );
      return response.success && response.data ? response.data : null;
    } catch (error: any) {
      this.logger.error('Failed to get context', {
        error: error.message,
        contextId,
        tenantId
      });
      throw error;
    }
  }

  /**
   * List all contexts for a user
   */
  async listUserContexts(userId: string, tenantId: string): Promise<CommunicationContext[]> {
    try {
      const query = 'SELECT * FROM c WHERE c.tenantId = @tenantId AND ARRAY_CONTAINS(c.participants, {"userId": @userId}, true)';
      const parameters = [
        { name: '@tenantId', value: tenantId },
        { name: '@userId', value: userId }
      ];

      const response = await this.dbService.queryItems<CommunicationContext>(this.containerName, query, parameters);
      return response.success && response.data ? response.data : [];
    } catch (error: any) {
      this.logger.error('Failed to list user contexts', {
        error: error.message,
        userId
      });
      throw error;
    }
  }

  /**
   * Initialize chat thread for existing context
   */
  async initializeChatThread(contextId: string, tenantId: string, userId: string): Promise<string> {
    try {
      const context = await this.getContext(contextId, tenantId);
      if (!context) {
        throw new Error('Context not found');
      }

      if (context.chatThreadId) {
        return context.chatThreadId;
      }

      // Create chat thread
      const threadId = await this._createChatThread(context);

      // Update context
      context.chatThreadId = threadId;
      context.chatCreatedAt = new Date();
      context.updatedAt = new Date();

      const updateResponse = await this.dbService.updateItem(this.containerName, context.id, context);
      
      if (!updateResponse.success) {
        throw new Error(`Failed to update context: ${updateResponse.error?.message || 'Unknown error'}`);
      }

      this.logger.info('Chat thread initialized for context', {
        contextId,
        threadId
      });

      return threadId;
    } catch (error: any) {
      this.logger.error('Failed to initialize chat thread', {
        error: error.message,
        contextId
      });
      throw error;
    }
  }

  /**
   * Private helper to create chat thread
   */
  private async _createChatThread(context: CommunicationContext): Promise<string> {
    const topic = this._generateThreadTopic(context);
    
    const chatParticipants = context.participants.map(p => ({
      id: p.acsUserId,
      displayName: p.displayName,
      shareHistoryTime: new Date()
    }));

    // Use first participant as creator
    const creatorUserId = context.participants[0]?.userId;
    if (!creatorUserId) {
      throw new Error('No participants in context');
    }

    return await this.chatService.createThread(topic, chatParticipants, creatorUserId);
  }

  /**
   * Generate appropriate thread topic
   */
  private _generateThreadTopic(context: CommunicationContext): string {
    switch (context.type) {
      case 'order':
        return `Order ${context.entityId} - Communication`;
      case 'qc_review':
        return `QC Review ${context.entityId} - Communication`;
      default:
        return `Communication - ${context.entityId}`;
    }
  }

  /**
   * Start an ad-hoc call
   */
  async startCall(contextId: string, participants: string[]): Promise<CallDetails> {
    try {
      const context = await this.getContext(contextId);
      if (!context) {
        throw new Error('Context not found');
      }

      // Generate group call ID
      const groupCallId = uuidv4();

      const callDetails: CallDetails = {
        id: uuidv4(),
        type: 'adhoc_call',
        groupCallId,
        startedAt: new Date(),
        participants,
        // For ACS Calling, frontend uses groupCallId to join
        // No specific join URL needed - handled by ACS Calling SDK
      };

      // Add to context
      context.calls.push(callDetails);
      context.updatedAt = new Date();

      await this.dbService.updateItem(this.containerName, context.id, context);

      this.logger.info('Call started', {
        contextId,
        callId: callDetails.id,
        groupCallId,
        participantCount: participants.length
      });

      return callDetails;
    } catch (error: any) {
      this.logger.error('Failed to start call', {
        error: error.message,
        contextId
      });
      throw error;
    }
  }

  /**
   * Schedule a Teams meeting
   */
  async scheduleMeeting(
    contextId: string,
    params: MeetingParams,
    organizerUserId: string
  ): Promise<CallDetails> {
    try {
      const context = await this.getContext(contextId);
      if (!context) {
        throw new Error('Context not found');
      }

      // Create Teams meeting using createOrderMeeting
      const meeting = await this.teamsService.createOrderMeeting({
        orderId: context.entityId,
        subject: params.subject,
        startDateTime: params.startTime,
        endDateTime: params.endTime,
        organizerId: organizerUserId,
        participants: params.participants.map(email => ({
          userId: '', // Will be resolved by Teams service
          displayName: email,
          email,
          role: 'attendee' as const,
          isExternal: true
        })),
        tenantId: context.tenantId
      });

      const callDetails: CallDetails = {
        id: uuidv4(),
        type: 'scheduled_meeting',
        meetingLink: meeting.joinUrl,
        startedAt: params.startTime,
        participants: params.participants
      };

      // Add to context
      context.calls.push(callDetails);
      context.updatedAt = new Date();

      await this.dbService.updateItem(this.containerName, context.id, context);

      this.logger.info('Meeting scheduled', {
        contextId,
        callId: callDetails.id,
        meetingId: meeting.meetingId,
        subject: params.subject
      });

      return callDetails;
    } catch (error: any) {
      this.logger.error('Failed to schedule meeting', {
        error: error.message,
        contextId
      });
      throw error;
    }
  }

  /**
   * Add participant to context
   */
  async addParticipant(
    contextId: string,
    participant: {
      userId: string;
      displayName: string;
      email: string;
      role: string;
      permissions?: Partial<CommunicationParticipant['permissions']>;
    }
  ): Promise<void> {
    try {
      const context = await this.getContext(contextId);
      if (!context) {
        throw new Error('Context not found');
      }

      // Check if already a participant
      if (context.participants.some(p => p.userId === participant.userId)) {
        return;
      }

      // Get ACS user ID
      const acsResponse = await this.identityService.exchangeUserToken(participant.userId, context.tenantId);
      if (!acsResponse.success || !acsResponse.data) {
        throw new Error('Failed to get ACS user ID');
      }

      const newParticipant: CommunicationParticipant = {
        userId: participant.userId,
        acsUserId: acsResponse.data.acsUserId,
        displayName: participant.displayName,
        email: participant.email,
        role: participant.role,
        joinedAt: new Date(),
        permissions: {
          canStartCall: participant.permissions?.canStartCall ?? true,
          canScheduleMeeting: participant.permissions?.canScheduleMeeting ?? true,
          canInviteOthers: participant.permissions?.canInviteOthers ?? false,
          canViewTranscripts: participant.permissions?.canViewTranscripts ?? true
        }
      };

      // Add to context
      context.participants.push(newParticipant);
      context.updatedAt = new Date();

      // If chat thread exists, add to thread
      if (context.chatThreadId) {
        await this.chatService.addParticipant(
          context.chatThreadId,
          {
            id: acsResponse.data.acsUserId,
            displayName: participant.displayName,
            shareHistoryTime: new Date()
          },
          context.createdBy
        );
      }

      await this.dbService.updateItem(this.containerName, context.id, context);

      this.logger.info('Participant added to context', {
        contextId,
        userId: participant.userId,
        addedToChatThread: !!context.chatThreadId
      });
    } catch (error: any) {
      this.logger.error('Failed to add participant', {
        error: error.message,
        contextId,
        userId: participant.userId
      });
      throw error;
    }
  }

  /**
   * Remove participant from context
   */
  async removeParticipant(contextId: string, userId: string): Promise<void> {
    try {
      const context = await this.getContext(contextId);
      if (!context) {
        throw new Error('Context not found');
      }

      const participant = context.participants.find(p => p.userId === userId);
      if (!participant) {
        return;
      }

      // Remove from context
      context.participants = context.participants.filter(p => p.userId !== userId);
      context.updatedAt = new Date();

      // Remove from chat thread if exists
      if (context.chatThreadId) {
        await this.chatService.removeParticipant(
          context.chatThreadId,
          participant.acsUserId,
          context.createdBy
        );
      }

      await this.dbService.updateItem(this.containerName, context.id, context);

      this.logger.info('Participant removed from context', {
        contextId,
        userId
      });
    } catch (error: any) {
      this.logger.error('Failed to remove participant', {
        error: error.message,
        contextId,
        userId
      });
      throw error;
    }
  }

  /**
   * End a call (update end time)
   */
  async endCall(contextId: string, callId: string): Promise<void> {
    try {
      const context = await this.getContext(contextId);
      if (!context) {
        throw new Error('Context not found');
      }

      const call = context.calls.find(c => c.id === callId);
      if (!call) {
        throw new Error('Call not found');
      }

      call.endedAt = new Date();
      call.duration = Math.floor((call.endedAt.getTime() - call.startedAt.getTime()) / 1000);
      context.updatedAt = new Date();

      await this.dbService.updateItem(this.containerName, context.id, context);

      this.logger.info('Call ended', {
        contextId,
        callId,
        duration: call.duration
      });
    } catch (error: any) {
      this.logger.error('Failed to end call', {
        error: error.message,
        contextId,
        callId
      });
      throw error;
    }
  }
}
