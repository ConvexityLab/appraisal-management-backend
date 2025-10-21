# Dynamic Code Execution Service

## 📋 Overview

The **Dynamic Code Execution Service** is a powerful, enterprise-grade TypeScript/Node.js service that provides secure, sandboxed execution of JavaScript code at runtime. This service enables applications to execute user-defined business logic, data transformations, calculations, and complex decision-making processes with complete safety and control.

## 🎯 Key Features

### 🔒 **Security First**
- **Sandboxed Execution**: Uses Node.js built-in `vm` module with isolated context
- **Timeout Protection**: Configurable execution timeouts prevent infinite loops
- **Memory Limits**: Configurable memory usage limits prevent resource exhaustion
- **No File System Access**: Code cannot access local files or system resources
- **No Network Access**: Code cannot make external HTTP requests or network calls
- **Error Containment**: Code failures don't crash the host application

### ⚡ **High Performance**
- **Code Caching**: Compiled code is cached for repeated executions
- **Configurable Timeouts**: Fine-tune execution time limits per use case
- **Memory Management**: Efficient memory usage with configurable limits
- **Comprehensive Logging**: Detailed execution metrics and error reporting

### 🛠️ **Developer Friendly**
- **TypeScript Support**: Full TypeScript interfaces and type safety
- **Rich Context**: Pre-built utilities and helper functions available in sandbox
- **Flexible API**: Multiple execution modes for different use cases
- **Comprehensive Error Handling**: Detailed error messages and stack traces

## 🏗️ Architecture

```typescript
┌─────────────────────────────────────────────────────────────┐
│                Application Layer                            │
├─────────────────────────────────────────────────────────────┤
│         Dynamic Code Execution Service                     │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │   Sandbox   │  │   Timeout   │  │    Error Handler    │ │
│  │  Manager    │  │  Protection │  │                     │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│                Node.js VM Module                            │
└─────────────────────────────────────────────────────────────┘
```

## 📚 API Reference

### Core Interfaces

#### `CodeExecutionContext`
Defines the context available to executed code:

```typescript
interface CodeExecutionContext {
  event: any;           // Event data or input parameters
  context: any;         // User/session context
  rule: any;           // Rule or configuration data
  timestamp: Date;     // Current execution timestamp
  utils: {             // Utility objects
    date: typeof Date;
    math: typeof Math;
    json: typeof JSON;
    regex: typeof RegExp;
    console: Pick<Console, 'log' | 'warn' | 'error'>;
  };
}
```

#### `CodeExecutionOptions`
Configuration options for execution:

```typescript
interface CodeExecutionOptions {
  timeout?: number;              // Execution timeout in milliseconds (default: 5000)
  sandbox?: Record<string, any>; // Additional sandbox variables
  allowedModules?: string[];     // Whitelisted modules (default: ['lodash', 'moment', 'date-fns'])
  memoryLimit?: number;          // Memory limit in bytes (default: 16MB)
}
```

#### `CodeExecutionResult`
Result of code execution:

```typescript
interface CodeExecutionResult {
  success: boolean;      // Whether execution was successful
  result?: any;         // Return value from executed code
  error?: string;       // Error message if execution failed
  executionTime: number; // Execution time in milliseconds
  memoryUsed?: number;  // Memory used during execution
}
```

### Main Methods

#### `executeCode(code, context, options?)`
Execute JavaScript code with full context:

```typescript
async executeCode(
  code: string, 
  executionContext: CodeExecutionContext,
  options?: Partial<CodeExecutionOptions>
): Promise<CodeExecutionResult>
```

**Example:**
```typescript
const service = new DynamicCodeExecutionService();

const result = await service.executeCode(`
  const { customerAge, purchaseAmount } = event.data;
  const discount = customerAge > 65 ? 0.1 : customerAge > 18 ? 0.05 : 0;
  const finalAmount = purchaseAmount * (1 - discount);
  
  console.log('Discount calculation:', { customerAge, discount, finalAmount });
  return { discount, finalAmount };
`, {
  event: { data: { customerAge: 70, purchaseAmount: 100 } },
  context: { userId: 'user123' },
  rule: { name: 'senior-discount' },
  timestamp: new Date(),
  utils: { /* ... */ }
});

// Result: { success: true, result: { discount: 0.1, finalAmount: 90 }, executionTime: 45 }
```

