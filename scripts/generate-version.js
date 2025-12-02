#!/usr/bin/env node

/**
 * Generate version.ts from package.json
 * This script reads the version from package.json and generates a TypeScript file
 * that exports the version constant. This ensures the version is always in sync
 * across the codebase.
 *
 * If generation fails, the fallback version committed in git will be used.
 */

const fs = require('fs');
const path = require('path');

try {
  // Read package.json
  const packageJsonPath = path.join(__dirname, '..', 'package.json');
  const packageJsonContent = fs.readFileSync(packageJsonPath, 'utf8');
  const packageJson = JSON.parse(packageJsonContent);
  const version = packageJson.version;

  if (!version) {
    throw new Error('Version field not found in package.json');
  }

  // Validate version format (basic check)
  if (typeof version !== 'string' || version.trim() === '') {
    throw new Error(`Invalid version in package.json: "${version}"`);
  }

  // Ensure src directory exists
  const srcDir = path.join(__dirname, '..', 'src');
  if (!fs.existsSync(srcDir)) {
    throw new Error(`src directory does not exist at ${srcDir}`);
  }

  // Generate version.ts content
  const versionTs = `/**
 * Version file - DO NOT edit manually
 *
 * This file is auto-generated during build from package.json.
 * A fallback version is committed to git to ensure builds don't fail
 * if version generation fails.
 */

export const VERSION = "${version}";
`;

  const versionPath = path.join(srcDir, 'version.ts');

  // Write the file
  fs.writeFileSync(versionPath, versionTs, 'utf8');

  // Verify the file was written correctly
  const writtenContent = fs.readFileSync(versionPath, 'utf8');
  if (!writtenContent.includes(`VERSION = "${version}"`)) {
    throw new Error('Verification failed: written content does not match expected version');
  }

  console.log(`✓ Generated src/version.ts with version ${version}`);
} catch (error) {
  console.error(`⚠ Warning: Failed to generate version file from package.json`);
  console.error(`  ${error.message}`);
  console.error(`  Using fallback version from committed src/version.ts`);
  console.error(`  (If this persists, check that package.json is valid and src/ directory exists)`);
  // Don't exit with error - let the fallback version be used
  // The fallback version.ts is committed to git with "0.0.0-development" marker
}
