# PDFDancer TypeScript Client

A TypeScript client library for the PDFDancer PDF manipulation API.

## Features

- Session-based PDF manipulation with automatic session creation
- Type-safe models and fluent builders for paragraphs and images
- Page-scoped selectors for paragraphs, text lines, images, forms, and paths
- Form filling helpers with field-name lookup
- Custom font registration with on-the-fly TTF uploads
- Detailed exceptions for validation, HTTP, and session errors
- Works in both Node.js and browser environments

## Installation

```bash
npm install pdfdancer-client-typescript
```

## Quick Start

```typescript
import { PDFDancer, Color } from 'pdfdancer-client-typescript';
import { promises as fs } from 'node:fs';

async function run() {
  const pdfBytes = await fs.readFile('input.pdf');

  // Token defaults to PDFDANCER_TOKEN when omitted.
  const pdf = await PDFDancer.open(pdfBytes, 'your-auth-token');

  const page0 = pdf.page(0); // Page indexes are zero-based

  await page0.newParagraph()
    .text('Hello, PDFDancer!')
    .font('Roboto-Regular', 14)
    .color(new Color(255, 64, 64))
    .lineSpacing(1.1)
    .at(100, 200)
    .apply();

  const updated = await pdf.getBytes();
  await fs.writeFile('output.pdf', updated);
}

run().catch(console.error);
```

## Authentication & Configuration

```typescript
const pdf = await PDFDancer.open(
  pdfData,     // Uint8Array, File, or ArrayBuffer
  token,       // Optional: defaults to process.env.PDFDANCER_TOKEN
  baseUrl,     // Optional: defaults to process.env.PDFDANCER_BASE_URL or https://api.pdfdancer.com
  timeout      // Optional request timeout in ms (default: 30000)
);
```

- Set `PDFDANCER_TOKEN` to avoid passing the token explicitly.
- Override the API endpoint with `PDFDANCER_BASE_URL`.
- Page indexes start at `0` throughout the API.

## Working with Pages

```typescript
const page = pdf.page(0);
const allPages = await pdf.pages(); // Array<PageClient>

await page.delete(); // Remove the page from the document
```

`PageClient` exposes page-scoped helpers like `selectParagraphs`, `selectTextLinesStartingWith`, `selectImagesAt`, and `newParagraph()`.

## Finding Objects

```typescript
const paragraphs = await pdf.selectParagraphs();
const header = await pdf.page(0).selectParagraphsStartingWith('Invoice #');
const imagesAtPoint = await pdf.page(2).selectImagesAt(120, 300);
const fieldsByName = await pdf.selectFieldsByName('firstName');
const textLines = await pdf.selectLines(); // All text lines across the document
```

Use `Position` helpers when you need explicit coordinates:

```typescript
import { Position } from 'pdfdancer-client-typescript';

const point = Position.atPageCoordinates(1, 250, 400);
const paragraphsAtPoint = await pdf.page(1).selectParagraphsAt(point.getX()!, point.getY()!);
```

## Creating and Editing Paragraphs

### Add a Paragraph

```typescript
await pdf.page(0).newParagraph()
  .text('Awesomely\nObvious!')
  .font('Roboto-Regular', 14)
  .lineSpacing(0.8)
  .color(new Color(0, 0, 0))
  .at(300, 500)
  .apply();
```

### Edit an Existing Paragraph

```typescript
const [para] = await pdf.page(0).selectParagraphsStartingWith('The Complete');

if (para) {
  await para.edit()
    .replace('Awesomely\nObvious!')
    .font('Helvetica', 12)
    .color(new Color(0, 0, 0))
    .moveTo(280, 460)
    .apply();
}
```

`ParagraphBuilder` also supports `.fontFile(ttfBytes, size)` to register a custom font before applying.

## Working with Images

```typescript
await pdf.newImage()
  .fromFile('fixtures/logo-80.png')
  .at(0, 420, 200)
  .add();

const images = await pdf.selectImages();
await images[0].moveTo(200, 350);
await images[1].delete();
```

Use `.fromBytes()` when image data already exists in memory.

## Form Fields

```typescript
const fields = await pdf.selectFormFields();

for (const field of fields) {
  if (field.name === 'firstName') {
    await field.fill('Ada');
  }
}

const zipFields = await pdf.selectFieldsByName('zip');
await zipFields[0]?.delete();
```

## Document Operations

```typescript
const pdfBytes = await pdf.getBytes();
await pdf.save('output.pdf'); // Node.js helper that writes the file
```

`pdf.save` wraps `fs.writeFile` for convenience. In browsers, use the bytes returned by `getBytes()` with your own download logic.

## Error Handling

```typescript
import {
  ValidationException,
  HttpClientException,
  SessionException,
  FontNotFoundException,
  PdfDancerException
} from 'pdfdancer-client-typescript';

try {
  await pdf.page(0).newParagraph()
    .text('Hello')
    .font('Unknown-Font', 12)
    .at(100, 100)
    .apply();
} catch (error) {
  if (error instanceof FontNotFoundException) {
    console.error('Font not found:', error.message);
  } else if (error instanceof ValidationException) {
    console.error('Invalid input:', error.message);
  } else if (error instanceof HttpClientException) {
    console.error('API error:', error.message);
  } else if (error instanceof SessionException) {
    console.error('Session error:', error.message);
  } else if (error instanceof PdfDancerException) {
    console.error('Unexpected failure:', error.message);
  }
}
```

## Types and Enums

### ObjectType

- `IMAGE` - Image objects
- `FORM_X_OBJECT` - Form XObjects
- `PATH` - Vector path objects
- `PARAGRAPH` - Paragraph objects
- `TEXT_LINE` - Text line objects
- `PAGE` - Page objects
- `FORM_FIELD` - Generic form field references
- `TEXT_FIELD` - Text input fields
- `CHECK_BOX` - Checkbox form fields
- `RADIO_BUTTON` - Radio button form fields

### PositionMode

- `INTERSECT` - Objects that intersect with the specified area
- `CONTAINS` - Objects completely contained within the specified area

### ShapeType

- `POINT` - Single point coordinate
- `LINE` - Linear shape between two points
- `CIRCLE` - Circular area with radius
- `RECT` - Rectangular area with width and height

## Development

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run all tests
npm test

# Run only unit tests
npm run test:unit

# Run e2e tests (requires fixtures and a running server)
npm run test:e2e

# Run linter
npm run lint
```

### E2E Tests

The project includes comprehensive end-to-end tests. To run them:

1. **Start the PDFDancer server** at `http://localhost:8080` or set `PDFDANCER_BASE_URL`.
2. **Provide an authentication token** via `export PDFDANCER_TOKEN=your-token` or a `jwt-token-*.txt` file in the project root.
3. **Populate fixtures** in the `fixtures/` directory:
   - `ObviouslyAwesome.pdf`
   - `mixed-form-types.pdf`
   - `basic-paths.pdf`
   - `logo-80.png`
   - `DancingScript-Regular.ttf`
4. **Run the suite**: `npm run test:e2e`

The e2e suite covers paragraphs, pages, text lines, images, form fields, and path manipulation scenarios.

## License

MIT
