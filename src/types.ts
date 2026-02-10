import {
    Color,
    CommandResult,
    FlipDirection,
    Font,
    FormFieldRef,
    Image,
    ImageTransformRequest,
    ImageTransformType,
    ObjectRef,
    ObjectType,
    Paragraph,
    Position,
    RedactOptions,
    RedactResponse,
    RedactTarget,
    TextObjectRef
} from "./models";
import {PDFDancer} from "./pdfdancer_v1";
import {ParagraphBuilder} from "./paragraph-builder";
import {ValidationException} from "./exceptions";

// 👇 Internal view of PDFDancer methods, not exported
interface PDFDancerInternals {
    delete(objectRef: ObjectRef): Promise<boolean>;

    move(objectRef: ObjectRef, position: Position): Promise<boolean>;

    changeFormField(formFieldRef: FormFieldRef, value: string): Promise<boolean>;

    modifyTextLine(objectRef: ObjectRef, newText: string): Promise<CommandResult>;

    modifyTextLineObject(objectRef: TextObjectRef, options: { text?: string; fontName?: string; fontSize?: number; color?: Color; position?: Position }): Promise<CommandResult>;

    modifyParagraph(objectRef: ObjectRef, update: Paragraph | string | null): Promise<CommandResult>;

    _redactTargets(targets: RedactTarget[], options?: RedactOptions): Promise<RedactResponse>;

    transformImage(request: ImageTransformRequest): Promise<CommandResult>;
}

export class BaseObject<TRef extends ObjectRef = ObjectRef> {

    _client: PDFDancer;

    internalId: string;
    type: ObjectType;
    position: Position;
    protected _internals: PDFDancerInternals;

    constructor(client: PDFDancer, internalId: string, type: ObjectType, position: Position) {
        this.internalId = internalId;
        this.type = type;
        this.position = position;
        this._client = client;
        this._internals = this._client as unknown as PDFDancerInternals;
    }

    async delete() {
        return this._internals.delete(this.ref());
    }

    protected ref(): TRef {
        return new ObjectRef(this.internalId, this.position, this.type) as TRef;
    }

    async moveTo(x: number, y: number) {
        return this._internals.move(this.ref(), Position.atPageCoordinates(this.position.pageNumber!, x, y));
    }

    /**
     * Redacts this object from the PDF.
     * For text objects, replaces content with the replacement string.
     * For images/paths, replaces with a solid color placeholder.
     * @param replacementOrOptions For text: replacement string. For images/paths: options with color.
     */
    async redact(replacementOrOptions?: string | { color?: Color }): Promise<RedactResponse> {
        const replacement = typeof replacementOrOptions === 'string'
            ? replacementOrOptions
            : '[REDACTED]';

        const target: RedactTarget = {
            id: this.internalId,
            replacement,
        };

        const options: RedactOptions = {};
        if (typeof replacementOrOptions === 'object' && replacementOrOptions.color) {
            options.placeholderColor = replacementOrOptions.color;
        }

        return this._internals._redactTargets([target], options);
    }
}

export class PathObject extends BaseObject {

    static fromRef(_client: PDFDancer, objectRef: ObjectRef) {
        return new PathObject(_client, objectRef.internalId, objectRef.type, objectRef.position);
    }
}

export class ImageObject extends BaseObject {

    static fromRef(_client: PDFDancer, objectRef: ObjectRef) {
        return new ImageObject(_client, objectRef.internalId, objectRef.type, objectRef.position);
    }

    /**
     * Replaces this image with a new image while keeping the same position.
     * @param newImage The new image to replace this one with
     * @returns CommandResult indicating success or failure
     */
    async replace(newImage: Image): Promise<CommandResult> {
        if (!newImage) {
            throw new ValidationException("New image cannot be null");
        }
        const request = new ImageTransformRequest(
            this.ref(),
            ImageTransformType.REPLACE,
            newImage
        );
        return this._internals.transformImage(request);
    }

    /**
     * Scales the image by a factor.
     * @param factor Scale factor (e.g., 0.5 for half size, 2.0 for double size)
     * @returns CommandResult indicating success or failure
     */
    async scale(factor: number): Promise<CommandResult> {
        if (factor <= 0) {
            throw new ValidationException(`Scale factor must be positive, got ${factor}`);
        }
        const request = new ImageTransformRequest(
            this.ref(),
            ImageTransformType.SCALE,
            undefined,
            factor
        );
        return this._internals.transformImage(request);
    }

