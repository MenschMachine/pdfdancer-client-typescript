import {ValidationException} from './exceptions';

function fail(message: string): never {
    throw new ValidationException(message);
}

function finite(value: number, name: string): void {
    if (!Number.isFinite(value)) fail(`${name} must be finite`);
}

function compact(value: object): Record<string, unknown> {
    return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined));
}

function normalizedPages(values: Array<number | number[]>): number[] {
    const pages = values.flatMap(value => Array.isArray(value) ? value : [value]);
    for (const page of pages) {
        if (!Number.isInteger(page) || page < 1) fail('pages must contain only page numbers >= 1');
    }
    return pages;
}

export enum PdfColorSpace {
    RGB = 'rgb',
    CMYK = 'cmyk',
    GRAY = 'gray'
}

export class PdfColorRequest {
    constructor(
        public readonly space: PdfColorSpace,
        public readonly components: number[],
        public readonly alphaValue?: number
    ) {}

    static rgb(red: number, green: number, blue: number): PdfColorRequest {
        return new PdfColorRequest(PdfColorSpace.RGB, [red, green, blue]).validated();
    }

    static cmyk(cyan: number, magenta: number, yellow: number, black: number): PdfColorRequest {
        return new PdfColorRequest(PdfColorSpace.CMYK, [cyan, magenta, yellow, black]).validated();
    }

    static gray(gray: number): PdfColorRequest {
        return new PdfColorRequest(PdfColorSpace.GRAY, [gray]).validated();
    }

    alpha(alpha: number): PdfColorRequest {
        return new PdfColorRequest(this.space, [...this.components], alpha).validated();
    }

    validated(): this {
        const expected = this.space === PdfColorSpace.RGB ? 3 : this.space === PdfColorSpace.CMYK ? 4 : this.space === PdfColorSpace.GRAY ? 1 : 0;
        if (expected === 0) fail('color space must be rgb, cmyk, or gray');
        if (!Array.isArray(this.components) || this.components.length !== expected) {
            fail(`color space ${this.space} requires ${expected} components`);
        }
        for (const component of this.components) this.validateNormalized(component, 'color component');
        if (this.alphaValue !== undefined) this.validateNormalized(this.alphaValue, 'alpha');
        return this;
    }

    private validateNormalized(value: number, name: string): void {
        if (!Number.isFinite(value) || value < 0 || value > 1) fail(`${name} must be finite and between 0.0 and 1.0`);
    }

    toJSON(): Record<string, unknown> {
        return compact({space: this.space, components: this.components, alpha: this.alphaValue});
    }
}

export class PdfAffineTransform {
    private constructor(private readonly coefficients: [number, number, number, number, number, number]) {
        coefficients.forEach(value => finite(value, 'PDF affine matrix coefficient'));
    }

    static fromPdfMatrix(coefficients: number[]): PdfAffineTransform {
        if (!Array.isArray(coefficients) || coefficients.length !== 6) {
            fail('PDF affine matrix must contain exactly 6 coefficients');
        }
        return new PdfAffineTransform([...coefficients] as [number, number, number, number, number, number]);
    }

    static builder(): PdfAffineTransformBuilder {
        return new PdfAffineTransformBuilder();
    }

    toPdfMatrix(): number[] {
        return [...this.coefficients];
    }

    followedBy(next: PdfAffineTransform): PdfAffineTransform {
        const [a, b, c, d, e, f] = this.coefficients;
        const [na, nb, nc, nd, ne, nf] = next.coefficients;
        return PdfAffineTransform.fromPdfMatrix([
            na * a + nc * b,
            nb * a + nd * b,
            na * c + nc * d,
            nb * c + nd * d,
            na * e + nc * f + ne,
            nb * e + nd * f + nf
        ]);
    }
}

export class PdfAffineTransformBuilder {
    private transform = PdfAffineTransform.fromPdfMatrix([1, 0, 0, 1, 0, 0]);

    scale(scaleX: number, scaleY: number): this {
        this.transform = this.transform.followedBy(PdfAffineTransform.fromPdfMatrix([scaleX, 0, 0, scaleY, 0, 0]));
        return this;
    }

    shear(shearX: number, shearY: number): this {
        this.transform = this.transform.followedBy(PdfAffineTransform.fromPdfMatrix([1, shearY, shearX, 1, 0, 0]));
        return this;
    }

