import {Color, CommandResult, Font, FormFieldRef, ObjectRef, ObjectType, Paragraph, Position, RedactOptions, RedactResponse, RedactTarget, TextObjectRef} from "./models";
import {PDFDancer} from "./pdfdancer_v1";
import {ParagraphBuilder} from "./paragraph-builder";
import {ValidationException} from "./exceptions";

// 👇 Internal view of PDFDancer methods, not exported
interface PDFDancerInternals {
    delete(objectRef: ObjectRef): Promise<boolean>;

    move(objectRef: ObjectRef, position: Position): Promise<boolean>;

    changeFormField(formFieldRef: FormFieldRef, value: string): Promise<boolean>;

    modifyTextLine(objectRef: ObjectRef, newText: string): Promise<CommandResult>;

    modifyParagraph(objectRef: ObjectRef, update: Paragraph | string | null): Promise<CommandResult>;

    _redactTargets(targets: RedactTarget[], options?: RedactOptions): Promise<RedactResponse>;
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
    private _objectRef: ObjectRef;
    private _client: PDFDancer
    private _internals: PDFDancerInternals;

    constructor(client: PDFDancer, objectRef: ObjectRef) {
        this._objectRef = objectRef;
        this._client = client;
        this._internals = this._client as unknown as PDFDancerInternals;
    }

    text(newText: string) {
        this._text = newText;
        return this;
    }

    async apply() {
        const result = await this._internals.modifyTextLine(this._objectRef, this._text!);
        if (result.warning) {
            process.stderr.write(`WARNING: ${result.warning}\n`);
        }
        return result;
    }
}
