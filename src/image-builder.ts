import {PDFDancer} from "./pdfdancer_v1";
import fs from "fs";
import {Image, Position} from "./models";

// 👇 Internal view of PDFDancer methods, not exported
interface PDFDancerInternals {
    addImage(image: Image, position: Position): Promise<boolean>;
}

export class ImageBuilder {
    private _client: PDFDancer;
    private _imageData: Uint8Array<ArrayBuffer> | undefined;
    private _position: Position | undefined;
    private _internals: PDFDancerInternals;

    constructor(_client: PDFDancer) {
        this._client = _client;
        // Cast to the internal interface to get access
        this._internals = this._client as unknown as PDFDancerInternals;
    }

    fromFile(imagePath: string) {
        if (!fs.existsSync(imagePath)) {
            throw new Error(`Image not found: ${imagePath}`);
        }
        this._imageData = new Uint8Array(fs.readFileSync(imagePath));
        return this
    }

    // noinspection JSUnusedGlobalSymbols
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
        return await this._internals.addImage(image, this._position);
    }
}
