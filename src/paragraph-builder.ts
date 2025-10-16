/**
 * ParagraphBuilder for the PDFDancer TypeScript client.
 */

import {ValidationException} from './exceptions';
import {Color, Font, ObjectRef, Paragraph, Position} from './models';
import {PDFDancer} from "./pdfdancer_v1";

/**
 * Builder class for constructing Paragraph objects with fluent interface.
 */
export class ParagraphBuilder {
    private _paragraph: Paragraph;
    private _lineSpacing: number = 1.2;
    private _textColor: Color = new Color(0, 0, 0); // Black by default
    private _text?: string;
    private _font?: Font;
    private _pending: Promise<unknown>[] = [];
    private _registeringFont: boolean = false;
    private _pageIndex: number;

    constructor(private _client: PDFDancer, private objectRefOrPageIndex?: ObjectRef | number) {
        if (!_client) {
            throw new ValidationException("Client cannot be null");
        }

        this._pageIndex = objectRefOrPageIndex instanceof ObjectRef ? objectRefOrPageIndex.position.pageIndex! : objectRefOrPageIndex!;
        this._paragraph = new Paragraph();
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
    fontFile(ttfFile: Uint8Array | File, fontSize: number): this {
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

        this._paragraph.setPosition(Position.atPageCoordinates(this._pageIndex, x, y));
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
        this._paragraph.color = this._textColor;
        this._paragraph.lineSpacing = this._lineSpacing;

        // Process text into lines
        this._paragraph.textLines = this._processTextLines(this._text);

        return this._paragraph;
    }

    /**
     * Register a TTF font with the client and return a Font object.
     */
    private async _registerTtf(ttfFile: Uint8Array | File, fontSize: number): Promise<Font> {
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

    async apply() {
        if (!this._text) {
            throw new ValidationException("Text must be set before building paragraph");
        }
        // Wait for all deferred operations (e.g., fontFile, images, etc.)
        if (this._pending.length) {
            await Promise.all(this._pending);
            this._pending = []; // reset if builder is reusable
        }

        if (this._registeringFont && !this._font) {
            throw new ValidationException("Font registration is not complete");
        }

        let paragraph = this.build();
        if (this.objectRefOrPageIndex instanceof ObjectRef) {
            if (!this._font || !this._textColor) {
                return await this._client.modifyParagraph(this.objectRefOrPageIndex, this._text);
            } else {
                return await this._client.modifyParagraph(this.objectRefOrPageIndex, paragraph);
            }
        } else {
            return await this._client.addParagraph(paragraph);
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
