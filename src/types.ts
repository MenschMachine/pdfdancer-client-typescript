import {
    Color,
    CommandResult,
    FlipDirection,
    FormFieldRef,
    Image,
    ImageTransformRequest,
    ImageTransformType,
    ObjectRef,
    ObjectType,
    PathGroupInfo,
    PathObjectRef,
    Position,
} from "./models";
import {PDFDancer} from "./pdfdancer_v1";
import {ValidationException} from "./exceptions";
import fs from "node:fs";
import path from "node:path";

// 👇 Internal view of PDFDancer methods, not exported
interface PDFDancerInternals {
    delete(objectRef: ObjectRef): Promise<boolean>;

    move(objectRef: ObjectRef, position: Position): Promise<boolean>;

    clearClipping(objectRef: ObjectRef): Promise<boolean>;

    changeFormField(formFieldRef: FormFieldRef, value: string): Promise<boolean>;

    modifyPath(objectRef: ObjectRef, strokeColor?: Color | null, fillColor?: Color | null): Promise<CommandResult>;

    transformImage(request: ImageTransformRequest): Promise<CommandResult>;

    clearPathGroupClipping(pageNumber: number, groupId: string): Promise<boolean>;
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

    objectRef(): TRef {
        return this.ref();
    }

    async moveTo(x: number, y: number) {
        return this._internals.move(this.ref(), Position.atPageCoordinates(this.position.pageNumber!, x, y));
    }

    async clearClipping(): Promise<boolean> {
        return this._internals.clearClipping(this.ref());
    }

}

export class PathObject extends BaseObject {

    private _strokeColor?: Color | null;
    private _fillColor?: Color | null;
    private _strokeWidth?: number | null;
    private _dashArray?: number[] | null;
    private _dashPhase?: number | null;

    static fromRef(_client: PDFDancer, objectRef: ObjectRef) {
        const pathObj = new PathObject(_client, objectRef.internalId, objectRef.type, objectRef.position);
        if (objectRef instanceof PathObjectRef) {
            pathObj._strokeColor = objectRef.strokeColor;
            pathObj._fillColor = objectRef.fillColor;
            pathObj._strokeWidth = objectRef.strokeWidth;
            pathObj._dashArray = objectRef.dashArray;
            pathObj._dashPhase = objectRef.dashPhase;
        }
        return pathObj;
    }

    /**
     * Returns the stroke color of this path, or undefined if not set.
     */
    get strokeColor(): Color | null | undefined {
        return this._strokeColor;
    }

    /**
     * Returns the fill color of this path, or undefined if not set.
     */
    get fillColor(): Color | null | undefined {
        return this._fillColor;
    }

    /**
     * Returns the stroke width of this path, or undefined if not set.
     */
    get strokeWidth(): number | null | undefined {
        return this._strokeWidth;
    }

    /**
     * Returns the dash array of this path, or undefined if not set.
     */
    get dashArray(): number[] | null | undefined {
        return this._dashArray;
    }

    /**
     * Returns the dash phase of this path, or undefined if not set.
     */
    get dashPhase(): number | null | undefined {
        return this._dashPhase;
    }

    /**
     * Starts an edit session to modify this path's colors.
     */
    edit(): PathEditSession {
        return new PathEditSession(this._client, this.ref());
    }
}

export class PathGroupObject {
    private _client: PDFDancer;
    private _pageIndex: number;
    private _info: PathGroupInfo;
    private _internals: PathGroupInternals;

    constructor(client: PDFDancer, pageIndex: number, info: PathGroupInfo) {
        this._client = client;
        this._pageIndex = pageIndex;
        this._info = info;
        this._internals = this._client as unknown as PathGroupInternals;
    }

    get pathCount(): number { return this._info.pathCount; }
    get groupId(): string { return this._info.groupId; }
    get boundingBox(): Record<string, any> | null { return this._info.boundingBox; }
    get x(): number { return this._info.x; }
    get y(): number { return this._info.y; }

    async moveTo(x: number, y: number): Promise<boolean> {
        return this._internals.movePathGroup(this._pageIndex, this._info.groupId, x, y);
    }

    async scale(factor: number): Promise<boolean> {
        return this._internals.scalePathGroup(this._pageIndex, this._info.groupId, factor);
    }

    async rotate(degrees: number): Promise<boolean> {
        return this._internals.rotatePathGroup(this._pageIndex, this._info.groupId, degrees);
    }

    async resize(width: number, height: number): Promise<boolean> {
        return this._internals.resizePathGroup(this._pageIndex, this._info.groupId, width, height);
    }

    async remove(): Promise<boolean> {
        return this._internals.removePathGroup(this._pageIndex, this._info.groupId);
    }

