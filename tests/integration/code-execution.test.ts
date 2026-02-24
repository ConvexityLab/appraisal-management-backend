// Integration tests for Dynamic Code Execution Service
// Tests the sandboxed JavaScript execution functionality

import { describe, it, expect, beforeEach } from 'vitest'
import { DynamicCodeExecutionService, type CodeExecutionContext } from '../../src/services/dynamic-code-execution.service'

describe('Dynamic Code Execution Service', () => {
  let service: DynamicCodeExecutionService

  beforeEach(() => {
    service = new DynamicCodeExecutionService()
  })

  // Helper function to create a valid execution context
  const createContext = (customContext: any = {}): CodeExecutionContext => ({
    event: {},
    context: customContext,
    rule: {},
    timestamp: new Date(),
    utils: {
      date: Date,
      math: Math,
      json: JSON,
      regex: RegExp,
      console: { log: console.log, warn: console.warn, error: console.error }
    }
  })

  describe('Basic Code Execution', () => {
    it('should execute simple arithmetic', async () => {
      const result = await service.executeCode(
        'return 2 + 3;', 
        createContext()
      )
      
      expect(result).toEqual(
        expect.objectContaining({
          success: true,
          result: 5,
          executionTime: expect.any(Number)
        })
      )
      
      expect(result.executionTime).toBeGreaterThan(0)
      expect(result.executionTime).toBeLessThan(1000)
    })

    it('should execute string operations', async () => {
      const result = await service.executeCode(
        'return "Hello" + " " + "World!";',
        createContext()
      )
      
      expect(result).toEqual(
        expect.objectContaining({
          success: true,
          result: 'Hello World!',
          executionTime: expect.any(Number)
        })
      )
    })

    it('should execute array operations', async () => {
      const result = await service.executeCode(
        'return [1, 2, 3, 4, 5].reduce((a, b) => a + b, 0);',
        createContext()
      )
      
      expect(result).toEqual(
        expect.objectContaining({
          success: true,
          result: 15,
          executionTime: expect.any(Number)
        })
      )
    })

    it('should execute object operations', async () => {
      const result = await service.executeCode(`
        const person = { name: 'John', age: 30 };
        return person.name + ' is ' + person.age + ' years old';
      `, createContext())
      
      expect(result).toEqual(
        expect.objectContaining({
          success: true,
          result: 'John is 30 years old',
          executionTime: expect.any(Number)
        })
      )
    })
  })

  describe('Context Handling', () => {
    it('should execute code with simple context', async () => {
      const customContext = { multiplier: 5 }
      const result = await service.executeCode(
        'return 10 * context.multiplier;', 
        createContext(customContext)
      )
      
      expect(result).toEqual(
        expect.objectContaining({
          success: true,
          result: 50,
          executionTime: expect.any(Number)
        })
      )
    })

    it('should execute code with complex context', async () => {
      const customContext = {
        property: {
          price: 500000,
          sqft: 2000,
          bedrooms: 3,
          bathrooms: 2
        },
        market: {
          appreciation: 0.05,
          pricePerSqft: 250
        }
      }
      
      const result = await service.executeCode(`
        const pricePerSqft = context.property.price / context.property.sqft;
        const marketValue = context.property.sqft * context.market.pricePerSqft;
        const appreciatedValue = context.property.price * (1 + context.market.appreciation);
        
        return {
          pricePerSqft,
          marketValue,
          appreciatedValue,
          recommendedValue: Math.max(marketValue, appreciatedValue)
        };
      `, createContext(customContext))
      
      expect(result).toEqual(
        expect.objectContaining({
          success: true,
          result: expect.objectContaining({
            pricePerSqft: 250,
            marketValue: 500000,
            appreciatedValue: 525000,
            recommendedValue: 525000
          }),
          executionTime: expect.any(Number)
        })
      )
    })

    it('should handle missing context gracefully', async () => {
      const result = await service.executeCode(
        'return context ? Object.keys(context).length : "no context";',
        createContext()
      )
      
      expect(result).toEqual(
        expect.objectContaining({
          success: true,
          result: 0, // empty context object has 0 keys
          executionTime: expect.any(Number)
        })
      )
    })
  })

  describe('Math and Financial Calculations', () => {
    it('should perform complex financial calculations', async () => {
      const customContext = {
        loanAmount: 400000,
        interestRate: 0.06,
        years: 30
      }
      
      const result = await service.executeCode(`
        const monthlyRate = context.interestRate / 12;
        const numPayments = context.years * 12;
        const monthlyPayment = context.loanAmount * 
          (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / 
          (Math.pow(1 + monthlyRate, numPayments) - 1);
        
        const totalPaid = monthlyPayment * numPayments;
        const totalInterest = totalPaid - context.loanAmount;
        
        return {
          monthlyPayment: Math.round(monthlyPayment * 100) / 100,
          totalPaid: Math.round(totalPaid * 100) / 100,
          totalInterest: Math.round(totalInterest * 100) / 100
        };
      `, createContext(customContext))
      
      expect(result.success).toBe(true)
      expect(result.result).toEqual(
        expect.objectContaining({
          monthlyPayment: expect.any(Number),
          totalPaid: expect.any(Number),
          totalInterest: expect.any(Number)
        })
      )
      
      // Validate the monthly payment is reasonable for a 30-year mortgage
      expect(result.result.monthlyPayment).toBeGreaterThan(2000)
      expect(result.result.monthlyPayment).toBeLessThan(3000)
    })

    it('should calculate property valuation adjustments', async () => {
      const customContext = {
        baseValue: 500000,
        adjustments: [
          { type: 'condition', factor: 0.95 },
          { type: 'location', factor: 1.1 },
          { type: 'market', factor: 1.05 }
        ]
      }
      
      const result = await service.executeCode(`
        let adjustedValue = context.baseValue;
        const adjustmentLog = [];
        
        for (const adj of context.adjustments) {
          const oldValue = adjustedValue;
          adjustedValue *= adj.factor;
          adjustmentLog.push({
            type: adj.type,
            factor: adj.factor,
            before: oldValue,
            after: adjustedValue,
            change: adjustedValue - oldValue
          });
        }
        
        return {
          originalValue: context.baseValue,
          finalValue: Math.round(adjustedValue),
          totalAdjustment: Math.round(adjustedValue - context.baseValue),
          adjustmentLog
        };
      `, createContext(customContext))
      
      expect(result.success).toBe(true)
      expect(result.result.originalValue).toBe(500000)
      expect(result.result.finalValue).toBeGreaterThan(500000) // Net positive adjustments
      expect(result.result.adjustmentLog).toHaveLength(3)
    })
  })

  describe('Error Handling', () => {
    it('should handle syntax errors', async () => {
      const result = await service.executeCode(
        'return 2 +;', // Invalid syntax
        createContext()
      )
      
      // VM may report syntax errors in various forms; the key assertion is failure
      expect(result.success).toBe(false)
      expect(typeof result.error).toBe('string')
      expect(result.error!.length).toBeGreaterThan(0)
      expect(typeof result.executionTime).toBe('number')
    })

    it('should handle runtime errors', async () => {
      const result = await service.executeCode(
        'throw new Error("Test error");',
        createContext()
      )
      
      // Service wraps as 'Execution error: Test error'
      expect(result.success).toBe(false)
      expect(result.error).toMatch(/Test error/i)
      expect(typeof result.executionTime).toBe('number')
    })

    it('should handle undefined variables', async () => {
      const result = await service.executeCode(
        'return undefinedVariable;',
        createContext()
      )
      
      // Wrapped as 'Execution error: undefinedVariable is not defined'
      expect(result.success).toBe(false)
      expect(result.error).toMatch(/undefinedVariable|not defined/i)
      expect(typeof result.executionTime).toBe('number')
    })

    it('should respect timeout limits', async () => {
      const result = await service.executeCode(
        'while(true) {}', // Infinite loop
        createContext(),
        { timeout: 100 } // 100ms timeout
      )
      
      // Service emits 'Code execution timeout after 100ms'
      expect(result.success).toBe(false)
      expect(result.error).toMatch(/timeout/i)
      expect(typeof result.executionTime).toBe('number')
      // Should timeout close to the limit
      expect(result.executionTime).toBeGreaterThan(50)
      expect(result.executionTime).toBeLessThan(500)
    }, 10000) // Allow extra time for this test
  })

  describe('Security Restrictions', () => {
    it('should block file system access', async () => {
      const result = await service.executeCode(`
        const fs = require('fs');
        return fs.readFileSync('/etc/passwd', 'utf8');
      `, createContext())
      
      expect(result.success).toBe(false)
      expect(result.error).toMatch(/require|not.*function|access.*denied/i)
    })

    it('should block network access', async () => {
      const result = await service.executeCode(`
        const http = require('http');
        return http.get('http://example.com');
      `, createContext())
      
      expect(result.success).toBe(false)
      expect(result.error).toMatch(/require|not.*function|access.*denied/i)
    })

    it('should block process access', async () => {
      const result = await service.executeCode(
        'return process.env;',
        createContext()
      )
      
      expect(result.success).toBe(false)
      expect(result.error).toMatch(/process|not.*defined|access.*denied/i)
    })

    it('should allow safe built-in objects', async () => {
      const result = await service.executeCode(`
        return {
          mathPI: Math.PI,
          dateNow: typeof Date.now,
          arrayFrom: typeof Array.from,
          objectKeys: typeof Object.keys,
          jsonStringify: typeof JSON.stringify
        };
      `, createContext())
      
      expect(result.success).toBe(true)
      expect(result.result).toEqual({
        mathPI: Math.PI,
        dateNow: 'function',
        arrayFrom: 'function',
        objectKeys: 'function',
        jsonStringify: 'function'
      })
    })
  })

  describe('Performance', () => {
    it('should execute simple code quickly', async () => {
      const startTime = Date.now()
      const result = await service.executeCode(
        'return 1 + 1;',
        createContext()
      )
      const totalTime = Date.now() - startTime
      
      expect(result.success).toBe(true)
      expect(result.executionTime).toBeLessThan(100) // Should be very fast
      expect(totalTime).toBeLessThan(500) // Including overhead
    })

    it('should handle multiple concurrent executions', async () => {
      const promises = Array.from({ length: 5 }, (_, i) => 
        service.executeCode(
          `return ${i} * 10;`,
          createContext()
        )
      )
      
      const results = await Promise.all(promises)
      
      results.forEach((result, index) => {
        expect(result.success).toBe(true)
        expect(result.result).toBe(index * 10)
      })
    })

    it('should handle computational intensive tasks within timeout', async () => {
      const result = await service.executeCode(`
        // Calculate fibonacci sequence
        function fibonacci(n) {
          if (n <= 1) return n;
          return fibonacci(n - 1) + fibonacci(n - 2);
        }
        
        return fibonacci(20); // Should complete but be noticeable
      `, createContext(), { timeout: 5000 }) // 5 second timeout
      
      expect(result.success).toBe(true)
      expect(result.result).toBe(6765) // 20th fibonacci number
      expect(result.executionTime).toBeGreaterThanOrEqual(0) // Non-negative duration
      expect(result.executionTime).toBeLessThan(5000) // But not timeout
    })
  })
})