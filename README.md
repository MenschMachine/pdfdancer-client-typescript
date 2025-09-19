# PDFDancer TypeScript Client

A TypeScript client library for the PDFDancer PDF manipulation API. This client provides a clean, TypeScript interface
for PDF operations that closely mirrors the Python client structure and functionality.

## Features

- **Session-based PDF manipulation** - Upload PDF, perform operations, download modified PDF
- **Type-safe API** - Full TypeScript support with proper types and interfaces
- **Fluent Builder Pattern** - Easy paragraph construction with method chaining
- **Comprehensive Search** - Find PDF objects by type, position, and other criteria
- **Custom Font Support** - Register and use custom TTF fonts
- **Error Handling** - Detailed exceptions for different error scenarios
- **Browser Compatible** - Works in both Node.js and browser environments

## Installation

```bash
npm install pdfdancer-client-typescript
```

## Basic Usage

```typescript
import {ClientV1, Position, Color, Font} from 'pdfdancer-client-typescript';

async function example() {
    // Load PDF data (from file upload, fetch, etc.)
    const pdfData = new Uint8Array(/* your PDF data */);

    // Create client with authentication token
    const client = await ClientV1.create('your-auth-token', pdfData, undefined, 30000);

    // Find all paragraphs on page 1
    const paragraphs = await client.findParagraphs(Position.atPage(1));

    // Add a new paragraph
    const newParagraph = client.paragraphBuilder()
        .fromString('Hello, PDFDancer!', new Color(255, 0, 0))
        .withFont(new Font('Arial', 12))
        .withPosition(Position.atPageCoordinates(1, 100, 200))
        .build();

    await client.addParagraph(newParagraph);

    // Get the modified PDF
    const modifiedPdf = await client.getPdfFile();

    // Save PDF (browser environment)
    await client.savePdf('modified-document.pdf');
}
```

## API Overview

### Client Initialization

```typescript
const client = await ClientV1.create(
    token,        // Authentication token
    pdfData,      // PDF data as Uint8Array, File, or ArrayBuffer
    baseUrl,      // Optional: API server URL (default: http://localhost:8080)
    readTimeout   // Optional: Request timeout in ms (default: 30000)
);
```

### Search Operations

```typescript
// Find objects by type and position
const objects = await client.find(ObjectType.PARAGRAPH, position);

// Convenience methods for specific object types
const paragraphs = await client.findParagraphs(position);
const images = await client.findImages(position);
const forms = await client.findForms(position);
const paths = await client.findPaths(position);
const textLines = await client.findTextLines(position);

// Page operations
const pages = await client.getPages();
const page = await client.getPage(1); // 1-based index
```

### Position Specification

```typescript
// Page-based position
const pagePosition = Position.atPage(1);

// Coordinate-based position
const coordPosition = Position.atPageCoordinates(1, 100, 200);

// Position with movement
const movedPosition = coordPosition.copy().moveX(50).moveY(30);
```

### Adding Content

```typescript
// Add paragraph using builder pattern
const paragraph = client.paragraphBuilder()
    .fromString('Your text here')
    .withFont(new Font('Arial', 12))
    .withColor(new Color(0, 0, 0))
    .withPosition(Position.atPageCoordinates(1, 100, 200))
    .withLineSpacing(1.2)
    .build();

await client.addParagraph(paragraph);

// Add image
const image = new Image(position, 'PNG', 100, 50, imageData);
await client.addImage(image);
```

### Modifying Content

```typescript
// Modify paragraph text
await client.modifyParagraph(paragraphRef, 'New text content');

// Modify text line
await client.modifyTextLine(textLineRef, 'New line content');

// Move object to new position
await client.move(objectRef, newPosition);

// Delete object
await client.delete(objectRef);
```

### Font Management

```typescript
// Find available fonts
const fonts = await client.findFonts('Arial', 12);

// Register custom font
const ttfData = new Uint8Array(/* TTF font data */);
const fontName = await client.registerFont(ttfData);

// Use custom font
const customFont = new Font(fontName, 14);
```

### Document Operations

```typescript
// Get modified PDF data
const pdfBytes = await client.getPdfFile();

// Save PDF file (browser)
await client.savePdf('output.pdf');

// Delete page
await client.deletePage(pageRef);
```

## Error Handling

The client provides specific exception types for different error scenarios:

```typescript
import {
    ValidationException,
    HttpClientException,
    SessionException,
    FontNotFoundException,
    PdfDancerException
} from 'pdfdancer-client-typescript';

try {
    await client.addParagraph(paragraph);
} catch (error) {
    if (error instanceof ValidationException) {
        console.error('Invalid input:', error.message);
    } else if (error instanceof HttpClientException) {
        console.error('API error:', error.message, 'Status:', error.statusCode);
    } else if (error instanceof FontNotFoundException) {
        console.error('Font not found:', error.message);
    } else if (error instanceof SessionException) {
        console.error('Session error:', error.message);
    }
}
```

## Types and Enums

### ObjectType

- `IMAGE` - Image objects
- `FORM` - Form field objects
- `PATH` - Vector path objects
- `PARAGRAPH` - Paragraph objects
- `TEXT_LINE` - Text line objects
- `PAGE` - Page objects

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

# Run only e2e tests (requires fixtures and server)
npm run test:e2e

# Run linter
npm run lint
```

### E2E Tests

The project includes comprehensive end-to-end tests that mirror the Python client test suite. To run e2e tests:

1. **Start PDFDancer server** at `http://localhost:8080` (or set `PDFDANCER_BASE_URL`)

2. **Set authentication token**:
    - Environment variable: `export PDFDANCER_TOKEN=your-token`
    - Or place a `jwt-token-*.txt` file in the project root

3. **Add test fixtures** in the `fixtures/` directory:
    - `ObviouslyAwesome.pdf` - Main test document
    - `mixed-form-types.pdf` - Document with form fields
    - `basic-paths.pdf` - Document with vector paths
    - `logo-80.png` - Test image file
    - `DancingScript-Regular.ttf` - Test font file

4. **Run e2e tests**: `npm run test:e2e`

The e2e tests cover:

- **Paragraph operations**: Find, add, modify, delete paragraphs with custom fonts
- **Page operations**: Get pages, delete pages
- **Text line operations**: Find, modify, move, delete text lines
- **Image operations**: Find, add, move, delete images
- **Form operations**: Find and delete form fields
- **Path operations**: Find, move, delete vector paths

## License

MIT
