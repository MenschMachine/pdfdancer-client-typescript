/**
 * E2E tests demonstrating the test drawing helpers
 */

import {requireEnvAndFixture} from './test-helpers';
import {PDFDancer, Color} from "../../index";
import {
    drawCoordinateGrid,
    drawBoundingBox,
    drawBoundingBoxes,
    drawCrosshair,
    highlightText,
    drawArrow
} from './test-drawing-helpers';

describe('Test Drawing Helpers E2E Tests', () => {

    test('draw coordinate grid on blank PDF', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('blank.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        // Draw a coordinate grid
        await drawCoordinateGrid(pdf, {
            pageIndex: 0,
            spacing: 50,
            majorInterval: 100,
            showLabels: true
        });

        // Verify the grid was added by checking for paths
        const paths = await pdf.selectPaths();
        expect(paths.length).toBeGreaterThan(0);
    });

    test('draw bounding boxes around paragraphs', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('sample.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        // First, draw a coordinate grid for reference
        await drawCoordinateGrid(pdf, {
            pageIndex: 0,
            spacing: 50,
            majorInterval: 100
        });

        // Get all paragraphs on page 0
        const paragraphs = await pdf.page(0).selectParagraphs();

        // Draw bounding boxes around all paragraphs
        await drawBoundingBoxes(pdf, paragraphs, {
            color: new Color(255, 0, 0),
            lineWidth: 1.5,
            showDimensions: true,
            showCorners: true
        });

        expect(paragraphs.length).toBeGreaterThan(0);
    });

    test('draw bounding box around single text element', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('sample.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        // Select the first paragraph
        const paragraph = await pdf.selectParagraph();
        if (paragraph) {
            // Draw a dashed bounding box
            await drawBoundingBox(pdf, paragraph, {
                color: new Color(0, 0, 255),
                lineWidth: 2,
                dashPattern: [5, 3],
                showDimensions: true
            });

            expect(paragraph).not.toBeNull();
        }
    });

    test('draw crosshairs at specific coordinates', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('blank.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        // Draw coordinate grid first
        await drawCoordinateGrid(pdf);

        // Mark some test points with crosshairs
        await drawCrosshair(pdf, 100, 100, {
            color: new Color(255, 0, 0),
            size: 10,
            label: 'Point A'
        });

        await drawCrosshair(pdf, 200, 200, {
            color: new Color(0, 255, 0),
            size: 10,
            label: 'Point B'
        });

        await drawCrosshair(pdf, 300, 150, {
            color: new Color(0, 0, 255),
            size: 10,
            label: 'Point C'
        });

        const paths = await pdf.selectPaths();
        expect(paths.length).toBeGreaterThan(0);
    });

    test('highlight text elements', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('sample.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        // Get text lines
        const textLines = await pdf.page(0).selectTextLines();

        // Highlight the first few text lines
        for (let i = 0; i < Math.min(3, textLines.length); i++) {
            await highlightText(pdf, textLines[i], {
                color: new Color(255, 255, 0, 100),  // Semi-transparent yellow
                padding: 2
            });
        }

        expect(textLines.length).toBeGreaterThan(0);
    });

    test('draw arrows between points', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('blank.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        // Draw coordinate grid
        await drawCoordinateGrid(pdf);

        // Draw arrows showing some movement or relationship
        await drawArrow(pdf, 100, 100, 200, 200, {
            color: new Color(255, 0, 0),
            lineWidth: 2,
            arrowSize: 10,
            label: 'Direction 1'
        });

        await drawArrow(pdf, 300, 100, 300, 300, {
            color: new Color(0, 0, 255),
            lineWidth: 2,
            arrowSize: 10,
            label: 'Direction 2'
        });

        const paths = await pdf.selectPaths();
        expect(paths.length).toBeGreaterThan(0);
    });

    test('comprehensive visualization example', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('sample.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        // 1. Draw coordinate grid
        await drawCoordinateGrid(pdf, {
            pageIndex: 0,
            spacing: 25,
            majorInterval: 100
        });

        // 2. Add a test paragraph
        await pdf.newParagraph()
            .text('Test Paragraph', new Color(0, 0, 0))
            .font('Helvetica', 12)
            .at(0, 100, 200)
            .add();

        // 3. Get the paragraph and draw its bounding box
        const paragraphs = await pdf.page(0).selectParagraphs();
        if (paragraphs.length > 0) {
            await drawBoundingBox(pdf, paragraphs[0], {
                color: new Color(255, 0, 0),
                showDimensions: true
            });
        }

        // 4. Mark the exact position with a crosshair
        await drawCrosshair(pdf, 100, 200, {
            color: new Color(0, 255, 0),
            label: 'Insert Point'
        });

        // 5. Draw an arrow showing the text direction
        const rect = paragraphs[0]?.position?.boundingRect;
        if (rect) {
            await drawArrow(
                pdf,
                rect.x - 20,
                rect.y + rect.height / 2,
                rect.x,
                rect.y + rect.height / 2,
                {
                    color: new Color(0, 0, 255),
                    label: 'Text flow'
                }
            );
        }

        expect(paragraphs.length).toBeGreaterThan(0);
    });

    test('custom grid with different styling', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('blank.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        // Draw a custom styled grid
        await drawCoordinateGrid(pdf, {
            pageIndex: 0,
            startX: 0,
            startY: 0,
            endX: 400,
            endY: 400,
            spacing: 20,
            majorInterval: 100,
            gridColor: new Color(200, 220, 255),      // Light blue
            majorGridColor: new Color(100, 150, 255),  // Medium blue
            labelColor: new Color(50, 50, 150),        // Dark blue
            fontSize: 6,
            showLabels: true
        });

        const paths = await pdf.selectPaths();
        expect(paths.length).toBeGreaterThan(0);
    });
});
