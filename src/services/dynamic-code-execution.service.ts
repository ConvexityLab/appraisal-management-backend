/**
 * Dynamic Code Execution Service
 * Provides secure execution of JavaScript/Node.js code for advanced conditional logic
 * Uses Node.js built-in vm module with safety restrictions
 */

import * as vm from 'vm';
import { Logger } from '../utils/logger';

export interface CodeExecutionContext {
  event: any;
  context: any;
  rule: any;
  timestamp: Date;
  // Additional utilities available in the sandbox
  utils: {
    date: typeof Date;
    math: typeof Math;
    json: typeof JSON;
    regex: typeof RegExp;
    console: Pick<Console, 'log' | 'warn' | 'error'>;
  };
}

export interface CodeExecutionOptions {
  timeout?: number;
  sandbox?: Record<string, any>;
  allowedModules?: string[];
  memoryLimit?: number;
}

export interface CodeExecutionResult {
  success: boolean;
  result?: any;
  error?: string;
  executionTime: number;
  memoryUsed?: number;
}

export class DynamicCodeExecutionService {
  private logger: Logger;
  private defaultOptions: Required<CodeExecutionOptions>;

  constructor(options: Partial<CodeExecutionOptions> = {}) {
    this.logger = new Logger('DynamicCodeExecutionService');
    
    this.defaultOptions = {
      timeout: 5000, // 5 seconds max execution time
      sandbox: {},
      allowedModules: ['lodash', 'moment', 'date-fns'], // Safe utility modules
      memoryLimit: 16 * 1024 * 1024 // 16MB memory limit
    };

    Object.assign(this.defaultOptions, options);
  }

