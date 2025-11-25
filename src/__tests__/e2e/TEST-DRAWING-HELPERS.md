# Test Drawing Helpers

This module provides utilities for visualizing and debugging PDF operations in tests. These helpers use the PathBuilder and ParagraphBuilder to draw coordinate grids, bounding boxes, and other visual aids directly on PDFs.

## Installation

```typescript
import {
    drawCoordinateGrid,
    drawBoundingBox,
    drawBoundingBoxes,
    drawCrosshair,
    highlightText,
    drawArrow
} from './test-drawing-helpers';
```

## Available Helpers

### 1. `drawCoordinateGrid(pdf, options)`

Draws a coordinate grid on a PDF page to help understand the coordinate system.

**Options:**
- `startX`, `startY`: Starting coordinates (default: 0, 0)
- `endX`, `endY`: Ending coordinates (default: page size)
- `spacing`: Grid spacing in points (default: 50)
- `majorInterval`: Interval for major grid lines (default: 100)
- `gridColor`: Color for minor grid lines (default: light gray)
- `majorGridColor`: Color for major grid lines (default: medium gray)
- `labelColor`: Color for coordinate labels (default: dark gray)
- `fontSize`: Font size for labels (default: 8)
- `pageNumber`: Page to draw on (default: 0)
- `showLabels`: Whether to show coordinate labels (default: true)

**Example:**
```typescript
await drawCoordinateGrid(pdf, {
    pageNumber: 0,
    spacing: 50,
    majorInterval: 100,
    showLabels: true
});
```

### 2. `drawBoundingBox(pdf, objectRef, options)`

Draws a bounding box around a single PDF object (paragraph, text line, image, etc.).

**Options:**
- `color`: Box color (default: red)
- `lineWidth`: Line width (default: 1)
- `dashPattern`: Dash pattern for dashed lines
- `showCorners`: Show corner markers (default: true)
- `cornerSize`: Size of corner markers (default: 3)
- `showDimensions`: Show dimensions and position labels (default: true)

**Example:**
```typescript
const paragraph = await pdf.selectParagraph();
await drawBoundingBox(pdf, paragraph, {
    color: new Color(255, 0, 0),
    lineWidth: 1.5,
    showDimensions: true
});
```

### 3. `drawBoundingBoxes(pdf, objectRefs, options)`

Draws bounding boxes around multiple objects.

**Example:**
```typescript
const paragraphs = await pdf.selectParagraphs();
await drawBoundingBoxes(pdf, paragraphs, {
    color: new Color(0, 255, 0),
    dashPattern: [5, 3]
});
```

### 4. `drawCrosshair(pdf, x, y, options)`

Draws a crosshair marker at specific coordinates.

**Options:**
- `color`: Crosshair color (default: red)
- `size`: Size of crosshair (default: 5)
- `lineWidth`: Line width (default: 1)
- `pageNumber`: Page index (default: 0)
- `label`: Optional label text

**Example:**
```typescript
await drawCrosshair(pdf, 100, 200, {
    color: new Color(0, 0, 255),
    size: 10,
    label: 'Test Point'
});
```

### 5. `highlightText(pdf, textObjectRef, options)`

Highlights text with a semi-transparent background.

**Options:**
- `color`: Highlight color (default: yellow with transparency)
- `padding`: Padding around text (default: 2)

**Example:**
```typescript
const textLine = await pdf.selectTextLine();
await highlightText(pdf, textLine, {
    color: new Color(255, 255, 0, 128),  // Semi-transparent yellow
    padding: 2
});
```

### 6. `drawArrow(pdf, fromX, fromY, toX, toY, options)`

Draws an arrow between two points.

**Options:**
- `color`: Arrow color (default: blue)
- `lineWidth`: Line width (default: 1.5)
- `arrowSize`: Size of arrow head (default: 8)
- `pageNumber`: Page index (default: 0)
- `label`: Optional label text

**Example:**
```typescript
await drawArrow(pdf, 100, 100, 200, 200, {
    color: new Color(0, 0, 255),
    label: 'Direction'
});
```

## Complete Example

Here's a comprehensive example that combines multiple helpers:

```typescript
import {PDFDancer, Color} from '../../index';
import {
    drawCoordinateGrid,
    drawBoundingBox,
    drawCrosshair,
    drawArrow
} from './test-drawing-helpers';

test('comprehensive visualization', async () => {
    const pdf = await PDFDancer.open(pdfData, token, baseUrl);

    // 1. Draw coordinate grid for reference
    await drawCoordinateGrid(pdf, {
        spacing: 50,
        majorInterval: 100
    });

    // 2. Add a test paragraph
    await pdf.newParagraph()
        .text('Test Text', new Color(0, 0, 0))
        .font('Helvetica', 12)
        .at(0, 100, 200)
        .add();

    // 3. Get and visualize the paragraph
    const paragraph = await pdf.selectParagraph();

    // Draw bounding box
    await drawBoundingBox(pdf, paragraph, {
        color: new Color(255, 0, 0),
        showDimensions: true
    });

    // Mark insertion point
    await drawCrosshair(pdf, 100, 200, {
        color: new Color(0, 255, 0),
        label: 'Insert Point'
    });

    // Show text direction
    const rect = paragraph.position.boundingRect;
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

    // Save visualization
    const bytes = await pdf.getBytes();
    fs.writeFileSync('debug-output.pdf', bytes);
});
```

## Use Cases

### Debugging Position Issues

When you're having trouble with positioning:

```typescript
// Draw grid to see coordinate system
await drawCoordinateGrid(pdf);

// Mark expected position
await drawCrosshair(pdf, expectedX, expectedY, {
    label: 'Expected',
    color: new Color(0, 255, 0)
});

// Mark actual position
const obj = await pdf.selectParagraph();
if (obj?.position?.boundingRect) {
    await drawCrosshair(
        pdf,
        obj.position.boundingRect.x,
        obj.position.boundingRect.y,
        {
            label: 'Actual',
            color: new Color(255, 0, 0)
        }
    );
}
```

### Visualizing Text Layout

```typescript
// Draw grid
await drawCoordinateGrid(pdf);

// Get all text elements
const textLines = await pdf.page(0).selectTextLines();

// Draw bounding boxes
await drawBoundingBoxes(pdf, textLines, {
    color: new Color(255, 0, 0, 128)
});

// Highlight specific text
await highlightText(pdf, textLines[0], {
    color: new Color(255, 255, 0, 100)
});
```

### Testing Move Operations

```typescript
// Mark original position
await drawCrosshair(pdf, originalX, originalY, {
    label: 'Start',
    color: new Color(255, 0, 0)
});

// Perform move
await obj.moveTo(newX, newY);

// Mark new position
await drawCrosshair(pdf, newX, newY, {
    label: 'End',
    color: new Color(0, 255, 0)
});

// Draw arrow showing movement
await drawArrow(pdf, originalX, originalY, newX, newY, {
    label: 'Movement'
});
```

## Tips

1. **Layer Order**: Draw the grid first, then other elements on top
2. **Colors**: Use semi-transparent colors (alpha < 255) for overlays
3. **Labels**: Keep labels short to avoid overlapping
4. **Grid Spacing**: Adjust spacing based on your use case (smaller for precision, larger for overview)
5. **Save PDFs**: Save the annotated PDFs for visual inspection during debugging

## Performance Note

These helpers add visual elements to PDFs, which increases file size and processing time. Use them primarily for debugging and visual verification, not in production tests that run frequently.
