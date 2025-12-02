#!/usr/bin/env node

/**
 * Generate version.ts from package.json
 * This script reads the version from package.json and generates a TypeScript file
 * that exports the version constant. This ensures the version is always in sync
 * across the codebase.
 */

const fs = require('fs');
const path = require('path');

try {
  // Read package.json
  const packageJsonPath = path.join(__dirname, '..', 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const version = packageJson.version;

  if (!version) {
    throw new Error('Version not found in package.json');
  }

  // Generate version.ts
  const versionTs = `/**
 * Auto-generated version file
 * This file is generated during build from package.json
 * DO NOT edit manually
 */

export const VERSION = "${version}";
`;

  const versionPath = path.join(__dirname, '..', 'src', 'version.ts');
  fs.writeFileSync(versionPath, versionTs, 'utf8');

  console.log(`✓ Generated src/version.ts with version ${version}`);
} catch (error) {
  console.error('Error generating version file:', error.message);
  process.exit(1);
}
