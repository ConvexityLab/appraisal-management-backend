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
import { EmailService } from './email.service';
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
  private emailService: EmailService;
  private logger: Logger;
  private isConfigured: boolean = false;

  constructor() {
    this.logger = new Logger();
    
    // Only initialize Cosmos DB if we're going to use Teams service
    const tenantId = process.env.AZURE_TENANT_ID;
    if (!tenantId) {
      this.logger.warn('Teams service not configured: AZURE_TENANT_ID missing');
      this.isConfigured = false;
      return;
    }

    // Initialize services only if Teams is configured
    try {
      this.cosmosDbService = new CosmosDbService();
      this.emailService = new EmailService();
    } catch (error) {
      this.logger.warn('Failed to initialize Teams service dependencies', { error });
      this.isConfigured = false;
      return;
    }

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
   * Get channel email address for email-based notifications
   */
  async getChannelEmail(
    teamId: string,
    channelId: string
  ): Promise<string | null> {
    if (!this.isConfigured || !this.graphClient) {
      throw new Error('Teams service not configured');
    }

    try {
      this.logger.info('Getting channel email address', { teamId, channelId });

      const channel = await this.graphClient
        .api(`/teams/${teamId}/channels/${channelId}`)
        .get();

      const email = channel.email || null;
      this.logger.info('Channel email retrieved', { teamId, channelId, hasEmail: !!email });

      return email;
    } catch (error: any) {
      this.logger.error('Failed to get channel email:', { 
        error: error.message,
        teamId,
        channelId
      });
      throw error;
    }
  }

  /**
   * Send notification to Teams channel via email
   * This is the recommended approach for system notifications without a bot
   */
  async sendChannelEmailNotification(
    teamId: string,
    channelId: string,
    subject: string,
    htmlContent: string
  ): Promise<{ success: boolean; channelEmail: string; messageId?: string; error?: string }> {
    if (!this.isConfigured || !this.graphClient) {
      throw new Error('Teams service not configured');
    }

    try {
      // Get channel email address
      const channelEmail = await this.getChannelEmail(teamId, channelId);
      
      if (!channelEmail) {
        throw new Error('Channel does not have an email address configured');
      }

      this.logger.info('Sending email notification to Teams channel', { 
        teamId, 
        channelId, 
        channelEmail,
        subject,
        emailServiceConfigured: this.emailService.isConfigured()
      });

      // Use the email service (SMTP/SendGrid)
      const result = await this.emailService.sendEmail({
        to: channelEmail,
        subject: subject,
        html: htmlContent,
        text: htmlContent.replace(/<[^>]*>/g, '') // Strip HTML tags for plain text fallback
      });

      if (!result.success) {
        this.logger.error('Email service failed to send notification', {
          error: result.error,
          channelEmail
        });

        return {
          success: false,
          channelEmail,
          error: result.error || 'Email service not configured. Set SMTP_HOST or SENDGRID_API_KEY in environment variables.'
        };
      }

      this.logger.info('Email notification sent to Teams channel', { 
        teamId, 
        channelId,
        channelEmail,
        messageId: result.messageId
      });

      return {
        success: true,
        channelEmail,
        ...(result.messageId && { messageId: result.messageId })
      };
    } catch (error: any) {
      this.logger.error('Failed to send email notification to channel:', { 
        error: error.message,
        teamId,
        channelId
      });
      
      return {
        success: false,
        channelEmail: '',
        error: error.message
      };
    }
  }

  /**
   * Send a message to a Teams channel
   * Works with application permissions - no user context needed
   */
  async sendChannelMessage(
    teamId: string,
    channelId: string,
    message: string,
    subject?: string
  ): Promise<{ messageId: string }> {
    if (!this.isConfigured || !this.graphClient) {
      throw new Error('Teams service not configured');
    }

    try {
      this.logger.info('Sending Teams channel message', { teamId, channelId, subject });

      const messageBody: any = {
        body: {
          contentType: 'html',
          content: message
        }
      };

      if (subject) {
        messageBody.subject = subject;
      }

      const messageResponse = await this.graphClient
        .api(`/teams/${teamId}/channels/${channelId}/messages`)
        .post(messageBody);

      this.logger.info('Channel message sent', { 
        messageId: messageResponse.id,
        teamId,
        channelId
      });

      return {
        messageId: messageResponse.id
      };
    } catch (error: any) {
      this.logger.error('Failed to send channel message:', { 
        error: error.message,
        teamId,
        channelId
      });
      throw error;
    }
  }

  /**
   * Send a direct 1-on-1 message to a Teams user
   * Note: Requires user delegation or Teams Bot for application-only context
   * For system notifications, use sendChannelMessage instead
   * Creates a chat if it doesn't exist, then sends the message
   */
  async sendDirectMessage(
    recipientUserId: string,
    message: string,
    senderUserId?: string
  ): Promise<{ chatId: string; messageId: string }> {
    if (!this.isConfigured || !this.graphClient) {
      throw new Error('Teams service not configured');
    }

    try {
      this.logger.info('Sending direct Teams message', { recipientUserId, senderUserId });

      // For oneOnOne chats with application permissions, we need both users
      // If sender is same as recipient, or no sender, use system notification approach
      if (!senderUserId || senderUserId === recipientUserId) {
        // Get all chats for the recipient and find or create a system notification chat
        // For now, throw error requiring different users
        throw new Error('Sender and recipient must be different users for oneOnOne chats. Consider using Channel messages or group chats for system notifications.');
      }

      // Step 1: Create or get existing 1-on-1 chat between two users
      // Microsoft Graph will return existing chat if it already exists
      // Note: Can use either user ID or email (UPN) in the users endpoint
      const chatResponse = await this.graphClient
        .api('/chats')
        .post({
          chatType: 'oneOnOne',
          members: [
            {
              '@odata.type': '#microsoft.graph.aadUserConversationMember',
              roles: ['owner'],
              'user@odata.bind': `https://graph.microsoft.com/v1.0/users/${senderUserId}` // Accepts ID or email
            },
            {
              '@odata.type': '#microsoft.graph.aadUserConversationMember',
              roles: ['owner'],
              'user@odata.bind': `https://graph.microsoft.com/v1.0/users/${recipientUserId}` // Accepts ID or email
            }
          ]
        });

      const chatId = chatResponse.id;

      // Step 2: Send message in the chat
      const messageResponse = await this.graphClient
        .api(`/chats/${chatId}/messages`)
        .post({
          body: {
            contentType: 'html',
            content: message
          }
        });

      this.logger.info('Direct Teams message sent', { 
        chatId, 
        messageId: messageResponse.id,
        recipientUserId 
      });

      return {
        chatId,
        messageId: messageResponse.id
      };
    } catch (error: any) {
      this.logger.error('Failed to send direct Teams message:', { 
        error: error.message,
        recipientUserId 
      });
      throw error;
    }
  }

  /**
   * Send a notification message to a user about an order
   * Convenience wrapper with order context
   */
  async sendOrderNotification(
    recipientUserId: string,
    orderId: string,
    subject: string,
    message: string
  ): Promise<{ chatId: string; messageId: string }> {
    const formattedMessage = `
      <h3>${subject}</h3>
      <p><strong>Order:</strong> #${orderId}</p>
      <p>${message}</p>
      <p><a href="https://appraisal.l1-analytics.com/orders/${orderId}">View Order</a></p>
    `;

    return this.sendDirectMessage(recipientUserId, formattedMessage);
  }

  /**
   * Check if service is configured
   */
  isServiceConfigured(): boolean {
    return this.isConfigured;
  }
}
