/**
 * Microsoft Teams Integration Service
 * 
 * Provides Teams meeting creation and management using Microsoft Graph API
 * Enables Teams interoperability for external ACS users (no Teams license required)
 * 
 * Features:
 * - Create Teams meetings for order collaboration
 * - Generate join links for external users (vendors, borrowers)
 * - ACS users can join as guests without Teams licenses
 * - Chat, audio/video calling within Teams meetings
 * - Meeting recording and transcription
 */

import { Client } from '@microsoft/microsoft-graph-client';
import { DefaultAzureCredential } from '@azure/identity';
import { CosmosDbService } from './cosmos-db.service';
import { Logger } from '../utils/logger.js';

interface TeamsMeetingParticipant {
  userId: string;
  acsUserId?: string;
  displayName: string;
  email?: string;
  role: 'organizer' | 'presenter' | 'attendee';
  isExternal: boolean;
}

interface TeamsMeeting {
  id: string;
  meetingId: string;
  orderId: string;
  subject: string;
  startDateTime: Date;
  endDateTime: Date;
  joinUrl: string;
  joinWebUrl: string;
  organizerId: string;
  participants: TeamsMeetingParticipant[];
  chatThreadId?: string;
  recordingEnabled: boolean;
  transcriptionEnabled: boolean;
  allowExternalParticipants: boolean;
  createdAt: Date;
  tenantId: string;
}

interface CreateMeetingOptions {
  orderId: string;
  subject: string;
  startDateTime: Date;
  endDateTime: Date;
  organizerId: string;
  participants: TeamsMeetingParticipant[];
  recordingEnabled?: boolean;
  transcriptionEnabled?: boolean;
  tenantId: string;
}

export class TeamsService {
  private graphClient: Client | null = null;
  private cosmosDbService: CosmosDbService;
  private logger: Logger;
  private isConfigured: boolean = false;

  constructor() {
    this.cosmosDbService = new CosmosDbService();
    this.logger = new Logger();
    this.initialize();
  }

  /**
   * Initialize Microsoft Graph client with Managed Identity
   */
  private async initialize(): Promise<void> {
    try {
      const tenantId = process.env.AZURE_TENANT_ID;
      const clientId = process.env.AZURE_CLIENT_ID;

      if (!tenantId) {
        this.logger.warn('Teams service not configured: AZURE_TENANT_ID missing');
        return;
      }

      // Use DefaultAzureCredential (Managed Identity in Azure, local credentials in dev)
      const credential = new DefaultAzureCredential();

      // Initialize Graph client with Microsoft Graph permissions
      this.graphClient = Client.initWithMiddleware({
        authProvider: {
          getAccessToken: async () => {
            const token = await credential.getToken('https://graph.microsoft.com/.default');
            return token?.token || '';
          }
        }
      });

      this.isConfigured = true;
      this.logger.info('Teams service initialized with Managed Identity');
    } catch (error: any) {
      this.logger.error('Failed to initialize Teams service:', { error: error.message });
      this.isConfigured = false;
    }
  }

