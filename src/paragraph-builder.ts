/**
 * ParagraphBuilder for the PDFDancer TypeScript client.
 */

import {ValidationException} from './exceptions';
import {Color, CommandResult, Font, ObjectRef, Paragraph, Position, TextObjectRef} from './models';
import {PDFDancer} from "./pdfdancer_v1";

// 👇 Internal view of PDFDancer methods, not exported
interface PDFDancerInternals {
    modifyParagraph(objectRefOrPageIndex: ObjectRef, text: string | Paragraph): Promise<CommandResult>;

    addParagraph(paragraph: Paragraph): Promise<boolean>;
}

/**
 * Builder class for constructing Paragraph objects with fluent interface.
 */
export class ParagraphBuilder {
    private _paragraph: Paragraph;
    private _lineSpacing?: number; // undefined initially, like Python's None
    private _textColor?: Color;
    private _text?: string;
    private _font?: Font;
    private _position?: Position; // Track if position was explicitly set
    private _pending: Promise<unknown>[] = [];
    private _registeringFont: boolean = false;
    private _pageIndex: number;
    private _internals: PDFDancerInternals;

    constructor(private _client: PDFDancer, private objectRefOrPageIndex?: TextObjectRef | number) {
        if (!_client) {
            throw new ValidationException("Client cannot be null");
        }

        this._pageIndex = objectRefOrPageIndex instanceof ObjectRef ? objectRefOrPageIndex.position.pageIndex! : objectRefOrPageIndex!;
        this._paragraph = new Paragraph();

        // Cast to the internal interface to get access
        this._internals = this._client as unknown as PDFDancerInternals;
    }

    /**
     * Set the text content for the paragraph.
     */
    replace(text: string, color?: Color): ParagraphBuilder {
        if (text === null || text === undefined) {
            throw new ValidationException("Text cannot be null");
        }
        if (!text.trim()) {
            throw new ValidationException("Text cannot be empty");
        }

        this._text = text;
        if (color) {
            this._textColor = color;
        }

        return this;
    }

    /**
     * Set the font for the paragraph using an existing Font object.
     */
    font(font: Font): ParagraphBuilder;
    font(fontName: string, fontSize: number): ParagraphBuilder;
    font(fontOrName: Font | string, fontSize?: number): ParagraphBuilder {
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

        return this;
    }

    /**
     * Set the font for the paragraph using a TTF file.
     */
    fontFile(ttfFile: Uint8Array | File | string, fontSize: number): this {
        if (!ttfFile) throw new ValidationException("TTF file cannot be null");
        if (fontSize <= 0) {
            throw new ValidationException(`Font size must be positive, got ${fontSize}`);
        }

        this._registeringFont = true;
        const job = this._registerTtf(ttfFile, fontSize).then(font => {
            this._font = font;
        });

        this._pending.push(job);
        return this;
    }

    /**
     * Set the line spacing for the paragraph.
     */
    lineSpacing(spacing: number): ParagraphBuilder {
        if (spacing <= 0) {
            throw new ValidationException(`Line spacing must be positive, got ${spacing}`);
        }

        this._lineSpacing = spacing;
        return this;
    }

    /**
     * Set the text color for the paragraph.
     */
    color(color: Color): ParagraphBuilder {
        if (!color) {
            throw new ValidationException("Color cannot be null");
        }

        this._textColor = color;
        return this;
    }

    /**
     * Set the position for the paragraph.
     */
    moveTo(x: number, y: number): ParagraphBuilder {
        if (x === null || x === undefined || y === null || y === undefined) {
            throw new ValidationException("Coordinates cannot be null or undefined");
        }

        this._position = Position.atPageCoordinates(this._pageIndex, x, y);
        this._paragraph.setPosition(this._position);
        return this;
    }

    /**
     * Build and return the final Paragraph object.
     */
    private build(): Paragraph {
        // Validate required fields
        if (!this._text) {
            throw new ValidationException("Text must be set before building paragraph");
        }
        // Set paragraph properties
        this._paragraph.font = this._font;
        this._paragraph.color = this._textColor ?? new Color(0, 0, 0);
        this._paragraph.lineSpacing = this._lineSpacing ?? 1.2; // Default 1.2 like Python

        // Process text into lines
        this._paragraph.textLines = this._processTextLines(this._text);

        return this._paragraph;
    }

