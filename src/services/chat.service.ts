/**
 * Chat Service - Azure Communication Services Chat with Real-Time Support
 * 
 * Implements real-time chat using ACS Chat SDK with user token authentication.
 * Each user gets their own ChatClient instance with WebSocket real-time notifications.
 * Supports Teams interoperability - ACS users can join Teams meetings and chat.
 */

import { Logger } from '../utils/logger';
import { CosmosDbService } from './cosmos-db.service';
import { AzureCommunicationService } from './azure-communication.service';
import { AcsIdentityService } from './acs-identity.service';
import { TeamsService } from './teams.service';
import { ApiResponse } from '../types/index';
import { ChatThread, ChatMessage, ChatParticipant } from '../types/communication.types';
import { ChatClient, ChatThreadClient } from '@azure/communication-chat';

/**
 * User chat session - stores client and thread clients
 */
interface UserChatSession {
  acsUserId: string;
  chatClient: ChatClient;
  token: string;
  expiresOn: Date;
  threadClients: Map<string, ChatThreadClient>;
}

export class ChatService {
  private logger: Logger;
  private dbService: CosmosDbService;
  private acsService: AzureCommunicationService;
  private identityService: AcsIdentityService;
  private teamsService: TeamsService;
  
  // Active user sessions
  private userSessions: Map<string, UserChatSession> = new Map();

  constructor() {
    this.logger = new Logger();
    this.dbService = new CosmosDbService();
    this.acsService = new AzureCommunicationService();
    this.identityService = new AcsIdentityService();
    this.teamsService = new TeamsService();
  }

  /**
   * Initialize chat for user - call once per user session
   * Creates ChatClient with user's token and starts real-time notifications
   */
  async initializeUserChat(
    azureAdUserId: string, 
    acsUserId: string, 
    token: string, 
    expiresOn: Date
  ): Promise<void> {
    try {
      this.logger.info('Initializing chat for user', { azureAdUserId, acsUserId });

      // Create chat client for user
      const chatClient = this.acsService.getChatClientForUser(acsUserId, token, expiresOn);

      // Start real-time notifications (WebSocket connection)
      await chatClient.startRealtimeNotifications();

      // Store session
      const session: UserChatSession = {
        acsUserId,
        chatClient,
        token,
        expiresOn,
        threadClients: new Map()
      };

      this.userSessions.set(azureAdUserId, session);

      // Subscribe to global events
      chatClient.on('chatMessageReceived', async (e: any) => {
        await this.handleMessageReceived(e);
      });

      chatClient.on('typingIndicatorReceived', (e: any) => {
        this.logger.info('Typing indicator received', { 
          threadId: e.threadId, 
          sender: e.sender 
        });
      });

      chatClient.on('readReceiptReceived', (e: any) => {
        this.logger.info('Read receipt received', { 
          threadId: e.threadId, 
          messageId: e.chatMessageId,
          reader: e.sender 
        });
      });

      this.logger.info('Chat initialized successfully', { azureAdUserId, acsUserId });
    } catch (error) {
      this.logger.error('Error initializing user chat', { error, azureAdUserId });
      throw error;
    }
  }

  /**
   * Handle incoming real-time messages
   */
  private async handleMessageReceived(event: any): Promise<void> {
    try {
      this.logger.info('Real-time message received', { 
        threadId: event.threadId, 
        messageId: event.id 
      });

      // Save message to Cosmos DB
      const message: ChatMessage = {
        id: event.id,
        threadId: event.threadId,
        senderId: event.sender?.communicationUserId || 'unknown',
        senderDisplayName: event.senderDisplayName || 'Unknown',
        content: event.message || '',
        type: 'text',
        createdAt: event.createdOn ? new Date(event.createdOn) : new Date()
      };

      await this.dbService.upsertItem('chatMessages', message);

      this.logger.info('Message saved to Cosmos DB', { messageId: event.id });
    } catch (error) {
      this.logger.error('Error handling received message', { error, event });
    }
  }

