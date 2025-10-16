/**
 * ParagraphBuilder for the PDFDancer TypeScript client.
 */

import { ValidationException } from './exceptions';
import { Paragraph, Font, Color, Position } from './models';
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

  constructor(private _client: PDFDancer) {
    if (!_client) {
      throw new ValidationException("Client cannot be null");
    }

    this._paragraph = new Paragraph();
  }

  /**
   * Set the text content for the paragraph.
   */
  fromString(text: string, color?: Color): ParagraphBuilder {
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
  withFont(font: Font): ParagraphBuilder {
    if (!font) {
      throw new ValidationException("Font cannot be null");
    }

    this._font = font;
    return this;
  }

  /**
   * Set the font for the paragraph using a TTF file.
   */
  async withFontFile(ttfFile: Uint8Array | File, fontSize: number): Promise<ParagraphBuilder> {
    if (!ttfFile) {
      throw new ValidationException("TTF file cannot be null");
    }
    if (fontSize <= 0) {
      throw new ValidationException(`Font size must be positive, got ${fontSize}`);
    }

    // Register font and open Font object
    this._font = await this._registerTtf(ttfFile, fontSize);
    return this;
  }

  /**
   * Set the line spacing for the paragraph.
   */
  withLineSpacing(spacing: number): ParagraphBuilder {
    if (spacing <= 0) {
      throw new ValidationException(`Line spacing must be positive, got ${spacing}`);
    }

    this._lineSpacing = spacing;
    return this;
  }

  /**
   * Set the text color for the paragraph.
   */
  withColor(color: Color): ParagraphBuilder {
    if (!color) {
      throw new ValidationException("Color cannot be null");
    }

    this._textColor = color;
    return this;
  }

  /**
   * Set the position for the paragraph.
   */
  withPosition(position: Position): ParagraphBuilder {
    if (!position) {
      throw new ValidationException("Position cannot be null");
    }

    this._paragraph.setPosition(position);
    return this;
  }

  /**
   * Build and return the final Paragraph object.
   */
  build(): Paragraph {
    // Validate required fields
    if (!this._text) {
      throw new ValidationException("Text must be set before building paragraph");
    }
    if (!this._font) {
      throw new ValidationException("Font must be set before building paragraph");
    }
    if (!this._paragraph.getPosition()) {
      throw new ValidationException("Position must be set before building paragraph");
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
}
