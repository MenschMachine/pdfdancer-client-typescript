import {PDFDancer} from "./pdfdancer_v1";
import fs from "fs";
import {Image, Position} from "./models";

// 👇 Internal view of PDFDancer methods, not exported
interface PDFDancerInternals {
    addImage(image: Image, position: Position): Promise<boolean>;
}

export class ImageBuilder {
    private _imageData: Uint8Array<ArrayBuffer> | undefined;
    private _position: Position | undefined;
    private readonly _internals: PDFDancerInternals;

    constructor(private _client: PDFDancer, private readonly _defaultPageIndex?: number) {
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

    at(x: number, y: number): this;
    at(pageIndex: number, x: number, y: number): this;
    at(pageIndexOrX: number, xOrY: number, maybeY?: number): this {
        if (maybeY === undefined) {
            if (this._defaultPageIndex === undefined) {
                throw new Error('Page index must be provided when adding an image');
            }
            this._position = Position.atPageCoordinates(this._defaultPageIndex, pageIndexOrX, xOrY);
        } else {
            this._position = Position.atPageCoordinates(pageIndexOrX, xOrY, maybeY);
        }
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
