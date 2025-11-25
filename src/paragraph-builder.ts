/**
 * ParagraphBuilder for the PDFDancer TypeScript client.
 */

import {ValidationException} from './exceptions';
import {
    Color,
    CommandResult,
    Font,
    ObjectRef,
    Paragraph,
    Position,
    StandardFonts,
    TextLine,
    TextObjectRef
} from './models';
import {PDFDancer} from './pdfdancer_v1';

const DEFAULT_LINE_SPACING_FACTOR = 1.2;
const DEFAULT_BASE_FONT_SIZE = 12;

// 👇 Internal view of PDFDancer methods, not exported
interface PDFDancerInternals {
    modifyParagraph(objectRef: ObjectRef, update: Paragraph | string | null): Promise<CommandResult>;

    addParagraph(paragraph: Paragraph): Promise<boolean>;
}

const cloneColor = (color?: Color | null): Color | undefined => {
    if (!color) {
        return undefined;
    }
    return new Color(color.r, color.g, color.b, color.a);
};

const clonePosition = (position?: Position): Position | undefined => {
    return position ? position.copy() : undefined;
};

const defaultTextColor = (): Color => new Color(0, 0, 0);

/**
 * Builder class for constructing Paragraph objects with fluent interface.
 * Aligns with the Python client's ParagraphBuilder behaviour.
 */
export class ParagraphBuilder {
    private readonly _paragraph: Paragraph;
    private readonly _internals: PDFDancerInternals;

    private _lineSpacingFactor?: number;
    private _textColor?: Color;
    private _text?: string;
    private _ttfSource?: Uint8Array | File | string;
    private _font?: Font;
    private _fontExplicitlyChanged = false;
    private _originalParagraphPosition?: Position;
    private _targetObjectRef?: TextObjectRef;
    private _originalFont?: Font;
    private _originalColor?: Color;
    private _positionChanged = false;
    private _pageNumber?: number;

    private _pending: Promise<unknown>[] = [];
    private _registeringFont = false;

    constructor(private readonly _client: PDFDancer, objectRefOrPageNumber?: TextObjectRef | number) {
        if (!_client) {
            throw new ValidationException("Client cannot be null");
        }

        this._paragraph = new Paragraph();
        this._internals = this._client as unknown as PDFDancerInternals;

        if (objectRefOrPageNumber instanceof TextObjectRef) {
            this.target(objectRefOrPageNumber);
        } else if (typeof objectRefOrPageNumber === 'number') {
            this._pageNumber = objectRefOrPageNumber;
        }
    }

    static fromObjectRef(client: PDFDancer, objectRef: TextObjectRef): ParagraphBuilder {
        if (!objectRef) {
            throw new ValidationException("Object reference cannot be null");
        }

        const builder = new ParagraphBuilder(client, objectRef);
        builder.target(objectRef);
        builder.setOriginalParagraphPosition(objectRef.position);

        if (objectRef.lineSpacings) {
            builder._paragraph.setLineSpacings(objectRef.lineSpacings);
            const [firstSpacing] = objectRef.lineSpacings;
            if (firstSpacing !== undefined) {
                builder._paragraph.lineSpacing = firstSpacing;
            }
        }

        if (objectRef.fontName && objectRef.fontSize) {
            builder._originalFont = new Font(objectRef.fontName, objectRef.fontSize);
        }

        if (objectRef.color) {
            builder._originalColor = cloneColor(objectRef.color);
        }

        if (objectRef.children && objectRef.children.length > 0) {
            objectRef.children.forEach(child => builder.addTextLine(child));
        } else if (objectRef.text) {
            builder._splitText(objectRef.text).forEach(segment => builder.addTextLine(segment));
        }

        return builder;
    }

    setFontExplicitlyChanged(changed: boolean): void {
        this._fontExplicitlyChanged = !!changed;
    }

    setOriginalParagraphPosition(position?: Position): void {
        this._originalParagraphPosition = clonePosition(position);
        if (position && !this._paragraph.getPosition()) {
            this._paragraph.setPosition(clonePosition(position)!);
        }
        if (position?.pageNumber !== undefined) {
            this._pageNumber = position.pageNumber;
        }
    }

    target(objectRef: ObjectRef): this {
        if (!objectRef) {
            throw new ValidationException("Object reference cannot be null");
        }
        this._targetObjectRef = objectRef as TextObjectRef;
        if (objectRef.position) {
            this.setOriginalParagraphPosition(objectRef.position);
        }
        if (objectRef.position?.pageNumber !== undefined) {
            this._pageNumber = objectRef.position.pageNumber;
        }
        return this;
    }

    onlyTextChanged(): boolean {
        return (
            this._text !== undefined &&
            this._textColor === undefined &&
            this._ttfSource === undefined &&
            (this._font === undefined || !this._fontExplicitlyChanged) &&
            this._lineSpacingFactor === undefined
        );
    }