#### `executeExpression(expression, context, options?)`
Execute simple expressions:

```typescript
async executeExpression(
  expression: string, 
  executionContext: CodeExecutionContext,
  options?: Partial<CodeExecutionOptions>
): Promise<CodeExecutionResult>
```

**Example:**
```typescript
const result = await service.executeExpression(
  'event.data.amount > 1000 && context.userRole === "manager"',
  executionContext
);
// Result: { success: true, result: true, executionTime: 12 }
```

#### `executeFunction(functionBody, context, options?)`
Execute function-style code:

```typescript
async executeFunction(
  functionBody: string, 
  executionContext: CodeExecutionContext,
  options?: Partial<CodeExecutionOptions>
): Promise<CodeExecutionResult>
```

**Example:**
```typescript
const result = await service.executeFunction(`
  const { items } = event.data;
  return items.reduce((total, item) => total + item.price * item.quantity, 0);
`, executionContext);
```

## 🎯 Use Cases

### 1. **Business Rules Engine**
Execute complex business logic that changes frequently:

```typescript
// Dynamic pricing rules
const pricingCode = `
  const { productType, customerTier, seasonality, inventory } = event.data;
  let price = event.data.basePrice;
  
  // Customer tier discounts
  const tierDiscounts = { bronze: 0, silver: 0.05, gold: 0.1, platinum: 0.15 };
  price *= (1 - (tierDiscounts[customerTier] || 0));
  
  // Seasonal adjustments
  if (seasonality === 'peak') price *= 1.2;
  if (seasonality === 'off-season') price *= 0.8;
  
  // Inventory-based pricing
  if (inventory < 10) price *= 1.1; // Scarcity premium
  
  return Math.round(price * 100) / 100; // Round to 2 decimals
`;
```

### 2. **Data Transformation & Processing**
Transform data between different formats and systems:

