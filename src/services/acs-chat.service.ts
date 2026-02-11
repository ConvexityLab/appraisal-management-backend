/**
 * Azure Communication Services Chat Service
 * Manages chat threads, participants, and messages
 */

import { ChatClient, ChatThreadClient } from '@azure/communication-chat';
import { AzureCommunicationTokenCredential } from '@azure/communication-common';
import { CommunicationIdentityClient } from '@azure/communication-identity';
import { Logger } from '../utils/logger';
import { AcsIdentityService } from './acs-identity.service';

export interface ChatParticipant {
  id: string;
  displayName: string;
  shareHistoryTime?: Date;
}

export interface ChatThreadDetails {
  threadId: string;
  topic: string;
  createdOn: Date;
  participants: ChatParticipant[];
}

export class AcsChatService {
  private chatClient: ChatClient | null = null;
  private identityService: AcsIdentityService;
  private logger: Logger;
  private configured: boolean = false;
  private endpoint: string;
  private apiKey: string;

  constructor() {
    this.logger = new Logger();
    this.identityService = new AcsIdentityService();
    
    this.endpoint = process.env.AZURE_COMMUNICATION_ENDPOINT || process.env.ACS_ENDPOINT || '';
    this.apiKey = process.env.AZURE_COMMUNICATION_API_KEY || process.env.ACS_API_KEY || '';

    if (!this.endpoint || !this.apiKey) {
      this.logger.warn('ACS Chat Service: Missing AZURE_COMMUNICATION_ENDPOINT or AZURE_COMMUNICATION_API_KEY - service will not be available');
      return;
    }

    try {
      // Initialize chat client with service credential
      this.chatClient = new ChatClient(
        this.endpoint,
        new AzureKeyCredential(this.apiKey)
      );
      
      this.configured = true;
      this.logger.info('ACS Chat Service initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize ACS Chat Service', error);
    }
  }

  /**
   * Create a new chat thread
   */
  async createThread(
    topic: string,
    participants: ChatParticipant[],
    creatorUserId: string
  ): Promise<string> {
    if (!this.configured || !this.chatClient) {
      throw new Error('ACS Chat Service is not configured');
    }

    try {
      // Get or create ACS user for thread creator
      const creatorAcsUser = await this.identityService.exchangeUserToken(creatorUserId, 'system');

      // Create chat client for the creator
      const creatorToken = creatorAcsUser.token;
      const creatorChatClient = new ChatClient(
        this.endpoint,
        new AzureCommunicationTokenCredential(creatorToken)
      );

      // Create the thread
      const createChatThreadRequest = {
        topic,
        participants: participants.map(p => ({
          id: { communicationUserId: p.id },
          displayName: p.displayName,
          shareHistoryTime: p.shareHistoryTime || new Date()
        }))
      };

      const createChatThreadResult = await creatorChatClient.createChatThread(
        createChatThreadRequest
      );

      if (!createChatThreadResult.chatThread) {
        throw new Error('Failed to create chat thread - no thread returned');
      }

      const threadId = createChatThreadResult.chatThread.id;

      this.logger.info('Chat thread created', {
        threadId,
        topic,
        participantCount: participants.length
      });

      return threadId;
    } catch (error: any) {
      this.logger.error('Failed to create chat thread', {
        error: error.message,
        stack: error.stack,
        topic
      });
      throw error;
    }
  }

  /**
   * Get thread client for operations
   */
  private getThreadClient(threadId: string, userToken: string): ChatThreadClient {
    const chatClient = new ChatClient(
      this.endpoint,
      new AzureCommunicationTokenCredential(userToken)
    );
    return chatClient.getChatThreadClient(threadId);
  }

  /**
   * Add participant to existing thread
   */
  async addParticipant(
    threadId: string,
    participant: ChatParticipant,
    operatorUserId: string
  ): Promise<void> {
    if (!this.configured) {
      throw new Error('ACS Chat Service is not configured');
    }

    try {
      // Get operator's token
      const operatorAcsUser = await this.identityService.exchangeUserToken(operatorUserId, 'system');
      const threadClient = this.getThreadClient(threadId, operatorAcsUser.token);

      // Add participant
      await threadClient.addParticipants({
        participants: [{
          id: { communicationUserId: participant.id },
          displayName: participant.displayName,
          shareHistoryTime: participant.shareHistoryTime || new Date()
        }]
      });

      this.logger.info('Participant added to thread', {
        threadId,
        participantId: participant.id,
        displayName: participant.displayName
      });
    } catch (error: any) {
      this.logger.error('Failed to add participant to thread', {
        error: error.message,
        threadId,
        participantId: participant.id
      });
      throw error;
    }
  }

