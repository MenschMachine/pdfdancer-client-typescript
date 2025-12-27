/**
 * PathBuilder Example
 *
 * This example demonstrates how to use the PathBuilder to create vector paths in PDFs.
 */

import { PDFDancer, Color } from '../src';
import * as fs from 'fs';

async function pathBuilderExample() {
    // Load an existing PDF or create a new one
    const pdfData = fs.readFileSync('blank.pdf');
    const token = process.env.PDFDANCER_API_TOKEN || process.env.PDFDANCER_TOKEN || 'your-api-token';
    const baseUrl = process.env.PDFDANCER_BASE_URL || 'https://api.pdfdancer.com';

    const pdf = await PDFDancer.open(pdfData, token, baseUrl);

    // Example 1: Simple line
    await pdf.newPath()
        .moveTo(100, 100)
        .lineTo(200, 200)
        .strokeColor(new Color(0, 0, 0))
        .strokeWidth(2)
        .at(0, 0, 0)  // Page 0, position (0, 0)
        .add();

    // Example 2: Rectangle with page-level API
    await pdf.page(0).newPath()
        .moveTo(50, 50)
        .lineTo(150, 50)
        .lineTo(150, 150)
        .lineTo(50, 150)
        .lineTo(50, 50)  // Close the rectangle
        .strokeColor(new Color(255, 0, 0))
        .strokeWidth(3)
        .at(0, 0)  // Position (0, 0) on the current page
        .add();

    // Example 3: Filled rectangle
    await pdf.newPath()
        .moveTo(250, 50)
        .lineTo(350, 50)
        .lineTo(350, 150)
        .lineTo(250, 150)
        .lineTo(250, 50)
        .fillColor(new Color(200, 200, 255))  // Light blue fill
        .strokeColor(new Color(0, 0, 255))     // Blue stroke
        .strokeWidth(2)
        .at(0, 0, 0)
        .add();

    // Example 4: Bezier curve
    await pdf.newPath()
        .moveTo(100, 300)
        .bezierTo(150, 250, 250, 350, 300, 300)
        .strokeColor(new Color(0, 255, 0))
        .strokeWidth(3)
        .at(0, 0, 0)
        .add();

    // Example 5: Dashed line
    await pdf.newPath()
        .moveTo(100, 400)
        .lineTo(400, 400)
        .strokeColor(new Color(0, 0, 0))
        .strokeWidth(2)
        .dashPattern([10, 5, 2, 5])  // 10 on, 5 off, 2 on, 5 off
        .at(0, 0, 0)
        .add();

    // Example 6: Complex path with multiple segments
    await pdf.newPath()
        .moveTo(100, 500)
        .lineTo(200, 500)
        .bezierTo(250, 450, 250, 550, 300, 500)
        .lineTo(400, 500)
        .strokeColor(new Color(255, 0, 255))
        .strokeWidth(4)
        .at(0, 0, 0)
        .add();

    // Example 7: Triangle with even-odd fill
    await pdf.newPath()
        .moveTo(500, 100)
        .lineTo(550, 200)
        .lineTo(450, 200)
        .lineTo(500, 100)
        .fillColor(new Color(255, 255, 0))
        .strokeColor(new Color(0, 0, 0))
        .strokeWidth(2)
        .evenOddFill(true)
        .at(0, 0, 0)
        .add();

    // Save the modified PDF
    const modifiedPdf = await pdf.getBytes();
    fs.writeFileSync('output-with-paths.pdf', modifiedPdf);

    console.log('PDF with paths created successfully!');

    // Close the session
    await pdf.close();
}

// Run the example
pathBuilderExample().catch(console.error);
