#!/usr/bin/env node

/**
 * TypeScript Compilation Error Fix Script
 * Automatically fixes common TypeScript compilation errors across the codebase
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

const sourceDir = './src';

// Common error patterns and their fixes
const fixes = [
  // Fix ApiError objects missing timestamp
  {
    pattern: /error:\s*{\s*code:\s*['"]([^'"]+)['"],\s*message:\s*([^}]+)\s*}/gm,
    replacement: 'error: createApiError(\'$1\', $2)'
  },
  
  // Fix ApiResponse objects with invalid message property
  {
    pattern: /return\s*{\s*success:\s*true,\s*data:\s*([^,]+),\s*message:\s*[^}]+\s*}/gm,
    replacement: 'return { success: true, data: $1 }'
  },
  
  // Fix string assignments to ApiError type
  {
    pattern: /error:\s*['"]([^'"]+)['"]/gm,
    replacement: 'error: createApiError(ErrorCodes.UNKNOWN_ERROR, \'$1\')'
  },
  
  // Add required imports for error handling
  {
    pattern: /(import.*from\s*['"][^'"]*types[^'"]*['"];\s*)/,
    replacement: '$1import { createApiError, ErrorCodes } from \'../utils/api-response.util.js\';\n'
  }
];

function walkDirectory(dir, callback) {
  const files = readdirSync(dir);
  
  for (const file of files) {
    const filePath = join(dir, file);
    const stat = statSync(filePath);
    
    if (stat.isDirectory()) {
      walkDirectory(filePath, callback);
    } else if (extname(file) === '.ts' && !file.endsWith('.d.ts')) {
      callback(filePath);
    }
  }
}

function fixFile(filePath) {
  try {
    let content = readFileSync(filePath, 'utf8');
    let hasChanges = false;
    
    // Apply fixes
    for (const fix of fixes) {
      const originalContent = content;
      content = content.replace(fix.pattern, fix.replacement);
      if (content !== originalContent) {
        hasChanges = true;
      }
    }
    
    // Write back if changes were made
    if (hasChanges) {
      writeFileSync(filePath, content, 'utf8');
      console.log(`Fixed: ${filePath}`);
    }
  } catch (error) {
    console.error(`Error fixing ${filePath}:`, error.message);
  }
}

// Main execution
console.log('Starting TypeScript compilation error fixes...');

walkDirectory(sourceDir, fixFile);

console.log('Compilation error fixes completed.');