    /**
     * Scales the image to a target size.
     * @param width Target width in points
     * @param height Target height in points
     * @param preserveAspectRatio Whether to preserve the aspect ratio (default: true)
     * @returns CommandResult indicating success or failure
     */
    async scaleTo(width: number, height: number, preserveAspectRatio: boolean = true): Promise<CommandResult> {
        if (width <= 0 || height <= 0) {
            throw new ValidationException(`Target size must be positive, got ${width}x${height}`);
        }
        const request = new ImageTransformRequest(
            this.ref(),
            ImageTransformType.SCALE,
            undefined,
            undefined,
            { width, height },
            preserveAspectRatio
        );
        return this._internals.transformImage(request);
    }

    /**
     * Rotates the image by the specified angle.
     * @param angle Rotation angle in degrees (positive = clockwise)
     * @returns CommandResult indicating success or failure
     */
    async rotate(angle: number): Promise<CommandResult> {
        const request = new ImageTransformRequest(
            this.ref(),
            ImageTransformType.ROTATE,
            undefined,
            undefined,
            undefined,
            undefined,
            angle
        );
        return this._internals.transformImage(request);
    }

    /**
     * Crops the image by trimming edges.
     * @param left Pixels to trim from the left edge
     * @param top Pixels to trim from the top edge
     * @param right Pixels to trim from the right edge
     * @param bottom Pixels to trim from the bottom edge
     * @returns CommandResult indicating success or failure
     */
    async crop(left: number, top: number, right: number, bottom: number): Promise<CommandResult> {
        if (left < 0 || top < 0 || right < 0 || bottom < 0) {
            throw new ValidationException("Crop values cannot be negative");
        }
        const request = new ImageTransformRequest(
            this.ref(),
            ImageTransformType.CROP,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            left,
            top,
            right,
            bottom
        );
        return this._internals.transformImage(request);
    }

    /**
     * Sets the opacity/transparency of the image.
     * @param opacity Opacity value from 0.0 (fully transparent) to 1.0 (fully opaque)
     * @returns CommandResult indicating success or failure
     */
    async setOpacity(opacity: number): Promise<CommandResult> {
        if (opacity < 0 || opacity > 1) {
            throw new ValidationException(`Opacity must be between 0.0 and 1.0, got ${opacity}`);
        }
        const request = new ImageTransformRequest(
            this.ref(),
            ImageTransformType.OPACITY,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            opacity
        );
        return this._internals.transformImage(request);
    }

    /**
     * Flips the image horizontally, vertically, or both.
     * @param direction The flip direction (HORIZONTAL, VERTICAL, or BOTH)
     * @returns CommandResult indicating success or failure
     */
    async flip(direction: FlipDirection): Promise<CommandResult> {
        if (!direction) {
            throw new ValidationException("Flip direction cannot be null");
        }
        const request = new ImageTransformRequest(
            this.ref(),
            ImageTransformType.FLIP,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            direction
        );
        return this._internals.transformImage(request);
    }
}

export class FormXObject extends BaseObject {

    static fromRef(_client: PDFDancer, objectRef: ObjectRef) {
        return new FormXObject(_client, objectRef.internalId, objectRef.type, objectRef.position);
    }
}

export class FormFieldObject extends BaseObject<FormFieldRef> {
    name: string;
    value: string | null;

    constructor(client: PDFDancer, internalId: string, type: ObjectType, position: Position, name: string, value: string | null) {
        super(client, internalId, type, position);
        this.name = name;
        this.value = value;
    }

    async fill(value: string) {
        return await this._internals.changeFormField(this.ref(), value);
    }

    protected ref() {
        return new FormFieldRef(this.internalId, this.position, this.type, this.name, this.value);
    }

    static fromRef(_client: PDFDancer, objectRef: FormFieldRef) {
        return new FormFieldObject(_client, objectRef.internalId, objectRef.type, objectRef.position, objectRef.name, objectRef.value);
    }
}

export class ParagraphObject extends BaseObject<TextObjectRef> {

