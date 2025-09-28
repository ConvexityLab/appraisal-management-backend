/**
 * Azure Web PubSub Service
 * Provides real-time WebSocket connections for instant notifications
 */

import { WebPubSubServiceClient } from '@azure/web-pubsub';
import { NotificationMessage, NotificationChannel } from '../types/events';
import { Logger } from '../utils/logger';

export interface WebPubSubConfig {
  connectionString?: string;
  hubName?: string;
  enableLocalEmulation?: boolean;
}

export interface WebSocketMessage {
  type: 'notification' | 'system' | 'heartbeat';
  data: any;
  timestamp: Date;
  messageId: string;
}

export class WebPubSubService {
  private client: WebPubSubServiceClient | null = null;
  private readonly hubName: string;
  private readonly logger: Logger;
  private readonly isEmulator: boolean;
  private connectionString: string;

  constructor(config: WebPubSubConfig = {}) {
    this.hubName = config.hubName || 'appraisal-notifications';
    this.connectionString = config.connectionString || process.env.AZURE_WEB_PUBSUB_CONNECTION_STRING || 'local-emulator';
    this.isEmulator = this.connectionString === 'local-emulator' || config.enableLocalEmulation === true;
    this.logger = new Logger('WebPubSubService');

    if (this.isEmulator) {
      this.logger.info('Using local emulator mode for Web PubSub');
    } else {
      this.client = new WebPubSubServiceClient(this.connectionString, this.hubName);
      this.logger.info(`Initialized Web PubSub client for hub: ${this.hubName}`);
    }
  }

  /**
   * Send notification to all connected clients
   */
  async broadcastNotification(notification: NotificationMessage): Promise<void> {
    const message: WebSocketMessage = {
      type: 'notification',
      data: {
        id: notification.id,
        title: notification.title,
        message: notification.message,
        priority: notification.priority,
        category: notification.category,
        timestamp: new Date(),
        metadata: notification.data
      },
      timestamp: new Date(),
      messageId: `ws-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    };

    if (this.isEmulator) {
      this.simulateBroadcast(message);
    } else {
      await this.sendToAllClients(message);
    }
  }

  /**
   * Send notification to specific user
   */
  async sendToUser(userId: string, notification: NotificationMessage): Promise<void> {
    const message: WebSocketMessage = {
      type: 'notification',
      data: {
        id: notification.id,
        title: notification.title,
        message: notification.message,
        priority: notification.priority,
        category: notification.category,
        timestamp: new Date(),
        metadata: notification.data,
        userId
      },
      timestamp: new Date(),
      messageId: `ws-user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    };

    if (this.isEmulator) {
      this.simulateUserMessage(userId, message);
    } else {
      await this.sendToSpecificUser(userId, message);
    }
  }

  /**
   * Send notification to users in a specific group (e.g., role-based)
   */
  async sendToGroup(groupName: string, notification: NotificationMessage): Promise<void> {
    const message: WebSocketMessage = {
      type: 'notification',
      data: {
        id: notification.id,
        title: notification.title,
        message: notification.message,
        priority: notification.priority,
        category: notification.category,
        timestamp: new Date(),
        metadata: notification.data,
        group: groupName
      },
      timestamp: new Date(),
      messageId: `ws-group-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    };

    if (this.isEmulator) {
      this.simulateGroupMessage(groupName, message);
    } else {
      await this.sendToSpecificGroup(groupName, message);
    }
  }

  /**
   * Send system message (non-notification)
   */
  async sendSystemMessage(message: any, target?: string): Promise<void> {
    const wsMessage: WebSocketMessage = {
      type: 'system',
      data: message,
      timestamp: new Date(),
      messageId: `ws-system-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    };

    if (this.isEmulator) {
      this.simulateSystemMessage(wsMessage, target);
    } else {
      if (target) {
        await this.sendToSpecificUser(target, wsMessage);
      } else {
        await this.sendToAllClients(wsMessage);
      }
    }
  }

