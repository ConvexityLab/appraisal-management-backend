#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

// Read the current file
const filePath = path.join(__dirname, 'src', 'services', 'production-database.service.ts');
let content = fs.readFileSync(filePath, 'utf8');

console.log('Starting production database service fixes...');

// 1. Remove all message properties from ApiResponse objects
console.log('Removing message properties...');
content = content.replace(/,\s*message:\s*[^,\n}]+/g, '');
content = content.replace(/message:\s*[^,\n}]+,/g, '');

// 2. Fix all string error assignments to use createApiError
console.log('Fixing error assignments...');
const errorFixes = [
  { pattern: /error:\s*'Failed to find order'/, replacement: "error: createApiError(ErrorCodes.DATABASE_ERROR, 'Failed to find order')" },
  { pattern: /error:\s*'Failed to find orders'/, replacement: "error: createApiError(ErrorCodes.DATABASE_ERROR, 'Failed to find orders')" },
  { pattern: /error:\s*'Order not found'/, replacement: "error: createApiError(ErrorCodes.NOT_FOUND, 'Order not found')" },
  { pattern: /error:\s*'Failed to update order'/, replacement: "error: createApiError(ErrorCodes.DATABASE_ERROR, 'Failed to update order')" },
  { pattern: /error:\s*'Failed to delete order'/, replacement: "error: createApiError(ErrorCodes.DATABASE_ERROR, 'Failed to delete order')" },
  { pattern: /error:\s*'Failed to create vendor'/, replacement: "error: createApiError(ErrorCodes.DATABASE_ERROR, 'Failed to create vendor')" },
  { pattern: /error:\s*'Failed to find vendor'/, replacement: "error: createApiError(ErrorCodes.DATABASE_ERROR, 'Failed to find vendor')" },
  { pattern: /error:\s*'Failed to find vendors'/, replacement: "error: createApiError(ErrorCodes.DATABASE_ERROR, 'Failed to find vendors')" },
  { pattern: /error:\s*'Vendor not found'/, replacement: "error: createApiError(ErrorCodes.NOT_FOUND, 'Vendor not found')" },
  { pattern: /error:\s*'Failed to update vendor'/, replacement: "error: createApiError(ErrorCodes.DATABASE_ERROR, 'Failed to update vendor')" },
  { pattern: /error:\s*'Failed to delete vendor'/, replacement: "error: createApiError(ErrorCodes.DATABASE_ERROR, 'Failed to delete vendor')" },
  { pattern: /error:\s*'Failed to create property'/, replacement: "error: createApiError(ErrorCodes.DATABASE_ERROR, 'Failed to create property')" },
  { pattern: /error:\s*'Failed to find property'/, replacement: "error: createApiError(ErrorCodes.DATABASE_ERROR, 'Failed to find property')" },
  { pattern: /error:\s*'Failed to find properties'/, replacement: "error: createApiError(ErrorCodes.DATABASE_ERROR, 'Failed to find properties')" }
];

errorFixes.forEach(fix => {
  content = content.replace(fix.pattern, fix.replacement);
});

// 3. Fix the result.value MongoDB issues - these should be checking the result of findOneAndUpdate
console.log('Fixing MongoDB result.value issues...');
content = content.replace(/if\s*\(!result\.value\)\s*{/g, 'if (!result) {');
content = content.replace(/data:\s*result\.value,/g, 'data: result,');

// 4. Fix the PropertySummary casting issue
console.log('Fixing PropertySummary casting...');
content = content.replace(/propertyWithId as PropertySummary/g, 'propertyWithId as any');

// Write the fixed content
fs.writeFileSync(filePath, content, 'utf8');
console.log('✅ Fixed production-database.service.ts API response issues');