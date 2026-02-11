/**
 * Service Health Check - Diagnostics for Communication & AI Services
 * 
 * Provides comprehensive health checks and configuration diagnostics
 * for all communication channels and AI providers.
 */

import { Logger } from '../utils/logger.js';
import { AzureCommunicationService } from './azure-communication.service.js';
import { AcsIdentityService } from './acs-identity.service.js';
import { TeamsService } from './teams.service.js';
import { UniversalAIService } from './universal-ai.service.js';

interface ServiceHealthStatus {
  name: string;
  status: 'healthy' | 'degraded' | 'unavailable';
  configured: boolean;
  details: string;
  requiredEnvVars: string[];
  missingEnvVars: string[];
  capabilities?: string[];
  error?: string;
}

interface SystemHealthReport {
  timestamp: Date;
  overallStatus: 'healthy' | 'degraded' | 'critical';
  services: {
    communication: {
      acs: ServiceHealthStatus;
      acsIdentity: ServiceHealthStatus;
      teams: ServiceHealthStatus;
      email: ServiceHealthStatus;
      sms: ServiceHealthStatus;
      chat: ServiceHealthStatus;
    };
    ai: {
      azureOpenAI: ServiceHealthStatus;
      googleGemini: ServiceHealthStatus;
      sambaNova: ServiceHealthStatus;
      certo: ServiceHealthStatus;
      universalAI: ServiceHealthStatus;
    };
  };
  summary: {
    totalServices: number;
    healthyServices: number;
    degradedServices: number;
    unavailableServices: number;
    criticalIssues: string[];
    warnings: string[];
    recommendations: string[];
  };
}

export class ServiceHealthCheckService {
  private logger: Logger;

  constructor() {
    this.logger = new Logger();
  }

  /**
   * Perform comprehensive health check on all services
   */
  async performHealthCheck(): Promise<SystemHealthReport> {
    this.logger.info('Starting comprehensive service health check...');

    const communicationHealth = await this.checkCommunicationServices();
    const aiHealth = await this.checkAIServices();

    // Calculate overall status
    const allStatuses = [
      ...Object.values(communicationHealth),
      ...Object.values(aiHealth)
    ];

    const healthyCount = allStatuses.filter(s => s.status === 'healthy').length;
    const degradedCount = allStatuses.filter(s => s.status === 'degraded').length;
    const unavailableCount = allStatuses.filter(s => s.status === 'unavailable').length;

    const criticalIssues: string[] = [];
    const warnings: string[] = [];
    const recommendations: string[] = [];

    // Analyze critical issues
    if (communicationHealth.acs.status === 'unavailable') {
      criticalIssues.push('Azure Communication Services not configured - email, SMS, and chat unavailable');
      recommendations.push('Set AZURE_COMMUNICATION_ENDPOINT environment variable');
    }

    if (communicationHealth.teams.status === 'unavailable') {
      warnings.push('Microsoft Teams integration not configured');
      recommendations.push('Set AZURE_TENANT_ID to enable Teams meetings');
    }

    // Check if any AI provider is available
    const aiProviderCount = [
      aiHealth.azureOpenAI,
      aiHealth.googleGemini,
      aiHealth.sambaNova,
      aiHealth.certo
    ].filter(p => p.status !== 'unavailable').length;

    if (aiProviderCount === 0) {
      criticalIssues.push('No AI providers configured - AI features unavailable');
      recommendations.push('Configure at least one AI provider (Azure OpenAI recommended)');
    } else if (aiProviderCount === 1) {
      warnings.push('Only one AI provider configured - no fallback available');
      recommendations.push('Configure a backup AI provider for redundancy');
    }

    // Determine overall status
    let overallStatus: 'healthy' | 'degraded' | 'critical';
    if (criticalIssues.length > 0) {
      overallStatus = 'critical';
    } else if (degradedCount > 0 || warnings.length > 0) {
      overallStatus = 'degraded';
    } else {
      overallStatus = 'healthy';
    }

    const report: SystemHealthReport = {
      timestamp: new Date(),
      overallStatus,
      services: {
        communication: communicationHealth,
        ai: aiHealth
      },
      summary: {
        totalServices: allStatuses.length,
        healthyServices: healthyCount,
        degradedServices: degradedCount,
        unavailableServices: unavailableCount,
        criticalIssues,
        warnings,
        recommendations
      }
    };

    this.logger.info('Health check complete', {
      overallStatus,
      healthy: healthyCount,
      degraded: degradedCount,
      unavailable: unavailableCount
    });

    return report;
  }

