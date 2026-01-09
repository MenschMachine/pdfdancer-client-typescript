/**
 * ReplacementBuilder for fluent template replacement API.
 */

import { Color, Font, ReflowPreset, TemplateReplacement, TemplateReplaceRequest } from './models';
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
 */
export class ReplacementBuilder {
    private _replacements: TemplateReplacement[] = [];
    private _pageIndex?: number;
    private _reflowPreset?: ReflowPreset;

    private _currentPlaceholder?: string;
    private _currentText?: string;
    private _currentFont?: Font;
    private _currentColor?: Color;

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
     * Add another replacement.
     */
    and(placeholder: string, text: string): this {
        return this.replace(placeholder, text);
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
        if (this._currentPlaceholder !== undefined && this._currentText !== undefined) {
            this._replacements.push(new TemplateReplacement(
                this._currentPlaceholder,
                this._currentText,
                this._currentFont,
                this._currentColor
            ));
            this._currentPlaceholder = undefined;
            this._currentText = undefined;
            this._currentFont = undefined;
            this._currentColor = undefined;
        }
    }
}