    rotateDegrees(degrees: number): this {
        finite(degrees, 'rotation degrees');
        const radians = degrees * Math.PI / 180;
        const cosine = Math.cos(radians);
        const sine = Math.sin(radians);
        this.transform = this.transform.followedBy(PdfAffineTransform.fromPdfMatrix([cosine, sine, -sine, cosine, 0, 0]));
        return this;
    }

    translate(x: number, y: number): this {
        this.transform = this.transform.followedBy(PdfAffineTransform.fromPdfMatrix([1, 0, 0, 1, x, y]));
        return this;
    }

    build(): PdfAffineTransform {
        return this.transform;
    }
}

export enum TextLayoutMode {
    SOURCE_ANCHORED = 'sourceAnchored',
    REFLOW_WHEN_SUPPORTED = 'reflowWhenSupported',
    REQUIRE_REFLOW = 'requireReflow'
}

export enum TextLayoutProfile {
    DEFAULT = 'default',
    BODY_TEXT = 'bodyText',
    NO_REFLOW = 'noReflow'
}

export class TextLayoutRequest {
    constructor(
        public readonly mode?: TextLayoutMode,
        public readonly profile?: TextLayoutProfile,
        public readonly hyphenationEnabled?: boolean
    ) {}

    static sourceAnchored(): TextLayoutRequest {
        return new TextLayoutRequest(TextLayoutMode.SOURCE_ANCHORED);
    }

    static reflowWhenSupported(profile: TextLayoutProfile): TextLayoutRequest {
        return new TextLayoutRequest(TextLayoutMode.REFLOW_WHEN_SUPPORTED, profile);
    }

    static requireReflow(profile: TextLayoutProfile): TextLayoutRequest {
        return new TextLayoutRequest(TextLayoutMode.REQUIRE_REFLOW, profile);
    }

    withHyphenationEnabled(enabled: boolean): TextLayoutRequest {
        return new TextLayoutRequest(this.mode, this.profile, enabled);
    }

    validated(): this {
        const mode = this.mode ?? TextLayoutMode.SOURCE_ANCHORED;
        if (mode === TextLayoutMode.SOURCE_ANCHORED && this.profile !== undefined) {
            fail('sourceAnchored layout must not specify profile');
        }
        if (mode === TextLayoutMode.SOURCE_ANCHORED && this.hyphenationEnabled !== undefined) {
            fail('layout.hyphenationEnabled is not valid when layout.mode is sourceAnchored');
        }
        if (mode !== TextLayoutMode.SOURCE_ANCHORED && this.profile === undefined) {
            fail(`${mode} profile must be one of default, bodyText, noReflow`);
        }
        return this;
    }

    toJSON(): Record<string, unknown> {
        return compact({mode: this.mode, profile: this.profile, hyphenationEnabled: this.hyphenationEnabled});
    }
}

export class TextSelectorRequest {
    constructor(
        public readonly literal?: string,
        public readonly regex?: string,
        public readonly caseSensitive?: boolean,
        public readonly wholeWords?: boolean,
        public readonly maxMatches?: number
    ) {}

    validated(): this {
        if ((this.literal === undefined) === (this.regex === undefined)) fail('Exactly one of literal or regex must be provided');
        if (this.literal !== undefined && this.literal.trim() === '') fail('literal must not be blank');
        if (this.regex !== undefined && this.regex.trim() === '') fail('regex must not be blank');
        if (this.maxMatches !== undefined && (!Number.isInteger(this.maxMatches) || this.maxMatches <= 0)) fail('maxMatches must be positive');
        return this;
    }

    toJSON(): Record<string, unknown> {
        return compact({literal: this.literal, regex: this.regex, caseSensitive: this.caseSensitive, wholeWords: this.wholeWords, maxMatches: this.maxMatches});
    }
}

interface StyleFields {
    font?: string;
    size?: number;
    fillColor?: PdfColorRequest;
    strokeColor?: PdfColorRequest;
    characterSpacing?: number;
    wordSpacing?: number;
}

function validateStyleFields(fields: StyleFields, requireAny: boolean): void {
    if (requireAny && Object.values(fields).every(value => value === undefined)) fail('style must set at least one field');
    if (fields.font !== undefined && fields.font.trim() === '') fail('font must not be blank');
    if (fields.size !== undefined && (!Number.isFinite(fields.size) || fields.size <= 0)) fail('size must be positive and finite');
    fields.fillColor?.validated();
    fields.strokeColor?.validated();
    if (fields.characterSpacing !== undefined) finite(fields.characterSpacing, 'characterSpacing');
    if (fields.wordSpacing !== undefined) finite(fields.wordSpacing, 'wordSpacing');
}

