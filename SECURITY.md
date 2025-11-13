# Security Policy

## Package Signing and Provenance

This package implements multiple layers of security and provenance verification to ensure package integrity and authenticity.

### NPM Provenance

All published packages include **NPM provenance** attestations, which provide:

- **Cryptographic signing**: Packages are automatically signed during the GitHub Actions publishing workflow
- **Build transparency**: Links each published package to the exact source code, build process, and GitHub Actions workflow that produced it
- **Verification**: Users can verify package authenticity using `npm audit signatures`

To verify the provenance of this package:

```bash
npm audit signatures
```

This will display the provenance information, including:
- The GitHub repository and commit that produced the package
- The workflow that built and published it
- Cryptographic signatures validating the package contents

### SLSA Provenance (Level 3)

We use the [SLSA framework](https://slsa.dev/) (Supply-chain Levels for Software Artifacts) to generate verifiable build provenance:

- **SLSA Level 3** attestations are generated for each release
- Provenance artifacts are automatically uploaded to GitHub Releases
- Provides a tamper-proof record of how the package was built

SLSA provenance files are named `<package>-<version>.intoto.jsonl` and can be found attached to each GitHub Release.

#### Verifying SLSA Provenance

To verify the SLSA provenance of a release:

1. Download the provenance file from the GitHub Release
2. Use the [slsa-verifier](https://github.com/slsa-framework/slsa-verifier) tool:

```bash
# Install slsa-verifier
go install github.com/slsa-framework/slsa-verifier/v2/cli/slsa-verifier@latest

# Verify the provenance
slsa-verifier verify-npm-package \
  pdfdancer-client-typescript@<version> \
  --provenance-path <package>-<version>.intoto.jsonl \
  --source-uri github.com/MenschMachine/pdfdancer-client-typescript
```

### OpenSSF Scorecard

We maintain an [OpenSSF Scorecard](https://securityscorecards.dev/) score to demonstrate security best practices:

[![OpenSSF Scorecard](https://api.securityscorecards.dev/projects/github.com/MenschMachine/pdfdancer-client-typescript/badge)](https://securityscorecards.dev/viewer/?uri=github.com/MenschMachine/pdfdancer-client-typescript)

The Scorecard evaluates the project on multiple security criteria including:
- Security policy
- Dependency management
- Code review practices
- Automated testing
- Signed releases
- Branch protection
- And more...

### Publishing Process

Packages are published automatically through GitHub Actions with the following security controls:

1. **Automated CI/CD**: All releases are built and published via GitHub Actions (`.github/workflows/publish.yml`)
2. **No local publishing**: Packages are never published from developer machines
3. **Required tests**: All tests must pass before publishing
4. **Provenance generation**: Automatic generation of NPM provenance and SLSA attestations
5. **Signed commits**: We encourage signed commits from contributors
6. **Protected branches**: The `main` branch is protected and requires pull request reviews

### Package Metadata

The package includes comprehensive metadata for security scanning and verification:

- **Homepage**: Links to the official GitHub repository
- **Repository**: Complete git repository information
- **Author**: The Famous Cat Ltd.
- **License**: Apache-2.0
- **Bug reports**: GitHub Issues URL
- **Public access**: Explicitly configured for public NPM registry

### Security Vulnerability Reporting

If you discover a security vulnerability in this package, please report it by:

1. **DO NOT** open a public GitHub issue
2. Email security concerns to: [security contact - to be added]
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

We will respond to security reports within 48 hours and work to release a fix as quickly as possible.

### Supported Versions

We provide security updates for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 1.x     | :white_check_mark: |
| < 1.0   | :x:                |

### Security Best Practices for Users

When using this package:

1. **Verify provenance**: Run `npm audit signatures` after installation
2. **Keep updated**: Regularly update to the latest version to receive security patches
3. **Check dependencies**: Run `npm audit` to check for known vulnerabilities
4. **Review changes**: Check the changelog and release notes before upgrading
5. **Use lock files**: Commit your `package-lock.json` to ensure consistent installations

### GitHub Actions Secrets

The publishing workflow requires the following secrets:

- `NPM_TOKEN`: NPM authentication token with publish permissions

These secrets are managed by repository administrators and are never exposed in logs or published artifacts.

## Additional Resources

- [NPM Provenance Documentation](https://docs.npmjs.com/generating-provenance-statements)
- [SLSA Framework](https://slsa.dev/)
- [OpenSSF Scorecard](https://securityscorecards.dev/)
- [Supply Chain Security Best Practices](https://github.com/ossf/wg-best-practices-os-developers)