  /**
   * Create ACS chat thread
   */
  async createChatThread(
    topic: string, 
    orderId: string, 
    participants: ChatParticipant[], 
    azureAdUserId: string,
    tenantId: string
  ): Promise<ApiResponse<ChatThread>> {
    try {
      const session = this.userSessions.get(azureAdUserId);
      if (!session) {
        return {
          success: false,
          data: null as any,
          error: { 
            code: 'SESSION_NOT_INITIALIZED', 
            message: 'Chat session not initialized. Call initializeUserChat first.', 
            timestamp: new Date() 
          }
        };
      }

      // Ensure all participants have ACS user IDs
      const participantsWithAcs = await Promise.all(
        participants.map(async (p) => {
          if (!p.acsUserId) {
            // Get or create ACS user ID for participant
            let acsUserId = await this.identityService.getAcsUserId(p.id, tenantId);
            if (!acsUserId) {
              // Create new ACS user for participant
              const tokenResult = await this.identityService.exchangeUserToken(p.id, tenantId);
              acsUserId = tokenResult.data?.acsUserId || '';
            }
            return { ...p, acsUserId };
          }
          return p;
        })
      );

      // Create thread in ACS
      const createResult = await session.chatClient.createChatThread(
        { topic },
        {
          participants: participantsWithAcs.map(p => ({
            id: { communicationUserId: p.acsUserId! },
            displayName: p.displayName
          }))
        }
      );

      const threadId = createResult.chatThread?.id;
      if (!threadId) {
        throw new Error('Failed to create ACS chat thread');
      }

      // Save to Cosmos DB
      const thread: ChatThread = {
        id: threadId,
        topic,
        orderId,
        participants: participantsWithAcs,
        createdAt: new Date(),
        createdBy: azureAdUserId
      };

      await this.dbService.createItem('chatThreads', thread);

      // Get thread client for this user
      const threadClient = session.chatClient.getChatThreadClient(threadId);
      session.threadClients.set(threadId, threadClient);

      this.logger.info('Chat thread created', { threadId, orderId });
      return { success: true, data: thread };
    } catch (error) {
      this.logger.error('Error creating chat thread', { error });
      throw error;
    }
  }

  /**
   * Send message to thread (broadcasts to all participants automatically via ACS)
   */
  async sendMessage(
    threadId: string,
    senderId: string,
    senderDisplayName: string,
    content: string,
    tenantId: string
  ): Promise<ApiResponse<ChatMessage>> {
    try {
      const session = this.userSessions.get(senderId);
      if (!session) {
        return {
          success: false,
          data: null as any,
          error: { 
            code: 'SESSION_NOT_INITIALIZED', 
            message: 'Chat session not initialized', 
            timestamp: new Date() 
          }
        };
      }

      // Get or create thread client
      let threadClient = session.threadClients.get(threadId);
      if (!threadClient) {
        threadClient = session.chatClient.getChatThreadClient(threadId);
        session.threadClients.set(threadId, threadClient);
      }

      // Send via ACS - this automatically broadcasts to all participants via WebSocket
      const sendResult = await threadClient.sendMessage(
        { content },
        { senderDisplayName }
      );

      const messageId = sendResult.id;

      // Save to Cosmos DB
      const message: ChatMessage = {
        id: messageId,
        threadId,
        senderId: session.acsUserId,
        senderDisplayName,
        content,
        type: 'text',
        createdAt: new Date()
      };

      await this.dbService.createItem('chatMessages', message);

      this.logger.info('Message sent', { threadId, messageId });
      return { success: true, data: message };
    } catch (error) {
      this.logger.error('Error sending message', { error });
      throw error;
    }
  }

  /**
   * Get messages for a thread
   */
  async getThreadMessages(threadId: string, tenantId: string, limit: number = 50): Promise<ChatMessage[]> {
    try {
      const query = `SELECT * FROM c WHERE c.threadId = @threadId ORDER BY c.createdAt DESC OFFSET 0 LIMIT @limit`;
      const parameters = [
        { name: '@threadId', value: threadId },
        { name: '@limit', value: limit }
      ];

      const result = await this.dbService.queryItems<ChatMessage>('chatMessages', query, parameters);
      return result.data?.reverse() || [];
    } catch (error) {
      this.logger.error('Error getting thread messages', { error });
      return [];
    }
  }