export class TextStylePatchRequest implements StyleFields {
    constructor(
        public readonly font?: string,
        public readonly size?: number,
        public readonly fillColor?: PdfColorRequest,
        public readonly strokeColor?: PdfColorRequest,
        public readonly characterSpacing?: number,
        public readonly wordSpacing?: number
    ) {}

    static builder(): TextStylePatchBuilder { return new TextStylePatchBuilder(); }

    validated(): this {
        validateStyleFields(this, true);
        return this;
    }

    toJSON(): Record<string, unknown> { return compact({...this}); }
}

export class TextStylePatchBuilder {
    private fields: StyleFields = {};
    font(value: string): this { this.fields.font = value; return this; }
    size(value: number): this { this.fields.size = value; return this; }
    fillColor(value: PdfColorRequest): this { this.fields.fillColor = value; return this; }
    strokeColor(value: PdfColorRequest): this { this.fields.strokeColor = value; return this; }
    characterSpacing(value: number): this { this.fields.characterSpacing = value; return this; }
    wordSpacing(value: number): this { this.fields.wordSpacing = value; return this; }
    build(): TextStylePatchRequest {
        return new TextStylePatchRequest(this.fields.font, this.fields.size, this.fields.fillColor, this.fields.strokeColor, this.fields.characterSpacing, this.fields.wordSpacing).validated();
    }
}

export class TextStyleSetRequest implements StyleFields {
    constructor(
        public readonly font?: string,
        public readonly size?: number,
        public readonly fillColor?: PdfColorRequest,
        public readonly strokeColor?: PdfColorRequest,
        public readonly characterSpacing?: number,
        public readonly wordSpacing?: number,
        public readonly resetSpacingOverrides?: boolean
    ) {}

    static builder(): TextStyleSetBuilder { return new TextStyleSetBuilder(); }

    validated(): this {
        validateStyleFields(this, this.resetSpacingOverrides === undefined);
        if (this.resetSpacingOverrides === false) fail('resetSpacingOverrides must be true when present');
        if (this.resetSpacingOverrides && (this.characterSpacing !== undefined || this.wordSpacing !== undefined)) {
            fail('resetSpacingOverrides cannot be combined with characterSpacing or wordSpacing');
        }
        return this;
    }

    toJSON(): Record<string, unknown> { return compact({...this}); }
}

export class TextStyleSetBuilder {
    private fields: StyleFields & {resetSpacingOverrides?: boolean} = {};
    constructor(style?: TextStyleSetRequest) { if (style) this.fields = {...style}; }
    font(value: string): this { this.fields.font = value; return this; }
    size(value: number): this { this.fields.size = value; return this; }
    fillColor(value: PdfColorRequest): this { this.fields.fillColor = value; return this; }
    strokeColor(value: PdfColorRequest): this { this.fields.strokeColor = value; return this; }
    characterSpacing(value: number): this { this.fields.characterSpacing = value; return this; }
    wordSpacing(value: number): this { this.fields.wordSpacing = value; return this; }
    resetSpacingOverrides(): this { this.fields.resetSpacingOverrides = true; return this; }
    build(): TextStyleSetRequest {
        return new TextStyleSetRequest(this.fields.font, this.fields.size, this.fields.fillColor, this.fields.strokeColor, this.fields.characterSpacing, this.fields.wordSpacing, this.fields.resetSpacingOverrides).validated();
    }
}

abstract class SelectorLayoutBuilder<T> {
    protected selector: {literal?: string; regex?: string; caseSensitive?: boolean; wholeWords?: boolean; maxMatches?: number} = {};
    protected pageValues?: number[];
    protected layoutValue?: TextLayoutRequest;
    protected pendingHyphenation?: boolean;

