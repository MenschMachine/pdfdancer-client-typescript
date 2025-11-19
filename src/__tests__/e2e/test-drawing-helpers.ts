/**
 * Test Drawing Helpers
 *
 * Utilities for drawing coordinate grids and bounding boxes on PDFs
 * to help with visual debugging and testing.
 */

import {PDFDancer, Color, StandardFonts, ObjectRef, TextObjectRef} from "../../index";

export interface GridOptions {
    /** Starting X coordinate (default: 0) */
    startX?: number;
    /** Starting Y coordinate (default: 0) */
    startY?: number;
    /** Ending X coordinate (default: page width) */
    endX?: number;
    /** Ending Y coordinate (default: page height) */
    endY?: number;
    /** Grid spacing in points (default: 50) */
    spacing?: number;
    /** Major grid line interval (default: 100) */
    majorInterval?: number;
    /** Grid line color (default: light gray) */
    gridColor?: Color;
    /** Major grid line color (default: medium gray) */
    majorGridColor?: Color;
    /** Label color (default: dark gray) */
    labelColor?: Color;
    /** Font size for labels (default: 8) */
    fontSize?: number;
    /** Page index to draw on (default: 0) */
    pageIndex?: number;
    /** Show labels (default: true) */
    showLabels?: boolean;
}

export interface BoundingBoxOptions {
    /** Bounding box color (default: red) */
    color?: Color;
    /** Line width (default: 1) */
    lineWidth?: number;
    /** Dash pattern (default: solid line) */
    dashPattern?: number[];
    /** Show corner markers (default: true) */
    showCorners?: boolean;
    /** Corner marker size (default: 3) */
    cornerSize?: number;
    /** Show dimensions label (default: true) */
    showDimensions?: boolean;
}

/**
 * Draws a coordinate grid on the specified page of a PDF.
 * Useful for understanding coordinate systems and positioning.
 *
 * @example
 * ```typescript
 * await drawCoordinateGrid(pdf, {
 *   pageIndex: 0,
 *   spacing: 50,
 *   majorInterval: 100
 * });
 * ```
 */
export async function drawCoordinateGrid(pdf: PDFDancer, options: GridOptions = {}): Promise<void> {
    const {
        startX = 0,
        startY = 0,
        endX = 595,  // A4 width in points
        endY = 842,  // A4 height in points
        spacing = 50,
        majorInterval = 100,
        gridColor = new Color(220, 220, 220),
        majorGridColor = new Color(180, 180, 180),
        labelColor = new Color(100, 100, 100),
        fontSize = 8,
        pageIndex = 0,
        showLabels = true
    } = options;

    // Get page size if available
    const pages = await pdf.getPages();
    if (pages.length > pageIndex) {
        const pageSize = pages[pageIndex].pageSize;
        if (pageSize) {
            // Use actual page size if not specified
            const actualEndX = options.endX ?? pageSize.width ?? endX;
            const actualEndY = options.endY ?? pageSize.height ?? endY;

            await drawCoordinateGrid(pdf, {
                ...options,
                endX: actualEndX,
                endY: actualEndY
            });
            return;
        }
    }

    // Draw vertical lines
    for (let x = startX; x <= endX; x += spacing) {
        const isMajor = x % majorInterval === 0;
        const color = isMajor ? majorGridColor : gridColor;
        const width = isMajor ? 0.5 : 0.25;

        await pdf.newPath()
            .moveTo(x, startY)
            .lineTo(x, endY)
            .strokeColor(color)
            .strokeWidth(width)
            .at(pageIndex, 0, 0)
            .add();

        // Add labels for major lines
        if (showLabels && isMajor) {
            await pdf.newParagraph()
                .text(`${x}`, labelColor)
                .font(StandardFonts.HELVETICA, fontSize)
                .at(pageIndex, x - 10, startY + 5)
                .add();
        }
    }

    // Draw horizontal lines
    for (let y = startY; y <= endY; y += spacing) {
        const isMajor = y % majorInterval === 0;
        const color = isMajor ? majorGridColor : gridColor;
        const width = isMajor ? 0.5 : 0.25;

        await pdf.newPath()
            .moveTo(startX, y)
            .lineTo(endX, y)
            .strokeColor(color)
            .strokeWidth(width)
            .at(pageIndex, 0, 0)
            .add();

        // Add labels for major lines
        if (showLabels && isMajor) {
            await pdf.newParagraph()
                .text(`${y}`, labelColor)
                .font(StandardFonts.HELVETICA, fontSize)
                .at(pageIndex, startX + 5, y - 2)
                .add();
        }
    }

    // Draw origin marker (0, 0)
    if (startX <= 0 && startY <= 0) {
        await pdf.newPath()
            .moveTo(-5, 0)
            .lineTo(5, 0)
            .strokeColor(new Color(255, 0, 0))
            .strokeWidth(2)
            .at(pageIndex, 0, 0)
            .add();

        await pdf.newPath()
            .moveTo(0, -5)
            .lineTo(0, 5)
            .strokeColor(new Color(255, 0, 0))
            .strokeWidth(2)
            .at(pageIndex, 0, 0)
            .add();
    }
}