    replace(text: string, color?: Color): this {
        return this.text(text, color);
    }

    text(text: string, color?: Color): this {
        if (text === null || text === undefined) {
            throw new ValidationException("Text cannot be null");
        }

        this._text = text;
        if (color) {
            this.color(color);
        }
        return this;
    }

    font(font: Font): this;
    font(fontName: string, fontSize: number): this;
    font(fontOrName: Font | string, fontSize?: number): this {
        if (fontOrName instanceof Font) {
            this._font = fontOrName;
        } else {
            if (!fontOrName) {
                throw new ValidationException("Font name cannot be null");
            }
            if (fontSize == null) {
                throw new ValidationException("Font size cannot be null");
            }
            this._font = new Font(fontOrName, fontSize);
        }

        this._fontExplicitlyChanged = true;
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
                this._font = font;
                this._fontExplicitlyChanged = true;
            })
            .finally(() => {
                this._registeringFont = false;
            });

        this._pending.push(job);
        return this;
    }

    lineSpacing(spacing: number): this {
        if (spacing <= 0) {
            throw new ValidationException(`Line spacing must be positive, got ${spacing}`);
        }
        this._lineSpacingFactor = spacing;
        return this;
    }

    color(color: Color): this {
        if (!color) {
            throw new ValidationException("Color cannot be null");
        }
        this._textColor = color;
        return this;
    }

    moveTo(x: number, y: number): this {
        if (x === null || x === undefined || y === null || y === undefined) {
            throw new ValidationException("Coordinates cannot be null or undefined");
        }

        let position = this._paragraph.getPosition();
        if (!position && this._targetObjectRef?.position) {
            position = clonePosition(this._targetObjectRef.position);
        }

        const pageNumber = position?.pageNumber ?? this._pageNumber;
        if (pageNumber === undefined) {
            throw new ValidationException("Paragraph position must include a page index to move");
        }

        this._paragraph.setPosition(Position.atPageCoordinates(pageNumber, x, y));
        this._positionChanged = true;
        return this;
    }

    atPosition(position: Position): this {
        if (!position) {
            throw new ValidationException("Position cannot be null");
        }
        this._paragraph.setPosition(clonePosition(position)!);
        this._positionChanged = true;
        if (position.pageNumber !== undefined) {
            this._pageNumber = position.pageNumber;
        }
        return this;
    }

    at(x: number, y: number): this;
    at(pageNumber: number, x: number, y: number): this;
    at(pageNumberOrX: number, xOrY: number, maybeY?: number): this {
        if (maybeY === undefined) {
            const pageNumber = this._pageNumber ?? this._paragraph.getPosition()?.pageNumber;
            if (pageNumber === undefined) {
                throw new ValidationException("Page index must be provided before calling at(x, y)");
            }
            return this._setPosition(pageNumber, pageNumberOrX, xOrY);
        }

        return this._setPosition(pageNumberOrX, xOrY, maybeY);
    }

    private _setPosition(pageNumber: number, x: number, y: number): this {
        this._pageNumber = pageNumber;
        return this.atPosition(Position.atPageCoordinates(pageNumber, x, y));
    }

    addTextLine(textLine: TextLine | TextObjectRef | string): this {
        this._paragraph.addLine(this._coerceTextLine(textLine));
        return this;
    }

    getText(): string | undefined {
        return this._text;
    }

    async add(): Promise<boolean> {
        await this._prepareAsync();
        if (this._targetObjectRef) {
            throw new ValidationException("Target object reference provided; use modify() for updates");
        }
        const paragraph = this._finalizeParagraph();
        return this._internals.addParagraph(paragraph);
    }

    async modify(objectRef?: ObjectRef): Promise<CommandResult> {
        await this._prepareAsync();
        const target = (objectRef as TextObjectRef) ?? this._targetObjectRef;
        if (!target) {
            throw new ValidationException("Object reference must be provided to modify a paragraph");
        }

        if (this.onlyTextChanged()) {
            const result = await this._internals.modifyParagraph(target, this._text ?? '');
            return this._withWarning(result);
        }

        const paragraph = this._finalizeParagraph();
        const result = await this._internals.modifyParagraph(target, paragraph);
        return this._withWarning(result);
    }

    async apply(): Promise<boolean | CommandResult> {
        await this._prepareAsync();
        if (this._targetObjectRef) {
            return this.modify(this._targetObjectRef);
        }
        return this.add();
    }

    private async _prepareAsync(): Promise<void> {
        if (this._pending.length) {
            await Promise.all(this._pending);
            this._pending = [];
        }

        if (this._registeringFont) {
            throw new ValidationException("Font registration is not complete");
        }
    }

    private _withWarning(result: CommandResult): CommandResult {
        if (result && result.warning) {
            process.stderr.write(`WARNING: ${result.warning}\n`);
        }
        return result;
    }

    private _finalizeParagraph(): Paragraph {
        const position = this._paragraph.getPosition();
        if (!position) {
            throw new ValidationException("Paragraph position is null, you need to specify a position for the new paragraph, using .at(x,y)");
        }

        if (!this._targetObjectRef && !this._font && !this._paragraph.font) {
            throw new ValidationException("Font must be set before building paragraph");
        }

        if (this._text !== undefined) {
            this._finalizeLinesFromText();
        } else if (!this._paragraph.textLines || this._paragraph.textLines.length === 0) {
            throw new ValidationException("Either text must be provided or existing lines supplied");
        } else {
            this._finalizeExistingLines();
        }

        this._repositionLines();

        const shouldSkipLines = (
            this._positionChanged &&
            this._text === undefined &&
            this._textColor === undefined &&
            (this._font === undefined || !this._fontExplicitlyChanged) &&
            this._lineSpacingFactor === undefined
        );

        if (shouldSkipLines) {
            this._paragraph.textLines = undefined;
            this._paragraph.setLineSpacings(null);
        }

        let finalFont = this._font ?? this._paragraph.font ?? this._originalFont;
        if (!finalFont) {
            finalFont = new Font(StandardFonts.HELVETICA, DEFAULT_BASE_FONT_SIZE);
        }
        this._paragraph.font = finalFont;

        let finalColor: Color | undefined;
        if (this._textColor) {
            finalColor = cloneColor(this._textColor);
        } else if (this._text !== undefined) {
            finalColor = cloneColor(this._originalColor) ?? defaultTextColor();
        } else {
            finalColor = cloneColor(this._originalColor);
        }
        this._paragraph.color = finalColor;

        return this._paragraph;
    }

    private _finalizeLinesFromText(): void {
        const baseFont = this._font ?? this._originalFont;
        const baseColor = this._textColor ?? cloneColor(this._originalColor) ?? defaultTextColor();

        let spacing: number;
        if (this._lineSpacingFactor !== undefined) {
            spacing = this._lineSpacingFactor;
        } else {
            const existingSpacings = this._paragraph.getLineSpacings();
            if (existingSpacings && existingSpacings.length > 0) {
                spacing = existingSpacings[0];
            } else if (this._paragraph.lineSpacing !== undefined && this._paragraph.lineSpacing !== null) {
                spacing = this._paragraph.lineSpacing;
            } else {
                spacing = DEFAULT_LINE_SPACING_FACTOR;
            }
        }

        this._paragraph.clearLines();
        const lines: TextLine[] = [];

        this._splitText(this._text ?? '').forEach((lineText, index) => {
            const linePosition = this._calculateLinePosition(index, spacing);
            lines.push(new TextLine(linePosition, baseFont, cloneColor(baseColor), spacing, lineText));
        });

        this._paragraph.setLines(lines);
        if (lines.length > 1) {
            this._paragraph.setLineSpacings(Array(lines.length - 1).fill(spacing));
        } else {
            this._paragraph.setLineSpacings(null);
        }
        this._paragraph.lineSpacing = spacing;
    }

    private _finalizeExistingLines(): void {
        const lines = this._paragraph.getLines();
        const spacingOverride = this._lineSpacingFactor;
        let spacingForCalc = spacingOverride;

        if (spacingForCalc === undefined) {
            const existingSpacings = this._paragraph.getLineSpacings();
            if (existingSpacings && existingSpacings.length > 0) {
                spacingForCalc = existingSpacings[0];
            }
        }
        if (spacingForCalc === undefined) {
            spacingForCalc = this._paragraph.lineSpacing ?? DEFAULT_LINE_SPACING_FACTOR;
        }

        const updatedLines: TextLine[] = [];
        lines.forEach((line, index) => {
            if (line instanceof TextLine) {
                if (spacingOverride !== undefined) {
                    line.lineSpacing = spacingOverride;
                }
                if (this._textColor) {
                    line.color = cloneColor(this._textColor);
                }
                if (this._font && this._fontExplicitlyChanged) {
                    line.font = this._font;
                }
                updatedLines.push(line);
            } else {
                const linePosition = this._calculateLinePosition(index, spacingForCalc!);
                updatedLines.push(new TextLine(
                    linePosition,
                    this._font ?? this._originalFont,
                    this._textColor ?? cloneColor(this._originalColor) ?? defaultTextColor(),
                    spacingOverride ?? spacingForCalc!,
                    String(line)
                ));
            }
        });

        this._paragraph.setLines(updatedLines);

        if (spacingOverride !== undefined) {
            if (updatedLines.length > 1) {
                this._paragraph.setLineSpacings(Array(updatedLines.length - 1).fill(spacingOverride));
            } else {
                this._paragraph.setLineSpacings(null);
            }
            this._paragraph.lineSpacing = spacingOverride;
        }
    }

    private _repositionLines(): void {
        if (this._text !== undefined) {
            return;
        }

        const paragraphPos = this._paragraph.getPosition();
        const lines = this._paragraph.textLines;
        if (!paragraphPos || !lines || lines.length === 0) {
            return;
        }

        let basePosition = this._originalParagraphPosition;
        if (!basePosition) {
            for (const line of lines) {
                if (line instanceof TextLine && line.position) {
                    basePosition = line.position;
                    break;
                }
            }
        }

        if (!basePosition) {
            return;
        }

        const targetX = paragraphPos.getX();
        const targetY = paragraphPos.getY();
        const baseX = basePosition.getX();
        const baseY = basePosition.getY();

        if (targetX === undefined || targetY === undefined || baseX === undefined || baseY === undefined) {
            return;
        }

        const dx = targetX - baseX;
        const dy = targetY - baseY;
        if (dx === 0 && dy === 0) {
            return;
        }

        lines.forEach(line => {
            if (line instanceof TextLine && line.position) {
                const currentX = line.position.getX();
                const currentY = line.position.getY();
                if (currentX === undefined || currentY === undefined) {
                    return;
                }
                const updatedPosition = line.position.copy();
                updatedPosition.atCoordinates({x: currentX + dx, y: currentY + dy});
                line.setPosition(updatedPosition);
            }
        });
    }

    private _coerceTextLine(source: TextLine | TextObjectRef | string): TextLine {
        if (source instanceof TextLine) {
            return source;
        }

        if (source instanceof TextObjectRef) {
            let font: Font | undefined;
            if (source.fontName && source.fontSize) {
                font = new Font(source.fontName, source.fontSize);
            } else if (source.children) {
                for (const child of source.children) {
                    if (child.fontName && child.fontSize) {
                        font = new Font(child.fontName, child.fontSize);
                        break;
                    }
                }
            }
            if (!font) {
                font = this._originalFont;
            }

            let spacing = this._lineSpacingFactor;
            if (spacing === undefined && source.lineSpacings && source.lineSpacings.length > 0) {
                spacing = source.lineSpacings[0];
            }
            if (spacing === undefined) {
                spacing = this._paragraph.lineSpacing ?? DEFAULT_LINE_SPACING_FACTOR;
            }

            const color = source.color ?? this._originalColor;

            if (!this._originalFont && font) {
                this._originalFont = font;
            }
            if (!this._originalColor && color) {
                this._originalColor = color;
            }

            return new TextLine(
                clonePosition(source.position),
                font,
                cloneColor(color),
                spacing,
                source.text ?? ''
            );
        }

        const currentIndex = this._paragraph.getLines().length;
        const spacing = this._lineSpacingFactor ?? this._paragraph.lineSpacing ?? DEFAULT_LINE_SPACING_FACTOR;
        const linePosition = this._calculateLinePosition(currentIndex, spacing);

        return new TextLine(
            linePosition,
            this._font ?? this._originalFont,
            this._textColor ?? cloneColor(this._originalColor) ?? defaultTextColor(),
            spacing,
            source
        );
    }

    private _splitText(text: string): string[] {
        const processed = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\\n/g, '\n');
        const parts = processed.split('\n');
        while (parts.length > 0 && parts[parts.length - 1] === '') {
            parts.pop();
        }
        if (parts.length === 0) {
            parts.push('');
        }
        return parts;
    }

    private _calculateLinePosition(lineIndex: number, spacingFactor: number): Position | undefined {
        const paragraphPosition = this._paragraph.getPosition();
        if (!paragraphPosition) {
            return undefined;
        }

        const pageNumber = paragraphPosition.pageNumber;
        const baseX = paragraphPosition.getX();
        const baseY = paragraphPosition.getY();
        if (pageNumber === undefined || baseX === undefined || baseY === undefined) {
            return undefined;
        }

        const offset = lineIndex * this._calculateBaselineDistance(spacingFactor);
        return Position.atPageCoordinates(pageNumber, baseX, baseY + offset);
    }

    private _calculateBaselineDistance(spacingFactor: number): number {
        const factor = spacingFactor > 0 ? spacingFactor : DEFAULT_LINE_SPACING_FACTOR;
        return this._baselineFontSize() * factor;
    }

    private _baselineFontSize(): number {
        if (this._font?.size) {
            return this._font.size;
        }
        if (this._originalFont?.size) {
            return this._originalFont.size;
        }
        return DEFAULT_BASE_FONT_SIZE;
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