    async clearClipping(): Promise<boolean> {
        return this._internals.clearPathGroupClipping(this._pageIndex + 1, this._info.groupId);
    }
}

// Internal interface for path group operations
interface PathGroupInternals {
    movePathGroup(pageIndex: number, groupId: string, x: number, y: number): Promise<boolean>;
    scalePathGroup(pageIndex: number, groupId: string, factor: number): Promise<boolean>;
    rotatePathGroup(pageIndex: number, groupId: string, degrees: number): Promise<boolean>;
    resizePathGroup(pageIndex: number, groupId: string, width: number, height: number): Promise<boolean>;
    removePathGroup(pageIndex: number, groupId: string): Promise<boolean>;
    clearPathGroupClipping(pageNumber: number, groupId: string): Promise<boolean>;
}

export class ImageObject extends BaseObject {

    static fromRef(_client: PDFDancer, objectRef: ObjectRef) {
        return new ImageObject(_client, objectRef.internalId, objectRef.type, objectRef.position);
    }

    get width(): number | undefined { return this.position.boundingRect?.width; }
    get height(): number | undefined { return this.position.boundingRect?.height; }
    get aspectRatio(): number | undefined {
        const width = this.width;
        const height = this.height;
        return width !== undefined && height !== undefined && height !== 0 ? width / height : undefined;
    }

    async replaceFromFile(imagePath: string): Promise<CommandResult> {
        if (!imagePath || !fs.existsSync(imagePath)) {
            throw new ValidationException(`Image file not found: ${imagePath}`);
        }
        const data = new Uint8Array(fs.readFileSync(imagePath));
        if (data.length === 0) throw new ValidationException('Image file cannot be empty');
        const format = path.extname(imagePath).replace(/^\./, '').toUpperCase() || undefined;
        return this.replace(new Image(undefined, format, undefined, undefined, data));
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

    async flipHorizontal(): Promise<CommandResult> { return this.flip(FlipDirection.HORIZONTAL); }
    async flipVertical(): Promise<CommandResult> { return this.flip(FlipDirection.VERTICAL); }

    /**
     * Fills a rectangular pixel region of the image with a solid color.
     *
     * @param x The x coordinate of the top-left corner of the region
     * @param y The y coordinate of the top-left corner of the region
     * @param width The width of the region in pixels
     * @param height The height of the region in pixels
     * @param color The fill color
     * @returns CommandResult indicating success or failure
     */
    async fillRegion(x: number, y: number, width: number, height: number, color: Color): Promise<CommandResult> {
        if (!(color instanceof Color)) {
            throw new ValidationException("Color must be an instance of Color");
        }
        if (width <= 0) {
            throw new ValidationException(`Width must be positive, got ${width}`);
        }
        if (height <= 0) {
            throw new ValidationException(`Height must be positive, got ${height}`);
        }
        const fillColor = (color.r << 16) | (color.g << 8) | color.b;
        const request = new ImageTransformRequest(
            this.ref(),
            ImageTransformType.FILL_REGION,
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
            undefined,
            x,
            y,
            width,
            height,
            fillColor
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

    async setValue(value: string) {
        return await this._internals.changeFormField(this.ref(), value);
    }

    protected ref() {
        return new FormFieldRef(this.internalId, this.position, this.type, this.name, this.value);
    }

    static fromRef(_client: PDFDancer, objectRef: FormFieldRef) {
        return new FormFieldObject(_client, objectRef.internalId, objectRef.type, objectRef.position, objectRef.name, objectRef.value);
    }
}

export class PathEditSession {
    private _strokeColor?: Color | null;
    private _fillColor?: Color | null;
    private _hasChanges = false;
    private readonly _internals: PDFDancerInternals;

    constructor(private readonly _client: PDFDancer, private readonly _objectRef: ObjectRef) {
        this._internals = this._client as unknown as PDFDancerInternals;
    }

    /**
     * Sets the stroke color for the path.
     * @param color The stroke color to set, or null to leave unchanged
     */
    strokeColor(color: Color | null): this {
        this._strokeColor = color;
        this._hasChanges = true;
        return this;
    }

    /**
     * Sets the fill color for the path.
     * @param color The fill color to set, or null to leave unchanged
     */
    fillColor(color: Color | null): this {
        this._fillColor = color;
        this._hasChanges = true;
        return this;
    }

    /**
     * Applies the color changes to the path.
     * If no changes have been made, this is a no-op.
     */
    async apply(): Promise<CommandResult> {
        if (!this._hasChanges) {
            return CommandResult.empty("ModifyPath", this._objectRef.internalId);
        }

        const result = await this._internals.modifyPath(this._objectRef, this._strokeColor, this._fillColor);
        this._hasChanges = false;
        return result;
    }
}
