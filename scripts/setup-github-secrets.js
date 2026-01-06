#!/usr/bin/env node
/**
 * Setup GitHub Secrets from .env file
 * 
 * This script reads your local .env file and sets GitHub repository secrets
 * for use in CI/CD pipelines.
 * 
 * Usage: node scripts/setup-github-secrets.js
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function parseEnvFile(filePath) {
  const envVars = {};
  const content = fs.readFileSync(filePath, 'utf-8');
  
  content.split('\n').forEach(line => {
    const trimmed = line.trim();
    
    // Skip comments and empty lines
    if (!trimmed || trimmed.startsWith('#')) {
      return;
    }
    
    // Parse key=value
    const match = trimmed.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim();
      envVars[key] = value;
    }
  });
  
  return envVars;
}

function checkGhCli() {
  try {
    const version = execSync('gh --version', { encoding: 'utf-8' });
    log(`✅ GitHub CLI found: ${version.split('\n')[0]}`, colors.green);
    return true;
  } catch (error) {
    log('❌ GitHub CLI not installed. Install from: https://cli.github.com/', colors.red);
    return false;
  }
}

function setGitHubSecret(name, value, repo = 'ConvexityLab/appraisal-management-backend') {
  try {
    execSync(`gh secret set ${name} --repo ${repo}`, {
      input: value,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    return true;
  } catch (error) {
    throw new Error(error.message);
  }
}

function isPlaceholderValue(value) {
  return !value || 
         value.includes('your-') || 
         value.includes('REPLACE') ||
         value === '=' ||
         value.length === 0;
}

async function main() {
  log('🔐 Setting up GitHub Secrets from .env file...', colors.cyan);
  
  // Check if .env exists
  const envPath = path.join(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) {
    log('❌ .env file not found. Please create one first.', colors.red);
    process.exit(1);
  }
  
  // Check if gh CLI is installed
  if (!checkGhCli()) {
    process.exit(1);
  }
  
  // Parse .env file
  log('\n📖 Reading .env file...', colors.cyan);
  const envVars = parseEnvFile(envPath);
  log(`✅ Found ${Object.keys(envVars).length} environment variables`, colors.green);
  
  // Map of .env keys to GitHub Secret names
  const secretMap = {
    'GOOGLE_MAPS_API_KEY': 'GOOGLE_MAPS_API_KEY',
    'AZURE_OPENAI_API_KEY': 'AZURE_OPENAI_API_KEY',
    'AZURE_OPENAI_ENDPOINT': 'AZURE_OPENAI_ENDPOINT',
    'GOOGLE_GEMINI_API_KEY': 'GOOGLE_GEMINI_API_KEY',
    'CENSUS_API_KEY': 'CENSUS_API_KEY',
    'BRIDGE_SERVER_TOKEN': 'BRIDGE_SERVER_TOKEN',
    'NPS_API_KEY': 'NPS_API_KEY',
    'SAMBANOVA_API_KEY': 'SAMBANOVA_API_KEY',
    'AZURE_COMMUNICATION_API_KEY': 'AZURE_COMMUNICATION_API_KEY',
    'AZURE_TENANT_ID': 'AZURE_TENANT_ID',
    'AZURE_CLIENT_ID': 'AZURE_CLIENT_ID',
    'AZURE_CLIENT_SECRET': 'AZURE_CLIENT_SECRET'
  };
  
  log('\n🔑 Setting GitHub Secrets...', colors.cyan);
  
  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;
  
  for (const [envKey, secretName] of Object.entries(secretMap)) {
    const secretValue = envVars[envKey];
    
    if (isPlaceholderValue(secretValue)) {
      log(`⏭️  Skipping ${secretName} (no value or placeholder)`, colors.yellow);
      skipCount++;
      continue;
    }
    
    try {
      setGitHubSecret(secretName, secretValue);
      log(`✅ Set ${secretName}`, colors.green);
      successCount++;
    } catch (error) {
      log(`❌ Failed to set ${secretName}: ${error.message}`, colors.red);
      errorCount++;
    }
  }
  
  // Summary
  log('\n📊 Summary:', colors.cyan);
  log(`  ✅ Secrets set: ${successCount}`, colors.green);
  log(`  ⏭️  Skipped: ${skipCount}`, colors.yellow);
  log(`  ❌ Errors: ${errorCount}`, colors.red);
  
  if (successCount > 0) {
    log('\n🎉 GitHub Secrets configured successfully!', colors.green);
    log('Next: Push changes and deploy will automatically use these secrets.', colors.cyan);
  } else {
    log('\n⚠️  No secrets were set. Check your .env file.', colors.yellow);
  }
}

// Run the script
main().catch(error => {
  log(`\n❌ Fatal error: ${error.message}`, colors.red);
  process.exit(1);
});
