/**
 * Email Service
 * Handles sending emails using Azure Communication Services Email
 */

import { EmailClient, KnownEmailSendStatus } from '@azure/communication-email';
import { AzureKeyCredential } from '@azure/core-auth';
import { Logger } from '../utils/logger';

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
}

export class EmailService {
  private logger: Logger;
  private emailClient: EmailClient | null = null;
  private defaultFrom: string;
  private configured: boolean = false;

  constructor() {
    this.logger = new Logger();
    this.defaultFrom = process.env.AZURE_COMMUNICATION_EMAIL_DOMAIN || 'donotreply@loneanalytics.com';
    this.initialize();
  }

  /**
   * Initialize Azure Communication Services Email client
   */
  private initialize(): void {
    try {
      const endpoint = process.env.AZURE_COMMUNICATION_ENDPOINT;
      const apiKey = process.env.AZURE_COMMUNICATION_API_KEY;

      if (!endpoint || !apiKey) {
        this.logger.warn('ACS Email service not configured', {
          note: 'Set AZURE_COMMUNICATION_ENDPOINT and AZURE_COMMUNICATION_API_KEY',
          endpoint: endpoint ? 'configured' : 'missing',
          apiKey: apiKey ? 'configured' : 'missing'
        });
        return;
      }

      this.emailClient = new EmailClient(endpoint, new AzureKeyCredential(apiKey));
      this.configured = true;
      this.logger.info('ACS Email service initialized', { endpoint });

    } catch (error: any) {
      this.logger.error('Failed to initialize ACS Email client', { error: error.message });
    }
  }

  /**
   * Send an email using Azure Communication Services
   */
  async sendEmail(options: EmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.emailClient) {
      const error = 'ACS Email service not configured';
      this.logger.error(error);
      return {
        success: false,
        error
      };
    }

    try {
      const from = options.from || this.defaultFrom;
      
      if (!from) {
        throw new Error('No sender email address configured');
      }

      // Normalize recipients to array
      const recipients = Array.isArray(options.to) ? options.to : [options.to];

      // Prepare content
      const plainText = options.text || options.html?.replace(/<[^>]*>/g, '') || '';
      const html = options.html || options.text || '';

      this.logger.info('Sending email via ACS', {
        to: recipients,
        subject: options.subject,
        from
      });

      // Send email via ACS
      const poller = await this.emailClient.beginSend({
        senderAddress: from,
        content: {
          subject: options.subject,
          plainText: plainText,
          html: html
        },
        recipients: {
          to: recipients.map(email => ({ address: email }))
        }
      });

      // Wait for completion
      const result = await poller.pollUntilDone();

      this.logger.info('Email sent successfully via ACS', {
        messageId: result.id,
        status: result.status,
        to: recipients
      });

      return {
        success: result.status === KnownEmailSendStatus.Succeeded,
        messageId: result.id
      };

    } catch (error: any) {
      this.logger.error('Failed to send email via ACS', {
        error: error.message,
        code: error.code,
        to: options.to
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Check if email service is configured and ready
   */
  isConfigured(): boolean {
    return this.configured;
  }
}
