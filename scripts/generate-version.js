#!/usr/bin/env node

/**
 * Generate version.ts from package.json (or git tags for dev builds).
 *
 * - Release builds: the release workflow sets package.json to the real version
 *   before running build, so we just use that.
 * - Dev builds: package.json is "0.0.0-dev". We derive the version from git:
 *   exact tag checkout (v2.0.14) → "2.0.14", commits after tag → "2.0.15-dev".
 * - Fallback: if everything fails, the committed src/version.ts is used as-is.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function getVersionFromGit() {
  try {
    const desc = execSync('git describe --tags', { encoding: 'utf8' }).trim();
    // Exact tag (e.g. "v2.0.14") → "2.0.14"
    // After a tag (e.g. "v2.0.15-11-g3acac2d") → "2.0.15-dev"
    const exactMatch = desc.match(/^v?(\d+\.\d+\.\d+)$/);
    if (exactMatch) return exactMatch[1];

    const devMatch = desc.match(/^v?(\d+\.\d+\.\d+)-\d+-g[0-9a-f]+$/);
    if (devMatch) return `${devMatch[1]}-dev`;
  } catch {
    // No git or no tags
  }
  return null;
}

try {
  const packageJsonPath = path.join(__dirname, '..', 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  let version = packageJson.version;

  if (!version || version === '0.0.0-dev') {
    // Dev build — derive from git tag
    const gitVersion = getVersionFromGit();
    if (gitVersion) {
      version = gitVersion;
    } else {
      version = '0.0.0-dev';
    }
  }

  const srcDir = path.join(__dirname, '..', 'src');
  if (!fs.existsSync(srcDir)) {
    throw new Error(`src directory does not exist at ${srcDir}`);
  }

  const versionTs = `/**
 * Version file - DO NOT edit manually
 *
 * This file is auto-generated during build from package.json / git tags.
 * A fallback version is committed to git to ensure builds don't fail
 * if version generation fails.
 */

export const VERSION = "${version}";
`;

  const versionPath = path.join(srcDir, 'version.ts');
  fs.writeFileSync(versionPath, versionTs, 'utf8');

  const writtenContent = fs.readFileSync(versionPath, 'utf8');
  if (!writtenContent.includes(`VERSION = "${version}"`)) {
    throw new Error('Verification failed: written content does not match expected version');
  }

  console.log(`✓ Generated src/version.ts with version ${version}`);
} catch (error) {
  console.error(`⚠ Warning: Failed to generate version file`);
  console.error(`  ${error.message}`);
  console.error(`  Using fallback version from committed src/version.ts`);
}
