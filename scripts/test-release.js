#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const packageJsonPath = path.join(__dirname, '..', 'package.json');

function run(command, description) {
  console.log(`\n🔧 ${description}...`);
  try {
    execSync(command, { stdio: 'inherit' });
    console.log(`✅ ${description} completed`);
  } catch (error) {
    console.error(`❌ ${description} failed`);
    process.exit(1);
  }
}

function getCurrentVersion() {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  return packageJson.version;
}

function main() {
  console.log('🧪 Testing release process (dry run)...\n');

  // Check working directory status
  try {
    execSync('git diff-index --quiet HEAD --', { stdio: 'pipe' });
    console.log('✅ Working directory is clean');
  } catch (error) {
    console.log('⚠️  Working directory has changes (this would block real release)');
  }

  // Run unit tests only (e2e tests have external dependencies)
  run('npm run test:unit', 'Running unit tests');

  // Run linting
  run('npm run lint', 'Running linter');

  // Build the project
  run('npm run build', 'Building project');

  // Simulate version check
  const currentVersion = getCurrentVersion();
  console.log(`\n📋 Current version: ${currentVersion}`);
  console.log('✅ Release script validation complete');

  console.log('\n🎯 To run actual release:');
  console.log('  npm run release');
  console.log('\nNote: Make sure working directory is clean before running actual release');
}

if (require.main === module) {
  main();
}

module.exports = { main };