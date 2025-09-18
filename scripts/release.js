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

function bumpVersion() {
  console.log('\n📦 Bumping version...');
  const currentVersion = getCurrentVersion();
  console.log(`Current version: ${currentVersion}`);

  execSync('npm version patch', { stdio: 'inherit' });

  const newVersion = getCurrentVersion();
  console.log(`New version: ${newVersion}`);
  return newVersion;
}

function main() {
  const args = process.argv.slice(2);
  const skipTests = args.includes('--skip-tests');

  console.log('🚀 Starting release process...\n');

  // Ensure we're on a clean working directory
  try {
    execSync('git diff-index --quiet HEAD --', { stdio: 'pipe' });
  } catch (error) {
    console.error('❌ Working directory is not clean. Please commit or stash your changes.');
    process.exit(1);
  }

  // Run tests (unless skipped)
  if (!skipTests) {
    run('npm run test:unit', 'Running unit tests');
  } else {
    console.log('⚠️  Skipping tests as requested');
  }

  // Run linting
  run('npm run lint', 'Running linter');

  // Build the project
  run('npm run build', 'Building project');

  // Get current version for confirmation
  const currentVersion = getCurrentVersion();
  console.log(`\n📋 About to release version ${currentVersion}`);
  console.log('This will:');
  console.log('  1. Publish to npm');
  console.log('  2. Bump the version number');
  console.log('  3. Create a git tag');
  console.log('  4. Push changes to git');

  // Publish to npm
  run('npm publish', 'Publishing to npm');

  // Bump version and create git tag
  const newVersion = bumpVersion();

  // Push changes and tags to git
  run('git push', 'Pushing changes to git');
  run('git push --tags', 'Pushing tags to git');

  console.log(`\n🎉 Release ${newVersion} completed successfully!`);
  console.log(`Package is now available at: https://www.npmjs.com/package/pdfdancer-client-typescript`);
}

if (require.main === module) {
  main();
}

module.exports = { main };