    pages(...pages: Array<number | number[]>): this { this.pageValues = normalizedPages(pages); return this; }
    literal(value: string): this { this.selector.literal = value; delete this.selector.regex; return this; }
    regex(value: string): this { this.selector.regex = value; delete this.selector.literal; return this; }
    caseSensitive(value: boolean): this { this.selector.caseSensitive = value; return this; }
    wholeWords(value: boolean): this { this.selector.wholeWords = value; return this; }
    maxMatches(value: number): this { this.selector.maxMatches = value; return this; }
    layout(value: TextLayoutRequest): this { this.layoutValue = value; this.pendingHyphenation = value.hyphenationEnabled; return this; }
    sourceAnchored(): this { this.layoutValue = TextLayoutRequest.sourceAnchored(); this.pendingHyphenation = undefined; return this; }
    reflowWhenSupported(profile: TextLayoutProfile): this { this.layoutValue = TextLayoutRequest.reflowWhenSupported(profile); return this; }
    requireReflow(profile: TextLayoutProfile): this { this.layoutValue = TextLayoutRequest.requireReflow(profile); return this; }
    hyphenationEnabled(enabled: boolean): this { this.pendingHyphenation = enabled; return this; }

    protected builtSelector(): TextSelectorRequest {
        return new TextSelectorRequest(this.selector.literal, this.selector.regex, this.selector.caseSensitive, this.selector.wholeWords, this.selector.maxMatches).validated();
    }

    protected builtLayout(): TextLayoutRequest | undefined {
        if (!this.layoutValue && this.pendingHyphenation === undefined) return undefined;
        const layout = this.layoutValue ?? TextLayoutRequest.sourceAnchored();
        return (this.pendingHyphenation === undefined ? layout : layout.withHyphenationEnabled(this.pendingHyphenation)).validated();
    }

    abstract build(): T;
}

export class TextReplacementImageRequest {
    constructor(public readonly data: Uint8Array, public readonly transformation: PdfAffineTransform) {}
    toJSON(): Record<string, unknown> {
        return {data: Buffer.from(this.data).toString('base64'), transformationMatrix: this.transformation.toPdfMatrix()};
    }
}

export class TextReplaceRequest {
    constructor(
        public readonly pages: number[] | undefined,
        public readonly select: TextSelectorRequest,
        public readonly replaceWith?: string,
        public readonly replaceWithImage?: TextReplacementImageRequest,
        public readonly style?: TextStyleSetRequest,
        public readonly layout?: TextLayoutRequest
    ) {}

    static literal(text: string, replaceWith: string): TextReplaceRequestBuilder { return new TextReplaceRequestBuilder().literal(text).replaceWith(replaceWith); }
    static regex(regex: string, replaceWith: string): TextReplaceRequestBuilder { return new TextReplaceRequestBuilder().regex(regex).replaceWith(replaceWith); }
    static builder(): TextReplaceRequestBuilder { return new TextReplaceRequestBuilder(); }
    withPages(pages: number[]): TextReplaceRequest { return new TextReplaceRequest([...pages], this.select, this.replaceWith, this.replaceWithImage, this.style, this.layout).validated(); }

    validated(): this {
        if (this.pages) normalizedPages([this.pages]);
        this.select.validated();
        if ((this.replaceWith === undefined) === (this.replaceWithImage === undefined)) fail('Exactly one of replaceWith or replaceWithImage is required');
        if (this.replaceWithImage) {
            if (this.replaceWithImage.data.length === 0) fail('replaceWithImage image data is required and must not be empty');
            if (this.style) fail('style is not valid with replaceWithImage');
            if (this.layout?.mode && this.layout.mode !== TextLayoutMode.SOURCE_ANCHORED) fail('replaceWithImage supports only sourceAnchored layout');
        }
        this.style?.validated();
        this.layout?.validated();
        return this;
    }

    toJSON(): Record<string, unknown> { return compact({...this}); }
}

