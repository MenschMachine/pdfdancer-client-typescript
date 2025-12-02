/**
 * E2E tests for redaction operations
 */

import {Color, PDFDancer} from '../../index';
import {requireEnvAndFixture} from './test-helpers';
import {PDFAssertions} from './pdf-assertions';

describe('Redact E2E Tests', () => {

    test('redact paragraph with default replacement', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        // Find paragraph with known text
        const para = await pdf.page(1).selectParagraphStartingWith('The Complete');
        expect(para).not.toBeNull();

        // Redact it
        const result = await para!.redact();

        // Verify result
        expect(result.success).toBe(true);
        expect(result.count).toBe(1);

        // Save and verify the text was replaced
        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertParagraphDoesNotExist('The Complete', 1);
        await assertions.assertParagraphExists('[REDACTED]', 1);
    });

    test('redact paragraph with custom replacement text', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const para = await pdf.page(1).selectParagraphStartingWith('The Complete');
        expect(para).not.toBeNull();

        const result = await para!.redact('[CONFIDENTIAL]');

        expect(result.success).toBe(true);
        expect(result.count).toBe(1);

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertParagraphDoesNotExist('The Complete', 1);
        await assertions.assertParagraphExists('[CONFIDENTIAL]', 1);
    });

    test('redact text line', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const line = await pdf.page(1).selectTextLineStartingWith('The Complete');
        expect(line).not.toBeNull();

        const result = await line!.redact('[REMOVED]');

        expect(result.success).toBe(true);
        expect(result.count).toBe(1);

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertTextlineDoesNotExist('The Complete', 1);
        await assertions.assertTextlineExists('[REMOVED]', 1);
    });

    test('redact image replaces with placeholder', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('Showcase.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const imagesBefore = await pdf.page(1).selectImages();
        expect(imagesBefore.length).toBeGreaterThan(0);

        const image = imagesBefore[0];
        const imageX = image.position.boundingRect?.x;
        const imageY = image.position.boundingRect?.y;

        const result = await image.redact();

        expect(result.success).toBe(true);
        expect(result.count).toBe(1);

        // Image should be gone, replaced with path (placeholder rectangle)
        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertNoImageAt(imageX!, imageY!, 1);
    });

    test('redact image with custom placeholder color', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('Showcase.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const images = await pdf.page(1).selectImages();
        expect(images.length).toBeGreaterThan(0);

        const image = images[0];
        const redColor = new Color(255, 0, 0);
        const result = await image.redact({ color: redColor });

        expect(result.success).toBe(true);
        expect(result.count).toBe(1);
    });

    test('redact path', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('basic-paths.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const pathsBefore = await pdf.page(1).selectPaths();
        expect(pathsBefore.length).toBeGreaterThan(0);
        const initialPathCount = pathsBefore.length;

        const path = pathsBefore[0];
        const result = await path.redact();

        expect(result.success).toBe(true);
        expect(result.count).toBe(1);

        // Check that we have fewer paths now
        const assertions = await PDFAssertions.create(pdf);
        const pathsAfter = await pdf.page(1).selectPaths();
        expect(pathsAfter.length).toBeLessThan(initialPathCount);
    });

    test('redact multiple paragraphs on page', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const paragraphs = await pdf.page(1).selectParagraphs();
        const initialCount = paragraphs.length;
        expect(initialCount).toBeGreaterThan(0);

        // Redact all paragraphs on page 1
        let totalRedacted = 0;
        for (const para of paragraphs) {
            const result = await para.redact();
            expect(result.success).toBe(true);
            totalRedacted += result.count;
        }

        expect(totalRedacted).toBe(initialCount);

        // Verify redacted text exists
        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertParagraphExists('[REDACTED]', 1);
    });

    test('redact returns valid response structure', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const para = await pdf.page(1).selectParagraphStartingWith('The Complete');
        const result = await para!.redact();

        // Verify response structure
        expect(typeof result.success).toBe('boolean');
        expect(typeof result.count).toBe('number');
    });

});
