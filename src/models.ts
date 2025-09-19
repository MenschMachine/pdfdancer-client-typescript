/**
 * Model classes for the PDFDancer TypeScript client.
 * Closely mirrors the Python model classes with TypeScript conventions.
 */

/**
 * Object type enumeration matching the Python ObjectType.
 */
export enum ObjectType {
    IMAGE = "IMAGE",
    FORM_X_OBJECT = "FORM_X_OBJECT",
    PATH = "PATH",
    PARAGRAPH = "PARAGRAPH",
    TEXT_LINE = "TEXT_LINE",
    PAGE = "PAGE"
}

/**
 * Defines how position matching should be performed when searching for objects.
 */
export enum PositionMode {
    INTERSECT = "INTERSECT", // Objects that intersect with the specified position area
    CONTAINS = "CONTAINS"    // Objects completely contained within the specified position area
}

/**
 * Defines the geometric shape type used for position specification.
 */
export enum ShapeType {
    POINT = "POINT",   // Single point coordinate
    LINE = "LINE",     // Linear shape between two points
    CIRCLE = "CIRCLE", // Circular area with radius
    RECT = "RECT"      // Rectangular area with width and height
}

/**
 * Represents a 2D point with x and y coordinates.
 */
export interface Point {
    x: number;
    y: number;
}

/**
 * Represents a bounding rectangle with position and dimensions.
 * Matches the Python BoundingRect class.
 */
export class BoundingRect {
    constructor(
        public x: number,
        public y: number,
        public width: number,
        public height: number
    ) {
    }

    getX(): number {
        return this.x;
    }

    getY(): number {
        return this.y;
    }

    getWidth(): number {
        return this.width;
    }

    getHeight(): number {
        return this.height;
    }
}

class PositioningError extends Error {
    constructor(msg: string) {
        super(msg);
        this.name = "PositioningException";
    }
}

/**
 * Represents spatial positioning and location information for PDF objects.
 * Closely mirrors the Python Position class with TypeScript conventions.
 */
export class Position {
    constructor(
        public pageIndex?: number,
        public shape?: ShapeType,
        public mode?: PositionMode,
        public boundingRect?: BoundingRect,
        public textStartsWith?: string
    ) {
    }

    /**
     * Creates a position specification for an entire page. Page indexes start with 0.
     */
    static atPage(pageIndex: number): Position {
        return new Position(pageIndex, undefined, PositionMode.CONTAINS);
    }

    /**
     * Creates a position specification for specific coordinates on a page.
     */
    static atPageCoordinates(pageIndex: number, x: number, y: number): Position {
        return Position.atPage(pageIndex).atCoordinates({x, y});
    }

    static atPageWithText(pageIndex: number, text: string) {
        return Position.atPage(pageIndex).withTextStarts(text);
    }

    /**
     * Sets the position to a specific point location.
     */
    atCoordinates(point: Point): this {
        this.mode = PositionMode.CONTAINS;
        this.shape = ShapeType.POINT;
        this.boundingRect = new BoundingRect(point.x, point.y, 0, 0);
        return this;
    }

    withTextStarts(text: string) {
        this.textStartsWith = text;
        return this;
    }

    /**
     * Move the position horizontally by the specified offset.
     */
    moveX(xOffset: number): Position {
        if (this.boundingRect) {
            this.atCoordinates({x: this.getX()! + xOffset, y: this.getY()!});
        } else {
            throw new PositioningError("Cannot move since no initial position exists");
        }
        return this;
    }

    /**
     * Move the position vertically by the specified offset.
     */
    moveY(yOffset: number): Position {
        if (this.boundingRect) {
            this.atCoordinates({x: this.getX()!, y: this.getY()! + yOffset});
        } else {
            throw new PositioningError("Cannot move since no initial position exists");
        }
        return this;
    }

    /**
     * Returns the X coordinate of this position.
     */
    getX(): number | undefined {
        return this.boundingRect?.getX();
    }

    /**
     * Returns the Y coordinate of this position.
     */
    getY(): number | undefined {
        return this.boundingRect?.getY();
    }

    /**
     * Creates a copy of this position.
     */
    copy(): Position {
        let boundingRectCopy: BoundingRect | undefined;
        if (this.boundingRect) {
            boundingRectCopy = new BoundingRect(
                this.boundingRect.x,
                this.boundingRect.y,
                this.boundingRect.width,
                this.boundingRect.height
            );
        }

        return new Position(
            this.pageIndex,
            this.shape,
            this.mode,
            boundingRectCopy,
            this.textStartsWith
        );
    }
}

/**
 * Lightweight reference to a PDF object providing identity and type information.
 * Mirrors the Python ObjectRef class exactly.
 */
export class ObjectRef {
    constructor(
        public internalId: string,
        public position: Position,
        public type: ObjectType
    ) {
    }

    getInternalId(): string {
        return this.internalId;
    }

    getPosition(): Position {
        return this.position;
    }

    setPosition(position: Position): void {
        this.position = position;
    }

    getType(): ObjectType {
        return this.type;
    }

    toDict(): Record<string, any> {
        return {
            internalId: this.internalId,
            position: positionToDict(this.position),
            type: this.type
        };
    }
}

/**
 * Represents an RGB color with optional alpha channel, values from 0-255.
 */
export class Color {
    constructor(
        public r: number,
        public g: number,
        public b: number,
        public a: number = 255 // Alpha channel, default fully opaque
    ) {
        // Validation similar to Python client
        for (const component of [this.r, this.g, this.b, this.a]) {
            if (component < 0 || component > 255) {
                throw new Error(`Color component must be between 0 and 255, got ${component}`);
            }
        }
    }
}