  /**
   * Execute JavaScript code safely in a sandboxed environment
   */
  async executeCode(
    code: string, 
    executionContext: CodeExecutionContext,
    options: Partial<CodeExecutionOptions> = {}
  ): Promise<CodeExecutionResult> {
    const startTime = Date.now();
    const mergedOptions = { ...this.defaultOptions, ...options };

    try {
      this.logger.debug('Executing dynamic code', { 
        codeLength: code.length,
        timeout: mergedOptions.timeout 
      });

      // Create sandbox environment
      const sandbox = this.createSandbox(executionContext, mergedOptions);
      const context = vm.createContext(sandbox);

      // Wrap code for safe execution
      const wrappedCode = this.wrapCode(code);

      // Execute with timeout
      const result = await this.executeWithTimeout(wrappedCode, context, mergedOptions.timeout);
      const executionTime = Date.now() - startTime;

      this.logger.debug('Code execution completed', { 
        executionTime, 
        resultType: typeof result 
      });

      return {
        success: true,
        result,
        executionTime
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown execution error';
      
      this.logger.error('Code execution failed', { 
        error: errorMessage, 
        executionTime,
        codePreview: code.substring(0, 200)
      });

      return {
        success: false,
        error: errorMessage,
        executionTime
      };
    }
  }

  /**
   * Execute code with timeout protection
   */
  private async executeWithTimeout(
    code: string, 
    context: vm.Context, 
    timeout: number
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Code execution timeout after ${timeout}ms`));
      }, timeout);

      try {
        const result = vm.runInContext(code, context, {
          timeout,
          displayErrors: true,
          breakOnSigint: true
        });

        clearTimeout(timeoutId);
        
        // Handle promises
        if (result && typeof result.then === 'function') {
          result.then(resolve).catch(reject);
        } else {
          resolve(result);
        }
      } catch (error) {
        clearTimeout(timeoutId);
        reject(error);
      }
    });
  }

  /**
   * Execute a simple expression (for inline conditions)
   */
  async executeExpression(
    expression: string,
    executionContext: CodeExecutionContext,
    options: Partial<CodeExecutionOptions> = {}
  ): Promise<CodeExecutionResult> {
    // Wrap expression in a return statement
    const code = `return (${expression});`;
    return this.executeCode(code, executionContext, options);
  }

  /**
   * Execute a function-style condition
   */
  async executeFunction(
    functionBody: string,
    executionContext: CodeExecutionContext,
    options: Partial<CodeExecutionOptions> = {}
  ): Promise<CodeExecutionResult> {
    // Wrap in an async function for maximum flexibility
    const code = `
      return (async function(event, context, rule, timestamp, utils) {
        ${functionBody}
      })(event, context, rule, timestamp, utils);
    `;
    
    return this.executeCode(code, executionContext, options);
  }

  /**
   * Validate JavaScript code syntax without execution
   */
  validateCode(code: string): { valid: boolean; error?: string } {
    try {
      // Create a minimal context for syntax validation
      const context = vm.createContext({});
      const testCode = `function validateSyntax() { ${code} }`;
      
      vm.runInContext(testCode, context, {
        timeout: 1000,
        displayErrors: true
      });
      
      return { valid: true };
    } catch (error) {
      return { 
        valid: false, 
        error: error instanceof Error ? error.message : 'Syntax error' 
      };
    }
  }

  /**
   * Create a secure sandbox environment
   */
  private createSandbox(
    executionContext: CodeExecutionContext,
    options: Required<CodeExecutionOptions>
  ): Record<string, any> {
    const sandbox = {
      // Execution context
      event: executionContext.event,
      context: executionContext.context,
      rule: executionContext.rule,
      timestamp: executionContext.timestamp,
      
      // Safe utilities
      utils: {
        date: Date,
        math: Math,
        json: JSON,
        regex: RegExp,
        console: {
          log: (...args: any[]) => this.logger.debug('Code console.log:', args),
          warn: (...args: any[]) => this.logger.warn('Code console.warn:', args),
          error: (...args: any[]) => this.logger.error('Code console.error:', args)
        }
      },

      // Helper functions for common operations
      helpers: {
        // Date/time helpers
        isToday: (date: Date) => {
          const today = new Date();
          return date.toDateString() === today.toDateString();
        },
        
        daysBetween: (date1: Date, date2: Date) => {
          const diffTime = Math.abs(date2.getTime() - date1.getTime());
          return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        },
        
        hoursUntil: (date: Date) => {
          const now = new Date();
          const diffTime = date.getTime() - now.getTime();
          return Math.max(0, diffTime / (1000 * 60 * 60));
        },

        // String helpers
        contains: (str: string, substring: string) => str.includes(substring),
        startsWith: (str: string, prefix: string) => str.startsWith(prefix),
        endsWith: (str: string, suffix: string) => str.endsWith(suffix),
        matches: (str: string, pattern: string | RegExp) => {
          const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
          return regex.test(str);
        },

        // Number helpers
        between: (value: number, min: number, max: number) => value >= min && value <= max,
        roundTo: (value: number, decimals: number) => Number(value.toFixed(decimals)),

        // Array helpers
        includes: (array: any[], item: any) => array.includes(item),
        isEmpty: (value: any) => {
          if (value == null) return true;
          if (Array.isArray(value)) return value.length === 0;
          if (typeof value === 'object') return Object.keys(value).length === 0;
          if (typeof value === 'string') return value.trim().length === 0;
          return false;
        },

        // Object helpers
        hasProperty: (obj: any, prop: string) => obj && obj.hasOwnProperty(prop),
        getNestedValue: (obj: any, path: string) => {
          return path.split('.').reduce((current, key) => current?.[key], obj);
        }
      },

      // Custom sandbox additions
      ...options.sandbox
    };

    return sandbox;
  }

  /**
   * Wrap user code in a safe execution context
   */
  private wrapCode(code: string): string {
    return `
      (async function() {
        try {
          ${code}
        } catch (error) {
          throw new Error('Execution error: ' + error.message);
        }
      })();
    `;
  }

  /**
   * Create predefined code templates for common scenarios
   */
  getCodeTemplates(): Record<string, { description: string; code: string; example: string }> {
    return {
      // Time-based conditions
      'business-hours': {
        description: 'Check if current time is during business hours',
        code: `
          const hour = timestamp.getHours();
          const day = timestamp.getDay();
          return day >= 1 && day <= 5 && hour >= 9 && hour <= 17;
        `,
        example: 'Only send notifications during business hours (9 AM - 5 PM, Mon-Fri)'
      },

      'deadline-approaching': {
        description: 'Check if deadline is approaching within specified hours',
        code: `
          const dueDate = new Date(event.data.dueDate);
          const hoursRemaining = helpers.hoursUntil(dueDate);
          return hoursRemaining <= 24 && hoursRemaining > 0;
        `,
        example: 'Alert when deadline is within 24 hours'
      },

      // Value-based conditions  
      'high-value-transaction': {
        description: 'Check for high-value transactions with escalation',
        code: `
          const value = event.data.value || 0;
          const clientTier = context.clientTier || 'standard';
          
          if (clientTier === 'premium') {
            return value > 250000;
          } else if (clientTier === 'enterprise') {
            return value > 500000;
          }
          return value > 100000;
        `,
        example: 'Different thresholds based on client tier'
      },

      // Complex business logic
      'risk-assessment': {
        description: 'Complex risk assessment based on multiple factors',
        code: `
          const { propertyType, value, location, clientHistory } = event.data;
          let riskScore = 0;
          
          // Property type risk
          if (propertyType === 'commercial') riskScore += 2;
          if (propertyType === 'industrial') riskScore += 3;
          
          // Value risk  
          if (value > 1000000) riskScore += 2;
          if (value > 5000000) riskScore += 3;
          
          // Location risk
          if (location && location.includes('high-risk-area')) riskScore += 2;
          
          // Client history
          if (clientHistory && clientHistory.defaultRate > 0.1) riskScore += 2;
          
          return riskScore >= 5;
        `,
        example: 'Multi-factor risk assessment for complex decisions'
      },

      // Data validation
      'data-quality-check': {
        description: 'Validate data quality and completeness',
        code: `
          const requiredFields = ['orderId', 'propertyAddress', 'value', 'dueDate'];
          const missingFields = requiredFields.filter(field => 
            helpers.isEmpty(helpers.getNestedValue(event.data, field))
          );
          
          // Check for suspicious values
          const value = event.data.value;
          const suspiciousValue = value && (value < 1000 || value > 100000000);
          
          return missingFields.length > 0 || suspiciousValue;
        `,
        example: 'Alert on missing required fields or suspicious values'
      },

      // Pattern matching
      'pattern-detection': {
        description: 'Detect patterns in event data or sequences',
        code: `
          const orderId = event.data.orderId;
          const priority = event.data.priority;
          
          // Check for specific ID patterns
          const isRushOrder = helpers.matches(orderId, /^RUSH-/i);
          const isVIPClient = helpers.matches(event.data.clientId, /^VIP-/i);
          
          // Combine conditions
          return (isRushOrder || isVIPClient) && priority === 'high';
        `,
        example: 'Pattern-based routing for special order types'
      }
    };
  }
}