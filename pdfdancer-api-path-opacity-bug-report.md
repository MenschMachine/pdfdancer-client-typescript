# `pdfdancer-api` bug: `PUT /pdf/modify/path` preserves fill alpha but drops stroke alpha

## Summary

`MenschMachine/pdfdancer-api` PR `#64` adds `PUT /pdf/modify/path` and accepts `Color` objects with `alpha` in both `strokeColor` and `fillColor`.

The TypeScript SDK propagation work added an e2e regression for that contract. Against the approved PR image, RGB updates round-trip correctly, fill alpha round-trips correctly, but stroke alpha is lost. The saved PDF writes `/ca` for fill opacity and keeps `/CA` at `1.0` for the same path.

This is an upstream server/backend issue, not a client parsing issue.

## Environment

- API PR: `MenschMachine/pdfdancer-api#64`
- Tested image: `ghcr.io/menschmachine/pdfdancer-api:pr-64`
- Date tested: `2026-03-21`
- Base URL used: `http://localhost:18080`
- Auth token: `PDFDANCER_API_TOKEN=42`
- Downstream test: `src/__tests__/e2e/path.test.ts`

## Reproduction

1. Start the PR image:

```bash
docker run \
  -e PDFDANCER_API_KEY_ENCRYPTION_SECRET="$(openssl rand -hex 16)" \
  -e FONTS_DIR=/tmp/fonts \
  -e METRICS_ENABLED=false \
  -e SWAGGER_ENABLED=true \
  -v /tmp/fonts:/home/app/fonts \
  --rm \
  -p 28080:8080 \
  ghcr.io/menschmachine/pdfdancer-api:pr-64
```

2. Run the focused TypeScript e2e:

```bash
PDFDANCER_BASE_URL=http://localhost:18080 \
PDFDANCER_API_TOKEN=42 \
npm test -- --selectProjects e2e --runInBand -t "change path colors preserves stroke and fill alpha" src/__tests__/e2e/path.test.ts
```

3. The test performs:

```ts
const path = (await pdf.selectPaths()).find(item => item.internalId === 'PATH_0_000003');
const stroke = new Color(255, 0, 0, 128);
const fill = new Color(0, 0, 255, 64);

const result = await path!.edit()
    .strokeColor(stroke)
    .fillColor(fill)
    .apply();
```

## Expected

- Stroke color becomes red with stroke opacity `128 / 255 ~= 0.50196`
- Fill color becomes blue with fill opacity `64 / 255 ~= 0.25098`
- The written PDF should reflect both opacity values in the path graphics state:
  - stroke alpha in `/CA`
  - fill alpha in `/ca`

## Actual

- Stroke RGB persists.
- Fill RGB persists.
- Fill alpha persists.
- Stroke alpha is reset to `1.0`.

Focused test failure:

```text
FAIL e2e src/__tests__/e2e/path.test.ts
  Path E2E Tests (New API)
    ✕ change path colors preserves stroke and fill alpha

  expect(received).toBeLessThanOrEqual(expected)

  Expected: <= 0.01
  Received:    0.4980392156862745
```

That delta is `abs(1.0 - 128/255)`, which means the saved PDF stroke opacity is still fully opaque.

## PDF-Level Evidence

The generated PDF from the failing test was saved at:

```text
/tmp/path-opacity-repro.pdf
```

After decompressing with `mutool clean -d /tmp/path-opacity-repro.pdf /tmp/path-opacity-repro-uncompressed.pdf`, the relevant objects are:

```pdf
16 0 obj
<<
  /gs1 17 0 R
  /gs2 18 0 R
  /gs3 19 0 R
  /gs4 20 0 R
  /gs5 21 0 R
  /gs6 22 0 R
  /gs7 23 0 R
  /gs8 24 0 R
  /gs9 25 0 R
>>
endobj

19 0 obj
<<
  /Type /ExtGState
  /ca .2509804
  /CA 1
>>
endobj
```

And the modified path content stream contains:

```pdf
q
0 0 1 rg
1 0 0 RG
/gs3 gs
80 580 m
200 580 l
200 640 l
80 640 l
80 580 l
h
2 w
0 j
10 M
B
Q
```

This shows:

- fill RGB is blue: `0 0 1 rg`
- stroke RGB is red: `1 0 0 RG`
- the path uses `/gs3`
- `/gs3` resolves to an `ExtGState` with fill opacity `/ca .2509804`
- the same state leaves stroke opacity at `/CA 1`

So the server is partially applying alpha: fill alpha is written, stroke alpha is not.

## Why This Is Upstream

The downstream SDK sends both alpha values and the parser now resolves `/ExtGState` through `/Resources` correctly, including inherited page-tree resources.

The failing assertion is reading the actual emitted PDF state, and that emitted state contains:

- correct RGB for both stroke and fill
- correct fill alpha
- incorrect stroke alpha

There is no downstream workaround here without masking a server contract failure.

## Likely Cause

The new path color modification flow appears to update:

- stroke color channel values
- fill color channel values
- fill transparency graphics state

but does not propagate stroke transparency into the written graphics state, or it overwrites/rebuilds the `ExtGState` with `/CA` defaulted to `1`.

Based on the PR diff, the likely area is the backend path color application in:

- `ModifyPathCommand`
- `ModelConverter.applyPathColors(...)`
- any lower-level backend writer invoked by `applyPathColors(...)`

## Requested Fix

When `strokeColor.alpha` is present in `ModifyPathRequest`, the API should persist it to the path graphics state as stroke opacity (`/CA`), alongside fill opacity (`/ca`) when `fillColor.alpha` is present.

The resulting saved PDF for the reproduction above should contain an `ExtGState` equivalent to:

```pdf
<<
  /Type /ExtGState
  /ca .2509804
  /CA .5019608
>>
```

## Downstream Status

- The TypeScript SDK keeps the failing regression test in place.
- No client-side workaround was added.
- On `2026-03-21`, the full `src/__tests__/e2e/path.test.ts` suite was rerun against the PR image at `http://localhost:18080`: 12 tests passed and only `change path colors preserves stroke and fill alpha` failed.
- On `2026-03-21`, `npm test -- --runInBand --selectProjects unit` passed (`5/5` suites, `54/54` tests).
- On `2026-03-21`, `npm run build` passed.
