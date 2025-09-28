#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Files to fix
const filesToFix = [
  './src/services/production-database.service.ts',
  './src/controllers/aiml.controller.ts'
];

function fixFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let hasChanges = false;
    
    // Remove message properties from ApiResponse returns
    const beforeMessageFix = content;
    content = content.replace(
      /return\s*{\s*success:\s*true,\s*data:\s*([^,]+),\s*message:\s*[^}]+\s*}/g,
      'return { success: true, data: $1 }'
    );
    content = content.replace(
      /return\s*{\s*success:\s*false,\s*data:\s*([^,]+),\s*message:\s*[^}]+\s*}/g,
      'return { success: false, data: $1 }'
    );
    content = content.replace(
      /return\s*{\s*success:\s*false,\s*error:\s*([^,]+),\s*message:\s*[^}]+\s*}/g,
      'return { success: false, error: $1 }'
    );
    
    // Fix string assignments to ApiError type
    content = content.replace(
      /error:\s*['"]([^'"]+)['"]/g,
      'error: createApiError(ErrorCodes.UNKNOWN_ERROR, \'$1\')'
    );
    
    // Fix specific error patterns
    content = content.replace(/createApiError\(ErrorCodes\.UNKNOWN_ERROR, 'Failed to create order'\)/g, 'createApiError(ErrorCodes.ORDER_CREATE_FAILED, \'Failed to create order\')');
    content = content.replace(/createApiError\(ErrorCodes\.UNKNOWN_ERROR, 'Failed to find order'\)/g, 'createApiError(ErrorCodes.ORDER_RETRIEVE_FAILED, \'Failed to find order\')');
    content = content.replace(/createApiError\(ErrorCodes\.UNKNOWN_ERROR, 'Failed to find orders'\)/g, 'createApiError(ErrorCodes.ORDER_SEARCH_FAILED, \'Failed to find orders\')');
    content = content.replace(/createApiError\(ErrorCodes\.UNKNOWN_ERROR, 'Failed to update order'\)/g, 'createApiError(ErrorCodes.ORDER_UPDATE_FAILED, \'Failed to update order\')');
    content = content.replace(/createApiError\(ErrorCodes\.UNKNOWN_ERROR, 'Failed to delete order'\)/g, 'createApiError(ErrorCodes.ORDER_DELETE_FAILED, \'Failed to delete order\')');
    content = content.replace(/createApiError\(ErrorCodes\.UNKNOWN_ERROR, 'Order not found'\)/g, 'createApiError(ErrorCodes.ORDER_NOT_FOUND, \'Order not found\')');
    
    content = content.replace(/createApiError\(ErrorCodes\.UNKNOWN_ERROR, 'Failed to create vendor'\)/g, 'createApiError(ErrorCodes.VENDOR_CREATE_FAILED, \'Failed to create vendor\')');
    content = content.replace(/createApiError\(ErrorCodes\.UNKNOWN_ERROR, 'Failed to find vendor'\)/g, 'createApiError(ErrorCodes.VENDOR_RETRIEVE_FAILED, \'Failed to find vendor\')');
    content = content.replace(/createApiError\(ErrorCodes\.UNKNOWN_ERROR, 'Failed to find vendors'\)/g, 'createApiError(ErrorCodes.VENDOR_SEARCH_FAILED, \'Failed to find vendors\')');
    content = content.replace(/createApiError\(ErrorCodes\.UNKNOWN_ERROR, 'Failed to update vendor'\)/g, 'createApiError(ErrorCodes.VENDOR_UPDATE_FAILED, \'Failed to update vendor\')');
    content = content.replace(/createApiError\(ErrorCodes\.UNKNOWN_ERROR, 'Failed to delete vendor'\)/g, 'createApiError(ErrorCodes.VENDOR_DELETE_FAILED, \'Failed to delete vendor\')');
    content = content.replace(/createApiError\(ErrorCodes\.UNKNOWN_ERROR, 'Vendor not found'\)/g, 'createApiError(ErrorCodes.VENDOR_NOT_FOUND, \'Vendor not found\')');
    
    content = content.replace(/createApiError\(ErrorCodes\.UNKNOWN_ERROR, 'Failed to create property'\)/g, 'createApiError(ErrorCodes.PROPERTY_CREATE_FAILED, \'Failed to create property\')');
    content = content.replace(/createApiError\(ErrorCodes\.UNKNOWN_ERROR, 'Failed to find property'\)/g, 'createApiError(ErrorCodes.PROPERTY_RETRIEVE_FAILED, \'Failed to find property\')');
    content = content.replace(/createApiError\(ErrorCodes\.UNKNOWN_ERROR, 'Failed to find properties'\)/g, 'createApiError(ErrorCodes.PROPERTY_SEARCH_FAILED, \'Failed to find properties\')');
    content = content.replace(/createApiError\(ErrorCodes\.UNKNOWN_ERROR, 'Property not found'\)/g, 'createApiError(ErrorCodes.PROPERTY_NOT_FOUND, \'Property not found\')');
    
    if (content !== beforeMessageFix) {
      hasChanges = true;
    }
    
    // Write back if changes were made
    if (hasChanges) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`Fixed: ${filePath}`);
    } else {
      console.log(`No changes needed: ${filePath}`);
    }
  } catch (error) {
    console.error(`Error fixing ${filePath}:`, error.message);
  }
}

// Fix all files
console.log('Starting compilation error fixes...');
filesToFix.forEach(fixFile);
console.log('Compilation error fixes completed.');