/**
 * Dynamic Code Execution Service Tests
 * 
 * Comprehensive test suite covering all functionality, security features,
 * error handling, and edge cases of the Dynamic Code Execution Service.
 */

import { DynamicCodeExecutionService, CodeExecutionContext, CodeExecutionOptions } from '../services/dynamic-code-execution.service';

describe('DynamicCodeExecutionService', () => {
  let service: DynamicCodeExecutionService;
  let defaultContext: CodeExecutionContext;

  beforeEach(() => {
    service = new DynamicCodeExecutionService();
    defaultContext = {
      event: { data: { testValue: 100 } },
      context: { userId: 'test-user', role: 'admin' },
      rule: { name: 'test-rule' },
      timestamp: new Date('2024-01-01T00:00:00Z'),
      utils: {
        date: Date,
        math: Math,
        json: JSON,
        regex: RegExp,
        console: { log: jest.fn(), warn: jest.fn(), error: jest.fn() }
      }
    };
  });

  describe('Basic Code Execution', () => {
    test('should execute simple return statement', async () => {
      const result = await service.executeCode('return 42;', defaultContext);
      
      expect(result.success).toBe(true);
      expect(result.result).toBe(42);
      expect(result.executionTime).toBeGreaterThan(0);
      expect(result.error).toBeUndefined();
    });

    test('should execute code with mathematical operations', async () => {
      const code = 'return Math.pow(2, 3) + Math.sqrt(16);';
      const result = await service.executeCode(code, defaultContext);
      
      expect(result.success).toBe(true);
      expect(result.result).toBe(12); // 8 + 4
    });

    test('should execute code with string operations', async () => {
      const code = `
        const name = "John Doe";
        return name.toUpperCase().split(' ').join('-');
      `;
      const result = await service.executeCode(code, defaultContext);
      
      expect(result.success).toBe(true);
      expect(result.result).toBe('JOHN-DOE');
    });

    test('should execute code with array operations', async () => {
      const code = `
        const numbers = [1, 2, 3, 4, 5];
        return numbers
          .filter(n => n % 2 === 0)
          .map(n => n * 2)
          .reduce((sum, n) => sum + n, 0);
      `;
      const result = await service.executeCode(code, defaultContext);
      
      expect(result.success).toBe(true);
      expect(result.result).toBe(12); // (2*2) + (4*2) = 4 + 8 = 12
    });

    test('should execute code with object operations', async () => {
      const code = `
        const data = { a: 1, b: 2, c: 3 };
        return Object.entries(data)
          .map(([key, value]) => ({ key, doubledValue: value * 2 }));
      `;
      const result = await service.executeCode(code, defaultContext);
      
      expect(result.success).toBe(true);
      expect(result.result).toEqual([
        { key: 'a', doubledValue: 2 },
        { key: 'b', doubledValue: 4 },
        { key: 'c', doubledValue: 6 }
      ]);
    });
  });

  describe('Context Access', () => {
    test('should access event data', async () => {
      const code = 'return event.data.testValue * 2;';
      const result = await service.executeCode(code, defaultContext);
      
      expect(result.success).toBe(true);
      expect(result.result).toBe(200);
    });

    test('should access context data', async () => {
      const code = 'return context.userId + "-" + context.role;';
      const result = await service.executeCode(code, defaultContext);
      
      expect(result.success).toBe(true);
      expect(result.result).toBe('test-user-admin');
    });

    test('should access timestamp', async () => {
      const code = 'return timestamp.getFullYear();';
      const result = await service.executeCode(code, defaultContext);
      
      expect(result.success).toBe(true);
      expect(result.result).toBe(2024);
    });

    test('should access utility functions', async () => {
      const code = `
        const now = new utils.date();
        return typeof now === 'object' && now instanceof Date;
      `;
      const result = await service.executeCode(code, defaultContext);
      
      expect(result.success).toBe(true);
      expect(result.result).toBe(true);
    });
  });

  describe('Helper Functions', () => {
    test('should access date helpers', async () => {
      const code = `
        const today = new Date();
        return helpers.isToday(today);
      `;
      const result = await service.executeCode(code, defaultContext);
      
      expect(result.success).toBe(true);
      expect(result.result).toBe(true);
    });

    test('should calculate days between dates', async () => {
      const code = `
        const date1 = new Date('2024-01-01');
        const date2 = new Date('2024-01-11');
        return helpers.daysBetween(date1, date2);
      `;
      const result = await service.executeCode(code, defaultContext);
      
      expect(result.success).toBe(true);
      expect(result.result).toBe(10);
    });

    test('should check string contains', async () => {
      const code = `
        return helpers.contains('Hello World', 'World');
      `;
      const result = await service.executeCode(code, defaultContext);
      
      expect(result.success).toBe(true);
      expect(result.result).toBe(true);
    });

    test('should check value between range', async () => {
      const code = `
        return helpers.between(50, 1, 100);
      `;
      const result = await service.executeCode(code, defaultContext);
      
      expect(result.success).toBe(true);
      expect(result.result).toBe(true);
    });

    test('should get nested object value', async () => {
      const code = `
        const obj = { user: { profile: { name: 'John' } } };
        return helpers.getNestedValue(obj, 'user.profile.name');
      `;
      const result = await service.executeCode(code, defaultContext);
      
      expect(result.success).toBe(true);
      expect(result.result).toBe('John');
    });
  });

  describe('Error Handling', () => {
    test('should handle syntax errors', async () => {
      const code = 'return invalid syntax here;';
      const result = await service.executeCode(code, defaultContext);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.result).toBeUndefined();
      expect(result.executionTime).toBeGreaterThan(0);
    });

    test('should handle runtime errors', async () => {
      const code = 'return nonExistentVariable.property;';
      const result = await service.executeCode(code, defaultContext);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.result).toBeUndefined();
    });

    test('should handle type errors', async () => {
      const code = 'return null.someMethod();';
      const result = await service.executeCode(code, defaultContext);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.result).toBeUndefined();
    });

    test('should handle reference errors', async () => {
      const code = 'return undefinedFunction();';
      const result = await service.executeCode(code, defaultContext);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.result).toBeUndefined();
    });
  });

  describe('Timeout Protection', () => {
    test('should timeout infinite loops', async () => {
      const code = 'while(true) { /* infinite loop */ }';
      const result = await service.executeCode(code, defaultContext, { timeout: 1000 });
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.executionTime).toBeGreaterThanOrEqual(1000);
    }, 10000);

    test('should timeout long-running operations', async () => {
      const code = `
        let sum = 0;
        for(let i = 0; i < 10000000; i++) {
          sum += Math.sqrt(i);
        }
        return sum;
      `;
      const result = await service.executeCode(code, defaultContext, { timeout: 100 });
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    }, 5000);

    test('should complete within timeout for fast operations', async () => {
      const code = 'return 2 + 2;';
      const result = await service.executeCode(code, defaultContext, { timeout: 1000 });
      
      expect(result.success).toBe(true);
      expect(result.result).toBe(4);
      expect(result.executionTime).toBeLessThan(1000);
    });
  });

  describe('Security Features', () => {
    test('should block file system access', async () => {
      const code = `
        const fs = require('fs');
        return fs.readFileSync('/etc/passwd', 'utf8');
      `;
      const result = await service.executeCode(code, defaultContext);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should block process access', async () => {
      const code = 'return process.env;';
      const result = await service.executeCode(code, defaultContext);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should block global access', async () => {
      const code = 'return global;';
      const result = await service.executeCode(code, defaultContext);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should block require function', async () => {
      const code = 'return require("child_process");';
      const result = await service.executeCode(code, defaultContext);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should block eval function', async () => {
      const code = 'return eval("2 + 2");';
      const result = await service.executeCode(code, defaultContext);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should block constructor access to restricted objects', async () => {
      const code = 'return this.constructor.constructor("return process")();';
      const result = await service.executeCode(code, defaultContext);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Complex Business Logic', () => {
    test('should execute loan calculation logic', async () => {
      const code = `
        const { principal, rate, years } = event.data;
        const monthlyRate = rate / 12 / 100;
        const totalPayments = years * 12;
        
        const monthlyPayment = principal * 
          (monthlyRate * Math.pow(1 + monthlyRate, totalPayments)) / 
          (Math.pow(1 + monthlyRate, totalPayments) - 1);
        
        return {
          monthlyPayment: Math.round(monthlyPayment * 100) / 100,
          totalPaid: Math.round(monthlyPayment * totalPayments * 100) / 100,
          totalInterest: Math.round((monthlyPayment * totalPayments - principal) * 100) / 100
        };
      `;

      const context = {
        ...defaultContext,
        event: { data: { principal: 200000, rate: 4.5, years: 30 } }
      };

      const result = await service.executeCode(code, context);
      
      expect(result.success).toBe(true);
      expect(result.result).toHaveProperty('monthlyPayment');
      expect(result.result).toHaveProperty('totalPaid');
      expect(result.result).toHaveProperty('totalInterest');
      expect(result.result.monthlyPayment).toBeCloseTo(1013.37, 2);
    });

    test('should execute risk assessment logic', async () => {
      const code = `
        const { creditScore, income, debt, loanAmount } = event.data;
        let riskScore = 0;
        
        // Credit score risk
        if (creditScore < 600) riskScore += 40;
        else if (creditScore < 700) riskScore += 20;
        else if (creditScore < 800) riskScore += 10;
        
        // Debt-to-income ratio
        const dti = debt / income;
        if (dti > 0.5) riskScore += 30;
        else if (dti > 0.3) riskScore += 15;
        
        // Loan amount vs income
        const loanToIncomeRatio = loanAmount / income;
        if (loanToIncomeRatio > 5) riskScore += 25;
        else if (loanToIncomeRatio > 3) riskScore += 10;
        
        return {
          riskScore,
          riskLevel: riskScore > 50 ? 'HIGH' : riskScore > 25 ? 'MEDIUM' : 'LOW',
          approved: riskScore <= 50,
          dti: Math.round(dti * 100),
          loanToIncomeRatio: Math.round(loanToIncomeRatio * 100) / 100
        };
      `;

      const context = {
        ...defaultContext,
        event: { 
          data: { 
            creditScore: 750, 
            income: 80000, 
            debt: 20000, 
            loanAmount: 250000 
          } 
        }
      };

      const result = await service.executeCode(code, context);
      
      expect(result.success).toBe(true);
      expect(result.result.riskLevel).toBe('LOW');
      expect(result.result.approved).toBe(true);
      expect(result.result.dti).toBe(25);
    });

    test('should execute data transformation logic', async () => {
      const code = `
        const { customers } = event.data;
        
        return customers
          .filter(customer => customer.active && customer.orders > 0)
          .map(customer => ({
            id: customer.id,
            name: customer.firstName + ' ' + customer.lastName,
            email: customer.email.toLowerCase(),
            totalSpent: customer.orderHistory.reduce((sum, order) => sum + order.amount, 0),
            avgOrderValue: customer.orderHistory.reduce((sum, order) => sum + order.amount, 0) / customer.orders,
            lastOrderDate: customer.orderHistory.length > 0 ? 
              Math.max(...customer.orderHistory.map(o => new Date(o.date).getTime())) : null,
            segment: customer.orders > 10 ? 'VIP' : customer.orders > 5 ? 'REGULAR' : 'NEW'
          }))
          .sort((a, b) => b.totalSpent - a.totalSpent);
      `;

      const context = {
        ...defaultContext,
        event: {
          data: {
            customers: [
              {
                id: 1,
                firstName: 'John',
                lastName: 'Doe',
                email: 'JOHN@EXAMPLE.COM',
                active: true,
                orders: 15,
                orderHistory: [
                  { date: '2024-01-01', amount: 100 },
                  { date: '2024-01-15', amount: 200 }
                ]
              },
              {
                id: 2,
                firstName: 'Jane',
                lastName: 'Smith',
                email: 'jane@example.com',
                active: false,
                orders: 3,
                orderHistory: []
              }
            ]
          }
        }
      };

      const result = await service.executeCode(code, context);
      
      expect(result.success).toBe(true);
      expect(result.result).toHaveLength(1); // Only active customer
      expect(result.result[0].name).toBe('John Doe');
      expect(result.result[0].email).toBe('john@example.com');
      expect(result.result[0].segment).toBe('VIP');
      expect(result.result[0].totalSpent).toBe(300);
    });
  });

  describe('Performance and Memory', () => {
    test('should track execution time', async () => {
      const code = `
        let sum = 0;
        for(let i = 0; i < 1000; i++) {
          sum += i;
        }
        return sum;
      `;
      const result = await service.executeCode(code, defaultContext);
      
      expect(result.success).toBe(true);
      expect(result.executionTime).toBeGreaterThan(0);
      expect(result.executionTime).toBeLessThan(1000); // Should be much faster
    });

    test('should handle large data processing', async () => {
      const code = `
        const largeArray = Array.from({ length: 10000 }, (_, i) => i);
        return largeArray
          .filter(n => n % 2 === 0)
          .map(n => n * n)
          .reduce((sum, n) => sum + n, 0);
      `;
      const result = await service.executeCode(code, defaultContext);
      
      expect(result.success).toBe(true);
      expect(typeof result.result).toBe('number');
      expect(result.result).toBeGreaterThan(0);
    });
  });

  describe('Configuration Options', () => {
    test('should use custom timeout', async () => {
      const service = new DynamicCodeExecutionService({ timeout: 100 });
      const code = `
        let sum = 0;
        for(let i = 0; i < 1000000; i++) {
          sum += Math.sqrt(i);
        }
        return sum;
      `;
      
      const result = await service.executeCode(code, defaultContext);
      
      expect(result.success).toBe(false);
      expect(result.executionTime).toBeGreaterThanOrEqual(100);
    }, 5000);

    test('should use custom sandbox variables', async () => {
      const options: CodeExecutionOptions = {
        sandbox: { customValue: 42, customFunction: () => 'custom' }
      };
      
      const code = 'return customValue + customFunction().length;';
      const result = await service.executeCode(code, defaultContext, options);
      
      expect(result.success).toBe(true);
      expect(result.result).toBe(48); // 42 + 6 (length of 'custom')
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty code', async () => {
      const result = await service.executeCode('', defaultContext);
      
      expect(result.success).toBe(true);
      expect(result.result).toBeUndefined();
    });

    test('should handle code without return statement', async () => {
      const code = 'const x = 42;';
      const result = await service.executeCode(code, defaultContext);
      
      expect(result.success).toBe(true);
      expect(result.result).toBeUndefined();
    });

    test('should handle null and undefined returns', async () => {
      const nullResult = await service.executeCode('return null;', defaultContext);
      const undefinedResult = await service.executeCode('return undefined;', defaultContext);
      
      expect(nullResult.success).toBe(true);
      expect(nullResult.result).toBeNull();
      
      expect(undefinedResult.success).toBe(true);
      expect(undefinedResult.result).toBeUndefined();
    });

    test('should handle complex object returns', async () => {
      const code = `
        return {
          string: 'test',
          number: 123,
          boolean: true,
          array: [1, 2, 3],
          object: { nested: true },
          date: new Date('2024-01-01'),
          nullValue: null,
          undefinedValue: undefined
        };
      `;
      const result = await service.executeCode(code, defaultContext);
      
      expect(result.success).toBe(true);
      expect(result.result).toHaveProperty('string', 'test');
      expect(result.result).toHaveProperty('number', 123);
      expect(result.result).toHaveProperty('boolean', true);
      expect(result.result).toHaveProperty('array');
      expect(result.result).toHaveProperty('object');
      expect(result.result).toHaveProperty('date');
      expect(result.result).toHaveProperty('nullValue', null);
    });
  });

  describe('Real-world Integration Scenarios', () => {
    test('should handle API response transformation', async () => {
      const code = `
        const { apiResponse } = event.data;
        
        return {
          users: apiResponse.data.map(user => ({
            id: user.user_id,
            name: user.full_name,
            email: user.email_address,
            joinDate: new Date(user.created_at).toISOString().split('T')[0],
            isActive: user.status === 'active',
            metadata: {
              lastLogin: user.last_login_timestamp,
              totalLogins: user.login_count || 0,
              preferences: user.user_preferences || {}
            }
          })),
          summary: {
            total: apiResponse.data.length,
            active: apiResponse.data.filter(u => u.status === 'active').length,
            inactive: apiResponse.data.filter(u => u.status !== 'active').length
          }
        };
      `;

      const context = {
        ...defaultContext,
        event: {
          data: {
            apiResponse: {
              data: [
                {
                  user_id: 1,
                  full_name: 'John Doe',
                  email_address: 'john@example.com',
                  created_at: '2024-01-01T00:00:00Z',
                  status: 'active',
                  last_login_timestamp: '2024-01-15T10:30:00Z',
                  login_count: 25
                },
                {
                  user_id: 2,
                  full_name: 'Jane Smith',
                  email_address: 'jane@example.com',
                  created_at: '2024-01-02T00:00:00Z',
                  status: 'inactive',
                  last_login_timestamp: null,
                  login_count: 0
                }
              ]
            }
          }
        }
      };

      const result = await service.executeCode(code, context);
      
      expect(result.success).toBe(true);
      expect(result.result.users).toHaveLength(2);
      expect(result.result.summary.total).toBe(2);
      expect(result.result.summary.active).toBe(1);
      expect(result.result.summary.inactive).toBe(1);
    });
  });
});