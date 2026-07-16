/**
 * E2E tests for PathBuilder (new API)
 */

import {requireEnvAndFixture} from './test-helpers';
import {Color, PDFDancer} from "../../index";

describe('PathBuilder E2E Tests (New API)', () => {

    test('all dedicated builders work at document and page scope', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('Empty.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        await pdf.newLine(1).from(20, 20).to(120, 20).strokeColor(Color.RED).strokeWidth(2).add();
        await pdf.page(1).newLine().from(20, 40).to(120, 40).dashPattern([4, 2]).add();
        await pdf.newBezier(1).from(20, 80).control1(50, 120).control2(90, 40).to(120, 80).add();
        await pdf.page(1).newBezier().from(20, 100).control1(50, 140).control2(90, 60).to(120, 100)
            .fillColor(new Color(200, 220, 255, 128)).evenOddFill().add();
        await pdf.newRectangle(1).at(150, 20).size(80, 40).strokeColor(Color.BLACK).add();
        await pdf.page(1).newRectangle().at(150, 80).size(80, 40)
            .fillColor(new Color(255, 220, 200)).dashPattern([4, 2], 2).add();

        expect(await pdf.selectPaths()).toHaveLength(6);
    });

    test('path conveniences create closed, rectangular, circular, dashed, and solid paths', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('Empty.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        await pdf.newPath(1)
            .moveTo(20, 20).lineTo(100, 20)
            .bezierTo(120, 20, 120, 80, 100, 80)
            .lineTo(20, 80).closePath()
            .fillColor(new Color(255, 0, 0, 80)).dashPattern([5, 2]).solid().add();
        await pdf.page(1).newPath().rectangle(140, 20, 60, 40).add();
        await pdf.page(1).newPath().circle(250, 60, 30).evenOddFill(true).add();

        expect(await pdf.page(1).selectPaths()).toHaveLength(3);
    });

    test('dedicated builders reject missing and invalid geometry', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('Empty.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        await expect(pdf.page(1).newLine().to(10, 10).add()).rejects.toThrow(/start and end/);
        await expect(pdf.page(1).newBezier().from(0, 0).control1(1, 1).control2(2, 2).add())
            .rejects.toThrow(/both control points/);
        await expect(pdf.page(1).newRectangle().add()).rejects.toThrow(/origin and size/);
        expect(() => pdf.page(1).newRectangle().at(0, 0).size(0, 10)).toThrow(/positive/);
        expect(() => pdf.page(1).newPath().strokeWidth(-0.1)).toThrow(/nonnegative/);
        expect(() => pdf.page(1).newPath().moveTo(Number.NaN, 0)).toThrow(/finite/);
        expect(() => pdf.page(1).newPath().dashPattern([0, 0])).toThrow(/all be zero/);
        expect(() => pdf.page(1).newPath().circle(20, 20, 0)).toThrow(/positive/);
    });

    test('create simple line path using PathBuilder', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('Empty.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        // Create a simple black line from (100, 100) to (200, 200)
        await pdf.newPath()
            .moveTo(100, 100)
            .lineTo(200, 200)
            .strokeColor(new Color(0, 0, 0))
            .strokeWidth(2)
            .at(1, 100, 100)
            .add();

        // Verify the path was added
        const paths = await pdf.selectPaths();
        expect(paths.length).toBeGreaterThan(0);
    });

    test('create path with multiple segments using page-level API', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('Empty.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        // Create a path with multiple line segments
        await pdf.page(1).newPath()
            .moveTo(50, 50)
            .lineTo(150, 50)
            .lineTo(150, 150)
            .lineTo(50, 150)
            .lineTo(50, 50)  // Close the rectangle
            .strokeColor(new Color(255, 0, 0))
            .strokeWidth(3)
            .at(50, 50)
            .add();

        const paths = await pdf.page(1).selectPaths();
        expect(paths.length).toBeGreaterThan(0);
    });

    test('create bezier curve path', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('Empty.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        // Create a bezier curve
        await pdf.newPath()
            .moveTo(100, 100)
            .bezierTo(150, 50, 250, 150, 300, 100)
            .strokeColor(new Color(0, 0, 255))
            .strokeWidth(2)
            .at(1, 100, 100)
            .add();

        const paths = await pdf.selectPaths();
        expect(paths.length).toBeGreaterThan(0);
    });

    test('create dashed line path', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('Empty.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        // Create a dashed line
        await pdf.newPath()
            .moveTo(100, 100)
            .lineTo(300, 100)
            .strokeColor(new Color(0, 0, 0))
            .strokeWidth(2)
            .dashPattern([5, 5])  // 5 units on, 5 units off
            .at(1, 100, 100)
            .add();

        const paths = await pdf.selectPaths();
        expect(paths.length).toBeGreaterThan(0);
    });

    test('create filled path with stroke', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('Empty.pdf');
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
            .at(1, 100, 100)
            .add();

        const paths = await pdf.selectPaths();
        expect(paths.length).toBeGreaterThan(0);
    });

    test('validate target page is required for document-scoped paths', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('Empty.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        // Try to add a document-scoped path without specifying its target page
        await expect(
            pdf.newPath()
                .moveTo(100, 100)
                .lineTo(200, 200)
                .strokeColor(new Color(0, 0, 0))
                .add()
        ).rejects.toThrow(/Target page is not set/);
    });

    test('validate segments are required', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('Empty.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        // Try to add path without any segments
        await expect(async () => {
            await pdf.newPath()
                .at(1, 0, 0)
                .add();
        }).rejects.toThrow(/No path segments defined/);
    });

    test('validate moveTo is required before lineTo', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('Empty.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        // Try to draw line without moving to starting point first
        await expect(async () => {
            await pdf.newPath()
                .lineTo(200, 200)
                .at(1, 0, 0)
                .add();
        }).rejects.toThrow(/No current point set/);
    });
});
