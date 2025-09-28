#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const filePath = './src/services/cosmos-db.service.ts';

try {
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Replace all error objects missing timestamp with createApiError calls
  content = content.replace(
    /error:\s*{\s*code:\s*['"]([^'"]+)['"],\s*message:\s*([^}]+)\s*}/g,
    'error: createApiError(\'$1\', $2)'
  );
  
  // Replace specific error codes with ErrorCodes constants
  content = content.replace(/createApiError\('FIND_ORDERS_FAILED'/g, 'createApiError(ErrorCodes.ORDER_SEARCH_FAILED');
  content = content.replace(/createApiError\('ORDER_NOT_FOUND'/g, 'createApiError(ErrorCodes.ORDER_NOT_FOUND');
  content = content.replace(/createApiError\('UPDATE_ORDER_FAILED'/g, 'createApiError(ErrorCodes.ORDER_UPDATE_FAILED');
  content = content.replace(/createApiError\('DELETE_ORDER_FAILED'/g, 'createApiError(ErrorCodes.ORDER_DELETE_FAILED');
  content = content.replace(/createApiError\('CREATE_VENDOR_FAILED'/g, 'createApiError(ErrorCodes.VENDOR_CREATE_FAILED');
  content = content.replace(/createApiError\('VENDOR_NOT_FOUND'/g, 'createApiError(ErrorCodes.VENDOR_NOT_FOUND');
  content = content.replace(/createApiError\('CREATE_PROPERTY_FAILED'/g, 'createApiError(ErrorCodes.PROPERTY_CREATE_FAILED');
  content = content.replace(/createApiError\('PROPERTY_NOT_FOUND'/g, 'createApiError(ErrorCodes.PROPERTY_NOT_FOUND');
  content = content.replace(/createApiError\('FIND_PROPERTIES_FAILED'/g, 'createApiError(ErrorCodes.PROPERTY_SEARCH_FAILED');
  
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Fixed ApiError issues in cosmos-db.service.ts');
} catch (error) {
  console.error('Error fixing file:', error.message);
}