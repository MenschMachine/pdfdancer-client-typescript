import {PDFDancer} from "./pdfdancer_v1";
import {Path, Position, Color, Line, Bezier, PathPoint, PathSegment} from "./models";

// 👇 Internal view of PDFDancer methods, not exported
interface PDFDancerInternals {
    addPath(path: Path): Promise<boolean>;
}

/**
 * Builder for creating vector paths in PDF documents.
 *
 * Supports creating paths with:
 * - Lines
 * - Bezier curves
 * - Custom stroke and fill colors
 * - Stroke width and dash patterns
 *
 * @example
 * ```typescript
 * // Create a simple line
 * await pdf.newPath()
 *   .moveTo(100, 100)
 *   .lineTo(200, 200)
 *   .strokeColor(new Color(0, 0, 0))
 *   .strokeWidth(2)
 *   .at(0, 0, 0)
 *   .add();
 *
 * // Create a bezier curve
 * await pdf.newPath()
 *   .moveTo(100, 100)
 *   .bezierTo(150, 50, 250, 150, 300, 100)
 *   .strokeColor(new Color(255, 0, 0))
 *   .at(0, 0, 0)
 *   .add();
 * ```
 */
export class PathBuilder {
    private _segments: PathSegment[] = [];
    private _position: Position | undefined;
    private _currentPoint: PathPoint | undefined;
    private _strokeColor: Color | undefined;
    private _fillColor: Color | undefined;
    private _strokeWidth: number | undefined;
    private _dashArray: number[] | undefined;
    private _dashPhase: number | undefined;
    private _evenOddFill: boolean | undefined;
    private readonly _internals: PDFDancerInternals;

    constructor(private _client: PDFDancer, private readonly _defaultPageIndex?: number) {
        // Cast to the internal interface to get access
        this._internals = this._client as unknown as PDFDancerInternals;
    }

    /**
     * Move to a point without drawing.
     * Sets the current point for subsequent drawing operations.
     */
    moveTo(x: number, y: number): this {
        this._currentPoint = {x, y};
        return this;
    }

    /**
     * Draw a line from the current point to the specified point.
     */
    lineTo(x: number, y: number): this {
        if (!this._currentPoint) {
            throw new Error("No current point set. Call moveTo() first.");
        }
        const line = new Line(
            this._currentPoint,
            {x, y},
            this._strokeColor,
            this._fillColor,
            this._strokeWidth,
            this._dashArray,
            this._dashPhase
        );
        this._segments.push(line);
        this._currentPoint = {x, y};
        return this;
    }

    /**
     * Draw a cubic Bezier curve from the current point.
     * @param cp1x First control point X
     * @param cp1y First control point Y
     * @param cp2x Second control point X
     * @param cp2y Second control point Y
     * @param x End point X
     * @param y End point Y
     */
    bezierTo(cp1x: number, cp1y: number, cp2x: number, cp2y: number, x: number, y: number): this {
        if (!this._currentPoint) {
            throw new Error("No current point set. Call moveTo() first.");
        }
        const bezier = new Bezier(
            this._currentPoint,
            {x: cp1x, y: cp1y},
            {x: cp2x, y: cp2y},
            {x, y},
            this._strokeColor,
            this._fillColor,
            this._strokeWidth,
            this._dashArray,
            this._dashPhase
        );
        this._segments.push(bezier);
        this._currentPoint = {x, y};
        return this;
    }

    /**
     * Add a custom path segment.
     */
    addSegment(segment: PathSegment): this {
        this._segments.push(segment);
        return this;
    }

    /**
     * Set the stroke color for subsequent path segments.
     */
    strokeColor(color: Color): this {
        this._strokeColor = color;
        return this;
    }

    /**
     * Set the fill color for subsequent path segments.
     */
    fillColor(color: Color): this {
        this._fillColor = color;
        return this;
    }

    /**
     * Set the stroke width for subsequent path segments.
     */
    strokeWidth(width: number): this {
        this._strokeWidth = width;
        return this;
    }

    /**
     * Set the dash pattern for subsequent path segments.
     * @param dashArray Array of numbers specifying dash pattern (on/off lengths)
     * @param dashPhase Offset into the dash pattern
     */
    dashPattern(dashArray: number[], dashPhase: number = 0): this {
        this._dashArray = dashArray;
        this._dashPhase = dashPhase;
        return this;
    }

    /**
     * Set whether to use even-odd fill rule (true) or nonzero winding rule (false).
     */
    evenOddFill(useEvenOdd: boolean): this {
        this._evenOddFill = useEvenOdd;
        return this;
    }

    /**
     * Set the position where the path will be added.
     * Can be called with (x, y) for page-level or (pageIndex, x, y) for document-level.
     */
    at(x: number, y: number): this;
    at(pageIndex: number, x: number, y: number): this;
    at(pageIndexOrX: number, xOrY: number, maybeY?: number): this {
        if (maybeY === undefined) {
            if (this._defaultPageIndex === undefined) {
                throw new Error('Page index must be provided when adding a path');
            }
            this._position = Position.atPageCoordinates(this._defaultPageIndex, pageIndexOrX, xOrY);
        } else {
            this._position = Position.atPageCoordinates(pageIndexOrX, xOrY, maybeY);
        }
        return this;
    }

    /**
     * Set the position using a Position object.
     */
    atPosition(position: Position): this {
        this._position = position;
        return this;
    }

    /**
     * Add the path to the PDF document.
     */
    async add(): Promise<boolean> {
        if (this._segments.length === 0) {
            throw new Error("No path segments defined. Use moveTo(), lineTo(), or bezierTo() to create path segments.");
        }
        if (!this._position) {
            throw new Error("Position is not set. Use at() or atPosition() to set the position.");
        }

        const path = new Path(this._position, this._segments, this._evenOddFill);
        return await this._internals.addPath(path);
    }

    /**
     * Alias for add(). Adds the path to the PDF document.
     */
    async apply(): Promise<boolean> {
        return await this.add();
    }
}
