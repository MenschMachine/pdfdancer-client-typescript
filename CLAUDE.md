# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

PDFDancer TypeScript Client — SDK for the PDFDancer PDF manipulation API. Session-based REST client for locating and modifying PDF elements (text, images, form fields, paths) with pixel-perfect positioning. Works in Node.js and browser.

## Commands

```bash
npm run build          # generate version.ts + compile TypeScript to dist/
npm run lint           # eslint src/
npm test               # all tests (unit + e2e)
npm run test:unit      # unit tests only (no external deps)
npm run test:e2e       # e2e tests (requires server + fixtures + token)
npm run test:watch     # jest watch mode

# Single test file
npm test -- src/__tests__/e2e/line.test.ts

# Single test by name
npm test -- --testNamePattern="find lines by text"
```

## Rules

- Always run the linter (`npm run lint`) before considering work done.
- Always run the tests you produce.
- Use `log.debug` for debug logging.
- Keep solutions simple.

## E2E Test Requirements

E2E tests need three things:
1. PDFDancer server running (env `PDFDANCER_BASE_URL`, defaults to `http://localhost:8080`)
2. Auth token (env `PDFDANCER_API_TOKEN`, or legacy `PDFDANCER_TOKEN`, or `jwt-token-*.txt` file in project root)
3. PDF fixtures in `fixtures/` (e.g. `ObviouslyAwesome.pdf`, `mixed-form-types.pdf`, `basic-paths.pdf`, `logo-80.png`, `DancingScript-Regular.ttf`)

Test timeout is 120s per test. E2E helpers are in `src/__tests__/e2e/test-helpers.ts`.

## Architecture

### Core Files
- `src/pdfdancer_v1.ts` — Main client class (`PDFDancer`). Session-based: opens a PDF, performs operations, saves/downloads.
- `src/types.ts` — Object classes returned by selectors (`ParagraphObject`, `TextLineObject`, `ImageObject`, etc.)
- `src/models.ts` — Data models (`Position`, `Color`, `Font`, `BoundingRect`, `ObjectRef`, `TextObjectRef`, enums)
- `src/exceptions.ts` — Exception hierarchy: `PdfDancerException` → `HttpClientException`, `SessionException`, `ValidationException`, `FontNotFoundException`

### Builders (fluent/chainable, call `.apply()` / `.add()` / `.draw()` / `.build()` to finalize)
- `paragraph-builder.ts` — Create/edit paragraphs
- `replacement-builder.ts` — Text replacement operations
- `page-builder.ts` — Page operations
- `path-builder.ts` — Vector paths
- `image-builder.ts` — Image operations

### Key Patterns
- **Session-based**: `PDFDancer.open()` creates an HTTP session; all operations happen within it
- **Builder pattern**: All builders are chainable, finalized with a terminal method
- **Typed object references**: Selectors return strongly-typed objects (`ParagraphObject`, `TextLineObject`, etc.) with `.edit()`, `.delete()`, `.moveTo()`, `.redact()` methods
- **Position system**: `Position.atPageCoordinates()`, `Position.atPage()`, `Position.byName()` with tolerance for fuzzy matching
- **Retry mechanism**: Configurable via `RetryConfig` — exponential backoff, retries on 429/502/503/504, respects `Retry-After` header

### Tests
- Unit tests: `src/__tests__/*.test.ts` — mock-based, no external dependencies
- E2E tests: `src/__tests__/e2e/*.test.ts` — require running server + fixtures
- Custom assertions in `src/__tests__/e2e/pdf-assertions.ts`
- Jest config uses two projects (`unit`, `e2e`) selectable with `--selectProjects`

### Version Management
- `src/version.ts` is auto-generated from `package.json` version during `npm run build`
- Release via tag push: `git tag v1.2.3 && git push origin v1.2.3`
- GitHub Actions handles lint, test, build, and npm publish automatically
- Uses npm Trusted Publishing (OIDC) — no NPM_TOKEN needed, configure trusted publisher on npmjs.com
- Requires `PDFDANCER_BASE_URL` and `PDFDANCER_API_TOKEN` secrets in repo settings for E2E tests
