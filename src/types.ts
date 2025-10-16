import {ObjectRef, ObjectType, Position} from "./models";
import {PDFDancer} from "./pdfdancer_v1";

export class BaseObject {

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

    static fromRef(_client: PDFDancer, objectRef: ObjectRef) {
        return new PathObject(_client, objectRef.internalId, objectRef.type, objectRef.position);
    }

    async delete() {
        return this._client.delete(this.ref());
    }

    private ref() {
        return new ObjectRef(this.internalId, this.position, this.type);
    }

    async moveTo(x: number, y: number) {
        return this._client.move(this.ref(), Position.atPageCoordinates(this.position.pageIndex!, x, y));
    }
}

export class PathObject extends BaseObject {

}

export class ImageObject extends BaseObject {

}
