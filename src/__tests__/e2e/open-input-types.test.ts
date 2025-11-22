/**
 * E2E tests for PDFDancer.open() with different input types
 */

import {PDFDancer} from '../../index';
import {getBaseUrl, readToken, serverUp} from './test-helpers';
import * as fs from 'fs';
import * as path from 'path';

describe('PDFDancer.open() Input Types E2E Tests', () => {
    let baseUrl: string;
    let token: string;
    const fixturesDir = path.resolve(__dirname, '../../../fixtures');
    const testPdfPath = path.join(fixturesDir, 'Empty.pdf');

    beforeAll(async () => {
        baseUrl = getBaseUrl();
        const tokenValue = readToken();

        if (!await serverUp(baseUrl)) {
            throw new Error(`PDFDancer server not reachable at ${baseUrl}; set PDFDANCER_BASE_URL or start server`);
        }

        if (!tokenValue) {
            throw new Error('PDFDANCER_TOKEN not set and no token file found; set env or place jwt-token-*.txt in repo');
        }

        token = tokenValue;

        // Verify test PDF exists
        if (!fs.existsSync(testPdfPath)) {
            throw new Error(`Test PDF not found at ${testPdfPath}`);
        }
    });

    test('open PDF with string filepath', async () => {
        // Test opening PDF with string filepath
        const pdf = await PDFDancer.open(testPdfPath, token, baseUrl);

        expect(pdf).toBeDefined();

        // Verify the PDF was loaded correctly
        const pages = await pdf.pages();
        expect(pages).toBeDefined();
        expect(Array.isArray(pages)).toBe(true);

        // Can get bytes from the PDF
        const bytes = await pdf.getBytes();
        expect(bytes).toBeInstanceOf(Uint8Array);
        expect(bytes.length).toBeGreaterThan(0);

        // Verify PDF signature
        const signature = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
        expect(signature).toBe('%PDF');
    });

    test('open PDF with Uint8Array (raw bytes)', async () => {
        // Read PDF as bytes
        const pdfBytes = new Uint8Array(fs.readFileSync(testPdfPath));

        // Test opening PDF with Uint8Array
        const pdf = await PDFDancer.open(pdfBytes, token, baseUrl);

        expect(pdf).toBeDefined();

        // Verify the PDF was loaded correctly
        const pages = await pdf.pages();
        expect(pages).toBeDefined();
        expect(Array.isArray(pages)).toBe(true);

        // Can get bytes from the PDF
        const bytes = await pdf.getBytes();
        expect(bytes).toBeInstanceOf(Uint8Array);
        expect(bytes.length).toBeGreaterThan(0);

        // Verify PDF signature
        const signature = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
        expect(signature).toBe('%PDF');
    });

    test('both input types produce equivalent results', async () => {
        // Open same PDF with filepath
        const pdfFromPath = await PDFDancer.open(testPdfPath, token, baseUrl);
        const pagesFromPath = await pdfFromPath.pages();

        // Open same PDF with bytes
        const pdfBytes = new Uint8Array(fs.readFileSync(testPdfPath));
        const pdfFromBytes = await PDFDancer.open(pdfBytes, token, baseUrl);
        const pagesFromBytes = await pdfFromBytes.pages();

        // Both should have same number of pages
        expect(pagesFromPath.length).toBe(pagesFromBytes.length);
    });

    test('open PDF with relative filepath', async () => {
        // Test with a relative path
        const relativePath = './fixtures/Empty.pdf';
        const pdf = await PDFDancer.open(relativePath, token, baseUrl);

        expect(pdf).toBeDefined();
        const pages = await pdf.pages();
        expect(pages).toBeDefined();
    });

    test('rejects invalid filepath', async () => {
        const invalidPath = '/nonexistent/path/to/file.pdf';

        await expect(PDFDancer.open(invalidPath, token, baseUrl))
            .rejects
            .toThrow(/PDF file not found|ENOENT/);
    });

    test('rejects empty Uint8Array', async () => {
        const emptyBytes = new Uint8Array(0);

        await expect(PDFDancer.open(emptyBytes, token, baseUrl))
            .rejects
            .toThrow(/PDF data cannot be empty/);
    });
});
