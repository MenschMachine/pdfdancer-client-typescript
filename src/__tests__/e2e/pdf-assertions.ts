/**
 * PDF Assertions helper for e2e tests
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {Color, PDFDancer} from '../../index';
import {expectWithin} from '../assertions';

export class PDFAssertions {
    private pdf: PDFDancer;

    private constructor(pdf: PDFDancer) {
        this.pdf = pdf;
    }

    static async create(sourcePdf: PDFDancer): Promise<PDFAssertions> {
        // Save and reload the PDF to ensure all changes are persisted
        // This matches the Python implementation
        const token = (sourcePdf as any)._token;
        const baseUrl = (sourcePdf as any)._baseUrl;

        // Create a temporary file
        const tempFile = path.join(os.tmpdir(), `test-${Date.now()}.pdf`);
        await sourcePdf.save(tempFile);

        // Reopen the PDF with the same token and baseUrl
        const pdfData = fs.readFileSync(tempFile);
        const pdf = await PDFDancer.open(new Uint8Array(pdfData), token, baseUrl);

        return new PDFAssertions(pdf);
    }

    async assertTextHasColor(text: string, color: Color, page: number = 0): Promise<this> {
        await this.assertTextlineHasColor(text, color, page);

        const paragraphs = await this.pdf.page(page).selectParagraphsMatching(text);
        expect(paragraphs).toHaveLength(1);

        const reference = (paragraphs[0] as any).ref();
        expect(reference.text).toContain(text);
        // Compare RGB values, alpha channel may differ
        expect(reference.color.r).toBe(color.r);
        expect(reference.color.g).toBe(color.g);
        expect(reference.color.b).toBe(color.b);

        return this;
    }

    async assertTextHasFont(text: string, fontName: string, fontSize: number, page: number = 0): Promise<this> {
        await this.assertTextlineHasFont(text, fontName, fontSize, page);

        const paragraphs = await this.pdf.page(page).selectParagraphsMatching(`.*${text}.*`);
        expect(paragraphs).toHaveLength(1);

        const reference = (paragraphs[0] as any).ref();
        expect(reference.fontName).toBe(fontName);
        expect(reference.fontSize).toBe(fontSize);

        return this;
    }

    async assertParagraphIsAt(text: string, x: number, y: number, page: number = 0, epsilon: number = 0.0001): Promise<this> {
        const paragraphs = await this.pdf.page(page).selectParagraphsMatching(`.*${text}.*`);
        expect(paragraphs.length).toBe(1);

        const reference = (paragraphs[0] as any).ref();
        const posX = reference.position.getX();
        const posY = reference.position.getY();

        expectWithin(posX, x, epsilon);
        expectWithin(posY, y, epsilon);

        const paragraphByPosition = await this.pdf.page(page).selectParagraphsAt(x, y);
        expect(paragraphByPosition.length).toBeGreaterThan(0);
        expect(paragraphs[0].internalId).toBe(paragraphByPosition[0].internalId);

        return this;
    }

    async assertTextHasFontMatching(text: string, fontName: string, fontSize: number, page: number = 0): Promise<this> {
        await this.assertTextlineHasFontMatching(text, fontName, fontSize, page);

        const paragraphs = await this.pdf.page(page).selectParagraphsMatching(`.*${text}.*`);
        expect(paragraphs).toHaveLength(1);

        const reference = (paragraphs[0] as any).ref();
        expect(reference.fontName).toContain(fontName);
        expect(reference.fontSize).toBe(fontSize);

        return this;
    }

    async assertTextlineHasColor(text: string, color: Color, page: number = 0): Promise<this> {
        const lines = await this.pdf.page(page).selectTextLinesMatching(text);
        expect(lines.length).toBe(1);

        const reference = (lines[0] as any).ref();

        // Compare RGB values, alpha channel may differ
        expect(reference.color.r).toBe(color.r);
        expect(reference.color.g).toBe(color.g);
        expect(reference.color.b).toBe(color.b);

        expect(reference.text).toContain(text);

        return this;
    }

    async assertTextlineHasFont(text: string, fontName: string, fontSize: number, page: number = 0): Promise<this> {
        const lines = await this.pdf.page(page).selectTextLinesStartingWith(text);
        expect(lines.length).toBe(1);

        const reference = (lines[0] as any).ref();
        expect(reference.fontName).toBe(fontName);
        expect(reference.fontSize).toBe(fontSize);

        return this;
    }

    async assertTextlineHasFontMatching(text: string, fontName: string, fontSize: number, page: number = 0): Promise<this> {
        const lines = await this.pdf.page(page).selectTextLinesStartingWith(text);
        expect(lines.length).toBe(1);

        const reference = (lines[0] as any).ref();
        expect(reference.fontName).toContain(fontName);
        expect(reference.fontSize).toBe(fontSize);

        return this;
    }

    async assertTextlineIsAt(text: string, x: number, y: number, page: number = 0, epsilon: number = 0.0001): Promise<this> {
        const lines = await this.pdf.page(page).selectTextLinesStartingWith(text);
        expect(lines.length).toBe(1);

        const reference = (lines[0] as any).ref();
        const posX = reference.position.getX();
        const posY = reference.position.getY();

        expectWithin(posX, x, epsilon);
        expectWithin(posY, y, epsilon);

        const byPosition = await this.pdf.page(page).selectTextLinesAt(x, y);
        expect(byPosition.length).toBeGreaterThan(0);
        expect(lines[0].internalId).toBe(byPosition[0].internalId);

        return this;
    }
}
