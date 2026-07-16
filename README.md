# PDFDancer TypeScript client

TypeScript client for the PDFDancer v2 API. Page numbers are 1-based, and requests send `X-API-VERSION: 2`.

## Install

```bash
npm install pdfdancer-client-typescript
```

## Open and save a PDF

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

## Selector-based text editing

Text mutations use `/pdf/text/replace`, `/pdf/text/delete`, `/pdf/text/insert`, and `/pdf/text/style`.

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

## Other PDF operations

The client retains the v2 operations for pages, images, paths, path groups, clipping, form XObjects, form fields, fonts, snapshots, and session-backed save/download. Examples:

```ts
const images = await pdf.page(1).selectImages();
await images[0]?.moveTo(100, 200);

const fields = await pdf.selectFieldsByName('customer_name');
await fields[0]?.fill('Acme Ltd.');

const newPage = await pdf.newPage().pageSize('A4').add();
await pdf.movePage(newPage.position.pageNumber!, 1);
```

The removed v1 paragraph/line mutation, template-replacement, and redaction endpoints are not exposed because they are absent from the v2 API contract.

## Tests

```bash
npm run build
npm run test:unit -- --runInBand
npm run test:e2e -- --runInBand
```

E2E tests expect the API at `http://localhost:8080` unless configured otherwise. The text-editing E2E suite saves and reopens mutated PDFs and uses the test-only `pdfjs-dist` dependency through `PDFAssertions` to validate persisted text and fonts.

## License

Apache-2.0