  /**
   * Create a Teams meeting for order collaboration
   * External users (ACS) can join via link without Teams license
   */
  async createOrderMeeting(options: CreateMeetingOptions): Promise<TeamsMeeting> {
    if (!this.isConfigured || !this.graphClient) {
      throw new Error('Teams service not configured');
    }

    try {
      const {
        orderId,
        subject,
        startDateTime,
        endDateTime,
        organizerId,
        participants,
        recordingEnabled = true,
        transcriptionEnabled = false,
        tenantId
      } = options;

      // Create online meeting via Graph API
      // This creates a Teams meeting that external users can join
      const meeting = await this.graphClient
        .api('/users/' + organizerId + '/onlineMeetings')
        .post({
          subject,
          startDateTime: startDateTime.toISOString(),
          endDateTime: endDateTime.toISOString(),
          participants: {
            organizer: {
              identity: {
                user: {
                  id: organizerId
                }
              }
            },
            attendees: participants
              .filter(p => !p.isExternal && p.email) // Only include internal users with email
              .map(p => ({
                identity: {
                  user: {
                    id: p.userId,
                    displayName: p.displayName
                  }
                },
                role: p.role
              }))
          },
          allowedPresenters: 'organization', // Internal users can present
          allowAttendeeToEnableCamera: true,
          allowAttendeeToEnableMic: true,
          allowMeetingChat: 'enabled',
          allowTeamworkReactions: true,
          recordAutomatically: recordingEnabled,
          allowTranscription: transcriptionEnabled,
          lobbyBypassSettings: {
            scope: 'organization', // Internal users bypass lobby
            isDialInBypassEnabled: false
          }
        });

      // Store meeting details in Cosmos DB
      const teamsMeeting: TeamsMeeting = {
        id: `meeting-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        meetingId: meeting.id,
        orderId,
        subject,
        startDateTime,
        endDateTime,
        joinUrl: meeting.joinUrl, // Universal join link (works for everyone)
        joinWebUrl: meeting.joinWebUrl, // Web browser link
        organizerId,
        participants,
        chatThreadId: meeting.chatInfo?.threadId,
        recordingEnabled,
        transcriptionEnabled,
        allowExternalParticipants: true,
        createdAt: new Date(),
        tenantId
      };

      await this.cosmosDbService.createItem('teamsMeetings', teamsMeeting);

      this.logger.info(`Teams meeting created for order ${orderId}: ${meeting.joinUrl}`);
      return teamsMeeting;
    } catch (error: any) {
      this.logger.error('Failed to create Teams meeting:', { error: error.message });
      throw error;
    }
  }

  /**
   * Get join information for external ACS users
   * Returns join URL and instructions
   */
  async getExternalJoinInfo(meetingId: string, acsUserId: string, tenantId: string): Promise<{
    joinUrl: string;
    joinWebUrl: string;
    displayName: string;
    instructions: string;
  }> {
    try {
      const meeting = await this.getMeetingById(meetingId, tenantId);

      if (!meeting) {
        throw new Error('Meeting not found');
      }

      const participant = meeting.participants.find(p => p.acsUserId === acsUserId);

      return {
        joinUrl: meeting.joinUrl,
        joinWebUrl: meeting.joinWebUrl,
        displayName: participant?.displayName || 'Guest',
        instructions: `
          Join Teams Meeting:
          1. Click the join link below (no Teams account required)
          2. Enter your name when prompted
          3. Allow camera/microphone permissions
          4. You'll join as a guest and can participate fully
          
          Features available:
          - Audio/video calling
          - Chat with all participants
          - Screen sharing (if presenter)
          - View shared content
        `
      };
    } catch (error: any) {
      this.logger.error('Failed to get external join info:', { error: error.message });
      throw error;
    }
  }

  /**
   * Add external ACS participant to existing meeting
   */
  async addExternalParticipant(
    meetingId: string,
    acsUserId: string,
    displayName: string,
    tenantId: string
  ): Promise<void> {
    try {
      const meeting = await this.getMeetingById(meetingId, tenantId);

      if (!meeting) {
        throw new Error('Meeting not found');
      }

      // Add participant to local record
      meeting.participants.push({
        userId: acsUserId, // ACS user ID
        acsUserId,
        displayName,
        role: 'attendee',
        isExternal: true
      });

      // Update Cosmos DB
      await this.cosmosDbService.upsertItem('teamsMeetings', meeting);

      this.logger.info(`Added external participant ${displayName} (${acsUserId}) to meeting ${meetingId}`);
    } catch (error: any) {
      this.logger.error('Failed to add external participant:', { error: error.message });
      throw error;
    }
  }

  /**
   * Get meeting by ID
   */
  async getMeetingById(meetingId: string, tenantId: string): Promise<TeamsMeeting | null> {
    try {
      const query = 'SELECT * FROM c WHERE c.meetingId = @meetingId';
      const result = await this.cosmosDbService.queryItems<TeamsMeeting>(
        'teamsMeetings',
        query,
        [{ name: '@meetingId', value: meetingId }]
      );

      return result.data?.[0] || null;
    } catch (error: any) {
      this.logger.error('Failed to get meeting:', { error: error.message });
      return null;
    }
  }

  /**
   * Get all meetings for an order
   */
  async getOrderMeetings(orderId: string, tenantId: string): Promise<TeamsMeeting[]> {
    try {
      const query = 'SELECT * FROM c WHERE c.orderId = @orderId ORDER BY c.startDateTime DESC';
      const result = await this.cosmosDbService.queryItems<TeamsMeeting>(
        'teamsMeetings',
        query,
        [{ name: '@orderId', value: orderId }]
      );
      return result.data || [];
    } catch (error: any) {
      this.logger.error('Failed to get order meetings:', { error: error.message });
      return [];
    }
  }

  /**
   * Get upcoming meetings for a user
   */
  async getUpcomingMeetings(userId: string, tenantId: string): Promise<TeamsMeeting[]> {
    try {
      const now = new Date().toISOString();
      const query = `
        SELECT * FROM c 
        WHERE ARRAY_CONTAINS(c.participants, {"userId": @userId}, true)
        AND c.startDateTime >= @now
        ORDER BY c.startDateTime ASC
      `;

      const result = await this.cosmosDbService.queryItems<TeamsMeeting>(
        'teamsMeetings',
        query,
        [
          { name: '@userId', value: userId },
          { name: '@now', value: now }
        ]
      );
      return result.data || [];
    } catch (error: any) {
      this.logger.error('Failed to get upcoming meetings:', { error: error.message });
      return [];
    }
  }

  /**
   * Cancel a Teams meeting
   */
  async cancelMeeting(meetingId: string, tenantId: string): Promise<void> {
    if (!this.isConfigured || !this.graphClient) {
      throw new Error('Teams service not configured');
    }

    try {
      const meeting = await this.getMeetingById(meetingId, tenantId);

      if (!meeting) {
        throw new Error('Meeting not found');
      }

      // Cancel meeting via Graph API
      await this.graphClient
        .api(`/users/${meeting.organizerId}/onlineMeetings/${meeting.meetingId}`)
        .delete();

      // Mark as cancelled in Cosmos DB
      await this.cosmosDbService.deleteItem('teamsMeetings', meeting.id);

      this.logger.info(`Meeting ${meetingId} cancelled`);
    } catch (error: any) {
      this.logger.error('Failed to cancel meeting:', { error: error.message });
      throw error;
    }
  }

  /**
   * Update meeting details
   */
  async updateMeeting(
    meetingId: string,
    updates: Partial<Pick<TeamsMeeting, 'subject' | 'startDateTime' | 'endDateTime'>>,
    tenantId: string
  ): Promise<TeamsMeeting> {
    if (!this.isConfigured || !this.graphClient) {
      throw new Error('Teams service not configured');
    }

    try {
      const meeting = await this.getMeetingById(meetingId, tenantId);

      if (!meeting) {
        throw new Error('Meeting not found');
      }

      // Update via Graph API
      const graphUpdates: any = {};
      if (updates.subject) graphUpdates.subject = updates.subject;
      if (updates.startDateTime) graphUpdates.startDateTime = updates.startDateTime.toISOString();
      if (updates.endDateTime) graphUpdates.endDateTime = updates.endDateTime.toISOString();

      await this.graphClient
        .api(`/users/${meeting.organizerId}/onlineMeetings/${meeting.meetingId}`)
        .patch(graphUpdates);

      // Update local record
      const updatedMeeting = { ...meeting, ...updates };
      await this.cosmosDbService.upsertItem('teamsMeetings', updatedMeeting);

      this.logger.info(`Meeting ${meetingId} updated`);
      return updatedMeeting;
    } catch (error: any) {
      this.logger.error('Failed to update meeting:', { error: error.message });
      throw error;
    }
  }

  /**
   * Check if service is configured
   */
  isServiceConfigured(): boolean {
    return this.isConfigured;
  }
}