/**
 * Represents a font with name and size.
 */
export class Font {
    constructor(
        public name: string,
        public size: number
    ) {
        if (this.size <= 0) {
            throw new Error(`Font size must be positive, got ${this.size}`);
        }
    }
}

/**
 * Represents an image object in a PDF document.
 * Matches the Python Image class structure.
 */
export class Image {
    constructor(
        public position?: Position,
        public format?: string,
        public width?: number,
        public height?: number,
        public data?: Uint8Array
    ) {
    }

    getPosition(): Position | undefined {
        return this.position;
    }

    setPosition(position: Position): void {
        this.position = position;
    }
}

/**
 * Represents a paragraph of text in a PDF document.
 * Structure mirrors the Python Paragraph class.
 */
export class Paragraph {
    constructor(
        public position?: Position,
        public textLines?: string[],
        public font?: Font,
        public color?: Color,
        public lineSpacing: number = 1.2
    ) {
    }

    getPosition(): Position | undefined {
        return this.position;
    }

    setPosition(position: Position): void {
        this.position = position;
    }
}

// Request classes for API communication

/**
 * Request object for find operations.
 */
export class FindRequest {
    constructor(
        public objectType?: ObjectType,
        public position?: Position,
        public hint?: string
    ) {
    }

    toDict(): Record<string, any> {
        return {
            objectType: this.objectType || null,
            position: this.position ? positionToDict(this.position) : null,
            hint: this.hint || null
        };
    }
}

/**
 * Request object for delete operations.
 */
export class DeleteRequest {
    constructor(public objectRef: ObjectRef) {
    }

    toDict(): Record<string, any> {
        return {
            objectRef: {
                internalId: this.objectRef.internalId,
                position: positionToDict(this.objectRef.position),
                type: this.objectRef.type
            }
        };
    }
}

/**
 * Request object for move operations.
 */
export class MoveRequest {
    constructor(
        public objectRef: ObjectRef,
        public position: Position
    ) {
    }

    toDict(): Record<string, any> {
        return {
            objectRef: {
                internalId: this.objectRef.internalId,
                position: positionToDict(this.objectRef.position),
                type: this.objectRef.type
            },
            newPosition: positionToDict(this.position)
        };
    }
}

/**
 * Request object for add operations.
 */
export class AddRequest {
    constructor(public pdfObject: Image | Paragraph) {
    }

    toDict(): Record<string, any> {
        return {
            object: this.objectToDict(this.pdfObject)
        };
    }

    private objectToDict(obj: Image | Paragraph): Record<string, any> {
        if (obj instanceof Image) {
            const size = obj.width !== undefined && obj.height !== undefined
                ? {width: obj.width, height: obj.height}
                : null;

            const dataB64 = obj.data ? btoa(String.fromCharCode(...obj.data)) : null;

            return {
                type: "IMAGE",
                position: obj.position ? positionToDict(obj.position) : null,
                format: obj.format || null,
                size,
                data: dataB64
            };
        } else if (obj instanceof Paragraph) {
            const lines: any[] = [];
            if (obj.textLines) {
                for (const line of obj.textLines) {
                    const textElement = {
                        text: line,
                        font: obj.font ? {name: obj.font.name, size: obj.font.size} : null,
                        color: obj.color ? {r: obj.color.r, g: obj.color.g, b: obj.color.b} : null,
                        position: obj.position ? positionToDict(obj.position) : null
                    };

                    const textLine: any = {
                        textElements: [textElement]
                    };

                    if (obj.color) {
                        textLine.color = {r: obj.color.r, g: obj.color.g, b: obj.color.b};
                    }
                    if (obj.position) {
                        textLine.position = positionToDict(obj.position);
                    }
                    lines.push(textLine);
                }
            }

            const lineSpacings = obj.lineSpacing !== undefined ? [obj.lineSpacing] : null;

            return {
                type: "PARAGRAPH",
                position: obj.position ? positionToDict(obj.position) : null,
                lines,
                lineSpacings,
                font: obj.font ? {name: obj.font.name, size: obj.font.size} : null
            };
        } else {
            throw new Error(`Unsupported object type: ${typeof obj}`);
        }
    }
}

/**
 * Request object for modify operations.
 */
export class ModifyRequest {
    constructor(
        public objectRef: ObjectRef,
        public newObject: Image | Paragraph
    ) {
    }

    toDict(): Record<string, any> {
        return {
            ref: {
                internalId: this.objectRef.internalId,
                position: positionToDict(this.objectRef.position),
                type: this.objectRef.type
            },
            newObject: new AddRequest(this.newObject).toDict().object
        };
    }
}

/**
 * Request object for text modification operations.
 */
export class ModifyTextRequest {
    constructor(
        public objectRef: ObjectRef,
        public newText: string
    ) {
    }

    toDict(): Record<string, any> {
        return {
            ref: {
                internalId: this.objectRef.internalId,
                position: positionToDict(this.objectRef.position),
                type: this.objectRef.type
            },
            newTextLine: this.newText
        };
    }
}

// Helper function to convert Position to dictionary for JSON serialization
function positionToDict(position: Position): Record<string, any> {
    const result: Record<string, any> = {
        pageIndex: position.pageIndex,
        textStartsWith: position.textStartsWith
    };

    if (position.shape) {
        result.shape = position.shape;
    }
    if (position.mode) {
        result.mode = position.mode;
    }
    if (position.boundingRect) {
        result.boundingRect = {
            x: position.boundingRect.x,
            y: position.boundingRect.y,
            width: position.boundingRect.width,
            height: position.boundingRect.height
        };
    }

    return result;
}
