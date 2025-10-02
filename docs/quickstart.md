# Quickstart

A minimal path to install, authenticate, and make your first call with the `pdfdancer-client-typescript` library.

## Prerequisites
- Node.js 18+ (LTS)
- An authentication token for the PDFDancer API
- A running PDFDancer server (default: `http://localhost:8080`), or set `PDFDANCER_BASE_URL`

## Install

```bash
npm install pdfdancer-client-typescript
```

## Authenticate

Set the environment variable in your shell (recommended during development):

```bash
export PDFDANCER_TOKEN="your-token"
```

Alternatively, you can place a file named like `jwt-token-*.txt` in the project root; the e2e helpers and some tooling can read it. For the client itself, prefer passing the token explicitly when creating the client.

## First call

The example below creates a client for an existing PDF buffer, finds paragraphs on page 1, adds a new paragraph, and saves the modified PDF in the browser. Adjust for Node (write to disk) as needed.

```ts
import { ClientV1, Position, Color, Font } from 'pdfdancer-client-typescript';

async function run() {
  // Provide your PDF data as Uint8Array, File, or ArrayBuffer
  const pdfData = new Uint8Array(/* your PDF bytes */);

  const token = process.env.PDFDANCER_TOKEN || 'your-auth-token';
  const baseUrl = process.env.PDFDANCER_BASE_URL || 'http://localhost:8080';

  const client = await ClientV1.create(token, pdfData, baseUrl, 30000);

  const paragraphs = await client.findParagraphs(Position.atPage(1));
  console.log(`Found paragraphs: ${paragraphs.length}`);

  const newParagraph = client
    .paragraphBuilder()
    .fromString('Hello, PDFDancer!', new Color(255, 0, 0))
    .withFont(new Font('Arial', 12))
    .withPosition(Position.atPageCoordinates(1, 100, 200))
    .build();

  await client.addParagraph(newParagraph);

  // Browser: save file
  await client.savePdf('modified-document.pdf');
}

run().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
```

## Next steps
- See `README.md` for broader API overview and examples.
- Use `Position`, `ObjectType`, and builder utilities to perform more complex operations.
- Check the upcoming Auth guide for configuration options.