export class TextReplaceRequestBuilder extends SelectorLayoutBuilder<TextReplaceRequest> {
    private replacement?: string;
    private image?: TextReplacementImageRequest;
    private styleValue?: TextStyleSetRequest;
    private styleBuilder?: TextStyleSetBuilder;
    replaceWith(value: string): this { this.replacement = value; this.image = undefined; return this; }
    replaceWithImage(data: Uint8Array, transformation: PdfAffineTransform): this { this.image = new TextReplacementImageRequest(data, transformation); this.replacement = undefined; return this; }
    style(value: TextStyleSetRequest): this { this.styleValue = value; this.styleBuilder = undefined; return this; }
    private styles(): TextStyleSetBuilder { return this.styleBuilder ??= new TextStyleSetBuilder(this.styleValue); }
    font(value: string): this { this.styles().font(value); return this; }
    size(value: number): this { this.styles().size(value); return this; }
    fillColor(value: PdfColorRequest): this { this.styles().fillColor(value); return this; }
    strokeColor(value: PdfColorRequest): this { this.styles().strokeColor(value); return this; }
    characterSpacing(value: number): this { this.styles().characterSpacing(value); return this; }
    wordSpacing(value: number): this { this.styles().wordSpacing(value); return this; }
    resetSpacingOverrides(): this { this.styles().resetSpacingOverrides(); return this; }
    build(): TextReplaceRequest {
        const style = this.styleBuilder ? this.styleBuilder.build() : this.styleValue;
        return new TextReplaceRequest(this.pageValues, this.builtSelector(), this.replacement, this.image, style, this.builtLayout()).validated();
    }
}

export class TextDeleteRequest {
    constructor(public readonly pages: number[] | undefined, public readonly select: TextSelectorRequest, public readonly layout?: TextLayoutRequest) {}
    static literal(text: string): TextDeleteRequestBuilder { return new TextDeleteRequestBuilder().literal(text); }
    static regex(regex: string): TextDeleteRequestBuilder { return new TextDeleteRequestBuilder().regex(regex); }
    static builder(): TextDeleteRequestBuilder { return new TextDeleteRequestBuilder(); }
    withPages(pages: number[]): TextDeleteRequest { return new TextDeleteRequest([...pages], this.select, this.layout).validated(); }
    validated(): this { if (this.pages) normalizedPages([this.pages]); this.select.validated(); this.layout?.validated(); return this; }
    toJSON(): Record<string, unknown> { return compact({...this}); }
}

export class TextDeleteRequestBuilder extends SelectorLayoutBuilder<TextDeleteRequest> {
    build(): TextDeleteRequest { return new TextDeleteRequest(this.pageValues, this.builtSelector(), this.builtLayout()).validated(); }
}

export enum TextInsertCaret { BEFORE = 'before', AFTER = 'after' }

export interface TextInsertAnchorTarget { pages?: number[]; select: TextSelectorRequest; caret: TextInsertCaret; }
export interface TextInsertCoordinateTarget { page?: number; x: number; y: number; rotationDegrees?: number; }
export interface TextInsertTarget { anchor?: TextInsertAnchorTarget; coordinate?: TextInsertCoordinateTarget; }
export interface TextInsertStyle { from?: 'anchor'; patch?: TextStylePatchRequest; }

export class TextInsertRequest {
    constructor(
        public readonly target: TextInsertTarget,
        public readonly insert: string,
        public readonly style: TextInsertStyle,
        public readonly layout?: TextLayoutRequest
    ) {}
    static after(anchor: string, insert: string): TextInsertRequestBuilder { return new TextInsertRequestBuilder().literal(anchor).insert(insert).caret(TextInsertCaret.AFTER); }
    static before(anchor: string, insert: string): TextInsertRequestBuilder { return new TextInsertRequestBuilder().literal(anchor).insert(insert).caret(TextInsertCaret.BEFORE); }
    static afterRegex(anchor: string, insert: string): TextInsertRequestBuilder { return new TextInsertRequestBuilder().regex(anchor).insert(insert).caret(TextInsertCaret.AFTER); }
    static beforeRegex(anchor: string, insert: string): TextInsertRequestBuilder { return new TextInsertRequestBuilder().regex(anchor).insert(insert).caret(TextInsertCaret.BEFORE); }
    static at(page: number, x: number, y: number, insert: string): TextInsertRequestBuilder { return new TextInsertRequestBuilder().coordinate(page, x, y).insert(insert); }
    static builder(): TextInsertRequestBuilder { return new TextInsertRequestBuilder(); }

    withPages(pages: number[]): TextInsertRequest {
        const target: TextInsertTarget = this.target.anchor
            ? {anchor: {...this.target.anchor, pages: [...pages]}}
            : {coordinate: {...this.target.coordinate!, page: pages.length === 1 ? pages[0] : this.target.coordinate!.page}};
        return new TextInsertRequest(target, this.insert, this.style, this.layout).validated();
    }

