/**
 * Test Drawing Helpers
 *
 * Utilities for drawing coordinate grids and bounding boxes on PDFs
 * to help with visual debugging and testing.
 */

import {PDFDancer, Color, StandardFonts, Position} from "../../index";

/**
 * Represents any PDF object that has a position property.
 * This includes BaseObject subclasses like ParagraphObject, TextLineObject, etc.
 */
export interface PositionedObject {
    position: Position;
}

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
    let {
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

    // Get page size if available and not explicitly set
    if (options.endX === undefined || options.endY === undefined) {
        const pages = await pdf.getPages();
        if (pages.length > pageIndex) {
            const pageSize = pages[pageIndex].pageSize;
            if (pageSize) {
                endX = options.endX ?? pageSize.width ?? endX;
                endY = options.endY ?? pageSize.height ?? endY;
            }
        }
    }

    // Draw all minor vertical lines in one path
    const minorVerticalPath = pdf.newPath();
    let hasMinorVertical = false;
    for (let x = startX; x <= endX; x += spacing) {
        const isMajor = x % majorInterval === 0;
        if (!isMajor) {
            minorVerticalPath.moveTo(x, startY).lineTo(x, endY);
            hasMinorVertical = true;
        }
    }
    if (hasMinorVertical) {
        await minorVerticalPath
            .strokeColor(gridColor)
            .strokeWidth(0.25)
            .at(pageIndex, startX, startY)
            .add();
    }

    // Draw all major vertical lines in one path
    const majorVerticalPath = pdf.newPath();
    let hasMajorVertical = false;
    for (let x = startX; x <= endX; x += spacing) {
        const isMajor = x % majorInterval === 0;
        if (isMajor) {
            majorVerticalPath.moveTo(x, startY).lineTo(x, endY);
            hasMajorVertical = true;

            // Add labels for major lines
            if (showLabels) {
                await pdf.newParagraph()
                    .text(`${x}`, labelColor)
                    .font(StandardFonts.HELVETICA, fontSize)
                    .at(pageIndex, x - 10, startY + 5)
                    .add();
            }
        }
    }
    if (hasMajorVertical) {
        await majorVerticalPath
            .strokeColor(majorGridColor)
            .strokeWidth(0.5)
            .at(pageIndex, startX, startY)
            .add();
    }

    // Draw all minor horizontal lines in one path
    const minorHorizontalPath = pdf.newPath();
    let hasMinorHorizontal = false;
    for (let y = startY; y <= endY; y += spacing) {
        const isMajor = y % majorInterval === 0;
        if (!isMajor) {
            minorHorizontalPath.moveTo(startX, y).lineTo(endX, y);
            hasMinorHorizontal = true;
        }
    }
    if (hasMinorHorizontal) {
        await minorHorizontalPath
            .strokeColor(gridColor)
            .strokeWidth(0.25)
            .at(pageIndex, startX, startY)
            .add();
    }

    // Draw all major horizontal lines in one path
    const majorHorizontalPath = pdf.newPath();
    let hasMajorHorizontal = false;
    for (let y = startY; y <= endY; y += spacing) {
        const isMajor = y % majorInterval === 0;
        if (isMajor) {
            majorHorizontalPath.moveTo(startX, y).lineTo(endX, y);
            hasMajorHorizontal = true;

            // Add labels for major lines
            if (showLabels) {
                await pdf.newParagraph()
                    .text(`${y}`, labelColor)
                    .font(StandardFonts.HELVETICA, fontSize)
                    .at(pageIndex, startX + 5, y - 2)
                    .add();
            }
        }
    }
    if (hasMajorHorizontal) {
        await majorHorizontalPath
            .strokeColor(majorGridColor)
            .strokeWidth(0.5)
            .at(pageIndex, startX, startY)
            .add();
    }

    // Draw origin marker (0, 0) if it's within the grid bounds
    if (startX <= 0 && endX >= 0 && startY <= 0 && endY >= 0) {
        await pdf.newPath()
            .moveTo(-5, 0)
            .lineTo(5, 0)
            .strokeColor(new Color(255, 0, 0))
            .strokeWidth(2)
            .at(pageIndex, -5, -5)
            .add();

        await pdf.newPath()
            .moveTo(0, -5)
            .lineTo(0, 5)
            .strokeColor(new Color(255, 0, 0))
            .strokeWidth(2)
            .at(pageIndex, -5, -5)
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
    objectRef: PositionedObject,
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
        .at(pageIndex, x, y);

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
                .at(pageIndex, corner.x - cornerSize, corner.y)
                .add();

            // Vertical line
            await pdf.newPath()
                .moveTo(corner.x, corner.y - cornerSize)
                .lineTo(corner.x, corner.y + cornerSize)
                .strokeColor(color)
                .strokeWidth(lineWidth + 0.5)
                .at(pageIndex, corner.x, corner.y - cornerSize)
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
    objectRefs: PositionedObject[],
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
        .at(pageIndex, x - size, y)
        .add();

    // Vertical line
    await pdf.newPath()
        .moveTo(x, y - size)
        .lineTo(x, y + size)
        .strokeColor(color)
        .strokeWidth(lineWidth)
        .at(pageIndex, x, y - size)
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
        .at(pageIndex, x - size, y - size)
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
    textObjectRef: PositionedObject,
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
        .at(pageIndex, rect.x - padding, rect.y - padding)
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
        .at(pageIndex, Math.min(fromX, toX), Math.min(fromY, toY))
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
        .at(pageIndex, Math.min(toX, leftX), Math.min(toY, leftY))
        .add();

    // Right arrow line
    const rightX = toX - arrowSize * Math.cos(angle + arrowAngle);
    const rightY = toY - arrowSize * Math.sin(angle + arrowAngle);

    await pdf.newPath()
        .moveTo(toX, toY)
        .lineTo(rightX, rightY)
        .strokeColor(color)
        .strokeWidth(lineWidth)
        .at(pageIndex, Math.min(toX, rightX), Math.min(toY, rightY))
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
