/**
 * E2E tests for path color read/write operations
 */

import {requireEnvAndFixture} from './test-helpers';
import {Color, PDFDancer} from "../../index";
import {PDFAssertions} from './pdf-assertions';
import {pathWithBounds} from './path-test-support';

describe('Path Color E2E Tests', () => {

    test('read path colors from existing paths', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('basic-paths.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        // Get paths from the document
        const paths = await pdf.selectPaths();
        expect(paths.length).toBeGreaterThan(0);

        // Find PATH_0_000003 which is a closed rectangle with stroke
        const path = paths.find(p => p.internalId === 'PATH_0_000003');
        expect(path).toBeDefined();
        // The path should have stroke color information
        expect(path!.type).toBe('PATH');
        // Path should have strokeColor property (actual value depends on PDF content)
        expect(path!.strokeColor).toBeDefined();
    });

    test('modify path stroke color', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('basic-paths.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        // Get a path
        const paths = await pdf.page(1).selectPathsAt(80, 720);
        expect(paths).toHaveLength(1);

        const path = paths[0];
        const originalBounds = path.position.boundingRect!;

        // Modify the stroke color
        const redColor = new Color(255, 0, 0);
        const result = await path!.edit()
            .strokeColor(redColor)
            .apply();

        expect(result).toBeDefined();
        expect(result.success).toBe(true);

        // Verify by reopening the PDF and checking the actual color value
        const assertions = await PDFAssertions.create(pdf);
        const updated = pathWithBounds(await assertions.getPdf().page(1).selectPaths(), originalBounds);
        expect(updated.strokeColor).toEqual(redColor);
    });

    test('modify path fill color', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('basic-paths.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        // Get the fixture path at a stable position
        const paths = await pdf.page(1).selectPathsAt(80, 720);
        expect(paths).toHaveLength(1);
        const path = paths[0];
        const originalBounds = path.position.boundingRect!;

        // Modify the fill color
        const blueColor = new Color(0, 0, 255);
        const result = await path.edit()
            .fillColor(blueColor)
            .apply();

        expect(result).toBeDefined();
        expect(result.success).toBe(true);

        // Verify by reopening the PDF and checking the actual color value
        const assertions = await PDFAssertions.create(pdf);
        const updated = pathWithBounds(await assertions.getPdf().page(1).selectPaths(), originalBounds);
        expect(updated.fillColor).toEqual(blueColor);
    });

    test('modify both stroke and fill color', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('basic-paths.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        // Get a path
        const paths = await pdf.page(1).selectPathsAt(80, 720);
        expect(paths).toHaveLength(1);
        const path = paths[0];
        const originalBounds = path.position.boundingRect!;

        // Modify both colors
        const redColor = new Color(255, 0, 0);
        const blueColor = new Color(0, 0, 255);
        const result = await path.edit()
            .strokeColor(redColor)
            .fillColor(blueColor)
            .apply();

        expect(result).toBeDefined();
        expect(result.success).toBe(true);

        // Verify by reopening the PDF and checking the actual color values
        const assertions = await PDFAssertions.create(pdf);
        const updated = pathWithBounds(await assertions.getPdf().page(1).selectPaths(), originalBounds);
        expect(updated.strokeColor).toEqual(redColor);
        expect(updated.fillColor).toEqual(blueColor);
    });

    test('path edit without changes returns success', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('basic-paths.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const paths = await pdf.page(1).selectPathsAt(80, 720);
        expect(paths).toHaveLength(1);
        const path = paths[0];

        // Apply with no changes
        const result = await path!.edit().apply();

        expect(result).toBeDefined();
        expect(result.success).toBe(true);
    });

    test('modify path color on newly created path', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('Empty.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        // Create a new path with initial color at a specific position
        const blackColor = new Color(0, 0, 0);
        await pdf.newPath()
            .moveTo(100, 100)
            .lineTo(200, 200)
            .strokeColor(blackColor)
            .strokeWidth(2)
            .at(1, 100, 100)
            .add();

        // Find the newly created path by its position - use a tight tolerance
        // since Empty.pdf should have no other paths at this location
        const paths = await pdf.page(1).selectPathsAt(100, 100, 10);
        expect(paths.length).toBe(1);

        // Capture the internalId of the path we created
        const newPath = paths[0];

        // Modify its color
        const redColor = new Color(255, 0, 0);
        const result = await newPath.edit()
            .strokeColor(redColor)
            .apply();

        expect(result).toBeDefined();
        expect(result.success).toBe(true);

        // Verify the color was actually changed by saving and reloading
        const assertions = await PDFAssertions.create(pdf);
        const reloadedPdf = assertions.getPdf();

        // Find the path at the same coordinates on the reloaded PDF
        const reloadedPaths = await reloadedPdf.page(1).selectPathsAt(100, 100, 10);
        expect(reloadedPaths.length).toBe(1);

        expect(reloadedPaths[0].strokeColor).toEqual(redColor);
    });

    test('path colors persist after save and reload', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('basic-paths.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        // Get a path
        const paths = await pdf.page(1).selectPathsAt(80, 720);
        expect(paths).toHaveLength(1);
        const path = paths[0];
        const originalBounds = path.position.boundingRect!;

        // Modify the stroke color
        const greenColor = new Color(0, 255, 0);
        await path.edit()
            .strokeColor(greenColor)
            .apply();

        // Save and reload the PDF to verify persistence
        const assertions = await PDFAssertions.create(pdf);
        const reloadedPdf = assertions.getPdf();

        // Get paths from the reloaded PDF and verify the color persisted
        const reloadedPaths = await reloadedPdf.selectPaths();
        const reloadedPath = pathWithBounds(reloadedPaths, originalBounds);
        expect(reloadedPath.strokeColor).toEqual(greenColor);
    });
});
