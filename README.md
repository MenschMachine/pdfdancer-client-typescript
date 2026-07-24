# PDFDancer TypeScript client

## Overview

PDFDancer gives Node.js applications pixel-perfect programmatic control over real-world PDFs. The client uses 1-based
page numbers and the same editing model as the Java and Python SDKs.

## Highlights

- Replace, insert, delete, and style text through selector-based operations.
- Select and mutate images, vector paths, form XObjects, form fields, and pages.
- Add images, paths, lines, Bezier curves, and rectangles from document or page scope.
- Save the result to a filesystem path or retrieve it as bytes.

## Installation

```bash
npm install pdfdancer-client-typescript
```

## Requirements

- Node.js 20 or newer.
- A PDFDancer API token, supplied explicitly or through `PDFDANCER_API_TOKEN` or `PDFDANCER_TOKEN`.
- This SDK targets Node.js and accepts a filesystem path, `Uint8Array`, or `ArrayBuffer` as PDF input.

## Quick Start

### Open and Save a PDF

```ts
import fs from 'node:fs';
import {PDFDancer} from 'pdfdancer-client-typescript';

const bytes = new Uint8Array(fs.readFileSync('input.pdf'));
const pdf = await PDFDancer.open(bytes, process.env.PDFDANCER_TOKEN);

// Mutate the document here.

await pdf.save('output.pdf');
```

For local development, pass the v2 service URL as the third argument:

```ts
const pdf = await PDFDancer.open(bytes, token, 'http://localhost:8080');
```

## Create a Blank PDF

```ts
import {Orientation, PDFDancer} from 'pdfdancer-client-typescript';

const pdf = await PDFDancer.new({
  pageSize: 'A4',
  orientation: Orientation.PORTRAIT,
  initialPageCount: 1
});

await pdf.page(1).newImage().fromFile('logo.png').at(420, 710).add();
await pdf.save('summary.pdf');
```

## Page API

Page numbers are 1-based. `pdf.page(1)` returns a page-scoped client, while `await pdf.pages()` returns page clients for
the document. Use `getSnapshot()` on a page client for a read-only page snapshot.

```ts
const firstPage = pdf.page(1);
const pages = await pdf.pages();
const snapshot = await firstPage.getSnapshot();
```

Page-scoped selectors, text editing, and builders automatically restrict the operation to that page.

## Selection

Document- and page-scoped selectors return typed objects for images, paths, form XObjects, and form fields. Position
selectors use PDF coordinates and a default tolerance of `0.01` point. Singular selectors return the first match or
`null`; plural selectors return arrays.

```ts
const documentImages = await pdf.selectImages();
const logo = await pdf.page(1).selectImageAt(72, 680);
const pagePaths = await pdf.page(1).selectPaths();
```

Use document or page snapshots when you need read-only inspection of the complete object vocabulary, including text-line
data.

## Builders and Vector Paths

All five dedicated builders are available at document and page scope: image, path, line, Bezier, and rectangle.

```ts
import {Color} from 'pdfdancer-client-typescript';

await pdf.page(1).newRectangle()
  .at(72, 500)
  .size(220, 80)
  .strokeColor(Color.BLACK)
  .fillColor(new Color(255, 255, 200))
  .add();

await pdf.page(1).newPath()
  .moveTo(72, 450)
  .lineTo(200, 450)
  .bezierTo(230, 450, 230, 390, 260, 390)
  .dashPattern([6, 3])
  .add();
```

`PathBuilder` also provides `closePath()`, `rectangle(...)`, `circle(...)`, and `solid()` conveniences. A circle is a
`PathBuilder` convenience, not a separate builder type.

## Images

Create images at document scope with an explicit page or directly from a page client:

```ts
await pdf.newImage().fromFile('logo.png').at(1, 72, 700).add();
await pdf.page(1).newImage().fromFile('stamp.png').at(300, 700).add();
```

`ImageObject` exposes `width`, `height`, and `aspectRatio`. It supports replacement from a filesystem path or `Image`,
proportional or explicit scaling, cropping, opacity, horizontal and vertical flips, region filling, and rotation.
Positive rotation angles are clockwise. Image transformations return `CommandResult`, which exposes `success`,
`message`, `warning`, and `elementId`.

## Form Fields

Form-field selection uses the same names at document and page scope. Mutate a selected field directly with
`setValue(...)`:

```ts
const signature = (await pdf.selectFormFieldsByName('signature'))[0];
const changed = await signature?.setValue('Signed by Jane Doe');
```

## Text Editing

### Selector-Based Operations

Use the replace, delete, insert, and style builders through `pdf.text()` or a page-scoped text client.

