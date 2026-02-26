/**
 * ReplacementBuilder for fluent template replacement API.
 */

import * as fs from 'fs';
import * as path from 'path';
import { Color, Font, Image, ReflowPreset, TemplateReplacement, TemplateReplaceRequest } from './models';
import { PDFDancer } from './pdfdancer_v1';

interface PDFDancerInternals {
    applyReplacements(request: TemplateReplaceRequest): Promise<boolean>;
}

/**
 * Fluent builder for template replacements.
 *
 * @example
 * // Simple replacement
 * await pdf.replace('{{name}}', 'John Doe').apply();
 *
 * // With formatting
 * await pdf.replace('{{name}}', 'John Doe')
 *     .font('Helvetica', 14)
 *     .color(new Color(255, 0, 0))
 *     .apply();
 *
 * // Batch replacements
 * await pdf.replace('{{name}}', 'John')
 *     .and('{{date}}', '2024-01-15')
 *     .apply();
 *
 * // Replace with image
 * await pdf.replace()
 *     .replaceWithImage('{{logo}}', 'logo.png')
 *     .apply();
 */
export class ReplacementBuilder {
    private _replacements: TemplateReplacement[] = [];
    private _pageIndex?: number;
    private _reflowPreset?: ReflowPreset;

    private _currentPlaceholder?: string;
    private _currentText?: string;
    private _currentFont?: Font;
    private _currentColor?: Color;
    private _currentImage?: Image;

    private readonly _internals: PDFDancerInternals;

    constructor(private readonly _client: PDFDancer) {
        this._internals = this._client as unknown as PDFDancerInternals;
    }

    /**
     * Start a replacement chain.
     */
    replace(placeholder: string, text: string): this {
        this._flushCurrent();
        this._currentPlaceholder = placeholder;
        this._currentText = text;
        return this;
    }

    /**
     * Replace a placeholder with an image.
     * Accepts a file path (string) or raw image data (Uint8Array).
     * Optionally specify width and height.
     */
    replaceWithImage(placeholder: string, imagePathOrData: string | Uint8Array, width?: number, height?: number): this {
        this._flushCurrent();
        this._currentPlaceholder = placeholder;

        let imageData: Uint8Array;
        let format: string | undefined;

        if (typeof imagePathOrData === 'string') {
            imageData = new Uint8Array(fs.readFileSync(imagePathOrData));
            const ext = path.extname(imagePathOrData).toLowerCase().replace('.', '');
            format = ext === 'jpg' ? 'jpeg' : ext;
        } else {
            imageData = imagePathOrData;
        }

        this._currentImage = new Image(undefined, format, width, height, imageData);
        return this;
    }

    /**
     * Set font for current replacement.
     */
    font(font: Font): this;
    font(fontName: string, fontSize: number): this;
    font(fontOrName: Font | string, fontSize?: number): this {
        if (fontOrName instanceof Font) {
            this._currentFont = fontOrName;
        } else {
            this._currentFont = new Font(fontOrName, fontSize!);
        }
        return this;
    }

    /**
     * Set color for current replacement.
     */
    color(color: Color): this {
        this._currentColor = color;
        return this;
    }

    /**
     * Add another text replacement.
     */
    and(placeholder: string, text: string): this {
        return this.replace(placeholder, text);
    }

    /**
     * Add another image replacement.
     */
    andImage(placeholder: string, imagePathOrData: string | Uint8Array, width?: number, height?: number): this {
        return this.replaceWithImage(placeholder, imagePathOrData, width, height);
    }

    /**
     * Limit replacements to a specific page (1-based).
     */
    onPage(pageNumber: number): this {
        this._pageIndex = pageNumber - 1;
        return this;
    }

    /**
     * Set reflow preset.
     */
    reflow(preset: ReflowPreset): this {
        this._reflowPreset = preset;
        return this;
    }

    /**
     * Use BEST_EFFORT reflow preset.
     */
    bestEffort(): this {
        return this.reflow(ReflowPreset.BEST_EFFORT);
    }

    /**
     * Use FIT_OR_FAIL reflow preset.
     */
    fitOrFail(): this {
        return this.reflow(ReflowPreset.FIT_OR_FAIL);
    }

    /**
     * Use NONE reflow preset.
     */
    noReflow(): this {
        return this.reflow(ReflowPreset.NONE);
    }

    /**
     * Execute the replacements.
     */
    async apply(): Promise<boolean> {
        this._flushCurrent();

        if (this._replacements.length === 0) {
            return true;
        }

        const request = new TemplateReplaceRequest(
            this._replacements,
            this._pageIndex,
            this._reflowPreset
        );

        return this._internals.applyReplacements(request);
    }

    private _flushCurrent(): void {
        if (this._currentPlaceholder !== undefined && (this._currentText !== undefined || this._currentImage !== undefined)) {
            this._replacements.push(new TemplateReplacement(
                this._currentPlaceholder,
                this._currentText,
                this._currentFont,
                this._currentColor,
                this._currentImage
            ));
            this._currentPlaceholder = undefined;
            this._currentText = undefined;
            this._currentFont = undefined;
            this._currentColor = undefined;
            this._currentImage = undefined;
        }
    }
}