  /**
   * Generate connection URL for client
   */
  async generateClientAccessUrl(userId?: string, roles?: string[]): Promise<string> {
    if (this.isEmulator) {
      const mockUrl = `ws://localhost:8080/client/hubs/${this.hubName}`;
      this.logger.info(`Generated mock client access URL: ${mockUrl}`, { userId, roles });
      return mockUrl;
    }

    if (!this.client) {
      throw new Error('Web PubSub client not initialized');
    }

    try {
      const options: any = {};
      if (userId) options.userId = userId;
      if (roles) options.roles = roles;
      
      const token = await this.client.getClientAccessToken(options);

      this.logger.info('Generated client access token', { userId, roles });
      return token.url;
    } catch (error) {
      this.logger.error('Failed to generate client access URL', { error, userId, roles });
      throw error;
    }
  }

  /**
   * Add user to group
   */
  async addUserToGroup(groupName: string, userId: string): Promise<void> {
    if (this.isEmulator) {
      this.logger.info(`Mock: Added user ${userId} to group ${groupName}`);
      return;
    }

    if (!this.client) {
      throw new Error('Web PubSub client not initialized');
    }

    try {
      await this.client.group(groupName).addUser(userId);
      this.logger.info(`Added user to group`, { groupName, userId });
    } catch (error) {
      this.logger.error('Failed to add user to group', { error, groupName, userId });
      throw error;
    }
  }

  /**
   * Remove user from group
   */
  async removeUserFromGroup(groupName: string, userId: string): Promise<void> {
    if (this.isEmulator) {
      this.logger.info(`Mock: Removed user ${userId} from group ${groupName}`);
      return;
    }

    if (!this.client) {
      throw new Error('Web PubSub client not initialized');
    }

    try {
      await this.client.group(groupName).removeUser(userId);
      this.logger.info(`Removed user from group`, { groupName, userId });
    } catch (error) {
      this.logger.error('Failed to remove user from group', { error, groupName, userId });
      throw error;
    }
  }

  /**
   * Get hub statistics
   */
  async getHubStats(): Promise<any> {
    if (this.isEmulator) {
      return {
        connectionCount: 5,
        userCount: 3,
        groupCount: 2,
        lastActivity: new Date(),
        isEmulator: true
      };
    }

    // Note: Azure Web PubSub doesn't have a direct stats API
    // In production, you'd track this through Azure Monitor/Application Insights
    return {
      hubName: this.hubName,
      status: 'active',
      lastChecked: new Date()
    };
  }

  // Private methods for actual Azure Web PubSub operations
  private async sendToAllClients(message: WebSocketMessage): Promise<void> {
    if (!this.client) {
      throw new Error('Web PubSub client not initialized');
    }

    try {
      await this.client.sendToAll(message);
      this.logger.info('Sent message to all clients', { 
        messageId: message.messageId, 
        type: message.type 
      });
    } catch (error) {
      this.logger.error('Failed to send message to all clients', { error, messageId: message.messageId });
      throw error;
    }
  }

  private async sendToSpecificUser(userId: string, message: WebSocketMessage): Promise<void> {
    if (!this.client) {
      throw new Error('Web PubSub client not initialized');
    }

    try {
      await this.client.sendToUser(userId, message);
      this.logger.info('Sent message to user', { 
        userId, 
        messageId: message.messageId, 
        type: message.type 
      });
    } catch (error) {
      this.logger.error('Failed to send message to user', { error, userId, messageId: message.messageId });
      throw error;
    }
  }

  private async sendToSpecificGroup(groupName: string, message: WebSocketMessage): Promise<void> {
    if (!this.client) {
      throw new Error('Web PubSub client not initialized');
    }

    try {
      await this.client.group(groupName).sendToAll(message);
      this.logger.info('Sent message to group', { 
        groupName, 
        messageId: message.messageId, 
        type: message.type 
      });
    } catch (error) {
      this.logger.error('Failed to send message to group', { error, groupName, messageId: message.messageId });
      throw error;
    }
  }