  /**
   * Get chat thread for an order
   */
  async getOrderThread(orderId: string, tenantId: string): Promise<ApiResponse<ChatThread>> {
    try {
      const query = `SELECT * FROM c WHERE c.orderId = @orderId`;
      const parameters = [{ name: '@orderId', value: orderId }];

      const result = await this.dbService.queryItems<ChatThread>('chatThreads', query, parameters);
      
      if (!result.success || !result.data || result.data.length === 0) {
        return {
          success: false,
          data: null as any,
          error: { code: 'THREAD_NOT_FOUND', message: 'Chat thread not found', timestamp: new Date() }
        };
      }

      const thread = result.data[0];
      if (!thread) {
        return {
          success: false,
          data: null as any,
          error: { code: 'THREAD_NOT_FOUND', message: 'Chat thread not found', timestamp: new Date() }
        };
      }

      return { success: true, data: thread };
    } catch (error) {
      this.logger.error('Error getting order thread', { error });
      throw error;
    }
  }

  /**
   * Add participant to thread
   */
  async addParticipant(
    threadId: string, 
    participant: ChatParticipant, 
    azureAdUserId: string,
    tenantId: string
  ): Promise<void> {
    try {
      const session = this.userSessions.get(azureAdUserId);
      if (!session) {
        throw new Error('Chat session not initialized');
      }

      // Ensure participant has ACS user ID
      let acsUserId = participant.acsUserId;
      if (!acsUserId) {
        const existingId = await this.identityService.getAcsUserId(participant.id, tenantId);
        if (existingId) {
          acsUserId = existingId;
        } else {
          const tokenResult = await this.identityService.exchangeUserToken(participant.id, tenantId);
          acsUserId = tokenResult.data?.acsUserId || '';
        }
        participant.acsUserId = acsUserId;
      }

      // Get thread client
      let threadClient = session.threadClients.get(threadId);
      if (!threadClient) {
        threadClient = session.chatClient.getChatThreadClient(threadId);
        session.threadClients.set(threadId, threadClient);
      }

      // Add to ACS thread
      await threadClient.addParticipants({
        participants: [{
          id: { communicationUserId: acsUserId },
          displayName: participant.displayName
        }]
      });

      // Update Cosmos DB
      const query = `SELECT * FROM c WHERE c.id = @threadId`;
      const parameters = [{ name: '@threadId', value: threadId }];
      const result = await this.dbService.queryItems<ChatThread>('chatThreads', query, parameters);

      if (result.success && result.data && result.data.length > 0) {
        const thread = result.data[0];
        if (thread) {
          const existingParticipant = thread.participants.find(p => p.id === participant.id);
          if (!existingParticipant) {
            thread.participants.push(participant);
            await this.dbService.upsertItem('chatThreads', thread);
          }
        }
      }

      this.logger.info('Participant added', { threadId, participantId: participant.id });
    } catch (error) {
      this.logger.error('Error adding participant', { error });
      throw error;
    }
  }

  /**
   * Send typing indicator
   */
  async sendTypingIndicator(threadId: string, azureAdUserId: string): Promise<void> {
    try {
      const session = this.userSessions.get(azureAdUserId);
      if (!session) return;

      let threadClient = session.threadClients.get(threadId);
      if (!threadClient) {
        threadClient = session.chatClient.getChatThreadClient(threadId);
        session.threadClients.set(threadId, threadClient);
      }

      await threadClient.sendTypingNotification();
    } catch (error) {
      this.logger.error('Error sending typing indicator', { error, threadId });
    }
  }

  /**
   * Mark message as read
   */
  async markMessageRead(threadId: string, messageId: string, azureAdUserId: string): Promise<void> {
    try {
      const session = this.userSessions.get(azureAdUserId);
      if (!session) return;

      let threadClient = session.threadClients.get(threadId);
      if (!threadClient) {
        threadClient = session.chatClient.getChatThreadClient(threadId);
        session.threadClients.set(threadId, threadClient);
      }

      await threadClient.sendReadReceipt({ chatMessageId: messageId });
      this.logger.info('Read receipt sent', { threadId, messageId });
    } catch (error) {
      this.logger.error('Error sending read receipt', { error, threadId, messageId });
    }
  }