```ts
import {
  PdfColorRequest,
  TextDeleteRequest,
  TextInsertRequest,
  TextLayoutProfile,
  TextReplaceRequest,
  TextStyleRequest
} from 'pdfdancer-client-typescript';

await pdf.text().replace(
  TextReplaceRequest.literal('Old product', 'New product')
    .wholeWords(true)
    .maxMatches(5)
    .requireReflow(TextLayoutProfile.BODY_TEXT)
    .build()
);

await pdf.page(2).text().delete(
  TextDeleteRequest.regex('Confidential\\s+draft')
    .caseSensitive(false)
    .build()
);

await pdf.text().insert(
  TextInsertRequest.before('Terms', 'Updated ')
    .wholeWords(true)
    .build()
);

await pdf.page(1).text().insert(
  TextInsertRequest.at(1, 72, 720, 'Coordinate text')
    .font('Helvetica-Bold')
    .size(12)
    .fillColor(PdfColorRequest.rgb(0.8, 0.1, 0.1))
    .build()
);

await pdf.text().style(
  TextStyleRequest.literal('Important')
    .font('Helvetica-Bold')
    .size(12)
    .fillColor(PdfColorRequest.rgb(1, 0, 0))
    .build()
);
```

Document-scoped `pdf.text()` honors pages supplied by the request builder. Page-scoped `pdf.page(pageNumber).text()` restricts the request to that page.

Each mutation returns a `TextEditResponse` containing match and change counts, changed page numbers, per-change diagnostics, warnings, and errors.

## Shared Models

`Color` requires integral RGBA components in the inclusive range 0–255. Alpha defaults to 255; `BLACK`, `WHITE`, and
`RED` are provided as constants.

Standard page sizes are A0–A6, B4–B5, Letter, Legal, Tabloid, Executive, Postcard, and 3×5 Index.
`pageSizeFromDimensions(...)` recognizes both portrait and rotated standard dimensions; custom dimensions must be finite
and positive.

The exported `ObjectType` enum covers every object type returned by the v2 snapshot and selection APIs.

## Configuration

- The SDK reads `process.env` but does not load `.env` files. Applications that use `.env` files must load them before
  calling the SDK.
- `PDFDANCER_API_TOKEN` is the preferred authentication variable; `PDFDANCER_TOKEN` is also supported.
- `PDFDANCER_BASE_URL` overrides the API host. The default is `https://api.pdfdancer.com`.
- The fourth `PDFDancer.open(...)` or `PDFDancer.new(...)` argument sets the request timeout in milliseconds. The default
  is 30,000 ms.
- The fifth argument accepts `RetryConfig`.

## Retry and Error Handling

The default HTTP policy makes three total attempts, including the initial request. It uses exponential backoff starting
at 1,000 ms, a multiplier of two, and a 5,000 ms delay cap. Statuses 408, 429, 500, 502, 503, 504, and 520 are retryable,
as are configured network and timeout failures. `Retry-After` is honored only for HTTP 429; retry delays do not use
jitter. Configure the policy with `maxAttempts`, `initialDelay`, `backoffMultiplier`, `maxDelay`,
`retryableStatusCodes`, `retryOnNetworkError`, and `respectRetryAfter`.

Failures use the `PdfDancerException` hierarchy: `ValidationException`, `HttpClientException`, `SessionException`,
`SessionNotFoundException`, `FontNotFoundException`, and `RateLimitException`. A rate-limit exception retains a parsed
`retryAfter` value when the response supplies one.

## Development and Testing

```bash
npm run build
npm run test:unit -- --runInBand
npm run test:e2e -- --runInBand
```

E2E tests expect the API at `http://localhost:8080` unless configured otherwise. The text-editing E2E suite saves and reopens mutated PDFs and uses the test-only `pdfjs-dist` dependency through `PDFAssertions` to validate persisted text and fonts.

## Troubleshooting

- For empty selections, inspect `await pdf.getDocumentSnapshot()` or `await pdf.page(n).getSnapshot()` and verify the
  1-based page number and PDF coordinates.
- For E2E failures, verify the API URL, token, and fixture files before changing the client.
- For request failures, inspect the specific `PdfDancerException` subclass and any attached HTTP response.

## Contributing

Contributions are welcome through pull requests. Add tests for behavioral changes, run `npm run build` and the relevant
test suites, and update the relevant API documentation with the implementation.

## Helpful Links

- [API documentation](https://docs.pdfdancer.com?utm_source=github&utm_medium=readme&utm_campaign=pdfdancer-typescript)
- [Product overview](https://www.pdfdancer.com?utm_source=github&utm_medium=readme&utm_campaign=pdfdancer-typescript)
- [npm](https://www.npmjs.com/package/pdfdancer-client-typescript)
- [Changelog](https://www.pdfdancer.com/changelog/?utm_source=github&utm_medium=readme&utm_campaign=pdfdancer-typescript)
- [Status](https://status.pdfdancer.com?utm_source=github&utm_medium=readme&utm_campaign=pdfdancer-typescript)
- [Issue tracker](https://github.com/MenschMachine/pdfdancer)

## Related SDKs

- Java client: https://github.com/MenschMachine/pdfdancer-client-java
- Python client: https://github.com/MenschMachine/pdfdancer-client-python

## License

Apache-2.0
