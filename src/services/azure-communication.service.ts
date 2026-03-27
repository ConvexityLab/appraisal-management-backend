/**
 * Azure Communication Services Wrapper
 * Manages connections to ACS Email, SMS, and Chat services using Managed Identity
 */

import { EmailClient } from '@azure/communication-email';
import { SmsClient } from '@azure/communication-sms';
import { ChatClient } from '@azure/communication-chat';
import { DefaultAzureCredential } from '@azure/identity';
import { AzureKeyCredential } from '@azure/core-auth';
import { Logger } from '../utils/logger.js';

// Define CommunicationTokenCredential interface
interface CommunicationTokenCredential {
  getToken(): Promise<{ token: string; expiresOnTimestamp: number }>;
  dispose(): void;
}

export class AzureCommunicationService {
  private logger: Logger;
  private emailClient?: EmailClient;
  private smsClient?: SmsClient;
  private chatClient?: ChatClient;
  
  private readonly endpoint: string;
  private readonly emailDomain: string;
  private readonly smsNumber: string;
  // API key credential used in local dev; undefined in production where Managed Identity is preferred.
  private readonly keyCredential?: AzureKeyCredential;
  private readonly managedIdentityCredential: DefaultAzureCredential;

  constructor() {
    this.logger = new Logger();
    
    // Get configuration from environment
    this.endpoint = process.env.AZURE_COMMUNICATION_ENDPOINT || '';
    this.emailDomain = process.env.AZURE_COMMUNICATION_EMAIL_DOMAIN || '';
    this.smsNumber = process.env.AZURE_COMMUNICATION_SMS_NUMBER || '';
    
    // Prefer API key in local dev (same pattern as AcsIdentityService).
    // In Azure, AZURE_COMMUNICATION_API_KEY is absent and Managed Identity is used.
    const apiKey = process.env.AZURE_COMMUNICATION_API_KEY;
    if (apiKey) {
      this.keyCredential = new AzureKeyCredential(apiKey);
      this.logger.info('AzureCommunicationService: using API key credential');
    }
    this.managedIdentityCredential = new DefaultAzureCredential();
    
    // Validate configuration
    if (!this.endpoint) {
      this.logger.warn('Azure Communication Services endpoint not configured');
    }
  }

  /**
   * Get or create Email client
   */
  getEmailClient(): EmailClient {
    if (!this.emailClient) {
      if (!this.endpoint) {
        throw new Error('Azure Communication Services endpoint not configured. Set AZURE_COMMUNICATION_ENDPOINT.');
      }
      
      this.logger.info('Initializing Azure Communication Services Email client');
      // Branch on credential type — ACS SDK overloads require a concrete type, not a union.
      this.emailClient = this.keyCredential
        ? new EmailClient(this.endpoint, this.keyCredential)
        : new EmailClient(this.endpoint, this.managedIdentityCredential);
    }
    
    return this.emailClient;
  }

  /**
   * Get or create SMS client
   */
  getSmsClient(): SmsClient {
    if (!this.smsClient) {
      if (!this.endpoint) {
        throw new Error('Azure Communication Services endpoint not configured. Set AZURE_COMMUNICATION_ENDPOINT.');
      }
      
      this.logger.info('Initializing Azure Communication Services SMS client');
      // Branch on credential type — ACS SDK overloads require a concrete type, not a union.
      this.smsClient = this.keyCredential
        ? new SmsClient(this.endpoint, this.keyCredential)
        : new SmsClient(this.endpoint, this.managedIdentityCredential);
    }
    
    return this.smsClient;
  }

  /**
   * Get or create Chat client (DEPRECATED - use getChatClientForUser instead)
   * Chat requires user-level token credentials
   */
  getChatClient(): ChatClient {
    // Chat requires CommunicationTokenCredential, not supported with Managed Identity
    throw new Error('Use getChatClientForUser() instead - chat requires user tokens');
  }

  /**
   * Create Chat client for specific user with token
   * This is the proper way to use ACS Chat SDK
   * 
   * @param acsUserId - ACS user ID (e.g., "8:acs:...")
   * @param token - ACS access token for the user
   * @param expiresOn - Token expiration date
   * @returns ChatClient instance configured for the user
   */
  getChatClientForUser(acsUserId: string, token: string, expiresOn: Date): ChatClient {
    if (!this.endpoint) {
      throw new Error('Azure Communication Services endpoint not configured. Set AZURE_COMMUNICATION_ENDPOINT.');
    }

    this.logger.info('Creating Chat client for user', { acsUserId });

    // Create token credential from user token
    const tokenCredential: CommunicationTokenCredential = {
      getToken: async () => ({
        token,
        expiresOnTimestamp: expiresOn.getTime()
      }),
      dispose: () => {
        // Cleanup if needed
      }
    };

    return new ChatClient(this.endpoint, tokenCredential);
  }

  /**
   * Get configured email sender address
   */
  getEmailSenderAddress(): string {
    if (!this.emailDomain) {
      throw new Error('Email sender address not configured. Set AZURE_COMMUNICATION_EMAIL_DOMAIN to a verified address (e.g. DoNotReply@yourdomain.com).');
    }
    return this.emailDomain;
  }

  /**
   * Get configured SMS sender number
   */
  getSmsSenderNumber(): string {
    if (!this.smsNumber) {
      throw new Error('SMS sender number not configured. Set AZURE_COMMUNICATION_SMS_NUMBER.');
    }
    return this.smsNumber;
  }

  /**
   * Check if Email service is configured
   */
  isEmailConfigured(): boolean {
    return !!this.endpoint && !!this.emailDomain;
  }

  /**
   * Check if SMS service is configured
   */
  isSmsConfigured(): boolean {
    return !!this.endpoint && !!this.smsNumber;
  }

  /**
   * Check if Chat service is configured
   */
  isChatConfigured(): boolean {
    return !!this.endpoint;
  }

  /**
   * Health check for all ACS services
   */
  async healthCheck(): Promise<{
    email: boolean;
    sms: boolean;
    chat: boolean;
  }> {
    return {
      email: this.isEmailConfigured(),
      sms: this.isSmsConfigured(),
      chat: this.isChatConfigured()
    };
  }
}