  /**
   * Remove participant from thread
   */
  async removeParticipant(
    threadId: string,
    participantAcsId: string,
    operatorUserId: string
  ): Promise<void> {
    if (!this.configured) {
      throw new Error('ACS Chat Service is not configured');
    }

    try {
      const operatorAcsUser = await this.identityService.exchangeUserToken(operatorUserId, 'system');
      const threadClient = this.getThreadClient(threadId, operatorAcsUser.token);

      await threadClient.removeParticipant({
        communicationUserId: participantAcsId
      });

      this.logger.info('Participant removed from thread', {
        threadId,
        participantId: participantAcsId
      });
    } catch (error: any) {
      this.logger.error('Failed to remove participant from thread', {
        error: error.message,
        threadId,
        participantId: participantAcsId
      });
      throw error;
    }
  }

  /**
   * Get thread properties
   */
  async getThread(threadId: string, userId: string): Promise<ChatThreadDetails> {
    if (!this.configured) {
      throw new Error('ACS Chat Service is not configured');
    }

    try {
      const userAcsUser = await this.identityService.exchangeUserToken(userId, 'system');
      const threadClient = this.getThreadClient(threadId, userAcsUser.token);

      const properties = await threadClient.getProperties();
      
      // Get participants
      const participantsList: ChatParticipant[] = [];
      const participantsIterator = threadClient.listParticipants();
      
      for await (const participant of participantsIterator) {
        participantsList.push({
          id: participant.id.communicationUserId || '',
          displayName: participant.displayName || 'Unknown',
          shareHistoryTime: participant.shareHistoryTime
        });
      }

      return {
        threadId,
        topic: properties.topic || '',
        createdOn: properties.createdOn || new Date(),
        participants: participantsList
      };
    } catch (error: any) {
      this.logger.error('Failed to get thread details', {
        error: error.message,
        threadId
      });
      throw error;
    }
  }

  /**
   * Delete a thread
   */
  async deleteThread(threadId: string, userId: string): Promise<void> {
    if (!this.configured) {
      throw new Error('ACS Chat Service is not configured');
    }

    try {
      const userAcsUser = await this.identityService.exchangeUserToken(userId, 'system');
      const chatClient = new ChatClient(
        this.endpoint,
        new AzureCommunicationTokenCredential(userAcsUser.token)
      );

      await chatClient.deleteChatThread(threadId);

      this.logger.info('Chat thread deleted', { threadId });
    } catch (error: any) {
      this.logger.error('Failed to delete thread', {
        error: error.message,
        threadId
      });
      throw error;
    }
  }

  /**
   * Send message to thread (for testing/system messages)
   */
  async sendMessage(
    threadId: string,
    content: string,
    senderUserId: string
  ): Promise<string> {
    if (!this.configured) {
      throw new Error('ACS Chat Service is not configured');
    }

    try {
      const userAcsUser = await this.identityService.exchangeUserToken(senderUserId, 'system');
      const threadClient = this.getThreadClient(threadId, userAcsUser.token);

      const sendMessageResult = await threadClient.sendMessage({ content });
      
      this.logger.info('Message sent to thread', {
        threadId,
        messageId: sendMessageResult.id
      });

      return sendMessageResult.id;
    } catch (error: any) {
      this.logger.error('Failed to send message', {
        error: error.message,
        threadId
      });
      throw error;
    }
  }

  /**
   * Get recent messages from thread (for AI analysis)
   */
  async getMessages(threadId: string, userId: string, maxMessages: number = 100) {
    if (!this.configured) {
      throw new Error('ACS Chat Service is not configured');
    }

    try {
      const userAcsUser = await this.identityService.exchangeUserToken(userId, 'system');
      const threadClient = this.getThreadClient(threadId, userAcsUser.token);

      const messages: any[] = [];
      const messagesIterator = threadClient.listMessages({ maxPageSize: maxMessages });
      
      for await (const message of messagesIterator) {
        messages.push(message);
      }

      return messages.reverse(); // Return in chronological order
    } catch (error: any) {
      this.logger.error('Failed to get messages', {
        error: error.message,
        threadId
      });
      throw error;
    }
  }

  /**
   * Check if service is configured
   */
  isConfigured(): boolean {
    return this.configured;
  }
}