  // Private methods for local emulation
  private simulateBroadcast(message: WebSocketMessage): void {
    this.logger.info('🌐 BROADCAST WebSocket Message', {
      type: message.type,
      messageId: message.messageId,
      title: message.data?.title,
      priority: message.data?.priority,
      recipients: 'ALL_CLIENTS'
    });
  }

  private simulateUserMessage(userId: string, message: WebSocketMessage): void {
    this.logger.info('👤 USER WebSocket Message', {
      type: message.type,
      messageId: message.messageId,
      userId,
      title: message.data?.title,
      priority: message.data?.priority
    });
  }

  private simulateGroupMessage(groupName: string, message: WebSocketMessage): void {
    this.logger.info('👥 GROUP WebSocket Message', {
      type: message.type,
      messageId: message.messageId,
      group: groupName,
      title: message.data?.title,
      priority: message.data?.priority
    });
  }

  private simulateSystemMessage(message: WebSocketMessage, target?: string): void {
    this.logger.info('⚙️  SYSTEM WebSocket Message', {
      type: message.type,
      messageId: message.messageId,
      target: target || 'ALL_CLIENTS',
      data: message.data
    });
  }
}

// Helper class for managing WebSocket connections and user groups
export class WebSocketConnectionManager {
  private webPubSub: WebPubSubService;
  private userGroups: Map<string, Set<string>> = new Map(); // userId -> Set of groups
  private logger: Logger;

  constructor(webPubSubService: WebPubSubService) {
    this.webPubSub = webPubSubService;
    this.logger = new Logger('WebSocketConnectionManager');
  }

  /**
   * Handle user connection - assign to appropriate groups based on role
   */
  async handleUserConnection(userId: string, userRole: string): Promise<string> {
    const groups = this.determineUserGroups(userRole);
    
    // Add user to appropriate groups
    for (const group of groups) {
      await this.webPubSub.addUserToGroup(group, userId);
      this.addUserToGroupTracking(userId, group);
    }

    // Generate and return connection URL
    const accessUrl = await this.webPubSub.generateClientAccessUrl(userId, [userRole]);
    
    this.logger.info('User connected', { userId, userRole, groups });
    return accessUrl;
  }

  /**
   * Handle user disconnection
   */
  async handleUserDisconnection(userId: string): Promise<void> {
    const userGroupSet = this.userGroups.get(userId);
    if (userGroupSet) {
      // Remove user from all groups
      for (const group of userGroupSet) {
        await this.webPubSub.removeUserFromGroup(group, userId);
      }
      this.userGroups.delete(userId);
    }
    
    this.logger.info('User disconnected', { userId });
  }

  /**
   * Send role-based notification
   */
  async sendRoleBasedNotification(role: string, notification: NotificationMessage): Promise<void> {
    const groupName = `role-${role}`;
    await this.webPubSub.sendToGroup(groupName, notification);
  }

  private determineUserGroups(userRole: string): string[] {
    const groups = [`role-${userRole}`, 'all-users'];
    
    // Add additional groups based on role
    switch (userRole) {
      case 'admin':
        groups.push('administrators', 'system-alerts');
        break;
      case 'manager':
        groups.push('management', 'order-updates');
        break;
      case 'appraiser':
        groups.push('appraisers', 'assignment-notifications');
        break;
      case 'qc-reviewer':
        groups.push('qc-team', 'qc-alerts');
        break;
      default:
        groups.push('general-users');
    }
    
    return groups;
  }

  private addUserToGroupTracking(userId: string, group: string): void {
    if (!this.userGroups.has(userId)) {
      this.userGroups.set(userId, new Set());
    }
    this.userGroups.get(userId)!.add(group);
  }

  /**
   * Get connection statistics
   */
  getConnectionStats(): { totalUsers: number; groupMemberships: number } {
    return {
      totalUsers: this.userGroups.size,
      groupMemberships: Array.from(this.userGroups.values())
        .reduce((total, groups) => total + groups.size, 0)
    };
  }
}