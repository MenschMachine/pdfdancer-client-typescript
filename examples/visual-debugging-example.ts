/**
 * Visual Debugging Example
 *
 * This example demonstrates how to use the test drawing helpers
 * to visualize and debug PDF operations.
 */

import { PDFDancer, Color, StandardFonts } from '../src';
import * as fs from 'fs';
import {
    drawCoordinateGrid,
    drawBoundingBox,
    drawCrosshair,
    drawArrow,
    highlightText
} from '../src/__tests__/e2e/test-drawing-helpers';

async function visualDebuggingExample() {
    const pdfData = fs.readFileSync('blank.pdf');
    const token = process.env.PDFDANCER_API_TOKEN || process.env.PDFDANCER_TOKEN || 'your-api-token';
    const baseUrl = process.env.PDFDANCER_BASE_URL || 'https://api.pdfdancer.com';

    const pdf = await PDFDancer.open(pdfData, token, baseUrl);

    // ====== SCENARIO 1: Debugging Text Positioning ======
    console.log('Scenario 1: Debugging text positioning...');

    // Draw coordinate grid first for reference
    await drawCoordinateGrid(pdf, {
        pageNumber: 0,
        spacing: 50,
        majorInterval: 100
    });

    // Try to add text at specific coordinates
    const targetX = 100;
    const targetY = 200;

    // Mark where we THINK the text will go
    await drawCrosshair(pdf, targetX, targetY, {
        color: new Color(0, 255, 0),
        size: 8,
        label: 'Expected'
    });

    // Add the text
    await pdf.newParagraph()
        .text('Hello, World!', new Color(0, 0, 0))
        .font(StandardFonts.HELVETICA, 12)
        .at(0, targetX, targetY)
        .add();

    // Get the actual paragraph and visualize where it ended up
    const paragraphs = await pdf.page(0).selectParagraphs();
    if (paragraphs.length > 0) {
        const actualParagraph = paragraphs[0];

        // Draw bounding box to see actual position
        await drawBoundingBox(pdf, actualParagraph, {
            color: new Color(255, 0, 0),
            showDimensions: true,
            showCorners: true
        });

        // Mark actual position
        const rect = actualParagraph.position.boundingRect;
        if (rect) {
            await drawCrosshair(pdf, rect.x, rect.y, {
                color: new Color(255, 0, 0),
                size: 8,
                label: 'Actual'
            });

            // Draw arrow showing the offset (if any)
            if (rect.x !== targetX || rect.y !== targetY) {
                await drawArrow(pdf, targetX, targetY, rect.x, rect.y, {
                    color: new Color(255, 128, 0),
                    label: `Offset: (${(rect.x - targetX).toFixed(1)}, ${(rect.y - targetY).toFixed(1)})`
                });
            }
        }
    }

    // Save the first scenario
    const scenario1Pdf = await pdf.getBytes();
    fs.writeFileSync('debug-scenario1-positioning.pdf', scenario1Pdf);
    console.log('Saved: debug-scenario1-positioning.pdf');

    // ====== SCENARIO 2: Testing Move Operations ======
    console.log('\nScenario 2: Testing move operations...');

    // Create a new PDF for this scenario
    const pdf2 = await PDFDancer.open(fs.readFileSync('blank.pdf'), token, baseUrl);

    await drawCoordinateGrid(pdf2);

    // Add a paragraph
    await pdf2.newParagraph()
        .text('Moving Text', new Color(0, 0, 0))
        .font(StandardFonts.HELVETICA, 14)
        .at(0, 150, 300)
        .add();

    const para = await pdf2.selectParagraph();
    if (para) {
        // Get original position
        const origRect = para.position.boundingRect!;
        const origX = origRect.x;
        const origY = origRect.y;

        // Mark original position
        await drawCrosshair(pdf2, origX, origY, {
            color: new Color(255, 0, 0),
            label: 'Start'
        });

        // Draw original bounding box
        await drawBoundingBox(pdf2, para, {
            color: new Color(255, 0, 0, 100),
            dashPattern: [5, 3]
        });

        // Move the paragraph
        const newX = 300;
        const newY = 400;
        await para.moveTo(newX, newY);

        // Mark target position
        await drawCrosshair(pdf2, newX, newY, {
            color: new Color(0, 255, 0),
            label: 'Target'
        });

        // Get updated paragraph and draw its new bounding box
        const movedPara = await pdf2.selectParagraph();
        if (movedPara) {
            await drawBoundingBox(pdf2, movedPara, {
                color: new Color(0, 255, 0),
                showDimensions: true
            });

            // Draw arrow showing movement
            await drawArrow(pdf2, origX, origY, newX, newY, {
                color: new Color(0, 0, 255),
                lineWidth: 2,
                label: 'Movement Vector'
            });
        }
    }

    const scenario2Pdf = await pdf2.getBytes();
    fs.writeFileSync('debug-scenario2-movement.pdf', scenario2Pdf);
    console.log('Saved: debug-scenario2-movement.pdf');

    // ====== SCENARIO 3: Analyzing Text Layout ======
    console.log('\nScenario 3: Analyzing text layout...');

    const pdf3 = await PDFDancer.open(fs.readFileSync('sample.pdf'), token, baseUrl);

    // Draw fine grid for detailed analysis
    await drawCoordinateGrid(pdf3, {
        spacing: 25,
        majorInterval: 100,
        gridColor: new Color(240, 240, 240),
        majorGridColor: new Color(200, 200, 200)
    });

    // Get all text lines
    const textLines = await pdf3.page(0).selectTextLines();

    console.log(`Found ${textLines.length} text lines`);

    // Highlight and box each text line with different colors
    const colors = [
        new Color(255, 200, 200),  // Light red
        new Color(200, 255, 200),  // Light green
        new Color(200, 200, 255),  // Light blue
        new Color(255, 255, 200),  // Light yellow
        new Color(255, 200, 255),  // Light magenta
    ];

    for (let i = 0; i < Math.min(textLines.length, 5); i++) {
        const textLine = textLines[i];
        const color = colors[i % colors.length];

        // Highlight the text
        await highlightText(pdf3, textLine, {
            color: new Color(color.r, color.g, color.b, 80),
            padding: 1
        });

        // Draw bounding box
        await drawBoundingBox(pdf3, textLine, {
            color: new Color(color.r - 50, color.g - 50, color.b - 50),
            lineWidth: 0.5,
            showDimensions: false,
            showCorners: false
        });
    }

    const scenario3Pdf = await pdf3.getBytes();
    fs.writeFileSync('debug-scenario3-layout.pdf', scenario3Pdf);
    console.log('Saved: debug-scenario3-layout.pdf');

    // ====== SCENARIO 4: Path Visualization ======
    console.log('\nScenario 4: Visualizing paths...');

    const pdf4 = await PDFDancer.open(fs.readFileSync('blank.pdf'), token, baseUrl);

    await drawCoordinateGrid(pdf4);

    // Define some path points
    const pathPoints = [
        { x: 100, y: 100 },
        { x: 200, y: 150 },
        { x: 300, y: 100 },
        { x: 400, y: 200 }
    ];

    // Mark all the points
    for (let i = 0; i < pathPoints.length; i++) {
        await drawCrosshair(pdf4, pathPoints[i].x, pathPoints[i].y, {
            color: new Color(0, 0, 255),
            size: 5,
            label: `P${i}`
        });
    }

    // Draw the actual path
    const pathBuilder = pdf4.newPath()
        .moveTo(pathPoints[0].x, pathPoints[0].y);

    for (let i = 1; i < pathPoints.length; i++) {
        pathBuilder.lineTo(pathPoints[i].x, pathPoints[i].y);
    }

    await pathBuilder
        .strokeColor(new Color(255, 0, 0))
        .strokeWidth(2)
        .at(0, 0, 0)
        .add();

    // Draw arrows showing direction
    for (let i = 0; i < pathPoints.length - 1; i++) {
        const from = pathPoints[i];
        const to = pathPoints[i + 1];
        const midX = (from.x + to.x) / 2;
        const midY = (from.y + to.y) / 2;

        await drawArrow(pdf4, from.x, from.y, midX, midY, {
            color: new Color(0, 150, 0),
            arrowSize: 5
        });
    }

    const scenario4Pdf = await pdf4.getBytes();
    fs.writeFileSync('debug-scenario4-paths.pdf', scenario4Pdf);
    console.log('Saved: debug-scenario4-paths.pdf');

    console.log('\n✅ All debugging visualizations created successfully!');
    console.log('Check the debug-scenario*.pdf files for visual analysis.');

    // Clean up sessions
    await pdf.close();
    await pdf2.close();
    await pdf3.close();
    await pdf4.close();
}

// Run the example
visualDebuggingExample().catch(error => {
    console.error('Error:', error);
    process.exit(1);
});
