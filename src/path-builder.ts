import {PDFDancer} from "./pdfdancer_v2";
import {Bezier, Color, Line, Path, PathPoint, PathSegment, Position} from "./models";
import {ValidationException} from "./exceptions";

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
    private _subpathStart: PathPoint | undefined;
    private _strokeColor: Color | undefined = Color.BLACK;
    private _fillColor: Color | undefined;
    private _strokeWidth: number | undefined = 1.0;
    private _dashArray: number[] | undefined;
    private _dashPhase: number | undefined;
    private _evenOddFill: boolean | undefined;
    private readonly _internals: PDFDancerInternals;

    constructor(private _client: PDFDancer, private readonly _defaultPageNumber?: number) {
        // Cast to the internal interface to get access
        this._internals = this._client as unknown as PDFDancerInternals;
    }

    /**
     * Move to a point without drawing.
     * Sets the current point for subsequent drawing operations.
     */
    moveTo(x: number, y: number): this {
        this.validateCoordinate(x, y);
        this._currentPoint = {x, y};
        this._subpathStart = {x, y};
        return this;
    }

    /**
     * Draw a line from the current point to the specified point.
     */
    lineTo(x: number, y: number): this {
        if (!this._currentPoint) {
            throw new ValidationException("No current point set. Call moveTo() first.");
        }
        this.validateCoordinate(x, y);
        const line = new Line(
            this._currentPoint,
            {x, y},
            undefined,  // position will be set in add()
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
            throw new ValidationException("No current point set. Call moveTo() first.");
        }
        [cp1x, cp1y, cp2x, cp2y, x, y].forEach(value => this.validateCoordinate(value));
        const bezier = new Bezier(
            this._currentPoint,
            {x: cp1x, y: cp1y},
            {x: cp2x, y: cp2y},
            {x, y},
            undefined,  // position will be set in add()
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
        if (!segment) {
            throw new ValidationException('Path segment cannot be null');
        }
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
        if (!Number.isFinite(width) || width < 0) {
            throw new ValidationException(`Stroke width must be a finite nonnegative number, got ${width}`);
        }
        this._strokeWidth = width;
        return this;
    }

    /**
     * Set the dash pattern for subsequent path segments.
     * @param dashArray Array of numbers specifying dash pattern (on/off lengths)
     * @param dashPhase Offset into the dash pattern
     */
    dashPattern(dashArray: number[], dashPhase: number = 0): this {
        if (!dashArray || dashArray.some(value => !Number.isFinite(value) || value < 0) ||
            (dashArray.length > 0 && dashArray.every(value => value === 0))) {
            throw new ValidationException('Dash pattern values must be finite and nonnegative, and cannot all be zero');
        }
        if (!Number.isFinite(dashPhase) || dashPhase < 0) {
            throw new ValidationException('Dash phase must be a finite nonnegative number');
        }
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

    solid(): this {
        this._dashArray = undefined;
        this._dashPhase = undefined;
        return this;
    }

    closePath(): this {
        if (!this._currentPoint || !this._subpathStart) {
            throw new ValidationException('Call moveTo() before closePath()');
        }
        if (this._currentPoint.x !== this._subpathStart.x || this._currentPoint.y !== this._subpathStart.y) {
            this.lineTo(this._subpathStart.x, this._subpathStart.y);
        }
        this._currentPoint = {...this._subpathStart};
        return this;
    }

    rectangle(x: number, y: number, width: number, height: number): this {
        if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
            throw new ValidationException('Rectangle width and height must be finite positive numbers');
        }
        return this.moveTo(x, y)
            .lineTo(x + width, y)
            .lineTo(x + width, y + height)
            .lineTo(x, y + height)
            .closePath();
    }

    circle(cx: number, cy: number, radius: number): this {
        if (!Number.isFinite(radius) || radius <= 0) {
            throw new ValidationException('Circle radius must be a finite positive number');
        }
        const k = 0.5522847498 * radius;
        return this.moveTo(cx, cy + radius)
            .bezierTo(cx + k, cy + radius, cx + radius, cy + k, cx + radius, cy)
            .bezierTo(cx + radius, cy - k, cx + k, cy - radius, cx, cy - radius)
            .bezierTo(cx - k, cy - radius, cx - radius, cy - k, cx - radius, cy)
            .bezierTo(cx - radius, cy + k, cx - k, cy + radius, cx, cy + radius)
            .closePath();
    }

    /**
     * Set the position where the path will be added.
     * Can be called with (x, y) for page-level or (pageNumber, x, y) for document-level.
     */
    at(x: number, y: number): this;
    at(pageNumber: number, x: number, y: number): this;
    at(pageNumberOrX: number, xOrY: number, maybeY?: number): this {
        if (maybeY === undefined) {
            if (this._defaultPageNumber === undefined) {
                throw new Error('Page index must be provided when adding a path');
            }
            this._position = Position.atPageCoordinates(this._defaultPageNumber, pageNumberOrX, xOrY);
        } else {
            this._position = Position.atPageCoordinates(pageNumberOrX, xOrY, maybeY);
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
            throw new ValidationException("No path segments defined. Use moveTo(), lineTo(), or bezierTo() to create path segments.");
        }
        if (!this._position) {
            const first = this._segments[0] as Line | Bezier;
            const start = first.p0;
            if (this._defaultPageNumber === undefined || !start) {
                throw new ValidationException("Target page is not set. Pass a page number to newPath() or use atPosition().");
            }
            this._position = Position.atPageCoordinates(this._defaultPageNumber, start.x, start.y);
        }

        // Apply current styling and position to all segments
        for (const segment of this._segments) {
            // All segments share the same position as the path
            segment.position = this._position;
            segment.strokeColor = this._strokeColor;
            segment.fillColor = this._fillColor;
            segment.strokeWidth = this._strokeWidth;
            segment.dashArray = this._dashArray;
            segment.dashPhase = this._dashPhase;
        }

        const path = new Path(this._position, this._segments, this._evenOddFill);
        return await this._internals.addPath(path);
    }

    private validateCoordinate(...values: number[]): void {
        if (values.some(value => !Number.isFinite(value))) {
            throw new ValidationException('Coordinates must be finite numbers');
        }
    }
}