/**
 * Draws a bounding box around a text element, paragraph, or any object with position information.
 *
 * @example
 * ```typescript
 * const paragraph = await pdf.selectParagraph();
 * await drawBoundingBox(pdf, paragraph, {
 *   color: new Color(255, 0, 0),
 *   showDimensions: true
 * });
 * ```
 */
export async function drawBoundingBox(
    pdf: PDFDancer,
    objectRef: ObjectRef,
    options: BoundingBoxOptions = {}
): Promise<void> {
    const {
        color = new Color(255, 0, 0),
        lineWidth = 1,
        dashPattern,
        showCorners = true,
        cornerSize = 3,
        showDimensions = true
    } = options;

    const position = objectRef.position;
    if (!position || !position.boundingRect) {
        console.warn('Object has no bounding rectangle, skipping bounding box');
        return;
    }

    const rect = position.boundingRect;
    const pageIndex = position.pageIndex ?? 0;
    const x = rect.x;
    const y = rect.y;
    const width = rect.width;
    const height = rect.height;

    // Draw the main bounding box rectangle
    const pathBuilder = pdf.newPath()
        .moveTo(x, y)
        .lineTo(x + width, y)
        .lineTo(x + width, y + height)
        .lineTo(x, y + height)
        .lineTo(x, y)
        .strokeColor(color)
        .strokeWidth(lineWidth)
        .at(pageIndex, 0, 0);

    if (dashPattern) {
        pathBuilder.dashPattern(dashPattern);
    }

    await pathBuilder.add();

    // Draw corner markers
    if (showCorners) {
        const corners = [
            {x, y},  // Bottom-left
            {x: x + width, y},  // Bottom-right
            {x: x + width, y: y + height},  // Top-right
            {x, y: y + height}  // Top-left
        ];

        for (const corner of corners) {
            // Horizontal line
            await pdf.newPath()
                .moveTo(corner.x - cornerSize, corner.y)
                .lineTo(corner.x + cornerSize, corner.y)
                .strokeColor(color)
                .strokeWidth(lineWidth + 0.5)
                .at(pageIndex, 0, 0)
                .add();

            // Vertical line
            await pdf.newPath()
                .moveTo(corner.x, corner.y - cornerSize)
                .lineTo(corner.x, corner.y + cornerSize)
                .strokeColor(color)
                .strokeWidth(lineWidth + 0.5)
                .at(pageIndex, 0, 0)
                .add();
        }
    }

    // Draw dimensions label
    if (showDimensions) {
        const dimensionText = `${width.toFixed(1)}×${height.toFixed(1)}`;
        const labelX = x + width / 2 - 15;
        const labelY = y - 10;

        await pdf.newParagraph()
            .text(dimensionText, color)
            .font(StandardFonts.HELVETICA, 7)
            .at(pageIndex, labelX, labelY)
            .add();

        // Position label
        const positionText = `(${x.toFixed(1)}, ${y.toFixed(1)})`;
        await pdf.newParagraph()
            .text(positionText, color)
            .font(StandardFonts.HELVETICA, 7)
            .at(pageIndex, x, y + height + 2)
            .add();
    }
}

/**
 * Draws bounding boxes around all objects of a specific type on a page.
 *
 * @example
 * ```typescript
 * // Draw boxes around all paragraphs
 * const paragraphs = await pdf.selectParagraphs();
 * await drawBoundingBoxes(pdf, paragraphs, {
 *   color: new Color(0, 255, 0)
 * });
 * ```
 */
export async function drawBoundingBoxes(
    pdf: PDFDancer,
    objectRefs: ObjectRef[],
    options: BoundingBoxOptions = {}
): Promise<void> {
    for (const objectRef of objectRefs) {
        await drawBoundingBox(pdf, objectRef, options);
    }
}

/**
 * Draws a cross-hair marker at specific coordinates.
 * Useful for marking test points.
 *
 * @example
 * ```typescript
 * await drawCrosshair(pdf, 100, 200, {
 *   color: new Color(0, 0, 255),
 *   size: 10
 * });
 * ```
 */
