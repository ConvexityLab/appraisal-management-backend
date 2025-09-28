const fs = require('fs');
const path = require('path');

// Read the current file
const filePath = path.join(__dirname, 'src', 'services', 'production-database.service.ts');
let content = fs.readFileSync(filePath, 'utf8');

// Fix all message property issues - remove them completely
content = content.replace(/\s*message:\s*[^,\n}]+[,\n]/g, '\n');
content = content.replace(/,\s*message:\s*[^}]+/g, '');

// Fix all string error assignments to use createApiError
const errorReplacements = [
  { from: "error: 'Failed to find orders',", to: "error: createApiError(ErrorCodes.DATABASE_ERROR, 'Failed to find orders')" },
  { from: "error: 'Order not found',", to: "error: createApiError(ErrorCodes.NOT_FOUND, 'Order not found')" },
  { from: "error: 'Failed to update order',", to: "error: createApiError(ErrorCodes.DATABASE_ERROR, 'Failed to update order')" },
  { from: "error: 'Failed to delete order',", to: "error: createApiError(ErrorCodes.DATABASE_ERROR, 'Failed to delete order')" },
  { from: "error: 'Failed to create vendor',", to: "error: createApiError(ErrorCodes.DATABASE_ERROR, 'Failed to create vendor')" },
  { from: "error: 'Failed to find vendor',", to: "error: createApiError(ErrorCodes.DATABASE_ERROR, 'Failed to find vendor')" },
  { from: "error: 'Failed to find vendors',", to: "error: createApiError(ErrorCodes.DATABASE_ERROR, 'Failed to find vendors')" },
  { from: "error: 'Vendor not found',", to: "error: createApiError(ErrorCodes.NOT_FOUND, 'Vendor not found')" },
  { from: "error: 'Failed to update vendor',", to: "error: createApiError(ErrorCodes.DATABASE_ERROR, 'Failed to update vendor')" },
  { from: "error: 'Failed to delete vendor',", to: "error: createApiError(ErrorCodes.DATABASE_ERROR, 'Failed to delete vendor')" },
  { from: "error: 'Failed to create property',", to: "error: createApiError(ErrorCodes.DATABASE_ERROR, 'Failed to create property')" },
  { from: "error: 'Failed to find property',", to: "error: createApiError(ErrorCodes.DATABASE_ERROR, 'Failed to find property')" },
  { from: "error: 'Failed to find properties',", to: "error: createApiError(ErrorCodes.DATABASE_ERROR, 'Failed to find properties')" }
];

errorReplacements.forEach(replacement => {
  content = content.replace(new RegExp(replacement.from.replace(/'/g, "\\'"), 'g'), replacement.to);
});

// Fix the result.value issues in update methods
content = content.replace(/if \(!result\.value\) \{/g, 'if (!result || !result.matchedCount) {');
content = content.replace(/data: result\.value,/g, 'data: result as any,');

// Fix the PropertySummary casting issue
content = content.replace(/propertyWithId as PropertySummary/g, '{ ...propertyWithId, _id: propertyWithId._id.toString() } as PropertySummary');

// Write the fixed content
fs.writeFileSync(filePath, content, 'utf8');
console.log('Fixed production-database.service.ts API response issues');