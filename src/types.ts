import {FormFieldRef, ObjectRef, ObjectType, Position} from "./models";
import {PDFDancer} from "./pdfdancer_v1";
import {ParagraphBuilder} from "./paragraph-builder";

export class BaseObject<TRef extends ObjectRef = ObjectRef> {

    _client: PDFDancer;

    internalId: string;
    type: ObjectType;
    position: Position;

    constructor(client: PDFDancer, internalId: string, type: ObjectType, position: Position) {
        this.internalId = internalId;
        this.type = type;
        this.position = position;
        this._client = client;
    }

    async delete() {
        return this._client.delete(this.ref());
    }

    protected ref(): TRef {
        return new ObjectRef(this.internalId, this.position, this.type) as TRef;
    }

    async moveTo(x: number, y: number) {
        return this._client.move(this.ref(), Position.atPageCoordinates(this.position.pageIndex!, x, y));
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
        return await this._client.changeFormField(this.ref(), value);
    }

    protected ref() {
        return new FormFieldRef(this.internalId, this.position, this.type, this.name, this.value);
    }

    static fromRef(_client: PDFDancer, objectRef: FormFieldRef) {
        return new FormFieldObject(_client, objectRef.internalId, objectRef.type, objectRef.position, objectRef.name, objectRef.value);
    }
}

export class ParagraphObject extends BaseObject {

    static fromRef(_client: PDFDancer, objectRef: ObjectRef) {
        return new ParagraphObject(_client, objectRef.internalId, objectRef.type, objectRef.position);
    }

    edit() {
        return new ParagraphBuilder(this._client, this.ref());
    }
}

export class TextLineObject extends BaseObject {
    static fromRef(_client: PDFDancer, objectRef: ObjectRef) {
        return new TextLineObject(_client, objectRef.internalId, objectRef.type, objectRef.position);
    }

    edit() {
        return new TextLineBuilder(this._client, this.ref());
    }
}


class TextLineBuilder {

    private _text: string | undefined;
    private _objectRef: ObjectRef;
    private _client: PDFDancer

    constructor(client: PDFDancer, objectRef: ObjectRef) {
        this._objectRef = objectRef;
        this._client = client;

    }

    text(newText: string) {
        this._text = newText;
        return this;
    }

    async apply() {
        return await this._client.modifyTextLine(this._objectRef, this._text!);
    }
}