    // Python-style getter methods that preserve original values if not explicitly set
    private _getLineSpacing(originalRef: TextObjectRef): number {
        if (this._lineSpacing !== undefined) {
            return this._lineSpacing;
        } else if (originalRef.lineSpacings && originalRef.lineSpacings.length > 0) {
            // Calculate average like Python does
            const sum = originalRef.lineSpacings.reduce((a, b) => a + b, 0);
            return sum / originalRef.lineSpacings.length;
        } else {
            return 1.2; // DEFAULT_LINE_SPACING
        }
    }

    private _getFont(originalRef: TextObjectRef): Font {
        if (this._font) {
            return this._font;
        } else if (originalRef.fontName && originalRef.fontSize) {
            return new Font(originalRef.fontName, originalRef.fontSize);
        } else {
            throw new ValidationException("Font is required");
        }
    }

    private _getColor(originalRef: TextObjectRef): Color {
        if (this._textColor) {
            return this._textColor;
        } else if (originalRef.color) {
            return originalRef.color;
        } else {
            return new Color(0, 0, 0); // DEFAULT_COLOR
        }
    }

    /**
     * Register a TTF font with the client and return a Font object.
     */
    private async _registerTtf(ttfFile: Uint8Array | File | string, fontSize: number): Promise<Font> {
        try {
            const fontName = await this._client.registerFont(ttfFile);
            return new Font(fontName, fontSize);
        } catch (error) {
            throw new ValidationException(`Failed to register font file: ${error}`);
        }
    }

    /**
     * Process text into lines for the paragraph.
     * This is a simplified version - the full implementation would handle
     * word wrapping, line breaks, and other text formatting based on the font
     * and paragraph width.
     */
    private _processTextLines(text: string): string[] {
        // Handle escaped newlines (\\n) as actual newlines
        const processedText = text.replace(/\\\\n/g, '\n');

        // Simple implementation - split on newlines
        // In the full version, this would implement proper text layout
        let lines = processedText.split('\n');

        // Remove empty lines at the end but preserve intentional line breaks
        while (lines.length > 0 && !lines[lines.length - 1].trim()) {
            lines.pop();
        }

        // Ensure at least one line
        if (lines.length === 0) {
            lines = [''];
        }

        return lines;
    }

    async apply(): Promise<boolean | CommandResult> {
        // Wait for all deferred operations (e.g., fontFile, images, etc.)
        if (this._pending.length) {
            await Promise.all(this._pending);
            this._pending = []; // reset if builder is reusable
        }

        if (this._registeringFont && !this._font) {
            throw new ValidationException("Font registration is not complete");
        }

        if (this.objectRefOrPageIndex instanceof TextObjectRef) {
            // Modifying existing paragraph - match Python's ParagraphEdit.apply() logic
            const originalRef = this.objectRefOrPageIndex;

            // Python logic: if ONLY text is being changed (all other properties are None), use simple text modification
            if (this._position === undefined &&
                this._lineSpacing === undefined &&
                this._font === undefined &&
                this._textColor === undefined) {
                // Simple text-only modification
                const result = await this._internals.modifyParagraph(originalRef, this._text!);
                if (result.warning) {
                    process.stderr.write(`WARNING: ${result.warning}\n`);
                }
                return result;
            } else {
                // Full paragraph modification - build new paragraph using getter methods to preserve original values
                const newParagraph = new Paragraph();
                newParagraph.position = this._position ?? originalRef.position;
                newParagraph.lineSpacing = this._getLineSpacing(originalRef);
                newParagraph.font = this._getFont(originalRef);
                newParagraph.textLines = this._text ? this._processTextLines(this._text) : this._processTextLines(originalRef.text!);
                newParagraph.color = this._getColor(originalRef);

                const result = await this._internals.modifyParagraph(originalRef, newParagraph);
                if (result.warning) {
                    process.stderr.write(`WARNING: ${result.warning}\n`);
                }
                return result;
            }
        } else {
            // Adding new paragraph
            let paragraph = this.build();
            return await this._internals.addParagraph(paragraph);
        }
    }

    text(text: string) {
        this._text = text;
        return this;
    }

    at(x: number, y: number) {
        return this.moveTo(x, y);
    }

}