export async function drawCrosshair(
    pdf: PDFDancer,
    x: number,
    y: number,
    options: {
        color?: Color;
        size?: number;
        lineWidth?: number;
        pageIndex?: number;
        label?: string;
    } = {}
): Promise<void> {
    const {
        color = new Color(255, 0, 0),
        size = 5,
        lineWidth = 1,
        pageIndex = 0,
        label
    } = options;

    // Horizontal line
    await pdf.newPath()
        .moveTo(x - size, y)
        .lineTo(x + size, y)
        .strokeColor(color)
        .strokeWidth(lineWidth)
        .at(pageIndex, 0, 0)
        .add();

    // Vertical line
    await pdf.newPath()
        .moveTo(x, y - size)
        .lineTo(x, y + size)
        .strokeColor(color)
        .strokeWidth(lineWidth)
        .at(pageIndex, 0, 0)
        .add();

    // Circle
    await pdf.newPath()
        .moveTo(x + size, y)
        .bezierTo(x + size, y + size * 0.55, x + size * 0.55, y + size, x, y + size)
        .bezierTo(x - size * 0.55, y + size, x - size, y + size * 0.55, x - size, y)
        .bezierTo(x - size, y - size * 0.55, x - size * 0.55, y - size, x, y - size)
        .bezierTo(x + size * 0.55, y - size, x + size, y - size * 0.55, x + size, y)
        .strokeColor(color)
        .strokeWidth(lineWidth)
        .at(pageIndex, 0, 0)
        .add();

    // Add label if provided
    if (label) {
        await pdf.newParagraph()
            .text(label, color)
            .font(StandardFonts.HELVETICA, 8)
            .at(pageIndex, x + size + 2, y - 3)
            .add();
    }
}

/**
 * Highlights the text content of a text object with a semi-transparent background.
 *
 * @example
 * ```typescript
 * const textLine = await pdf.selectTextLine();
 * await highlightText(pdf, textLine, {
 *   color: new Color(255, 255, 0, 128)  // Yellow with 50% transparency
 * });
 * ```
 */
export async function highlightText(
    pdf: PDFDancer,
    textObjectRef: TextObjectRef,
    options: {
        color?: Color;
        padding?: number;
    } = {}
): Promise<void> {
    const {
        color = new Color(255, 255, 0, 128),  // Yellow with transparency
        padding = 2
    } = options;

    const position = textObjectRef.position;
    if (!position || !position.boundingRect) {
        console.warn('Text object has no bounding rectangle, skipping highlight');
        return;
    }

    const rect = position.boundingRect;
    const pageIndex = position.pageIndex ?? 0;

    await pdf.newPath()
        .moveTo(rect.x - padding, rect.y - padding)
        .lineTo(rect.x + rect.width + padding, rect.y - padding)
        .lineTo(rect.x + rect.width + padding, rect.y + rect.height + padding)
        .lineTo(rect.x - padding, rect.y + rect.height + padding)
        .lineTo(rect.x - padding, rect.y - padding)
        .fillColor(color)
        .at(pageIndex, 0, 0)
        .add();
}

/**
 * Draws an arrow between two points.
 * Useful for indicating relationships or directions in test visualizations.
 *
 * @example
 * ```typescript
 * await drawArrow(pdf, 100, 100, 200, 200, {
 *   color: new Color(0, 0, 255),
 *   label: "Move direction"
 * });
 * ```
 */
export async function drawArrow(
    pdf: PDFDancer,
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    options: {
        color?: Color;
        lineWidth?: number;
        arrowSize?: number;
        pageIndex?: number;
        label?: string;
    } = {}
): Promise<void> {
    const {
        color = new Color(0, 0, 255),
        lineWidth = 1.5,
        arrowSize = 8,
        pageIndex = 0,
        label
    } = options;

    // Draw main line
    await pdf.newPath()
        .moveTo(fromX, fromY)
        .lineTo(toX, toY)
        .strokeColor(color)
        .strokeWidth(lineWidth)
        .at(pageIndex, 0, 0)
        .add();

    // Calculate arrow head angle
    const angle = Math.atan2(toY - fromY, toX - fromX);
    const arrowAngle = Math.PI / 6; // 30 degrees

    // Left arrow line
    const leftX = toX - arrowSize * Math.cos(angle - arrowAngle);
    const leftY = toY - arrowSize * Math.sin(angle - arrowAngle);

    await pdf.newPath()
        .moveTo(toX, toY)
        .lineTo(leftX, leftY)
        .strokeColor(color)
        .strokeWidth(lineWidth)
        .at(pageIndex, 0, 0)
        .add();

    // Right arrow line
    const rightX = toX - arrowSize * Math.cos(angle + arrowAngle);
    const rightY = toY - arrowSize * Math.sin(angle + arrowAngle);

    await pdf.newPath()
        .moveTo(toX, toY)
        .lineTo(rightX, rightY)
        .strokeColor(color)
        .strokeWidth(lineWidth)
        .at(pageIndex, 0, 0)
        .add();

    // Add label if provided
    if (label) {
        const midX = (fromX + toX) / 2;
        const midY = (fromY + toY) / 2;

        await pdf.newParagraph()
            .text(label, color)
            .font(StandardFonts.HELVETICA, 8)
            .at(pageIndex, midX + 5, midY + 5)
            .add();
    }
}