    private fontName: string | undefined;
    private fontSize: number | undefined;
    private lineSpacings: number[] | null | undefined;
    private children: TextObjectRef[] | undefined;
    private text: string | undefined;
    private color: Color | undefined;

    static fromRef(_client: PDFDancer, objectRef: TextObjectRef) {
        let paragraphObject = new ParagraphObject(_client, objectRef.internalId, objectRef.type, objectRef.position);
        paragraphObject.setFontName(objectRef.fontName);
        paragraphObject.setFontSize(objectRef.fontSize);
        paragraphObject.setLineSpacings(objectRef.lineSpacings);
        paragraphObject.setText(objectRef.text);
        paragraphObject.setChildren(objectRef.children);
        paragraphObject.setColor(objectRef.color);
        paragraphObject.ref = () => objectRef;
        return paragraphObject;
    }

    edit() {
        return new ParagraphEditSession(this._client, this.objectRef());
    }

    objectRef() {
        return this.ref();
    }

    getText() {
        return this.text;
    }

    getFontName() {
        return this.fontName;
    }

    getFontSize() {
        return this.fontSize;
    }

    getColor() {
        return this.color;
    }

    getChildren() {
        return this.children;
    }

    private setFontName(fontName: string | undefined) {
        this.fontName = fontName;
    }

    private setFontSize(fontSize: number | undefined) {
        this.fontSize = fontSize;
    }

    private setLineSpacings(lineSpacings: number[] | null | undefined) {
        this.lineSpacings = lineSpacings;
    }

    private setText(text: string | undefined) {
        this.text = text;
    }

    private setChildren(children: TextObjectRef[] | undefined) {
        this.children = children;
    }

    private setColor(color: Color | undefined) {
        this.color = color;
    }
}

export class ParagraphEditSession {
    private _newText?: string;
    private _fontName?: string;
    private _fontSize?: number;
    private _color?: Color;
    private _lineSpacing?: number;
    private _newPosition?: { x: number; y: number };
    private _hasChanges = false;
    private readonly _internals: PDFDancerInternals;

    constructor(private readonly _client: PDFDancer, private readonly _objectRef: TextObjectRef) {
        this._internals = this._client as unknown as PDFDancerInternals;
    }

    replace(text: string) {
        if (text === null || text === undefined) {
            throw new ValidationException("Text cannot be null");
        }
        this._newText = text;
        this._hasChanges = true;
        return this;
    }

    text(text: string) {
        return this.replace(text);
    }

    font(font: Font): this;
    font(fontName: string, fontSize: number): this;
    font(fontOrName: Font | string, fontSize?: number): this {
        if (fontOrName instanceof Font) {
            this._fontName = fontOrName.name;
            this._fontSize = fontOrName.size;
        } else {
            if (!fontOrName) {
                throw new ValidationException("Font name cannot be null");
            }
            if (fontSize == null) {
                throw new ValidationException("Font size cannot be null");
            }
            this._fontName = fontOrName;
            this._fontSize = fontSize;
        }

        this._hasChanges = true;
        return this;
    }

    color(color: Color) {
        if (!color) {
            throw new ValidationException("Color cannot be null");
        }
        this._color = color;
        this._hasChanges = true;
        return this;
    }

    lineSpacing(spacing: number) {
        if (spacing <= 0) {
            throw new ValidationException(`Line spacing must be positive, got ${spacing}`);
        }
        this._lineSpacing = spacing;
        this._hasChanges = true;
        return this;
    }

    moveTo(x: number, y: number) {
        if (x === null || x === undefined || y === null || y === undefined) {
            throw new ValidationException("Coordinates cannot be null or undefined");
        }
        this._newPosition = {x, y};
        this._hasChanges = true;
        return this;
    }

