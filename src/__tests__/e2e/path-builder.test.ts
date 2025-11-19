/**
 * E2E tests for PathBuilder (new API)
 */

import {requireEnvAndFixture} from './test-helpers';
import {PDFDancer, Color} from "../../index";
import {PDFAssertions} from './pdf-assertions';

describe('PathBuilder E2E Tests (New API)', () => {

    test('create simple line path using PathBuilder', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('blank.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        // Create a simple black line from (100, 100) to (200, 200)
        await pdf.newPath()
            .moveTo(100, 100)
            .lineTo(200, 200)
            .strokeColor(new Color(0, 0, 0))
            .strokeWidth(2)
            .at(0, 0, 0)
            .add();

        // Verify the path was added
        const paths = await pdf.selectPaths();
        expect(paths.length).toBeGreaterThan(0);
    });

    test('create path with multiple segments using page-level API', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('blank.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        // Create a path with multiple line segments
        await pdf.page(0).newPath()
            .moveTo(50, 50)
            .lineTo(150, 50)
            .lineTo(150, 150)
            .lineTo(50, 150)
            .lineTo(50, 50)  // Close the rectangle
            .strokeColor(new Color(255, 0, 0))
            .strokeWidth(3)
            .at(0, 0)
            .add();

        const paths = await pdf.page(0).selectPaths();
        expect(paths.length).toBeGreaterThan(0);
    });

    test('create bezier curve path', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('blank.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        // Create a bezier curve
        await pdf.newPath()
            .moveTo(100, 100)
            .bezierTo(150, 50, 250, 150, 300, 100)
            .strokeColor(new Color(0, 0, 255))
            .strokeWidth(2)
            .at(0, 0, 0)
            .add();

        const paths = await pdf.selectPaths();
        expect(paths.length).toBeGreaterThan(0);
    });

    test('create dashed line path', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('blank.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        // Create a dashed line
        await pdf.newPath()
            .moveTo(100, 100)
            .lineTo(300, 100)
            .strokeColor(new Color(0, 0, 0))
            .strokeWidth(2)
            .dashPattern([5, 5])  // 5 units on, 5 units off
            .at(0, 0, 0)
            .add();

        const paths = await pdf.selectPaths();
        expect(paths.length).toBeGreaterThan(0);
    });

    test('create filled path with stroke', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('blank.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        // Create a filled rectangle with stroke
        await pdf.newPath()
            .moveTo(100, 100)
            .lineTo(200, 100)
            .lineTo(200, 200)
            .lineTo(100, 200)
            .lineTo(100, 100)
            .fillColor(new Color(255, 200, 200))  // Light red fill
            .strokeColor(new Color(255, 0, 0))     // Red stroke
            .strokeWidth(2)
            .at(0, 0, 0)
            .add();

        const paths = await pdf.selectPaths();
        expect(paths.length).toBeGreaterThan(0);
    });

    test('validate position is required', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('blank.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        // Try to add path without setting position
        await expect(async () => {
            await pdf.newPath()
                .moveTo(100, 100)
                .lineTo(200, 200)
                .strokeColor(new Color(0, 0, 0))
                .add();
        }).rejects.toThrow(/Position is not set/);
    });

    test('validate segments are required', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('blank.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        // Try to add path without any segments
        await expect(async () => {
            await pdf.newPath()
                .at(0, 0, 0)
                .add();
        }).rejects.toThrow(/No path segments defined/);
    });

    test('validate moveTo is required before lineTo', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('blank.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        // Try to draw line without moving to starting point first
        await expect(async () => {
            await pdf.newPath()
                .lineTo(200, 200)
                .at(0, 0, 0)
                .add();
        }).rejects.toThrow(/No current point set/);
    });
});