abstract class SinglePathBuilder<T extends SinglePathBuilder<T>> {
    protected stroke = Color.BLACK;
    protected fill?: Color;
    protected width = 1.0;
    protected dash?: number[];
    protected phase = 0;

    constructor(protected readonly client: PDFDancer, protected readonly pageNumber: number) {
        if (!Number.isInteger(pageNumber) || pageNumber < 1) {
            throw new ValidationException('Page number must be >= 1 (1-based indexing)');
        }
    }

    strokeColor(color: Color): T { this.stroke = color; return this as unknown as T; }
    fillColor(color: Color): T { this.fill = color; return this as unknown as T; }
    strokeWidth(width: number): T {
        if (!Number.isFinite(width) || width < 0) throw new ValidationException('Stroke width must be nonnegative');
        this.width = width;
        return this as unknown as T;
    }
    dashPattern(pattern: number[], phase = 0): T {
        new PathBuilder(this.client, this.pageNumber).dashPattern(pattern, phase);
        this.dash = [...pattern];
        this.phase = phase;
        return this as unknown as T;
    }
    solid(): T { this.dash = undefined; this.phase = 0; return this as unknown as T; }
    protected path(): PathBuilder {
        const builder = new PathBuilder(this.client, this.pageNumber)
            .strokeColor(this.stroke).strokeWidth(this.width);
        if (this.fill) builder.fillColor(this.fill);
        if (this.dash) builder.dashPattern(this.dash, this.phase);
        return builder;
    }
    protected point(x: number, y: number): void {
        if (!Number.isFinite(x) || !Number.isFinite(y)) throw new ValidationException('Coordinates must be finite');
    }
}

export class LineBuilder extends SinglePathBuilder<LineBuilder> {
    private start?: PathPoint;
    private end?: PathPoint;
    from(x: number, y: number): this { this.point(x, y); this.start = {x, y}; return this; }
    to(x: number, y: number): this { this.point(x, y); this.end = {x, y}; return this; }
    async add(): Promise<boolean> {
        if (!this.start || !this.end) throw new ValidationException('Line start and end points are required');
        return this.path().moveTo(this.start.x, this.start.y).lineTo(this.end.x, this.end.y).add();
    }
}

export class BezierBuilder extends SinglePathBuilder<BezierBuilder> {
    private start?: PathPoint;
    private c1?: PathPoint;
    private c2?: PathPoint;
    private end?: PathPoint;
    private evenOdd = false;
    from(x: number, y: number): this { this.point(x, y); this.start = {x, y}; return this; }
    control1(x: number, y: number): this { this.point(x, y); this.c1 = {x, y}; return this; }
    control2(x: number, y: number): this { this.point(x, y); this.c2 = {x, y}; return this; }
    to(x: number, y: number): this { this.point(x, y); this.end = {x, y}; return this; }
    evenOddFill(enabled = true): this { this.evenOdd = enabled; return this; }
    async add(): Promise<boolean> {
        if (!this.start || !this.c1 || !this.c2 || !this.end) {
            throw new ValidationException('Bezier start, both control points, and end point are required');
        }
        return this.path().evenOddFill(this.evenOdd).moveTo(this.start.x, this.start.y)
            .bezierTo(this.c1.x, this.c1.y, this.c2.x, this.c2.y, this.end.x, this.end.y).add();
    }
}

export class RectangleBuilder extends SinglePathBuilder<RectangleBuilder> {
    private origin?: PathPoint;
    private rectangleWidth?: number;
    private rectangleHeight?: number;
    private evenOdd = false;
    at(x: number, y: number): this { this.point(x, y); this.origin = {x, y}; return this; }
    size(width: number, height: number): this {
        if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
            throw new ValidationException('Rectangle width and height must be finite positive numbers');
        }
        this.rectangleWidth = width; this.rectangleHeight = height; return this;
    }
    evenOddFill(enabled = true): this { this.evenOdd = enabled; return this; }
    async add(): Promise<boolean> {
        if (!this.origin || this.rectangleWidth === undefined || this.rectangleHeight === undefined) {
            throw new ValidationException('Rectangle origin and size are required');
        }
        return this.path().evenOddFill(this.evenOdd)
            .rectangle(this.origin.x, this.origin.y, this.rectangleWidth, this.rectangleHeight).add();
    }
}