    async apply(): Promise<CommandResult | boolean> {
        if (!this._hasChanges) {
            return this._internals.modifyParagraph(this._objectRef, null);
        }

        const onlyTextChanged = (
            this._newText !== undefined &&
            this._fontName === undefined &&
            this._fontSize === undefined &&
            this._color === undefined &&
            this._lineSpacing === undefined &&
            this._newPosition === undefined
        );

        if (onlyTextChanged) {
            const result = await this._internals.modifyParagraph(this._objectRef, this._newText ?? '');
            this._hasChanges = false;
            return result;
        }

        const onlyMove = (
            this._newPosition !== undefined &&
            this._newText === undefined &&
            this._fontName === undefined &&
            this._fontSize === undefined &&
            this._color === undefined &&
            this._lineSpacing === undefined
        );

        if (onlyMove) {
            const pageNumber = this._objectRef.position.pageNumber;
            if (pageNumber === undefined) {
                throw new ValidationException("Paragraph position must include a page number to move");
            }
            const position = Position.atPageCoordinates(pageNumber, this._newPosition!.x, this._newPosition!.y);
            const result = await this._internals.move(this._objectRef, position);
            this._hasChanges = false;
            return result;
        }

        const builder = ParagraphBuilder.fromObjectRef(this._client, this._objectRef);
        builder.setFontExplicitlyChanged(false);

        if (this._newText !== undefined) {
            builder.text(this._newText);
        }
        if (this._fontName !== undefined && this._fontSize !== undefined) {
            builder.font(this._fontName, this._fontSize);
        }
        if (this._color !== undefined) {
            builder.color(this._color);
        }
        if (this._lineSpacing !== undefined) {
            builder.lineSpacing(this._lineSpacing);
        }
        if (this._newPosition !== undefined) {
            builder.moveTo(this._newPosition.x, this._newPosition.y);
        }

        const result = await builder.modify(this._objectRef);
        this._hasChanges = false;
        return result;
    }
}

export class TextLineObject extends BaseObject<TextObjectRef> {

    private fontName: string | undefined;
    private fontSize: number | undefined;
    private lineSpacings: number[] | null | undefined;
    private children: TextObjectRef[] | undefined;
    private text: string | undefined;
    private color: Color | undefined;

    static fromRef(_client: PDFDancer, objectRef: TextObjectRef) {
        let textLineObject = new TextLineObject(_client, objectRef.internalId, objectRef.type, objectRef.position);
        textLineObject.setFontName(objectRef.fontName);
        textLineObject.setFontSize(objectRef.fontSize);
        textLineObject.setLineSpacings(objectRef.lineSpacings);
        textLineObject.setText(objectRef.text);
        textLineObject.setChildren(objectRef.children);
        textLineObject.setColor(objectRef.color);
        textLineObject.ref = () => objectRef;
        return textLineObject;
    }

    edit() {
        return new TextLineBuilder(this._client, this.ref());
    }

    private setFontName(fontName: string | undefined) {
        this.fontName = fontName;
    }

    private setFontSize(fontSize: number | undefined) {
        this.fontSize = fontSize;
    }

    private setLineSpacings(lineSpacings: number[] | null | undefined) {
        this.lineSpacings = lineSpacings;
    }

    private setText(text: string | undefined) {
        this.text = text;
    }

    private setChildren(children: TextObjectRef[] | undefined) {
        this.children = children;
    }

    private setColor(color: Color | undefined) {
        this.color = color;
    }

    objectRef() {
        return this.ref();
    }

    getText() {
        return this.text;
    }

    getFontName() {
        return this.fontName;
    }

    getFontSize() {
        return this.fontSize;
    }

    getColor() {
        return this.color;
    }

    getChildren() {
        return this.children;
    }
}


class TextLineBuilder {

    private _text: string | undefined;
    private _fontName: string | undefined;
    private _fontSize: number | undefined;
    private _color: Color | undefined;
    private _newPosition: { x: number; y: number } | undefined;
    private _hasChanges = false;
    private _ttfSource: Uint8Array | File | string | undefined;
    private _pending: Promise<unknown>[] = [];
    private _registeringFont = false;
    private _fontExplicitlyChanged = false;
    private _objectRef: TextObjectRef;
    private _client: PDFDancer;
    private _internals: PDFDancerInternals;

    constructor(client: PDFDancer, objectRef: TextObjectRef) {
        this._objectRef = objectRef;
        this._client = client;
        this._internals = this._client as unknown as PDFDancerInternals;
    }

    replace(text: string, color?: Color) {
        return this.text(text, color);
    }

    text(newText: string, color?: Color) {
        if (newText === null || newText === undefined) {
            throw new ValidationException("Text cannot be null");
        }
        this._text = newText;
        this._hasChanges = true;
        if (color) {
            this.color(color);
        }
        return this;
    }

