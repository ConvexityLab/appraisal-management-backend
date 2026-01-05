/**
 * SMS Notification Service - Azure Communication Services
 */

import { Logger } from '../utils/logger.js';
import { CosmosDbService } from './cosmos-db.service';
import { AzureCommunicationService } from './azure-communication.service';
import { ApiResponse } from '../types/index.js';
import { SmsMessage, SmsSendResult, SmsTemplate, NotificationHistory } from '../types/communication.types.js';

export class SmsNotificationService {
  private logger: Logger;
  private dbService: CosmosDbService;
  private acsService: AzureCommunicationService;

  constructor() {
    this.logger = new Logger();
    this.dbService = new CosmosDbService();
    this.acsService = new AzureCommunicationService();
  }

  async sendSms(to: string | string[], message: string, tenantId: string): Promise<ApiResponse<SmsSendResult[]>> {
    try {
      if (!this.acsService.isSmsConfigured()) {
        return { success: false, data: [], error: { code: 'SMS_NOT_CONFIGURED', message: 'SMS not configured', timestamp: new Date() } };
      }

      const smsClient = this.acsService.getSmsClient();
      const from = this.acsService.getSmsSenderNumber();
      const toArray = Array.isArray(to) ? to : [to];

      const results: SmsSendResult[] = [];
      
      for (const recipient of toArray) {
        const response = await smsClient.send({
          from,
          to: [recipient],
          message
        });

        const result: SmsSendResult = {
          messageId: response[0]?.messageId || '',
          to: recipient,
          httpStatusCode: response[0]?.httpStatusCode || 0,
          successful: response[0]?.successful || false,
          ...(response[0]?.errorMessage && { errorMessage: response[0].errorMessage })
        };

        results.push(result);
        await this.logSmsToHistory(recipient, message, result, tenantId);
      }

      return { success: true, data: results };
    } catch (error) {
      this.logger.error('Error sending SMS', { error });
      throw error;
    }
  }

  private async logSmsToHistory(recipient: string, message: string, result: SmsSendResult, tenantId: string): Promise<void> {
    try {
      const history: NotificationHistory = {
        id: `notif-${Date.now()}`,
        tenantId,
        userId: recipient,
        type: 'sms',
        category: 'sms',
        content: message,
        status: result.successful ? 'sent' : 'failed',
        ...(result.successful && { sentAt: new Date() }),
        ...(!result.successful && { failedAt: new Date() }),
        metadata: { 
          messageId: result.messageId, 
          provider: 'azure_communication_services',
          ...(result.errorMessage && { error: result.errorMessage })
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };
      await this.dbService.createItem('notificationHistory', history);
    } catch (error) {
      this.logger.error('Error logging SMS', { error });
    }
  }
}
