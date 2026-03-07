# Bug Report: `/pdf/path-group/clipping/clear` rejects first page group with `pageIndex: 0`

## Summary
`clearPathGroupClipping` fails for path groups created on the first page when the request uses `pageIndex: 0`.

The endpoint responds with:

`API request failed: Page number must be >= 1 (1-based indexing)`

This is inconsistent with existing path-group APIs in the same backend flow (`/pdf/path-group/create`, `/pdf/path-group/move`, `/pdf/path-group/transform`, `/pdf/path-group/remove`), which all operate with 0-based `pageIndex` and work correctly from the TypeScript client.

## Environment
- API image: `ghcr.io/menschmachine/pdfdancer-api:pr-66`
- SDK repo: `pdfdancer-client-typescript`
- Test fixture: `fixtures/basic-paths.pdf`
- Date: 2026-03-07

## Reproduction
1. Start API server from `pr-66`.
2. Open `fixtures/basic-paths.pdf`.
3. Create a path group on page 1 (`pageIndex` 0 internally).
4. Call `group.clearClipping()`.

Implemented failing test:
- `src/__tests__/e2e/clear-clipping.test.ts`
- test case: `clear clipping on path group keeps group transformable`

Command used:

```bash
PDFDANCER_BASE_URL=http://localhost:8080 PDFDANCER_API_TOKEN=<anon-token> \
npm run test:e2e -- --runInBand src/__tests__/e2e/clear-clipping.test.ts
```

## Actual Result
Request to `PUT /pdf/path-group/clipping/clear` fails with:

- HTTP error surfaced as `HttpClientException`
- Message: `Page number must be >= 1 (1-based indexing)`

## Expected Result
The endpoint should accept the same page indexing convention used by the rest of path-group operations in this API flow (0-based `pageIndex`), or the contract should be made consistent across all path-group endpoints.

## Impact
- `PathGroupObject.clearClipping()` cannot be used reliably on page 1 with current SDK indexing conventions.
- Breaks parity with the other path-group operations and blocks full rollout of clear-clipping support for path groups.

## Notes
- OpenAPI served by this image documents the request as `ClearPathGroupClippingRequest` with `pageIndex` + `groupId` for `PUT /pdf/path-group/clipping/clear`.
- The observed runtime validation error indicates the endpoint currently enforces 1-based page numbering for this specific operation.