    validated(allowMissingCoordinatePage = false): this {
        const anchor = this.target?.anchor;
        const coordinate = this.target?.coordinate;
        if (!!anchor === !!coordinate) fail('Exactly one of target.anchor or target.coordinate must be provided');
        if (anchor) {
            if (anchor.pages) normalizedPages([anchor.pages]);
            anchor.select.validated();
            if (!anchor.caret) fail('target.anchor.caret must not be null');
            if (this.style?.from !== 'anchor') fail('style.from must be anchor');
            this.style.patch?.validated();
        }
        if (coordinate) {
            if (coordinate.page === undefined) {
                if (!allowMissingCoordinatePage) fail('target.coordinate.page must be >= 1');
            } else if (!Number.isInteger(coordinate.page) || coordinate.page < 1) {
                fail('target.coordinate.page must be >= 1');
            }
            finite(coordinate.x, 'target.coordinate.x');
            finite(coordinate.y, 'target.coordinate.y');
            if (coordinate.rotationDegrees !== undefined) finite(coordinate.rotationDegrees, 'target.coordinate.rotationDegrees');
            if (this.style?.from !== undefined) fail('style.from must be omitted for coordinate insertion');
            if (!this.style?.patch) fail('style.patch is required for coordinate insertion');
            this.style.patch.validated();
        }
        if (this.insert === undefined || this.insert === '') fail('insert must not be null or empty');
        this.layout?.validated();
        return this;
    }

    toJSON(): Record<string, unknown> { return compact({...this}); }
}

export class TextInsertRequestBuilder extends SelectorLayoutBuilder<TextInsertRequest> {
    private targetKind: 'anchor' | 'coordinate' = 'anchor';
    private caretValue?: TextInsertCaret;
    private coordinateValue?: TextInsertCoordinateTarget;
    private insertValue = '';
    private styleFields: StyleFields = {};
    private explicitPatch?: TextStylePatchRequest;
    pages(...pages: Array<number | number[]>): this { super.pages(...pages); return this; }
    coordinate(page: number, x: number, y: number): this;
    coordinate(x: number, y: number): this;
    coordinate(first: number, second: number, third?: number): this {
        this.targetKind = 'coordinate';
        this.coordinateValue = third === undefined
            ? {x: first, y: second}
            : {page: first, x: second, y: third};
        this.selector = {};
        this.caretValue = undefined;
        return this;
    }
    rotationDegrees(value: number): this { if (!this.coordinateValue) fail('rotationDegrees requires a coordinate target'); this.coordinateValue.rotationDegrees = value; return this; }
    insert(value: string): this { this.insertValue = value; return this; }
    caret(value: TextInsertCaret): this { this.targetKind = 'anchor'; this.caretValue = value; return this; }
    stylePatch(value: TextStylePatchRequest): this { this.explicitPatch = value; this.styleFields = {}; return this; }
    private mutableStyle(): StyleFields {
        if (this.explicitPatch) {
            this.styleFields = {...this.explicitPatch};
            this.explicitPatch = undefined;
        }
        return this.styleFields;
    }
    font(value: string): this { this.mutableStyle().font = value; return this; }
    size(value: number): this { this.mutableStyle().size = value; return this; }
    fillColor(value: PdfColorRequest): this { this.mutableStyle().fillColor = value; return this; }
    strokeColor(value: PdfColorRequest): this { this.mutableStyle().strokeColor = value; return this; }
    characterSpacing(value: number): this { this.mutableStyle().characterSpacing = value; return this; }
    wordSpacing(value: number): this { this.mutableStyle().wordSpacing = value; return this; }

    build(): TextInsertRequest {
        const hasStyleFields = Object.values(this.styleFields).some(value => value !== undefined);
        const patch = this.explicitPatch ?? (hasStyleFields ? new TextStylePatchRequest(this.styleFields.font, this.styleFields.size, this.styleFields.fillColor, this.styleFields.strokeColor, this.styleFields.characterSpacing, this.styleFields.wordSpacing).validated() : undefined);
        const target: TextInsertTarget = this.targetKind === 'coordinate'
            ? {coordinate: this.coordinateValue}
            : {anchor: {pages: this.pageValues, select: this.builtSelector(), caret: this.caretValue!}};
        const style: TextInsertStyle = this.targetKind === 'coordinate' ? {patch} : compact({from: 'anchor', patch}) as TextInsertStyle;
        return new TextInsertRequest(target, this.insertValue, style, this.builtLayout())
            .validated(this.targetKind === 'coordinate' && this.coordinateValue?.page === undefined);
    }
}

