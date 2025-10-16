import {PDFDancer} from "./pdfdancer_v1";
import fs from "fs";
import {Image, Position} from "./models";

export class ImageBuilder {
    private _client: PDFDancer;
    private _imageData: Uint8Array<ArrayBuffer> | undefined;
    private _position: Position | undefined;

    constructor(_client: PDFDancer) {
        this._client = _client;
    }

    fromFile(imagePath: string) {
        if (!fs.existsSync(imagePath)) {
            throw new Error(`Image not found: ${imagePath}`);
        }
        this._imageData = new Uint8Array(fs.readFileSync(imagePath));
        return this
    }

    fromBytes(imageData: Uint8Array<ArrayBuffer>) {
        this._imageData = imageData;
        return this;
    }

    at(pageIndex: number, x: number, y: number) {
        this._position = Position.atPageCoordinates(pageIndex, x, y);
        return this;
    }

    async add() {
        if (!this._imageData) {
            throw new Error("Image data is not set");
        }
        if (!this._position) {
            throw new Error("Position is not set");
        }
        let image = new Image();
        image.data = this._imageData;
        return await this._client.addImage(image, this._position);
    }
}
