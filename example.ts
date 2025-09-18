/**
 * Example usage of the PDFDancer TypeScript client
 */

import {
  ClientV1,
  Position,
  Color,
  Font,
  ValidationException,
  HttpClientException
} from './src/index';

async function exampleUsage() {
  try {
    // Create a sample PDF data (in a real application, this would be loaded from a file)
    const pdfData = new Uint8Array([
      0x25, 0x50, 0x44, 0x46, // %PDF header
      // ... rest of PDF data would go here
    ]);

    // Initialize the client with authentication token and PDF data
    const client = new ClientV1('your-auth-token', pdfData, 'http://localhost:8080');

    // Initialize the session (must be called before using the client)
    await client.init();

    // Example 1: Find all paragraphs on page 1
    const page1Position = Position.atPage(1);
    const paragraphs = await client.findParagraphs(page1Position);
    console.log(`Found ${paragraphs.length} paragraphs on page 1`);

    // Example 2: Add a new paragraph using the builder pattern
    const newParagraph = client.paragraphBuilder()
      .fromString('Hello, PDFDancer!', new Color(255, 0, 0)) // Red text
      .withFont(new Font('Arial', 12))
      .withPosition(Position.onPageCoordinates(1, 100, 200))
      .withLineSpacing(1.5)
      .build();

    await client.addParagraph(newParagraph);
    console.log('Added new paragraph successfully');

    // Example 3: Find and modify existing text
    const textLines = await client.findTextLines(page1Position);
    if (textLines.length > 0) {
      await client.modifyTextLine(textLines[0], 'Modified text content');
      console.log('Modified first text line');
    }

    // Example 4: Get the modified PDF
    const modifiedPdf = await client.getPdfFile();
    console.log(`Generated PDF size: ${modifiedPdf.length} bytes`);

    // Example 5: Save PDF (in browser environment)
    // await client.savePdf('modified-document.pdf');

  } catch (error) {
    if (error instanceof ValidationException) {
      console.error('Validation error:', error.message);
    } else if (error instanceof HttpClientException) {
      console.error('HTTP error:', error.message, 'Status:', error.statusCode);
    } else {
      console.error('Unexpected error:', error);
    }
  }
}

// Example of using with custom font
async function exampleWithCustomFont() {
  try {
    const pdfData = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
    const client = new ClientV1('your-auth-token', pdfData);
    await client.init();

    // Register a custom font (example with dummy TTF data)
    const customFontData = new Uint8Array([/* TTF font data here */]);
    const fontName = await client.registerFont(customFontData);
    console.log(`Registered font: ${fontName}`);

    // Use the custom font in a paragraph
    const paragraph = client.paragraphBuilder()
      .fromString('Text with custom font')
      .withFont(new Font(fontName, 14))
      .withPosition(Position.onPageCoordinates(1, 50, 300))
      .build();

    await client.addParagraph(paragraph);
    console.log('Added paragraph with custom font');

  } catch (error) {
    console.error('Error with custom font:', error);
  }
}

// Note: These examples show the API usage patterns.
// In a real application, you would need:
// 1. A valid authentication token
// 2. Actual PDF data
// 3. A running PDFDancer server at the specified URL
// 4. Proper error handling for your use case

export { exampleUsage, exampleWithCustomFont };
