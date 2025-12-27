# Test Fixtures

This directory contains test fixtures used by the e2e tests.

For the e2e tests to run, you need to place the following files here:

- `ObviouslyAwesome.pdf` - Main test PDF document
- `mixed-form-types.pdf` - PDF with form fields for form tests
- `basic-paths.pdf` - PDF with vector paths for path tests
- `logo-80.png` - Small PNG image for image tests
- `DancingScript-Regular.ttf` - TTF font file for custom font tests

The e2e tests will be skipped if these files are not present or if the required environment variables are not set:

- `PDFDANCER_API_TOKEN` (or `PDFDANCER_TOKEN`) - Authentication token for the PDFDancer API
- `PDFDANCER_BASE_URL` - Optional: URL of the PDFDancer server (defaults to http://localhost:8080)

## Running E2E Tests

1. Start the PDFDancer server
2. Set the required environment variables
3. Place the fixture files in this directory
4. Run: `npm test -- --testPathPattern=e2e`
