/**
 * Chat Service - Simplified (Cosmos DB only, no ACS real-time)
 */

import { Logger } from '../utils/logger';
import { CosmosDbService } from './cosmos-db.service';
import { ApiResponse } from '../types/index';
import { ChatThread, ChatMessage, ChatParticipant } from '../types/communication.types';

export class ChatService {
  private logger: Logger;
  private dbService: CosmosDbService;

  constructor() {
    this.logger = new Logger();
    this.dbService = new CosmosDbService();
  }

  /**
   * Create chat thread (stores in Cosmos DB only)
   */
  async createChatThread(topic: string, orderId: string, participants: ChatParticipant[], tenantId: string): Promise<ApiResponse<ChatThread>> {
    try {
      const threadId = `thread-${orderId}-${Date.now()}`;

      const thread: ChatThread = {
        id: threadId,
        topic,
        orderId,
        participants,
        createdAt: new Date(),
        createdBy: participants[0]?.id || 'system'
      };

      await this.dbService.createItem('chatThreads', thread);

      this.logger.info('Chat thread created', { threadId, orderId });
      return { success: true, data: thread };
    } catch (error) {
      this.logger.error('Error creating chat thread', { error });
      throw error;
    }
  }

  /**
   * Send message (stores in Cosmos DB only)
   */
  async sendMessage(
    threadId: string, 
    senderId: string, 
    senderDisplayName: string, 
    content: string, 
    tenantId: string
  ): Promise<ApiResponse<ChatMessage>> {
    try {
      const messageId = `msg-${Date.now()}`;

      const message: ChatMessage = {
        id: messageId,
        threadId,
        senderId,
        senderDisplayName,
        content,
        type: 'text',
        createdAt: new Date()
      };

      await this.dbService.createItem('chatMessages', message);

      this.logger.info('Message sent', { threadId, messageId });
      return { success: true, data: message };
    } catch (error) {
      this.logger.error('Error sending chat message', { error });
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
  async addParticipant(threadId: string, participant: ChatParticipant, tenantId: string): Promise<void> {
    try {
      // Get existing thread
      const query = `SELECT * FROM c WHERE c.id = @threadId`;
      const parameters = [{ name: '@threadId', value: threadId }];
      const result = await this.dbService.queryItems<ChatThread>('chatThreads', query, parameters);

      if (!result.success || !result.data || result.data.length === 0) {
        throw new Error('Thread not found');
      }

      const thread = result.data[0];
      if (!thread) {
        throw new Error('Thread not found');
      }
      
      // Add participant if not already present
      const existingParticipant = thread.participants.find(p => p.id === participant.id);
      if (!existingParticipant) {
        thread.participants.push(participant);
        await this.dbService.upsertItem('chatThreads', thread);
      }

      this.logger.info('Participant added', { threadId, participantId: participant.id });
    } catch (error) {
      this.logger.error('Error adding participant', { error });
      throw error;
    }
  }

  /**
   * Placeholder methods for future ACS integration
   */
  async sendTypingIndicator(threadId: string, senderId: string): Promise<void> {
    // TODO: Implement when ACS Chat is ready
    this.logger.info('Typing indicator (not yet implemented)', { threadId, senderId });
  }

  async markMessageRead(threadId: string, messageId: string, userId: string): Promise<void> {
    // TODO: Implement when ACS Chat is ready
    this.logger.info('Read receipt (not yet implemented)', { threadId, messageId, userId });
  }

  async subscribeToThread(
    threadId: string,
    onMessageReceived: (message: ChatMessage) => void,
    onTypingIndicator?: (senderId: string, isTyping: boolean) => void
  ): Promise<void> {
    // TODO: Implement when ACS Chat is ready
    this.logger.info('Subscribe (not yet implemented)', { threadId });
  }

  async unsubscribeFromThread(threadId: string): Promise<void> {
    // TODO: Implement when ACS Chat is ready
    this.logger.info('Unsubscribe (not yet implemented)', { threadId });
  }
}