  /**
   * Check communication services
   */
  private async checkCommunicationServices() {
    const acsStatus = this.checkAzureCommunicationService();
    const acsIdentityStatus = this.checkAcsIdentityService();
    const teamsStatus = this.checkTeamsService();

    return {
      acs: acsStatus,
      acsIdentity: acsIdentityStatus,
      teams: teamsStatus,
      email: this.deriveEmailStatus(acsStatus),
      sms: this.deriveSmsStatus(acsStatus),
      chat: this.deriveChatStatus(acsStatus, acsIdentityStatus)
    };
  }

  /**
   * Check AI services
   */
  private async checkAIServices() {
    const azureOpenAIStatus = this.checkAzureOpenAI();
    const geminiStatus = this.checkGoogleGemini();
    const sambaNovaStatus = this.checkSambaNova();
    const certoStatus = this.checkCerto();

    // Check Universal AI service
    let universalAIStatus: ServiceHealthStatus;
    try {
      const aiService = new UniversalAIService();
      const health = await aiService.healthCheck();
      
      const enabledProviders = Object.entries(health)
        .filter(([_, v]: [string, any]) => v.enabled && v.available)
        .map(([k]: [string, any]) => k);

      universalAIStatus = {
        name: 'Universal AI Service',
        status: enabledProviders.length > 0 ? 'healthy' : 'unavailable',
        configured: enabledProviders.length > 0,
        details: `${enabledProviders.length} provider(s) available: ${enabledProviders.join(', ')}`,
        requiredEnvVars: [],
        missingEnvVars: [],
        capabilities: ['text-generation', 'vision', 'embeddings', 'qc-analysis']
      };
    } catch (error) {
      universalAIStatus = {
        name: 'Universal AI Service',
        status: 'unavailable',
        configured: false,
        details: 'Service initialization failed',
        requiredEnvVars: [],
        missingEnvVars: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }

    return {
      azureOpenAI: azureOpenAIStatus,
      googleGemini: geminiStatus,
      sambaNova: sambaNovaStatus,
      certo: certoStatus,
      universalAI: universalAIStatus
    };
  }

  /**
   * Check Azure Communication Service
   */
  private checkAzureCommunicationService(): ServiceHealthStatus {
    const requiredVars = ['AZURE_COMMUNICATION_ENDPOINT'];
    const missingVars = requiredVars.filter(v => !process.env[v]);

    try {
      const acsService = new AzureCommunicationService();
      const isConfigured = acsService.isEmailConfigured() || 
                          acsService.isSmsConfigured() || 
                          acsService.isChatConfigured();

      return {
        name: 'Azure Communication Services',
        status: isConfigured ? 'healthy' : 'unavailable',
        configured: isConfigured,
        details: isConfigured 
          ? 'ACS endpoint configured, services available'
          : 'ACS endpoint not configured',
        requiredEnvVars: requiredVars,
        missingEnvVars: missingVars,
        capabilities: isConfigured ? ['email', 'sms', 'chat'] : []
      };
    } catch (error) {
      return {
        name: 'Azure Communication Services',
        status: 'unavailable',
        configured: false,
        details: 'Service initialization failed',
        requiredEnvVars: requiredVars,
        missingEnvVars: missingVars,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Check ACS Identity Service
   */
  private checkAcsIdentityService(): ServiceHealthStatus {
    const requiredVars = ['AZURE_COMMUNICATION_ENDPOINT'];
    const missingVars = requiredVars.filter(v => !process.env[v]);

    try {
      const identityService = new AcsIdentityService();
      const isConfigured = identityService.isConfigured();

      return {
        name: 'ACS Identity Service',
        status: isConfigured ? 'healthy' : 'unavailable',
        configured: isConfigured,
        details: isConfigured 
          ? 'Identity service configured, token exchange available'
          : 'ACS endpoint not configured',
        requiredEnvVars: requiredVars,
        missingEnvVars: missingVars,
        capabilities: isConfigured ? ['token-exchange', 'user-management'] : []
      };
    } catch (error) {
      return {
        name: 'ACS Identity Service',
        status: 'unavailable',
        configured: false,
        details: 'Service initialization failed',
        requiredEnvVars: requiredVars,
        missingEnvVars: missingVars,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Check Teams Service
   */
  private checkTeamsService(): ServiceHealthStatus {
    const requiredVars = ['AZURE_TENANT_ID'];
    const optionalVars = ['AZURE_CLIENT_ID'];
    const missingVars = requiredVars.filter(v => !process.env[v]);

    try {
      const teamsService = new TeamsService();
      const isConfigured = teamsService.isServiceConfigured();

      return {
        name: 'Microsoft Teams Service',
        status: isConfigured ? 'healthy' : 'unavailable',
        configured: isConfigured,
        details: isConfigured 
          ? 'Teams service configured, meeting creation available'
          : 'AZURE_TENANT_ID not set',
        requiredEnvVars: [...requiredVars, ...optionalVars],
        missingEnvVars: missingVars,
        capabilities: isConfigured ? ['meetings', 'chat-interop', 'teams-integration'] : []
      };
    } catch (error) {
      return {
        name: 'Microsoft Teams Service',
        status: 'unavailable',
        configured: false,
        details: 'Service initialization failed',
        requiredEnvVars: requiredVars,
        missingEnvVars: missingVars,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Check Azure OpenAI
   */
  private checkAzureOpenAI(): ServiceHealthStatus {
    const requiredVars = ['AZURE_OPENAI_ENDPOINT', 'AZURE_OPENAI_API_KEY'];
    const missingVars = requiredVars.filter(v => !process.env[v]);
    const isConfigured = missingVars.length === 0;

    return {
      name: 'Azure OpenAI',
      status: isConfigured ? 'healthy' : 'unavailable',
      configured: isConfigured,
      details: isConfigured 
        ? 'Azure OpenAI configured with GPT-4 and embedding models'
        : `Missing: ${missingVars.join(', ')}`,
      requiredEnvVars: requiredVars,
      missingEnvVars: missingVars,
      capabilities: isConfigured ? ['text-generation', 'embeddings', 'vision', 'function-calling'] : []
    };
  }

  /**
   * Check Google Gemini
   */
  private checkGoogleGemini(): ServiceHealthStatus {
    const requiredVars = ['GOOGLE_GEMINI_API_KEY'];
    const missingVars = requiredVars.filter(v => !process.env[v]);
    const isConfigured = missingVars.length === 0;

    return {
      name: 'Google Gemini',
      status: isConfigured ? 'healthy' : 'unavailable',
      configured: isConfigured,
      details: isConfigured 
        ? 'Google Gemini configured with vision and document processing'
        : `Missing: ${missingVars.join(', ')}`,
      requiredEnvVars: requiredVars,
      missingEnvVars: missingVars,
      capabilities: isConfigured ? ['text-generation', 'vision', 'multimodal', 'document-processing'] : []
    };
  }

  /**
   * Check SambaNova
   */
  private checkSambaNova(): ServiceHealthStatus {
    const requiredVars = ['SAMBANOVA_API_KEY', 'SAMBANOVA_ENDPOINT'];
    const missingVars = requiredVars.filter(v => !process.env[v]);
    const isConfigured = missingVars.length === 0;

    return {
      name: 'SambaNova',
      status: isConfigured ? 'healthy' : 'unavailable',
      configured: isConfigured,
      details: isConfigured 
        ? 'SambaNova configured with Llama models'
        : `Missing: ${missingVars.join(', ')}`,
      requiredEnvVars: requiredVars,
      missingEnvVars: missingVars,
      capabilities: isConfigured ? ['text-generation', 'vision', 'structured-output'] : []
    };
  }

  /**
   * Check Certo AI
   */
  private checkCerto(): ServiceHealthStatus {
    const requiredVars = ['CERTO_ENDPOINT', 'CERTO_API_KEY'];
    const missingVars = requiredVars.filter(v => !process.env[v]);
    const isConfigured = missingVars.length === 0;

    return {
      name: 'Certo AI (Custom vLLM)',
      status: isConfigured ? 'healthy' : 'unavailable',
      configured: isConfigured,
      details: isConfigured 
        ? 'Certo AI configured with custom models'
        : `Missing: ${missingVars.join(', ')}`,
      requiredEnvVars: requiredVars,
      missingEnvVars: missingVars,
      capabilities: isConfigured ? ['text-generation', 'vision', 'embeddings', 'structured-output'] : []
    };
  }

  /**
   * Derive email service status from ACS
   */
  private deriveEmailStatus(acsStatus: ServiceHealthStatus): ServiceHealthStatus {
    const emailDomain = process.env.AZURE_COMMUNICATION_EMAIL_DOMAIN;
    
    if (acsStatus.status === 'unavailable') {
      return {
        name: 'Email Service',
        status: 'unavailable',
        configured: false,
        details: 'ACS not configured',
        requiredEnvVars: ['AZURE_COMMUNICATION_ENDPOINT', 'AZURE_COMMUNICATION_EMAIL_DOMAIN'],
        missingEnvVars: acsStatus.missingEnvVars
      };
    }

    return {
      name: 'Email Service',
      status: emailDomain ? 'healthy' : 'degraded',
      configured: !!emailDomain,
      details: emailDomain 
        ? `Email configured with domain: ${emailDomain}`
        : 'ACS configured but email domain not set (using default)',
      requiredEnvVars: ['AZURE_COMMUNICATION_EMAIL_DOMAIN'],
      missingEnvVars: emailDomain ? [] : ['AZURE_COMMUNICATION_EMAIL_DOMAIN'],
      capabilities: ['email-notifications', 'templates']
    };
  }

  /**
   * Derive SMS service status from ACS
   */
  private deriveSmsStatus(acsStatus: ServiceHealthStatus): ServiceHealthStatus {
    const smsNumber = process.env.AZURE_COMMUNICATION_SMS_NUMBER;
    
    if (acsStatus.status === 'unavailable') {
      return {
        name: 'SMS Service',
        status: 'unavailable',
        configured: false,
        details: 'ACS not configured',
        requiredEnvVars: ['AZURE_COMMUNICATION_ENDPOINT', 'AZURE_COMMUNICATION_SMS_NUMBER'],
        missingEnvVars: acsStatus.missingEnvVars
      };
    }

    return {
      name: 'SMS Service',
      status: smsNumber ? 'healthy' : 'unavailable',
      configured: !!smsNumber,
      details: smsNumber 
        ? `SMS configured with number: ${smsNumber}`
        : 'ACS configured but SMS number not set',
      requiredEnvVars: ['AZURE_COMMUNICATION_SMS_NUMBER'],
      missingEnvVars: smsNumber ? [] : ['AZURE_COMMUNICATION_SMS_NUMBER'],
      capabilities: smsNumber ? ['sms-notifications'] : []
    };
  }

  /**
   * Derive chat service status from ACS and Identity
   */
  private deriveChatStatus(
    acsStatus: ServiceHealthStatus,
    identityStatus: ServiceHealthStatus
  ): ServiceHealthStatus {
    if (acsStatus.status === 'unavailable' || identityStatus.status === 'unavailable') {
      return {
        name: 'Chat Service',
        status: 'unavailable',
        configured: false,
        details: 'ACS or Identity service not configured',
        requiredEnvVars: ['AZURE_COMMUNICATION_ENDPOINT'],
        missingEnvVars: acsStatus.missingEnvVars,
        capabilities: []
      };
    }

    return {
      name: 'Chat Service',
      status: 'healthy',
      configured: true,
      details: 'Chat service ready for real-time messaging',
      requiredEnvVars: ['AZURE_COMMUNICATION_ENDPOINT'],
      missingEnvVars: [],
      capabilities: ['real-time-chat', 'websocket-notifications', 'thread-management']
    };
  }

  /**
   * Print health check report to console
   */
  printHealthReport(report: SystemHealthReport): void {
    console.log('\n='.repeat(80));
    console.log('SERVICE HEALTH CHECK REPORT');
    console.log('='.repeat(80));
    console.log(`Timestamp: ${report.timestamp.toISOString()}`);
    console.log(`Overall Status: ${report.overallStatus.toUpperCase()}`);
    console.log(`\nSummary: ${report.summary.healthyServices}/${report.summary.totalServices} healthy, ` +
      `${report.summary.degradedServices} degraded, ${report.summary.unavailableServices} unavailable`);

    // Communication Services
    console.log('\n--- COMMUNICATION SERVICES ---');
    for (const [key, service] of Object.entries(report.services.communication)) {
      this.printServiceStatus(service);
    }

    // AI Services
    console.log('\n--- AI SERVICES ---');
    for (const [key, service] of Object.entries(report.services.ai)) {
      this.printServiceStatus(service);
    }

    // Critical Issues
    if (report.summary.criticalIssues.length > 0) {
      console.log('\n🔴 CRITICAL ISSUES:');
      report.summary.criticalIssues.forEach(issue => console.log(`   - ${issue}`));
    }

    // Warnings
    if (report.summary.warnings.length > 0) {
      console.log('\n⚠️  WARNINGS:');
      report.summary.warnings.forEach(warning => console.log(`   - ${warning}`));
    }

    // Recommendations
    if (report.summary.recommendations.length > 0) {
      console.log('\n💡 RECOMMENDATIONS:');
      report.summary.recommendations.forEach(rec => console.log(`   - ${rec}`));
    }

    console.log('\n' + '='.repeat(80) + '\n');
  }

  /**
   * Print individual service status
   */
  private printServiceStatus(service: ServiceHealthStatus): void {
    const icon = service.status === 'healthy' ? '✓' : 
                 service.status === 'degraded' ? '⚠' : '✗';
    
    console.log(`\n${icon} ${service.name}: ${service.status.toUpperCase()}`);
    console.log(`   ${service.details}`);
    
    if (service.missingEnvVars.length > 0) {
      console.log(`   Missing: ${service.missingEnvVars.join(', ')}`);
    }
    
    if (service.capabilities && service.capabilities.length > 0) {
      console.log(`   Capabilities: ${service.capabilities.join(', ')}`);
    }
    
    if (service.error) {
      console.log(`   Error: ${service.error}`);
    }
  }
}
