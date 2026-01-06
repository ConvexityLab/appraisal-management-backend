#!/usr/bin/env node
/**
 * Setup GitHub Environment Secrets from .env file
 * 
 * This script reads your local .env file and sets GitHub environment-specific secrets
 * for use in CI/CD pipelines. Supports dev, staging, and prod environments.
 * 
 * Usage: 
 *   node scripts/setup-github-secrets.js --environment dev
 *   node scripts/setup-github-secrets.js --environment staging
 *   node scripts/setup-github-secrets.js --environment prod
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

function setGitHubSecret(name, value, environment, repo = 'ConvexityLab/appraisal-management-backend') {
  try {
    const command = `gh secret set ${name} --repo ${repo} --env ${environment}`;
    execSync(command, {
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
  // Parse command line arguments
  const args = process.argv.slice(2);
  const envIndex = args.indexOf('--environment');
  
  if (envIndex === -1 || !args[envIndex + 1]) {
    log('❌ Missing required --environment argument', colors.red);
    log('Usage: node scripts/setup-github-secrets.js --environment <dev|staging|prod>', colors.yellow);
    process.exit(1);
  }
  
  const targetEnvironment = args[envIndex + 1];
  const validEnvironments = ['dev', 'staging', 'prod'];
  
  if (!validEnvironments.includes(targetEnvironment)) {
    log(`❌ Invalid environment: ${targetEnvironment}`, colors.red);
    log(`Valid environments: ${validEnvironments.join(', ')}`, colors.yellow);
    process.exit(1);
  }
  
  log(`🔐 Setting up GitHub Secrets for ${targetEnvironment} environment...`, colors.cyan);
  
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
  cons`\n🔑 Setting GitHub Secrets for ${targetEnvironment} environment...`, colors.cyan);
  
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
      setGitHubSecret(secretName, secretValue, targetEnvironment);
      log(`✅ Set ${secretName} for ${targetEnvironment
  
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
    log(`\n🎉 GitHub Secrets configured successfully for ${targetEnvironment}!`, colors.green);
    log(`Next: Deploy to ${targetEnvironment} and it will automatically use these secrets.`, colors.cyan);
    log('\n💡 Tip: Run this script for each environment with different .env values:', colors.cyan);
    log('  node scripts/setup-github-secrets.js --environment dev', colors.yellow);
    log('  node scripts/setup-github-secrets.js --environment staging', colors.yellow);
    log('  node scripts/setup-github-secrets.js --environment prod', colors.yellow);
  } else {
    log('\n⚠️  No secrets were set. Check your .env file.', colors.yellow);
  }
}

// Run the script
main().catch(error => {
  log(`\n❌ Fatal error: ${error.message}`, colors.red);
  process.exit(1);
});
