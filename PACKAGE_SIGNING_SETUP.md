# Package Signing and Provenance Setup Guide

This document explains how to set up and maintain package signing and provenance for the PDFDancer TypeScript client.

## Overview

The package uses multiple security and provenance mechanisms:

1. **NPM Provenance** - Automatic cryptographic signing via GitHub Actions
2. **SLSA Provenance** - Supply-chain security attestations (Level 3)
3. **OpenSSF Scorecard** - Security best practices evaluation
4. **Package Metadata** - Comprehensive metadata for security scanners

## Prerequisites

Before you can publish signed packages, ensure:

1. **GitHub Repository Settings**:
   - Repository is public (required for OpenSSF Scorecard)
   - Branch protection is enabled on `main`
   - Actions have write permissions for contents and packages

2. **NPM Account**:
   - Account with publish permissions
   - 2FA enabled (required for provenance)
   - Access token created with automation permissions

3. **Secrets Configuration**:
   - `NPM_TOKEN` secret added to GitHub repository settings
   - Token must have publish permissions and support provenance

## Setup Steps

### 1. Configure NPM Token

1. Log in to [npmjs.com](https://www.npmjs.com/)
2. Navigate to Access Tokens
3. Generate new token:
   - Type: **Automation**
   - Scope: **Read and write**
4. Copy the token
5. Add to GitHub:
   - Go to repository Settings → Secrets and variables → Actions
   - Create new repository secret: `NPM_TOKEN`
   - Paste the token value

### 2. Enable GitHub Actions Permissions

In repository Settings → Actions → General:

1. **Workflow permissions**:
   - Select "Read and write permissions"
   - Enable "Allow GitHub Actions to create and approve pull requests"

2. **Required for**:
   - SLSA provenance generation
   - OpenSSF Scorecard uploads

### 3. Verify Workflows

The repository includes three security-related workflows:

#### `.github/workflows/publish.yml`
- **Triggers**: On release publication or manual workflow dispatch
- **Purpose**: Publishes package with NPM provenance and SLSA attestations
- **Permissions**: Requires `id-token: write` for provenance signing

#### `.github/workflows/scorecard.yml`
- **Triggers**: Weekly on Monday, on push to main, or manual dispatch
- **Purpose**: Runs OpenSSF Scorecard analysis
- **Permissions**: Requires `security-events: write` for SARIF upload

#### `.github/workflows/ci.yml`
- **Triggers**: On push and pull requests
- **Purpose**: Continuous integration testing
- **Security**: Validates code before merge

### 4. Configure Branch Protection

Recommended branch protection rules for `main`:

1. **Require pull request reviews before merging**
   - At least 1 approval required
   - Dismiss stale reviews on new commits

2. **Require status checks to pass**
   - Require `test` or `test-full-matrix` to pass
   - Require branches to be up to date

3. **Require signed commits** (optional but recommended)

4. **Include administrators** (recommended)

## Publishing a Release

### Automated Publishing (Recommended)

1. **Create a release on GitHub**:
   ```bash
   # Tag the release
   git tag v1.0.18
   git push origin v1.0.18
   ```

2. **Create GitHub Release**:
   - Go to Releases → Create new release
   - Choose the tag you just pushed
   - Add release notes
   - Publish release

3. **Automatic workflow execution**:
   - The publish workflow triggers automatically
   - Package is built, tested, and published with provenance
   - SLSA attestations are generated and uploaded to the release

### Manual Publishing (Not Recommended)

If you must publish manually:

```bash
# This will NOT include provenance attestations
npm publish --provenance
```

**Note**: Manual publishing from a local machine will not generate the same level of provenance as GitHub Actions. Always prefer the automated workflow.

## Verifying Published Packages

### Verify NPM Provenance

After publishing, verify the package has provenance:

```bash
npm view pdfdancer-client-typescript@latest

# Look for 'attestations' field in the output
# Should show: { url: '...', provenance: { ... } }
```

Users can verify integrity:

```bash
npm install pdfdancer-client-typescript
npm audit signatures
```

Expected output:
```
audited 1 package in X.Xs

1 package has a verified registry signature
```

### Verify SLSA Provenance

1. Download the provenance file from GitHub Release
2. Install slsa-verifier:
   ```bash
   go install github.com/slsa-framework/slsa-verifier/v2/cli/slsa-verifier@latest
   ```

3. Verify:
   ```bash
   slsa-verifier verify-npm-package \
     pdfdancer-client-typescript@1.0.18 \
     --provenance-path pdfdancer-client-typescript-1.0.18.intoto.jsonl \
     --source-uri github.com/MenschMachine/pdfdancer-client-typescript
   ```

### Check OpenSSF Scorecard

View the latest scorecard at:
https://securityscorecards.dev/viewer/?uri=github.com/MenschMachine/pdfdancer-client-typescript

## Troubleshooting

### Publishing Fails: "Provenance generation failed"

**Cause**: Missing or incorrect permissions for `id-token` in workflow

**Solution**: Ensure publish.yml has:
```yaml
permissions:
  id-token: write
  contents: read
```

### Publishing Fails: "403 Forbidden"

**Cause**: Invalid or expired NPM_TOKEN

**Solution**:
1. Generate new NPM token
2. Update GitHub secret
3. Ensure token has automation permissions

### SLSA Workflow Fails

**Cause**: publish job didn't output package digest

**Solution**: The current workflow template has a placeholder for package digest. Update with:
```yaml
- name: Compute package digest
  id: hash
  run: |
    echo "digest=$(sha256sum dist/*.tgz | base64 -w0)" >> $GITHUB_OUTPUT
```

### Scorecard Score is Low

**Common issues**:
- No branch protection → Enable branch protection on main
- No security policy → SECURITY.md now added
- Unsigned commits → Enable signed commits requirement
- Permissions too broad → Review GitHub Actions permissions

## Maintenance

### Regular Tasks

1. **Weekly**: Review OpenSSF Scorecard results
2. **Per Release**: Verify provenance attestations
3. **Monthly**: Audit dependencies with `npm audit`
4. **Quarterly**: Review and rotate NPM tokens

### Updating Workflows

When updating GitHub Actions workflows:

1. Test in a feature branch first
2. Use `workflow_dispatch` trigger for manual testing
3. Review security implications of permission changes
4. Update this documentation if process changes

## Additional Resources

- [NPM Provenance Documentation](https://docs.npmjs.com/generating-provenance-statements)
- [SLSA Framework](https://slsa.dev/)
- [SLSA GitHub Generator](https://github.com/slsa-framework/slsa-github-generator)
- [OpenSSF Scorecard Checks](https://github.com/ossf/scorecard#scorecard-checks)
- [GitHub Actions Security](https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions)

## Support

For questions about the signing and provenance setup:
- Review SECURITY.md for security reporting
- Open a GitHub issue for setup questions
- Refer to the official documentation links above
