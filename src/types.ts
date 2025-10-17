import {FormFieldRef, ObjectRef, ObjectType, Position, TextObjectRef} from "./models";
import {PDFDancer} from "./pdfdancer_v1";
import {ParagraphBuilder} from "./paragraph-builder";

// 👇 Internal view of PDFDancer methods, not exported
interface PDFDancerInternals {
    delete(objectRef: ObjectRef): Promise<boolean>;

    move(objectRef: ObjectRef, position: Position): Promise<boolean>;

    changeFormField(formFieldRef: FormFieldRef, value: string): Promise<boolean>;

    modifyTextLine(objectRef: ObjectRef, newText: string): Promise<boolean>;
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
        return this._internals.move(this.ref(), Position.atPageCoordinates(this.position.pageIndex!, x, y));
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

    static fromRef(_client: PDFDancer, objectRef: TextObjectRef) {
        let paragraphObject = new ParagraphObject(_client, objectRef.internalId, objectRef.type, objectRef.position);
        paragraphObject.setFontName(objectRef.fontName);
        paragraphObject.setFontSize(objectRef.fontSize);
        paragraphObject.setLineSpacings(objectRef.lineSpacings);
        paragraphObject.setText(objectRef.text);
        paragraphObject.setChildren(objectRef.children);
        paragraphObject.ref = () => objectRef;
        return paragraphObject;
    }

    edit() {
        return new ParagraphBuilder(this._client, this.ref());
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
}

export class TextLineObject extends BaseObject<TextObjectRef> {

    private fontName: string | undefined;
    private fontSize: number | undefined;
    private lineSpacings: number[] | null | undefined;
    private children: TextObjectRef[] | undefined;
    private text: string | undefined;

    static fromRef(_client: PDFDancer, objectRef: TextObjectRef) {
        let textLineObject = new TextLineObject(_client, objectRef.internalId, objectRef.type, objectRef.position);
        textLineObject.setFontName(objectRef.fontName);
        textLineObject.setFontSize(objectRef.fontSize);
        textLineObject.setLineSpacings(objectRef.lineSpacings);
        textLineObject.setText(objectRef.text);
        textLineObject.setChildren(objectRef.children);
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
        return await this._internals.modifyTextLine(this._objectRef, this._text!);
    }
}
