# PDFDancer TypeScript Client

**Getting Started with PDFDancer**

PDFDancer gives you pixel-perfect programmatic control over any PDF document from TypeScript. Locate existing elements by coordinates or text, adjust them precisely, add brand-new content, and ship the modified PDF in memory or on disk. The same API is also available for Python and Java, so teams can orchestrate identical PDF workflows across stacks.

> Need the raw API schema? The latest OpenAPI description is published at https://bucket.pdfdancer.com/api-doc/development-0.0.yml.

## Highlights

- Locate paragraphs, text lines, images, vector paths, form fields, and pages by index, coordinates, or text prefixes.
- Edit existing content in place with fluent editors that apply changes safely.
- Programmatically control third-party PDFs—modify invoices, contracts, and reports you did not author.
- Add content with precise XY positioning using paragraph and image builders, custom fonts, and color helpers.
- Export results as bytes for downstream processing or save directly to disk with one call.
- Works in both Node.js and browser environments.

## What Makes PDFDancer Different

- **Edit any PDF**: Work with documents from customers, governments, or vendors—not just ones you generated.
- **Pixel-perfect positioning**: Move or add elements at exact coordinates and keep the original layout intact.
- **Surgical text replacement**: Swap or rewrite paragraphs without reflowing the rest of the page.
- **Form manipulation**: Inspect, fill, and update AcroForm fields programmatically.
- **Coordinate-based selection**: Select objects by position, bounding box, or text patterns.
- **Real PDF editing**: Modify the underlying PDF structure instead of merely stamping overlays.

## Installation

```bash
npm install pdfdancer-client-typescript
```

Requires Node.js 20+ (or a modern browser) and a PDFDancer API token.

## Quick Start — Edit an Existing PDF

```typescript
import { PDFDancer, Color, StandardFonts } from 'pdfdancer-client-typescript';
import { promises as fs } from 'node:fs';

async function run() {
  const pdfBytes = await fs.readFile('input.pdf');

  // Token defaults to PDFDANCER_TOKEN environment variable when omitted
  const pdf = await PDFDancer.open(
    pdfBytes,
    'your-api-token',              // optional when PDFDANCER_TOKEN is set
    'https://api.pdfdancer.com'    // optional base URL
  );

  // Locate and update an existing paragraph
  const heading = (await pdf.page(0).selectParagraphsStartingWith('Executive Summary'))[0];
  await heading.moveTo(72, 680);

  const result = await heading.edit()
    .replace('Overview')
    .apply();

  // Add a new paragraph with precise placement
  await pdf.page(0).newParagraph()
    .text('Generated with PDFDancer')
    .font(StandardFonts.HELVETICA, 12)
    .color(new Color(70, 70, 70))
    .lineSpacing(1.4)
    .at(72, 520)
    .apply();

  // Persist the modified document
  await pdf.save('output.pdf');
  // or keep it in memory
  const updatedBytes = await pdf.getBytes();
}

run().catch(console.error);
```

## Create a Blank PDF

```typescript
import { PDFDancer, Color, StandardFonts } from 'pdfdancer-client-typescript';

async function createNew() {
  const pdf = await PDFDancer.new('your-api-token');

  await pdf.page(0).newParagraph()
    .text('Quarterly Summary')
    .font(StandardFonts.TIMES_BOLD, 18)
    .color(new Color(10, 10, 80))
    .lineSpacing(1.2)
    .at(72, 730)
    .apply();

  await pdf.newImage()
    .fromFile('logo.png')
    .at(0, 420, 710)
    .add();

  await pdf.save('summary.pdf');
}

createNew().catch(console.error);
```

## Work with Forms and Layout

```typescript
import { PDFDancer } from 'pdfdancer-client-typescript';

async function workWithForms() {
  const pdf = await PDFDancer.open('contract.pdf');

  // Inspect global document structure
  const pages = await pdf.pages();
  console.log('Total pages:', pages.length);

  // Update form fields
  const signature = (await pdf.selectFieldsByName('signature'))[0];
  await signature.fill('Signed by Jane Doe');

  // Trim or move content at specific coordinates
  const images = await pdf.page(1).selectImages();
  for (const image of images) {
    const x = image.position.boundingRect?.x;
    if (x !== undefined && x < 100) {
      await image.delete();
    }
  }

  await pdf.save('contract-updated.pdf');
}
```

Selectors return typed objects (`ParagraphObject`, `TextLineObject`, `ImageObject`, `FormFieldObject`, `PageRef`, …) with helpers such as `delete()`, `moveTo(x, y)`, or `edit()` depending on the object type.

## Configuration

```typescript
const pdf = await PDFDancer.open(
  pdfData,     // Uint8Array, File, or ArrayBuffer
  token,       // Optional: defaults to process.env.PDFDANCER_TOKEN
  baseUrl,     // Optional: defaults to process.env.PDFDANCER_BASE_URL or https://api.pdfdancer.com
  timeout,     // Optional request timeout in ms (default: 60000)
  retryConfig  // Optional retry configuration
);
```

- Set `PDFDANCER_TOKEN` for authentication (preferred for local development and CI).
- Override the API host with `PDFDANCER_BASE_URL` (e.g., sandbox environments).
- Tune HTTP read timeouts via the `timeout` argument on `PDFDancer.open()` and `PDFDancer.new()`.
- Page indexes start at `0` throughout the API.

### Retry Configuration

