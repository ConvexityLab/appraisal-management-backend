#!/usr/bin/env node

/**
 * Production Readiness Validation Script
 * 
 * This script validates that the codebase is ready for production deployment
 * by checking for common anti-patterns, security issues, and configuration problems.
 */

const fs = require('fs');
const path = require('path');

class ProductionValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.info = [];
    this.srcDir = path.join(__dirname, '..', 'src');
  }

  log(level, message, file = null) {
    const entry = { message, file, timestamp: new Date().toISOString() };
    this[level].push(entry);
    
    const color = {
      errors: '\x1b[31m', // Red
      warnings: '\x1b[33m', // Yellow  
      info: '\x1b[36m' // Cyan
    };
    
    console.log(`${color[level]}[${level.toUpperCase()}]${file ? ` ${file}:` : ''} ${message}\x1b[0m`);
  }

  async validateFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const relativePath = path.relative(this.srcDir, filePath);

    // Check for hardcoded secrets/keys
    const secretPatterns = [
      /jwt[_-]?secret['"]\s*:\s*['"][^'"]{1,20}['"]/i,
      /['"]your[_-]?secret[_-]?key['"]/i,
      /['"]demo[_-]?secret['"]/i,
      /['"]default[_-]?dev[_-]?secret['"]/i,
      /['"]test[_-]?secret['"]/i
    ];

    secretPatterns.forEach(pattern => {
      if (pattern.test(content)) {
        this.log('errors', `Hardcoded secret detected: ${pattern}`, relativePath);
      }
    });

    // Check for console logging in production files
    if (relativePath.includes('api/') && /console\.(log|error|warn|info)/.test(content)) {
      const matches = content.match(/console\.(log|error|warn|info)/g);
      this.log('warnings', `Console logging detected (${matches?.length || 0} instances)`, relativePath);
    }

    // Check for hardcoded ports/URLs
    const hardcodedPatterns = [
      /constructor.*port\s*=\s*3000\s*\)/,
      /http:\/\/localhost:3000/,
      /port.*=.*3000/
    ];

    hardcodedPatterns.forEach(pattern => {
      if (pattern.test(content)) {
        this.log('warnings', `Hardcoded port/URL detected`, relativePath);
      }
    });

    // Check for missing environment variable validation
    const envVarPattern = /process\.env\.([A-Z_]+)\s*\|\|\s*['"][^'"]+['"]/g;
    let match;
    while ((match = envVarPattern.exec(content)) !== null) {
      const envVar = match[1];
      if (['JWT_SECRET', 'AZURE_COSMOS_KEY', 'GOOGLE_MAPS_API_KEY'].includes(envVar)) {
        this.log('warnings', `Environment variable ${envVar} has fallback value`, relativePath);
      }
    }

    // Check for proper error handling
    const errorHandlingPatterns = [
      /catch\s*\([^)]*\)\s*\{\s*\}/,  // Empty catch blocks
      /throw new Error\(.*\)\s*;?\s*$/m // Generic error throwing
    ];

    errorHandlingPatterns.forEach(pattern => {
      if (pattern.test(content)) {
        this.log('warnings', `Potential error handling issue detected`, relativePath);
      }
    });

    // Positive checks - look for good practices
    if (/import.*Logger.*from/.test(content)) {
      this.log('info', `Logger properly imported`, relativePath);
    }

    if (/process\.env\.[A-Z_]+\s*\?\s*/.test(content)) {
      this.log('info', `Environment variable validation detected`, relativePath);
    }
  }

  async validateDirectory(dir) {
    const files = fs.readdirSync(dir);
    
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory() && !file.includes('node_modules') && !file.includes('.git')) {
        await this.validateDirectory(filePath);
      } else if (file.endsWith('.ts') || file.endsWith('.js')) {
        await this.validateFile(filePath);
      }
    }
  }

  checkEnvironmentTemplate() {
    const envExamplePath = path.join(__dirname, '..', '.env.example');
    const envTemplatePath = path.join(__dirname, '..', '.env.template');
    
    if (!fs.existsSync(envExamplePath) && !fs.existsSync(envTemplatePath)) {
      this.log('errors', 'No .env.example or .env.template file found');
    } else {
      this.log('info', 'Environment template file exists');
    }
  }

  checkDockerConfiguration() {
    const dockerfilePath = path.join(__dirname, '..', 'Dockerfile');
    if (fs.existsSync(dockerfilePath)) {
      const content = fs.readFileSync(dockerfilePath, 'utf8');
      
      if (content.includes('EXPOSE')) {
        this.log('info', 'Dockerfile properly exposes ports');
      } else {
        this.log('warnings', 'Dockerfile may be missing port exposure');
      }
    }
  }

  async validate() {
    console.log('\n🔍 Starting Production Readiness Validation...\n');
    
    try {
      await this.validateDirectory(this.srcDir);
      this.checkEnvironmentTemplate();
      this.checkDockerConfiguration();
      
      console.log('\n📊 VALIDATION SUMMARY:');
      console.log('====================');
      console.log(`❌ Errors: ${this.errors.length}`);
      console.log(`⚠️  Warnings: ${this.warnings.length}`);
      console.log(`ℹ️  Info: ${this.info.length}`);
      
      if (this.errors.length === 0) {
        console.log('\n✅ NO CRITICAL ERRORS FOUND - Ready for production!');
      } else {
        console.log('\n🚨 CRITICAL ERRORS DETECTED - Fix before production deployment!');
      }
      
      // Save detailed report
      const report = {
        timestamp: new Date().toISOString(),
        summary: {
          errors: this.errors.length,
          warnings: this.warnings.length,
          info: this.info.length
        },
        details: {
          errors: this.errors,
          warnings: this.warnings,
          info: this.info
        }
      };
      
      const reportPath = path.join(__dirname, '..', 'PRODUCTION_READINESS_REPORT.json');
      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
      console.log(`\n📄 Detailed report saved to: ${reportPath}`);
      
      return this.errors.length === 0;
      
    } catch (error) {
      console.error('❌ Validation failed:', error.message);
      return false;
    }
  }
}

// Run validation if called directly
if (require.main === module) {
  const validator = new ProductionValidator();
  validator.validate().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = ProductionValidator;