export class TextStyleNumericFilterRequest {
    constructor(public readonly eq?: number, public readonly tolerance?: number) {}
    static equals(eq: number, tolerance?: number): TextStyleNumericFilterRequest { return new TextStyleNumericFilterRequest(eq, tolerance).validated(); }
    validated(): this {
        if (this.eq === undefined) fail('numeric filter eq must not be null');
        finite(this.eq, 'numeric filter eq');
        if (this.tolerance !== undefined && (!Number.isFinite(this.tolerance) || this.tolerance < 0)) fail('numeric filter tolerance must be non-negative and finite');
        return this;
    }
}

export interface TextStyleRunFilterRequest {
    textContains?: string;
    font?: string;
    size?: TextStyleNumericFilterRequest;
    fillColor?: PdfColorRequest;
    strokeColor?: PdfColorRequest;
    characterSpacing?: TextStyleNumericFilterRequest;
    wordSpacing?: TextStyleNumericFilterRequest;
    containsUnmappedGlyphs?: boolean;
}

export interface TextStyleSelectorRequest extends Omit<TextSelectorRequest, 'validated' | 'toJSON'> {
    runs?: {where: TextStyleRunFilterRequest; maxMatches?: number};
}

export interface TextStyleValue extends StyleFields { resetSpacingOverrides?: boolean; }

export class TextStyleRequest {
    constructor(
        public readonly pages: number[] | undefined,
        public readonly select: TextStyleSelectorRequest,
        public readonly style: TextStyleValue,
        public readonly layout?: TextLayoutRequest
    ) {}
    static literal(text: string): TextStyleRequestBuilder { return new TextStyleRequestBuilder().literal(text); }
    static regex(regex: string): TextStyleRequestBuilder { return new TextStyleRequestBuilder().regex(regex); }
    static runsWhere(): TextStyleRequestBuilder { return new TextStyleRequestBuilder().runsWhere(); }
    static builder(): TextStyleRequestBuilder { return new TextStyleRequestBuilder(); }
    withPages(pages: number[]): TextStyleRequest { return new TextStyleRequest([...pages], this.select, this.style, this.layout).validated(); }
    validated(): this {
        if (this.pages) normalizedPages([this.pages]);
        const hasLiteral = this.select.literal !== undefined;
        const hasRegex = this.select.regex !== undefined;
        const hasRuns = this.select.runs !== undefined;
        if ([hasLiteral, hasRegex, hasRuns].filter(Boolean).length !== 1) fail('Exactly one text style selector must be provided');
        if (hasLiteral || hasRegex) new TextSelectorRequest(this.select.literal, this.select.regex, this.select.caseSensitive, this.select.wholeWords, this.select.maxMatches).validated();
        if (hasRuns) validateRunFilter(this.select.runs!);
        validateStyleFields(this.style, this.style.resetSpacingOverrides === undefined);
        if (this.style.resetSpacingOverrides && (this.style.characterSpacing !== undefined || this.style.wordSpacing !== undefined)) fail('resetSpacingOverrides cannot be combined with characterSpacing or wordSpacing');
        this.layout?.validated();
        return this;
    }
    toJSON(): Record<string, unknown> { return compact({...this}); }
}

function validateRunFilter(runs: {where: TextStyleRunFilterRequest; maxMatches?: number}): void {
    const where = runs.where;
    if (!where || Object.values(where).every(value => value === undefined)) fail('runs.where must set at least one field');
    if (where.textContains !== undefined && where.textContains.trim() === '') fail('textContains must not be blank');
    if (where.font !== undefined && where.font.trim() === '') fail('font must not be blank');
    where.size?.validated();
    where.characterSpacing?.validated();
    where.wordSpacing?.validated();
    where.fillColor?.validated();
    where.strokeColor?.validated();
    if (runs.maxMatches !== undefined && (!Number.isInteger(runs.maxMatches) || runs.maxMatches <= 0)) fail('maxMatches must be positive');
}

