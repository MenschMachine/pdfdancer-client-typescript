/**
 * Model classes for the PDFDancer TypeScript client.
 */

export enum ObjectType {
    IMAGE = "IMAGE",
    FORM_X_OBJECT = "FORM_X_OBJECT",
    PATH = "PATH",
    PARAGRAPH = "PARAGRAPH",
    TEXT_LINE = "TEXT_LINE",
    PAGE = "PAGE",
    FORM_FIELD = "FORM_FIELD",
    TEXT_FIELD = "TEXT_FIELD",
    CHECKBOX = "CHECKBOX",
    RADIO_BUTTON = "RADIO_BUTTON"
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
 */
export class Position {
    public name?: string;
    public tolerance?: number;

    constructor(
        public pageIndex?: number,
        public shape?: ShapeType,
        public mode?: PositionMode,
        public boundingRect?: BoundingRect,
        public textStartsWith?: string,
        public textPattern?: string
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
     * @param tolerance Optional tolerance in points for coordinate matching (default: 0)
     */
    static atPageCoordinates(pageIndex: number, x: number, y: number, tolerance: number = 0): Position {
        const pos = Position.atPage(pageIndex).atCoordinates({x, y});
        pos.tolerance = tolerance;
        return pos;
    }

    static atPageWithText(pageIndex: number, text: string) {
        return Position.atPage(pageIndex).withTextStarts(text);
    }

    /**
     * Creates a position specification for finding objects by name.
     */
    static byName(name: string): Position {
        const position = new Position();
        position.name = name;
        return position;
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
 */
export class ObjectRef {

    constructor(
        public internalId: string,
        public position: Position,
        public type: ObjectType
    ) {
    }

    toDict(): Record<string, any> {
        return {
            internalId: this.internalId,
            position: positionToDict(this.position),
            type: this.type
        };
    }
}

export interface PageSize {
    name?: string;
    width?: number;
    height?: number;
}

export const STANDARD_PAGE_SIZES: Record<string, {width: number; height: number}> = {
    A4: {width: 595.0, height: 842.0},
    LETTER: {width: 612.0, height: 792.0},
    LEGAL: {width: 612.0, height: 1008.0},
    TABLOID: {width: 792.0, height: 1224.0},
    A3: {width: 842.0, height: 1191.0},
    A5: {width: 420.0, height: 595.0}
};

export enum Orientation {
    PORTRAIT = "PORTRAIT",
    LANDSCAPE = "LANDSCAPE"
}

/**
 * Font type classification from the PDF.
 */
export enum FontType {
    SYSTEM = "SYSTEM",
    STANDARD = "STANDARD",
    EMBEDDED = "EMBEDDED"
}

/**
 * Represents a font recommendation with similarity score.
 */
export class FontRecommendation {
    constructor(
        public fontName: string,
        public fontType: FontType,
        public similarityScore: number
    ) {}

    getFontName(): string {
        return this.fontName;
    }

    getFontType(): FontType {
        return this.fontType;
    }

    getSimilarityScore(): number {
        return this.similarityScore;
    }
}

/**
 * Status information for text objects.
 */
export class TextStatus {
    constructor(
        public modified: boolean,
        public encodable: boolean,
        public fontType: FontType,
        public fontRecommendation: FontRecommendation
    ) {}

    isModified(): boolean {
        return this.modified;
    }

    isEncodable(): boolean {
        return this.encodable;
    }

    getFontType(): FontType {
        return this.fontType;
    }

    getFontRecommendation(): FontRecommendation {
        return this.fontRecommendation;
    }
}

export class PageRef extends ObjectRef {
    pageSize?: PageSize;
    orientation?: Orientation;

    constructor(
        internalId: string,
        position: Position,
        type: ObjectType,
        pageSize?: PageSize,
        orientation?: Orientation
    ) {
        super(internalId, position, type);
        this.pageSize = pageSize;
        this.orientation = orientation;
    }
}

/**
 * Represents a form field reference with name and value properties.
 * Extends ObjectRef to include form-specific properties.
 */
export class FormFieldRef extends ObjectRef {
    constructor(
        internalId: string,
        position: Position,
        type: ObjectType,
        public name: string,
        public value: string | null
    ) {
        super(internalId, position, type);
    }
}

export class TextObjectRef extends ObjectRef {
    private _text?: string;
    private _fontName?: string;
    private _fontSize?: number;
    private _lineSpacings?: number[] | null;
    private _children?: TextObjectRef[];
    private _color?: Color;
    private _status?: TextStatus;

    constructor(
        internalId: string,
        position: Position,
        type: ObjectType,
        text?: string,
        fontName?: string,
        fontSize?: number,
        lineSpacings?: number[] | null,
        children?: TextObjectRef[],
        color?: Color,
        status?: TextStatus
    ) {
        super(internalId, position, type);
        this._text = text;
        this._fontName = fontName;
        this._fontSize = fontSize;
        this._lineSpacings = lineSpacings;
        this._children = children;
        this._color = color;
        this._status = status;
    }

    get text(): string | undefined {
        return this._text;
    }

    get fontName(): string | undefined {
        return this._fontName;
    }

    get fontSize(): number | undefined {
        return this._fontSize;
    }

    get lineSpacings(): number[] | null | undefined {
        return this._lineSpacings;
    }

    get children(): TextObjectRef[] | undefined {
        return this._children;
    }

    set children(value: TextObjectRef[] | undefined) {
        this._children = value;
    }

    get color(): Color | undefined {
        return this._color;
    }

    get status(): TextStatus | undefined {
        return this._status;
    }

    getStatus(): TextStatus | undefined {
        return this._status;
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
        for (const component of [this.r, this.g, this.b, this.a]) {
            if (component < 0 || component > 255) {
                throw new Error(`Color component must be between 0 and 255, got ${component}`);
            }
        }
    }
}

/**
 * Standard PDF fonts that are available in all PDF readers.
 * These 14 fonts are guaranteed to be available without embedding.
 */
export enum StandardFonts {
    TIMES_ROMAN = "Times-Roman",
    TIMES_BOLD = "Times-Bold",
    TIMES_ITALIC = "Times-Italic",
    TIMES_BOLD_ITALIC = "Times-BoldItalic",
    HELVETICA = "Helvetica",
    HELVETICA_BOLD = "Helvetica-Bold",
    HELVETICA_OBLIQUE = "Helvetica-Oblique",
    HELVETICA_BOLD_OBLIQUE = "Helvetica-BoldOblique",
    COURIER = "Courier",
    COURIER_BOLD = "Courier-Bold",
    COURIER_OBLIQUE = "Courier-Oblique",
    COURIER_BOLD_OBLIQUE = "Courier-BoldOblique",
    SYMBOL = "Symbol",
    ZAPF_DINGBATS = "ZapfDingbats"
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
                        color: obj.color ? {red: obj.color.r, green: obj.color.g, blue: obj.color.b, alpha: obj.color.a} : null,
                        position: obj.position ? positionToDict(obj.position) : null
                    };

                    const textLine: any = {
                        textElements: [textElement]
                    };

                    if (obj.color) {
                        textLine.color = {red: obj.color.r, green: obj.color.g, blue: obj.color.b, alpha: obj.color.a};
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

export class ChangeFormFieldRequest {
    constructor(
        public formFieldRef: FormFieldRef,
        public newValue: string
    ) {
    }

    toDict(): Record<string, any> {
        return {
            ref: {
                internalId: this.formFieldRef.internalId,
                position: positionToDict(this.formFieldRef.position),
                type: this.formFieldRef.type
            },
            value: this.newValue
        };
    }
}

/**
 * Request object for creating a new PDF document.
 */
export type PageSizeInput = string | PageSize | { name?: string; width?: number; height?: number };

export class CreatePdfRequest {
    private readonly _pageSize: PageSize;
    private readonly _orientation: Orientation;
    private readonly _initialPageCount: number;

    constructor(
        pageSize: PageSizeInput = "A4",
        orientation: Orientation = Orientation.PORTRAIT,
        initialPageCount: number = 1
    ) {
        this._pageSize = this.normalizePageSize(pageSize);
        this._orientation = this.normalizeOrientation(orientation);
        this._initialPageCount = this.normalizeInitialPageCount(initialPageCount);
    }

    toDict(): Record<string, any> {
        return {
            pageSize: this._pageSize,
            orientation: this._orientation,
            initialPageCount: this._initialPageCount
        };
    }

    private normalizePageSize(input: PageSizeInput): PageSize {
        const resolveStandardSize = (name: string): { width: number; height: number } | undefined => {
            const normalized = name.trim().toUpperCase();
            return STANDARD_PAGE_SIZES[normalized];
        };

        if (typeof input === 'string') {
            const normalizedName = input.trim().toUpperCase();
            const standard = resolveStandardSize(normalizedName);
            if (!standard) {
                throw new Error(`Unknown page size: ${input}`);
            }
            return {name: normalizedName, width: standard.width, height: standard.height};
        }

        const name = input.name ? input.name.trim().toUpperCase() : undefined;
        const standard = name ? resolveStandardSize(name) : undefined;
        const width = typeof input.width === 'number' ? input.width : standard?.width;
        const height = typeof input.height === 'number' ? input.height : standard?.height;

        if (width === undefined || height === undefined) {
            throw new Error('Page size must include numeric width and height');
        }

        if (width <= 0 || height <= 0) {
            throw new Error('Page size width and height must be positive numbers');
        }

        return {
            name,
            width,
            height
        };
    }

    private normalizeOrientation(orientation: Orientation): Orientation {
        if (orientation !== Orientation.PORTRAIT && orientation !== Orientation.LANDSCAPE) {
            throw new Error(`Invalid orientation: ${orientation}`);
        }
        return orientation;
    }

    private normalizeInitialPageCount(initialPageCount: number): number {
        if (!Number.isInteger(initialPageCount)) {
            throw new Error(`Initial page count must be an integer, got ${initialPageCount}`);
        }
        if (initialPageCount < 1) {
            throw new Error(`Initial page count must be at least 1, got ${initialPageCount}`);
        }
        return initialPageCount;
    }
}

/**
 * Request object for adding a page to the PDF.
 */
export class AddPageRequest {
    constructor(
        public pageIndex: number,
        public pageSize?: string,
        public orientation?: string
    ) {
    }

    toDict(): Record<string, any> {
        return {
            pageIndex: this.pageIndex,
            pageSize: this.pageSize,
            orientation: this.orientation
        };
    }
}

/**
 * Request object for moving a page within the PDF.
 */
export class MovePageRequest {
    constructor(
        public fromPageIndex: number,
        public toPageIndex: number
    ) {
    }

    toDict(): Record<string, any> {
        return {
            fromPageIndex: this.fromPageIndex,
            toPageIndex: this.toPageIndex
        };
    }
}

/**
 * Result object returned by certain API endpoints indicating the outcome of an operation.
 */
export class CommandResult {
    constructor(
        public commandName: string,
        public elementId: string | null,
        public message: string | null,
        public success: boolean,
        public warning: string | null
    ) {}

    static fromDict(data: Record<string, any>): CommandResult {
        return new CommandResult(
            data.commandName || '',
            data.elementId || null,
            data.message || null,
            data.success || false,
            data.warning || null
        );
    }

    static empty(commandName: string, elementId: string | null): CommandResult {
        return new CommandResult(commandName, elementId, null, true, null);
    }
}

/**
 * Represents a snapshot of a single page in a PDF document.
 * Contains the page reference and all elements on that page.
 */
export class PageSnapshot {
    constructor(
        public pageRef: PageRef,
        public elements: ObjectRef[]
    ) {}

    /**
     * Filters elements by object type.
     */
    getElementsByType(type: ObjectType): ObjectRef[] {
        return this.elements.filter(el => el.type === type);
    }

    /**
     * Gets the page index from the page reference.
     */
    getPageIndex(): number | undefined {
        return this.pageRef.position.pageIndex;
    }

    /**
     * Returns the number of elements on this page.
     */
    getElementCount(): number {
        return this.elements.length;
    }
}

/**
 * Represents a complete snapshot of a PDF document.
 * Contains page count, font information, and snapshots of all pages.
 */
export class DocumentSnapshot {
    constructor(
        public pageCount: number,
        public fonts: FontRecommendation[],
        public pages: PageSnapshot[]
    ) {}

    /**
     * Gets the snapshot for a specific page by index.
     */
    getPageSnapshot(pageIndex: number): PageSnapshot | undefined {
        return this.pages.find(page => page.getPageIndex() === pageIndex);
    }

    /**
     * Gets all elements across all pages.
     */
    getAllElements(): ObjectRef[] {
        return this.pages.flatMap(page => page.elements);
    }

    /**
     * Gets all elements of a specific type across all pages.
     */
    getElementsByType(type: ObjectType): ObjectRef[] {
        return this.getAllElements().filter(el => el.type === type);
    }

    /**
     * Returns the total number of elements across all pages.
     */
    getTotalElementCount(): number {
        return this.pages.reduce((sum, page) => sum + page.getElementCount(), 0);
    }
}

// Helper function to convert Position to dictionary for JSON serialization
function positionToDict(position: Position): Record<string, any> {
    const result: Record<string, any> = {
        pageIndex: position.pageIndex,
        textStartsWith: position.textStartsWith,
        textPattern: position.textPattern,
        name: position.name
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