    font(font: Font): this;
    font(fontName: string, fontSize: number): this;
    font(fontOrName: Font | string, fontSize?: number): this {
        if (fontOrName instanceof Font) {
            this._fontName = fontOrName.name;
            this._fontSize = fontOrName.size;
        } else {
            if (!fontOrName) {
                throw new ValidationException("Font name cannot be null");
            }
            if (fontSize == null) {
                throw new ValidationException("Font size cannot be null");
            }
            this._fontName = fontOrName;
            this._fontSize = fontSize;
        }
        this._fontExplicitlyChanged = true;
        this._hasChanges = true;
        return this;
    }

    fontFile(ttfFile: Uint8Array | File | string, fontSize: number): this {
        if (!ttfFile) {
            throw new ValidationException("TTF file cannot be null");
        }
        if (fontSize <= 0) {
            throw new ValidationException(`Font size must be positive, got ${fontSize}`);
        }
        this._ttfSource = ttfFile;
        this._registeringFont = true;
        const job = this._registerTtf(ttfFile, fontSize)
            .then(font => {
                this._fontName = font.name;
                this._fontSize = font.size;
                this._fontExplicitlyChanged = true;
            })
            .finally(() => {
                this._registeringFont = false;
            });
        this._pending.push(job);
        this._hasChanges = true;
        return this;
    }

    color(color: Color): this {
        if (!color) {
            throw new ValidationException("Color cannot be null");
        }
        this._color = color;
        this._hasChanges = true;
        return this;
    }

    moveTo(x: number, y: number): this {
        if (x === null || x === undefined || y === null || y === undefined) {
            throw new ValidationException("Coordinates cannot be null or undefined");
        }
        this._newPosition = {x, y};
        this._hasChanges = true;
        return this;
    }

    getText() {
        return this._text;
    }

    async apply(): Promise<CommandResult | boolean> {
        if (this._pending.length) {
            await Promise.all(this._pending);
            this._pending = [];
        }
        if (this._registeringFont) {
            throw new ValidationException("Font registration is not complete");
        }

        if (!this._hasChanges) {
            return this._internals.modifyTextLine(this._objectRef, this._text ?? '');
        }

        const onlyTextChanged = (
            this._text !== undefined &&
            this._fontName === undefined &&
            this._fontSize === undefined &&
            this._color === undefined &&
            this._newPosition === undefined
        );

        if (onlyTextChanged) {
            const result = await this._internals.modifyTextLine(this._objectRef, this._text!);
            if (result.warning) {
                process.stderr.write(`WARNING: ${result.warning}\n`);
            }
            return result;
        }

        const onlyMove = (
            this._newPosition !== undefined &&
            this._text === undefined &&
            this._fontName === undefined &&
            this._fontSize === undefined &&
            this._color === undefined
        );

        if (onlyMove) {
            const pageNumber = this._objectRef.position.pageNumber;
            if (pageNumber === undefined) {
                throw new ValidationException("Line position must include a page number to move");
            }
            const position = Position.atPageCoordinates(pageNumber, this._newPosition!.x, this._newPosition!.y);
            return this._internals.move(this._objectRef, position);
        }

        let pos: Position | undefined;
        if (this._newPosition !== undefined) {
            const pageNumber = this._objectRef.position.pageNumber;
            if (pageNumber === undefined) {
                throw new ValidationException("Line position must include a page number to move");
            }
            pos = Position.atPageCoordinates(pageNumber, this._newPosition.x, this._newPosition.y);
        }

        const result = await this._internals.modifyTextLineObject(this._objectRef, {
            text: this._text,
            fontName: this._fontName,
            fontSize: this._fontSize,
            color: this._color,
            position: pos
        });
        if (result.warning) {
            process.stderr.write(`WARNING: ${result.warning}\n`);
        }
        return result;
    }

    private async _registerTtf(ttfFile: Uint8Array | File | string, fontSize: number): Promise<Font> {
        try {
            const fontName = await this._client.registerFont(ttfFile);
            return new Font(fontName, fontSize);
        } catch (error: any) {
            throw new ValidationException(`Failed to register font file: ${error}`);
        }
    }
}