  /**
   * Cleanup user session (call on logout)
   */
  async cleanupUserSession(azureAdUserId: string): Promise<void> {
    try {
      const session = this.userSessions.get(azureAdUserId);
      if (session) {
        // Stop real-time notifications
        await session.chatClient.stopRealtimeNotifications();
        
        // Clear thread clients
        session.threadClients.clear();
        
        // Remove session
        this.userSessions.delete(azureAdUserId);
        
        this.logger.info('User session cleaned up', { azureAdUserId });
      }
    } catch (error) {
      this.logger.error('Error cleaning up session', { error, azureAdUserId });
    }
  }

  /**
   * TEAMS INTEROPERABILITY METHODS
   * External ACS users can join Teams meetings without Teams license
   */

  /**
   * Join a Teams meeting chat as ACS user
   * External users (vendors, borrowers) can participate without Teams license
   */
  async joinTeamsMeetingChat(
    meetingId: string,
    azureAdUserId: string,
    tenantId: string
  ): Promise<ApiResponse<{ threadId: string; joinUrl: string }>> {
    try {
      const session = this.userSessions.get(azureAdUserId);
      if (!session) {
        return {
          success: false,
          data: null as any,
          error: { 
            code: 'SESSION_NOT_INITIALIZED', 
            message: 'Chat session not initialized', 
            timestamp: new Date() 
          }
        };
      }

      // Get meeting details
      const meeting = await this.teamsService.getMeetingById(meetingId, tenantId);
      if (!meeting) {
        return {
          success: false,
          data: null as any,
          error: { 
            code: 'MEETING_NOT_FOUND', 
            message: 'Teams meeting not found', 
            timestamp: new Date() 
          }
        };
      }

      // Get thread client for Teams meeting
      // Teams meetings have an associated chat thread
      const threadId = meeting.chatThreadId;
      if (!threadId) {
        return {
          success: false,
          data: null as any,
          error: { 
            code: 'MEETING_CHAT_NOT_AVAILABLE', 
            message: 'Teams meeting chat not available', 
            timestamp: new Date() 
          }
        };
      }

      // Join the Teams meeting chat thread
      const threadClient = session.chatClient.getChatThreadClient(threadId);
      session.threadClients.set(threadId, threadClient);

      this.logger.info('Joined Teams meeting chat', { 
        meetingId, 
        threadId, 
        azureAdUserId 
      });

      return {
        success: true,
        data: {
          threadId,
          joinUrl: meeting.joinUrl
        }
      };
    } catch (error) {
      this.logger.error('Error joining Teams meeting chat', { error, meetingId });
      throw error;
    }
  }

  /**
   * Send message in Teams meeting chat
   * Works seamlessly - ACS users chat alongside Teams users
   */
  async sendTeamsMeetingMessage(
    meetingId: string,
    content: string,
    azureAdUserId: string,
    senderDisplayName: string,
    tenantId: string
  ): Promise<ApiResponse<ChatMessage>> {
    try {
      const meeting = await this.teamsService.getMeetingById(meetingId, tenantId);
      if (!meeting || !meeting.chatThreadId) {
        return {
          success: false,
          data: null as any,
          error: { 
            code: 'MEETING_NOT_FOUND', 
            message: 'Teams meeting or chat not found', 
            timestamp: new Date() 
          }
        };
      }

      // Send message to Teams meeting chat thread
      return await this.sendMessage(
        meeting.chatThreadId,
        azureAdUserId,
        senderDisplayName,
        content,
        tenantId
      );
    } catch (error) {
      this.logger.error('Error sending Teams meeting message', { error, meetingId });
      throw error;
    }
  }

  /**
   * Get messages from Teams meeting chat
   */
  async getTeamsMeetingMessages(
    meetingId: string,
    tenantId: string,
    limit: number = 50
  ): Promise<ChatMessage[]> {
    try {
      const meeting = await this.teamsService.getMeetingById(meetingId, tenantId);
      if (!meeting || !meeting.chatThreadId) {
        this.logger.warn('Teams meeting or chat not found', { meetingId });
        return [];
      }

      return await this.getThreadMessages(meeting.chatThreadId, tenantId, limit);
    } catch (error) {
      this.logger.error('Error getting Teams meeting messages', { error, meetingId });
      return [];
    }
  }
}
