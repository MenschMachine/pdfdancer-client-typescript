/**
 * PDF Assertions helper for e2e tests
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import {Color, Orientation, PDFDancer} from '../../index';
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
        console.log(`PDF file saved to ${tempFile}`);
        const pdf = await PDFDancer.open(new Uint8Array(pdfData), token, baseUrl);

        return new PDFAssertions(pdf);
    }

    private async aggregateCounts(pageIndex?: number) {
        const [paragraphs, textLines, images, paths, forms, fields] = await Promise.all([
            this.pdf.selectParagraphs(),
            this.pdf.selectLines(),
            this.pdf.selectImages(),
            this.pdf.selectPaths(),
            this.pdf.selectForms(),
            this.pdf.selectFormFields()
        ]);

        const filter = <T extends { position: { pageIndex?: number } }>(items: T[]): T[] => {
            if (pageIndex === undefined) {
                return items;
            }
            return items.filter(item => item.position.pageIndex === pageIndex);
        };

        return {
            paragraphs: filter(paragraphs).length,
            textLines: filter(textLines).length,
            images: filter(images).length,
            paths: filter(paths).length,
            forms: filter(forms).length,
            fields: filter(fields).length
        };
    }

    async assertTotalNumberOfElements(expected: number, pageIndex?: number): Promise<this> {
        const totals = await this.aggregateCounts(pageIndex);
        const actual = Object.values(totals).reduce((acc, count) => acc + count, 0);
        expect(actual).toBe(expected);
        return this;
    }

    async assertNumberOfPages(expected: number): Promise<this> {
        const pages = await this.pdf.pages();
        expect(pages.length).toBe(expected);
        return this;
    }

    async assertPageCount(expected: number): Promise<this> {
        const pages = await this.pdf.pages();
        expect(pages.length).toBe(expected);
        return this;
    }

    async assertPageDimension(width: number, height: number, orientation?: Orientation, pageIndex = 0): Promise<this> {
        const pages = await this.pdf.pages();
        expect(pageIndex).toBeLessThan(pages.length);
        const page = pages[pageIndex];
        expect(page.pageSize?.width).toBeCloseTo(width, 6);
        expect(page.pageSize?.height).toBeCloseTo(height, 6);
        if (orientation) {
            expect(page.orientation).toBe(orientation);
        }
        return this;
    }

    async assertParagraphIsAt(text: string, x: number, y: number, page = 0, epsilon = 3): Promise<this> {
        const paragraphs = await this.pdf.page(page).selectParagraphsMatching(`.*${text}.*`);
        expect(paragraphs.length).toBeGreaterThan(0);
        const reference = paragraphs[0].objectRef();
        expectWithin(reference.position.getX()!, x, epsilon);
        expectWithin(reference.position.getY()!, y, epsilon);

        const byPosition = await this.pdf.page(page).selectParagraphsAt(x, y, epsilon);
        expect(byPosition.length).toBeGreaterThan(0);
        return this;
    }

    async assertTextHasFont(text: string, fontName: string, fontSize: number, page = 0): Promise<this> {
        await this.assertTextlineHasFont(text, fontName, fontSize, page);

        const paragraphs = await this.pdf.page(page).selectParagraphsMatching(`.*${text}.*`);
        expect(paragraphs.length).toBeGreaterThan(0);
        const reference = paragraphs[0].objectRef();
        expect(reference.fontName).toBe(fontName);
        expectWithin(reference.fontSize!, fontSize, 1e-6);
        return this;
    }

    async assertTextHasFontMatching(text: string, fontName: string, fontSize: number, page = 0): Promise<this> {
        await this.assertTextlineHasFontMatching(text, fontName, fontSize, page);
        return this;
    }

    async assertTextHasColor(text: string, color: Color, page = 0): Promise<this> {
        await this.assertTextlineHasColor(text, color, page);
        return this;
    }

    async assertTextlineHasColor(text: string, color: Color, page = 0): Promise<this> {
        const lines = await this.pdf.page(page).selectTextLinesMatching(text);
        expect(lines.length).toBe(1);
        const reference = lines[0].objectRef();
        const refColor = reference.color;
        expect(refColor).toEqual(color);
        expect(reference.text).toContain(text);
        return this;
    }

    async assertTextlineHasFont(text: string, fontName: string, fontSize: number, page = 0): Promise<this> {
        const lines = await this.pdf.page(page).selectTextLinesStartingWith(text);
        expect(lines.length).toBe(1);
        const reference = lines[0].objectRef();
        expect(reference.fontName).toBe(fontName);
        expectWithin(reference.fontSize!, fontSize, 1e-6);
        return this;
    }

    async assertTextlineHasFontMatching(text: string, fontName: string, fontSize: number, page = 0): Promise<this> {
        const lines = await this.pdf.page(page).selectTextLinesStartingWith(text);
        expect(lines.length).toBe(1);
        const reference = lines[0].objectRef();
        expect((reference.fontName ?? '').includes(fontName)).toBe(true);
        expectWithin(reference.fontSize!, fontSize, 1e-6);
        return this;
    }

    async assertTextlineIsAt(text: string, x: number, y: number, page = 0, epsilon = 1e-4): Promise<this> {
        const lines = await this.pdf.page(page).selectTextLinesStartingWith(text);
        expect(lines.length).toBe(1);
        const reference = lines[0].objectRef();
        expectWithin(reference.position.getX()!, x, epsilon);
        expectWithin(reference.position.getY()!, y, epsilon);
        const byPosition = await this.pdf.page(page).selectTextLinesAt(x, y, epsilon);
        expect(byPosition.length).toBeGreaterThan(0);
        return this;
    }

    async assertPathIsAt(internalId: string, x: number, y: number, page = 0, epsilon = 1e-4): Promise<this> {
        const paths = await this.pdf.page(page).selectPathsAt(x, y);
        expect(paths.length).toBe(1);
        const reference = paths[0];
        expect(reference.internalId).toBe(internalId);
        expectWithin(reference.position.getX()!, x, epsilon);
        expectWithin(reference.position.getY()!, y, epsilon);
        return this;
    }

    async assertNoPathAt(x: number, y: number, page = 0): Promise<this> {
        const paths = await this.pdf.page(page).selectPathsAt(x, y);
        expect(paths.length).toBe(0);
        return this;
    }

    async assertNumberOfPaths(expected: number, page?: number): Promise<this> {
        const paths = page === undefined ? await this.pdf.selectPaths() : await this.pdf.page(page).selectPaths();
        expect(paths.length).toBe(expected);
        return this;
    }

    async assertNumberOfImages(expected: number, page?: number): Promise<this> {
        const images = page === undefined ? await this.pdf.selectImages() : await this.pdf.page(page).selectImages();
        expect(images.length).toBe(expected);
        return this;
    }

    async assertImageAt(x: number, y: number, page = 0): Promise<this> {
        const images = await this.pdf.page(page).selectImagesAt(x, y, 0.1);
        expect(images.length).toBe(1);
        return this;
    }

    async assertNoImageAt(x: number, y: number, page = 0): Promise<this> {
        const images = await this.pdf.page(page).selectImagesAt(x, y);
        expect(images.length).toBe(0);
        return this;
    }

    async assertImageWithIdAt(internalId: string, x: number, y: number, page = 0): Promise<this> {
        const images = await this.pdf.page(page).selectImagesAt(x, y);
        expect(images.length).toBe(1);
        expect(images[0].internalId).toBe(internalId);
        return this;
    }

    async assertNumberOfFormXObjects(expected: number, page?: number): Promise<this> {
        const forms = page === undefined ? await this.pdf.selectForms() : await this.pdf.page(page).selectForms();
        expect(forms.length).toBe(expected);
        return this;
    }

    async assertNumberOfFormFields(expected: number, page?: number): Promise<this> {
        const fields = page === undefined ? await this.pdf.selectFormFields() : await this.pdf.page(page).selectFormFields();
        expect(fields.length).toBe(expected);
        return this;
    }

    async assertParagraphExists(text: string, page = 0): Promise<this> {
        const paragraphs = await this.pdf.page(page).selectParagraphsStartingWith(text);
        expect(paragraphs.length).toBeGreaterThan(0);
        return this;
    }

    async assertParagraphDoesNotExist(text: string, page = 0): Promise<this> {
        const paragraphs = await this.pdf.page(page).selectParagraphsStartingWith(text);
        expect(paragraphs.length).toBe(0);
        return this;
    }

    async assertTextlineExists(text: string, page = 0): Promise<this> {
        const lines = await this.pdf.page(page).selectTextLinesStartingWith(text);
        expect(lines.length).toBeGreaterThan(0);
        return this;
    }

    async assertTextlineDoesNotExist(text: string, page = 0): Promise<this> {
        const lines = await this.pdf.page(page).selectTextLinesStartingWith(text);
        expect(lines.length).toBe(0);
        return this;
    }
}