```typescript
// API response transformation
const transformCode = `
  const { rawData } = event.data;
  
  return rawData.map(record => ({
    id: record.customer_id,
    name: \`\${record.first_name} \${record.last_name}\`,
    email: record.email_address?.toLowerCase(),
    totalSpent: record.orders?.reduce((sum, order) => sum + order.amount, 0) || 0,
    lastOrder: record.orders?.length > 0 ? 
      new Date(Math.max(...record.orders.map(o => new Date(o.date)))).toISOString() : null,
    segment: record.orders?.length > 10 ? 'VIP' : 
             record.orders?.length > 5 ? 'Regular' : 'New'
  }));
`;
```

### 3. **Financial Calculations**
Perform complex financial computations:

```typescript
// Loan calculation with dynamic parameters
const loanCode = `
  const { principal, annualRate, termYears, paymentType } = event.data;
  const monthlyRate = annualRate / 12 / 100;
  const totalPayments = termYears * 12;
  
  let monthlyPayment;
  if (paymentType === 'fixed') {
    monthlyPayment = principal * 
      (monthlyRate * Math.pow(1 + monthlyRate, totalPayments)) / 
      (Math.pow(1 + monthlyRate, totalPayments) - 1);
  } else {
    monthlyPayment = (principal / totalPayments) + (principal * monthlyRate);
  }
  
  const totalInterest = (monthlyPayment * totalPayments) - principal;
  
  return {
    monthlyPayment: Math.round(monthlyPayment * 100) / 100,
    totalInterest: Math.round(totalInterest * 100) / 100,
    totalAmount: Math.round((monthlyPayment * totalPayments) * 100) / 100
  };
`;
```

### 4. **Validation & Quality Checks**
Implement complex validation logic:

```typescript
// Data quality validation
const validationCode = `
  const { record } = event.data;
  const errors = [];
  
  // Required fields validation
  const requiredFields = ['id', 'name', 'email', 'phone'];
  requiredFields.forEach(field => {
    if (!record[field] || record[field].trim() === '') {
      errors.push(\`Missing required field: \${field}\`);
    }
  });
  
  // Email validation
  const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
  if (record.email && !emailRegex.test(record.email)) {
    errors.push('Invalid email format');
  }
  
  // Phone validation
  const phoneRegex = /^\\+?[\\d\\s\\-\\(\\)]{10,}$/;
  if (record.phone && !phoneRegex.test(record.phone)) {
    errors.push('Invalid phone format');
  }
  
  // Age validation
  if (record.age && (record.age < 0 || record.age > 150)) {
    errors.push('Invalid age range');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    score: Math.max(0, 100 - (errors.length * 20))
  };
`;
```

### 5. **Report Generation**
Generate dynamic reports and analytics:

```typescript
// Sales report generation
const reportCode = `
  const { salesData, dateRange } = event.data;
  
  const summary = salesData.reduce((acc, sale) => {
    const month = new Date(sale.date).toISOString().slice(0, 7);
    
    if (!acc[month]) {
      acc[month] = { revenue: 0, orders: 0, customers: new Set() };
    }
    
    acc[month].revenue += sale.amount;
    acc[month].orders += 1;
    acc[month].customers.add(sale.customerId);
    
    return acc;
  }, {});
  
  return Object.entries(summary).map(([month, data]) => ({
    month,
    revenue: Math.round(data.revenue * 100) / 100,
    orders: data.orders,
    uniqueCustomers: data.customers.size,
    avgOrderValue: Math.round((data.revenue / data.orders) * 100) / 100
  })).sort((a, b) => a.month.localeCompare(b.month));
`;
```

## 🔒 Security Features

### Sandbox Environment
The service creates a completely isolated execution environment:

```typescript
// Available in sandbox (safe)
- Math object for calculations
- Date constructor for date operations
- JSON for data serialization
- RegExp for pattern matching
- console methods for logging (log, warn, error)
- Custom helper functions

// NOT available in sandbox (blocked for security)
- require() function
- import statements
- File system access (fs module)
- Network access (http, https modules)
- Process access (process object)
- Global variables (global, window)
- setTimeout/setInterval
```

### Helper Functions
Pre-built utility functions available in all executions:

```typescript
// Date helpers
helpers.isToday(date) // Check if date is today
helpers.daysBetween(date1, date2) // Calculate days between dates
helpers.hoursUntil(date) // Calculate hours until date

// String helpers
helpers.contains(str, substring) // Check if string contains substring
helpers.startsWith(str, prefix) // Check if string starts with prefix
helpers.matches(str, pattern) // Test string against regex pattern

// Number helpers
helpers.between(value, min, max) // Check if value is between min and max

// Array helpers
helpers.includes(array, item) // Check if array includes item

// Object helpers
helpers.isEmpty(value) // Check if value is empty
helpers.hasProperty(obj, prop) // Check if object has property
helpers.getNestedValue(obj, path) // Get nested object value by path
```

## ⚡ Performance Considerations

### Execution Timeouts
- **Default**: 5 seconds maximum execution time
- **Configurable**: Adjust per use case requirements
- **Protection**: Prevents infinite loops and long-running code

### Memory Management
- **Default**: 16MB memory limit per execution
- **Monitoring**: Track memory usage during execution
- **Protection**: Prevents memory exhaustion attacks

### Caching Strategy
- **Code Compilation**: Compiled code cached for repeated executions
- **Context Reuse**: Sandbox contexts can be reused for performance
- **Cleanup**: Automatic cleanup of unused cached items

### Logging & Monitoring
```typescript
// Automatic logging includes:
- Execution time metrics
- Memory usage statistics
- Error details and stack traces
- Code execution frequency
- Performance trend analysis
```

## 🚀 Getting Started

### Installation & Setup

1. **Import the service:**
```typescript
import { DynamicCodeExecutionService } from './services/dynamic-code-execution.service';
```

2. **Create service instance:**
```typescript
const codeExecutionService = new DynamicCodeExecutionService({
  timeout: 10000,        // 10 second timeout
  memoryLimit: 32 * 1024 * 1024, // 32MB memory limit
  allowedModules: ['lodash', 'moment'] // Additional safe modules
});
```

3. **Execute code:**
```typescript
const result = await codeExecutionService.executeCode(
  'return event.data.value * 1.1', // Simple calculation
  {
    event: { data: { value: 100 } },
    context: { userId: 'user123' },
    rule: { name: 'markup-calculation' },
    timestamp: new Date(),
    utils: { /* auto-populated */ }
  }
);

console.log(result); // { success: true, result: 110, executionTime: 23 }
```

## 🧪 Testing

The service includes comprehensive tests covering:
- ✅ Basic code execution
- ✅ Expression evaluation
- ✅ Function execution
- ✅ Error handling
- ✅ Timeout protection
- ✅ Memory limits
- ✅ Security sandbox
- ✅ Helper functions
- ✅ Context management
- ✅ Performance metrics

## 📊 Real-World Examples

### E-Commerce Platform
```typescript
// Dynamic shipping calculation
const shippingCode = `
  const { items, destination, customerTier } = event.data;
  
  let totalWeight = items.reduce((sum, item) => sum + item.weight * item.quantity, 0);
  let baseShipping = totalWeight * 2.5; // $2.50 per pound
  
  // Distance-based multiplier
  const distanceMultipliers = {
    'local': 1.0,
    'regional': 1.5,
    'national': 2.0,
    'international': 3.5
  };
  baseShipping *= distanceMultipliers[destination.zone] || 2.0;
  
  // Customer tier discounts
  const tierDiscounts = { bronze: 0, silver: 0.1, gold: 0.2, platinum: 0.3 };
  baseShipping *= (1 - (tierDiscounts[customerTier] || 0));
  
  // Free shipping threshold
  const orderTotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  if (orderTotal > 100) baseShipping = Math.max(0, baseShipping - 10);
  
  return Math.round(baseShipping * 100) / 100;
`;
```

### Insurance Premium Calculation
```typescript
// Risk-based insurance pricing
const insuranceCode = `
  const { applicant, coverage, history } = event.data;
  let basePremium = coverage.amount * 0.01; // 1% of coverage
  
  // Age factor
  if (applicant.age < 25) basePremium *= 1.5;
  else if (applicant.age > 65) basePremium *= 1.2;
  
  // Location risk
  const locationRisk = {
    'low-risk': 0.9,
    'medium-risk': 1.0,
    'high-risk': 1.3,
    'very-high-risk': 1.6
  };
  basePremium *= locationRisk[applicant.location.riskLevel] || 1.0;
  
  // Claims history
  if (history.claims > 0) {
    basePremium *= (1 + (history.claims * 0.15));
  }
  
  // Good driver discount
  if (history.yearsWithoutClaim >= 5) {
    basePremium *= 0.85;
  }
  
  return {
    monthlyPremium: Math.round(basePremium * 100) / 100,
    annualPremium: Math.round(basePremium * 12 * 100) / 100,
    riskScore: Math.min(100, Math.round((basePremium / (coverage.amount * 0.01)) * 100))
  };
`;
```

## 🔄 Integration Patterns

### With Web APIs
```typescript
// Express.js endpoint using dynamic code
app.post('/api/calculate', async (req, res) => {
  try {
    const result = await codeExecutionService.executeCode(
      req.body.calculationCode,
      {
        event: { data: req.body.inputData },
        context: { userId: req.user.id, timestamp: new Date() },
        rule: { name: req.body.ruleName },
        timestamp: new Date(),
        utils: { /* auto-populated */ }
      }
    );
    
    if (result.success) {
      res.json({ result: result.result, executionTime: result.executionTime });
    } else {
      res.status(400).json({ error: result.error });
    }
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

### With Database Operations
```typescript
// Execute code after database operations
const processOrder = async (orderData) => {
  // Save order to database
  const order = await db.orders.create(orderData);
  
  // Execute custom business logic
  const result = await codeExecutionService.executeCode(
    orderData.customLogic,
    {
      event: { data: order },
      context: { operation: 'order-created' },
      rule: { name: 'post-order-processing' },
      timestamp: new Date(),
      utils: { /* auto-populated */ }
    }
  );
  
  if (result.success && result.result?.sendNotification) {
    await notificationService.send(result.result.notification);
  }
  
  return order;
};
```

---

## 🎯 Conclusion

The Dynamic Code Execution Service provides a powerful, secure, and flexible foundation for executing JavaScript code at runtime. Whether you're building business rules engines, data transformation pipelines, financial calculators, or complex validation systems, this service offers the security, performance, and developer experience needed for production applications.

The service's comprehensive security model ensures safe execution of untrusted code, while its rich feature set and extensive API make it suitable for a wide range of use cases across different domains and industries.