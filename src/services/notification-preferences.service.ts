/**
 * Notification Preferences Service
 */

import { Logger } from '../utils/logger.js';
import { CosmosDbService } from './cosmos-db.service';
import { ApiResponse } from '../types/index.js';
import { NotificationPreferences } from '../types/communication.types.js';

export class NotificationPreferencesService {
  private logger: Logger;
  private dbService: CosmosDbService;

  constructor() {
    this.logger = new Logger();
    this.dbService = new CosmosDbService();
  }

  /**
   * Get user notification preferences
   */
  async getPreferences(userId: string, tenantId: string): Promise<ApiResponse<NotificationPreferences>> {
    try {
      const response = await this.dbService.queryItems(
        'notificationPreferences',
        'SELECT * FROM c WHERE c.userId = @userId AND c.tenantId = @tenantId',
        [
          { name: '@userId', value: userId },
          { name: '@tenantId', value: tenantId }
        ]
      ) as ApiResponse<NotificationPreferences[]>;

      if (response.data && response.data.length > 0) {
        const prefs = response.data[0];
        if (prefs) {
          return { success: true, data: prefs };
        }
      }

      // Return default preferences if none exist
      const defaultPrefs = this.getDefaultPreferences(userId, tenantId);
      return { success: true, data: defaultPrefs };
    } catch (error) {
      this.logger.error('Error getting preferences', { error, userId });
      throw error;
    }
  }

  /**
   * Update user notification preferences
   */
  async updatePreferences(userId: string, preferences: Partial<NotificationPreferences>, tenantId: string): Promise<ApiResponse<NotificationPreferences>> {
    try {
      const existing = await this.getPreferences(userId, tenantId);
      
      const defaults = this.getDefaultPreferences(userId, tenantId);
      const updated: NotificationPreferences = {
        ...defaults,
        ...existing.data,
        ...preferences,
        id: existing.data?.id || `pref-${userId}-${Date.now()}`,
        userId,
        tenantId,
        updatedAt: new Date(),
        createdAt: existing.data?.createdAt || new Date()
      };

      await this.dbService.upsertItem('notificationPreferences', updated);
      this.logger.info('Preferences updated', { userId });
      
      return { success: true, data: updated };
    } catch (error) {
      this.logger.error('Error updating preferences', { error, userId });
      throw error;
    }
  }

  /**
   * Check if user is in quiet hours
   */
  async isInQuietHours(userId: string, tenantId: string): Promise<boolean> {
    try {
      const prefs = await this.getPreferences(userId, tenantId);
      if (!prefs.data || !prefs.data.quietHours?.enabled) {
        return false;
      }

      const now = new Date();
      const userTime = new Date(now.toLocaleString('en-US', { timeZone: prefs.data.quietHours.timezone }));
      const hours = userTime.getHours();
      const minutes = userTime.getMinutes();
      const currentMinutes = hours * 60 + minutes;

      const [startHour = 0, startMin = 0] = prefs.data.quietHours.startTime.split(':').map(Number);
      const [endHour = 0, endMin = 0] = prefs.data.quietHours.endTime.split(':').map(Number);
      const startMinutes = startHour * 60 + startMin;
      const endMinutes = endHour * 60 + endMin;

      if (startMinutes < endMinutes) {
        return currentMinutes >= startMinutes && currentMinutes < endMinutes;
      } else {
        return currentMinutes >= startMinutes || currentMinutes < endMinutes;
      }
    } catch (error) {
      this.logger.error('Error checking quiet hours', { error, userId });
      return false;
    }
  }

  /**
   * Check if notification should be sent based on preferences
   */
  async shouldSendNotification(
    userId: string,
    tenantId: string,
    type: 'email' | 'sms' | 'push' | 'inApp',
    category: string,
    urgency?: 'low' | 'medium' | 'high' | 'critical'
  ): Promise<boolean> {
    try {
      const prefs = await this.getPreferences(userId, tenantId);

      // Check if channel is enabled
      const channelEnabled = prefs.data?.[type]?.enabled ?? true;
      if (!channelEnabled) {
        return false;
      }

      // Check if category is enabled (skip detailed check for now - would need per-type category validation)
      // TODO: Implement proper category checking based on type

      // Critical urgency bypasses quiet hours
      if (urgency === 'critical') {
        return true;
      }

      // Check quiet hours for non-critical notifications
      const inQuietHours = await this.isInQuietHours(userId, tenantId);
      if (inQuietHours) {
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error('Error checking notification rules', { error, userId });
      return true; // Fail open - send notification on error
    }
  }

  /**
   * Get default preferences for new users
   */
  private getDefaultPreferences(userId: string, tenantId: string): NotificationPreferences {
    return {
      id: `pref-${userId}-${Date.now()}`,
      userId,
      tenantId,
      email: {
        enabled: true,
        address: '',
        verified: false,
        frequency: 'immediate',
        categories: {
          orderUpdates: true,
          milestones: true,
          revisions: true,
          messages: true,
          systemAlerts: true
        }
      },
      sms: {
        enabled: false,
        phoneNumber: '',
        verified: false,
        urgentOnly: true,
        categories: {
          assignments: true,
          urgentRevisions: true,
          deadlineReminders: true,
          milestoneAlerts: true
        }
      },
      push: {
        enabled: true,
        categories: {
          all: false,
          messages: true,
          updates: true,
          urgent: true
        }
      },
      inApp: {
        enabled: true,
        playSound: true,
        showBadge: true
      },
      quietHours: {
        enabled: false,
        startTime: '22:00',
        endTime: '08:00',
        timezone: 'America/New_York',
        allowUrgent: true
      },
      language: 'en',
      timezone: 'America/New_York',
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }
}