export class TextStyleRequestBuilder extends SelectorLayoutBuilder<TextStyleRequest> {
    private selectorKind: 'text' | 'runs' = 'text';
    private where: TextStyleRunFilterRequest = {};
    private runMaxMatches?: number;
    private styleValue: TextStyleValue = {};
    runsWhere(): this { this.selectorKind = 'runs'; this.selector = {}; return this; }
    literal(value: string): this { this.selectorKind = 'text'; return super.literal(value); }
    regex(value: string): this { this.selectorKind = 'text'; return super.regex(value); }
    maxMatches(value: number): this { if (this.selectorKind === 'runs') this.runMaxMatches = value; else super.maxMatches(value); return this; }
    whereTextContains(value: string): this { this.runsWhere(); this.where.textContains = value; return this; }
    whereFont(value: string): this { this.runsWhere(); this.where.font = value; return this; }
    whereSize(eq: number, tolerance?: number): this { this.runsWhere(); this.where.size = TextStyleNumericFilterRequest.equals(eq, tolerance); return this; }
    whereFillColor(value: PdfColorRequest): this { this.runsWhere(); this.where.fillColor = value; return this; }
    whereStrokeColor(value: PdfColorRequest): this { this.runsWhere(); this.where.strokeColor = value; return this; }
    whereCharacterSpacing(eq: number, tolerance?: number): this { this.runsWhere(); this.where.characterSpacing = TextStyleNumericFilterRequest.equals(eq, tolerance); return this; }
    whereWordSpacing(eq: number, tolerance?: number): this { this.runsWhere(); this.where.wordSpacing = TextStyleNumericFilterRequest.equals(eq, tolerance); return this; }
    whereContainsUnmappedGlyphs(value: boolean): this { this.runsWhere(); this.where.containsUnmappedGlyphs = value; return this; }
    font(value: string): this { this.styleValue.font = value; return this; }
    size(value: number): this { this.styleValue.size = value; return this; }
    fillColor(value: PdfColorRequest): this { this.styleValue.fillColor = value; return this; }
    strokeColor(value: PdfColorRequest): this { this.styleValue.strokeColor = value; return this; }
    characterSpacing(value: number): this { this.styleValue.characterSpacing = value; return this; }
    wordSpacing(value: number): this { this.styleValue.wordSpacing = value; return this; }
    resetSpacingOverrides(value = true): this { this.styleValue.resetSpacingOverrides = value; return this; }
    build(): TextStyleRequest {
        const select: TextStyleSelectorRequest = this.selectorKind === 'runs'
            ? {runs: {where: {...this.where}, maxMatches: this.runMaxMatches}}
            : this.builtSelector();
        return new TextStyleRequest(this.pageValues, select, {...this.styleValue}, this.builtLayout()).validated();
    }
}

export interface TextEditChangeDiagnostic {
    page?: number;
    operation?: string;
    sourceText?: string;
    resultText?: string;
    requestedLayoutMode?: string;
    requestedLayoutProfile?: string;
    effectiveHyphenationEnabled: boolean;
    appliedLayoutMode?: string;
    elementIds?: string[];
    generatedElementIds?: string[];
    reflowUnitIds?: string[];
}

export interface TextOperationDiagnostic {
    page?: number;
    code?: string;
    message?: string;
    elementIds?: string[];
    reflowUnitIds?: string[];
}

export interface TextEditResponse {
    matched?: number;
    changed?: number;
    pagesChanged?: number[];
    change?: TextEditChangeDiagnostic[];
    warnings?: TextOperationDiagnostic[];
    errors?: TextOperationDiagnostic[];
}

export type TextOperation = 'replace' | 'delete' | 'insert' | 'style';

type TextEditingFunction = (
    operation: TextOperation,
    request: TextReplaceRequest | TextDeleteRequest | TextInsertRequest | TextStyleRequest
) => Promise<TextEditResponse>;

export class TextClient {
    constructor(private readonly edit: TextEditingFunction, private readonly pageNumber?: number) {}
    replace(request: TextReplaceRequest): Promise<TextEditResponse> { return this.edit('replace', this.scoped(request)); }
    delete(request: TextDeleteRequest): Promise<TextEditResponse> { return this.edit('delete', this.scoped(request)); }
    insert(request: TextInsertRequest): Promise<TextEditResponse> { return this.edit('insert', this.scoped(request)); }
    style(request: TextStyleRequest): Promise<TextEditResponse> { return this.edit('style', this.scoped(request)); }
    private scoped<T extends {withPages(pages: number[]): T}>(request: T): T {
        return this.pageNumber === undefined ? request : request.withPages([this.pageNumber]);
    }
}