The client includes a configurable retry mechanism for handling transient failures. By default, it retries on specific HTTP status codes (429, 500, 502, 503, 504) and network errors with exponential backoff. It also respects `Retry-After` headers from the server when available.

```typescript
import { PDFDancer, RetryConfig } from 'pdfdancer-client-typescript';

// Use default retry configuration (3 retries, exponential backoff, Retry-After support)
const pdf = await PDFDancer.open(pdfData);

// Customize retry behavior
const customRetryConfig: RetryConfig = {
  maxRetries: 5,              // Maximum number of retry attempts (default: 3)
  initialDelay: 1000,         // Initial delay in ms before first retry (default: 1000)
  maxDelay: 10000,            // Maximum delay in ms between retries (default: 10000)
  backoffMultiplier: 2,       // Exponential backoff multiplier (default: 2)
  retryableStatusCodes: [429, 500, 502, 503, 504], // HTTP status codes to retry (default)
  retryOnNetworkError: true,  // Retry on network errors (default: true)
  useJitter: true,            // Add random jitter to delays (default: true)
  respectRetryAfter: true     // Respect Retry-After headers from server (default: true)
};

const pdf = await PDFDancer.open(pdfData, token, baseUrl, timeout, customRetryConfig);
```

**Default Retry Behavior:**
- Retries up to 3 times on transient errors
- Uses exponential backoff with jitter (1s, 2s, 4s base delays)
- Respects `Retry-After` headers (supports both seconds and HTTP-date formats)
- Falls back to exponential backoff if `Retry-After` is missing or invalid
- Retries on HTTP 429 (rate limit), 500, 502, 503, 504 (server errors)
- Retries on network errors (connection failures, timeouts)
- Does NOT retry on client errors (4xx except 429)

**Disable Retries:**
```typescript
const noRetryConfig: RetryConfig = { maxRetries: 0 };
const pdf = await PDFDancer.open(pdfData, token, baseUrl, timeout, noRetryConfig);
```

The retry mechanism applies to all REST API calls including session creation, document operations, and font registration.

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
  const result = await para.edit()
    .replace('Awesomely\nObvious!')
    .font('Helvetica', 12)
    .color(new Color(0, 0, 0))
    .moveTo(280, 460)
    .apply();

  // Check for warnings (e.g., embedded font modifications)
  if (typeof result === 'object' && result.warning) {
    console.warn('Operation warning:', result.warning);
  }
}
```

**Note:** When modifying text with embedded fonts, you may receive warnings. Embedded fonts have limited character sets, and modifying text may result in unrenderable characters. Consider using standard fonts when possible.

`ParagraphBuilder` also supports `.fontFile(ttfBytes, size)` to register a custom font before applying.

### Text Object Status

Text objects (paragraphs and lines) include status information about their font and modification state:

```typescript
const lines = await pdf.page(0).selectTextLines();
const line = lines[0];

// Check text object status
const status = line.objectRef().status;
if (status) {
  console.log('Font type:', status.getFontType());        // SYSTEM, STANDARD, or EMBEDDED
  console.log('Is modified:', status.isModified());       // true if text was changed
  console.log('Is encodable:', status.isEncodable());     // true if text can be rendered

  // Get font mapping information if available
  const fontInfo = status.getFontInfo();
  if (fontInfo) {
    console.log('Document font:', fontInfo.getDocumentFontName());
    console.log('System font:', fontInfo.getSystemFontName());
  }
}
```

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

Operations raise subclasses of `PdfDancerException`:

- `ValidationException`: input validation problems (missing token, invalid coordinates, etc.).
- `FontNotFoundException`: requested font unavailable on the service.
- `HttpClientException`: transport or server errors with detailed context.
- `SessionException`: session creation and lifecycle failures.

Wrap automated workflows in `try/catch` blocks to surface actionable errors to your users:

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
- `CHECKBOX` - Checkbox form fields
- `RADIO_BUTTON` - Radio button form fields

### PositionMode

- `INTERSECT` - Objects that intersect with the specified area
- `CONTAINS` - Objects completely contained within the specified area

### ShapeType

- `POINT` - Single point coordinate
- `LINE` - Linear shape between two points
- `CIRCLE` - Circular area with radius
- `RECT` - Rectangular area with width and height

### FontType

- `SYSTEM` - System fonts available on the local machine
- `STANDARD` - Standard PDF fonts (14 built-in fonts)
- `EMBEDDED` - Fonts embedded in the PDF document

### Text Modification Results

When modifying text objects (paragraphs or lines), the operation returns a `CommandResult`:

```typescript
interface CommandResult {
  commandName: string;    // Name of the operation
  elementId: string | null;  // ID of the affected element
  message: string | null;    // Optional status message
  success: boolean;          // Operation success status
  warning: string | null;    // Warning message (e.g., embedded font issues)
}
```

### Text Status

Text objects include status information via `TextStatus`:

```typescript
interface TextStatus {
  modified: boolean;           // Whether text has been modified
  encodable: boolean;          // Whether text is encodable with current font
  fontType: FontType;         // Type of font being used
  fontInfo?: DocumentFontInfo; // Mapping between document font and available system font
}
```

The legacy `TextStatus.getFontRecommendation()` method is still available and returns the same `DocumentFontInfo` instance.

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

## Related SDKs

- Python client: https://github.com/MenschMachine/pdfdancer-client-python
- Java client: https://github.com/MenschMachine/pdfdancer-client-java

## License

Copyright 2025 The Famous Cat Ltd.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
