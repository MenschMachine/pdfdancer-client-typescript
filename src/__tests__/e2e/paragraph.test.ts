/**
 * E2E tests for paragraph operations — new PDFDancer API
 */

import {Color, PDFDancer} from '../../index';
import {readFontFixture, requireEnvAndFixture} from './test-helpers';
import {expectWithin} from '../assertions';

describe('Paragraph E2E Tests (v2 API)', () => {

    test('find paragraphs by position', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const paras = await pdf.selectParagraphs();
        expect(paras).toHaveLength(172);

        const parasPage0 = await pdf.page(0).selectParagraphs();
        expect(parasPage0).toHaveLength(2);

        const first = parasPage0[0];
        expect(first.internalId).toBe('PARAGRAPH_000003');
        expect(first.position).toBeDefined();
        expectWithin(first.position.boundingRect?.x, 326, 1);
        expectWithin(first.position.boundingRect?.y, 706, 1);

        const last = parasPage0[parasPage0.length - 1];
        expect(last.internalId).toBe('PARAGRAPH_000004');
        expect(last.position).toBeDefined();
        expectWithin(last.position.boundingRect?.x, 54, 1);
        expectWithin(last.position.boundingRect?.y, 496, 2);
    });

    test('find paragraphs by text', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const paras = await pdf.page(0).selectParagraphsStartingWith('The Complete');
        expect(paras).toHaveLength(1);

        const p = paras[0];
        expect(p.internalId).toBe('PARAGRAPH_000004');
        expect(p.position).toBeDefined();
        expectWithin(p.position.boundingRect?.x, 54, 1);
        expectWithin(p.position.boundingRect?.y, 496, 2);
    });

    test('find paragraphs by pattern', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const paras = await pdf.page(0).selectParagraphsMatching('.*Complete.*');
        expect(paras).toHaveLength(1);
        const p = paras[0];
        expect(p.internalId).toBe('PARAGRAPH_000004');

        const paras2 = await pdf.page(0).selectParagraphsMatching('.*NOT FOUND.*');
        expect(paras2).toHaveLength(0);

        const paras3 = await pdf.page(0).selectParagraphsMatching('.*');
        expect(paras3).toHaveLength(2);
    });

    test('delete paragraph', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const [target] = await pdf.page(0).selectParagraphsStartingWith('The Complete');
        await target.delete();

        const remaining = await pdf.page(0).selectParagraphsStartingWith('The Complete');
        expect(remaining).toHaveLength(0);
    });

    test('move paragraph', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const [para] = await pdf.page(0).selectParagraphsStartingWith('The Complete');
        await para.moveTo(0.1, 300);

        const moved = await pdf.page(0).selectParagraphsAt(0.1, 300);
        expect(moved.length).toBeGreaterThan(0);
    });

    async function assertNewParagraphExists(pdf: PDFDancer) {
        const lines = await pdf.page(0).selectTextLinesStartingWith('Awesomely');
        expect(lines.length).toBeGreaterThanOrEqual(1);
    }

    test('modify paragraph', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const [para] = await pdf.page(0).selectParagraphsStartingWith('The Complete');

        await para.edit().replace('Awesomely\nObvious!')
            .font("Helvetica", 12)
            .lineSpacing(0.7)
            .moveTo(300.1, 500)
            .apply()

        await assertNewParagraphExists(pdf);
    });

    test('modify paragraph (simple)', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const [para] = await pdf.page(0).selectParagraphsStartingWith('The Complete');
        await para.edit().replace('Awesomely\nObvious!').apply();
        await assertNewParagraphExists(pdf);
    });

    test('add paragraph with missing font (expect error)', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        await expect(
            pdf.page(0).newParagraph()
                .text('Awesomely\nObvious!')
                .font('Roboto', 14)
                .lineSpacing(0.7)
                .at(300.1, 500)
                .apply()
        ).rejects.toThrow('Font not found');
    });

    test('add paragraph with known font', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const success = await pdf.page(0).newParagraph()
            .text('Awesomely\nObvious!')
            .font('Roboto-Regular', 14)
            .lineSpacing(0.7)
            .at(300.1, 500)
            .apply()

        expect(success).toBe(true);
        await assertNewParagraphExists(pdf);
    });

    test('add paragraph using font lookup', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const fonts = await pdf.findFonts('Roboto', 14);
        expect(fonts.length).toBeGreaterThan(0);
        const roboto = fonts[0];

        const success = await pdf.page(0).newParagraph()
            .text('Awesomely\nObvious!')
            .font(roboto)
            .lineSpacing(0.7)
            .at(300.1, 500)
            .apply();

        expect(success).toBe(true);
        await assertNewParagraphExists(pdf);
    });

    test('add paragraph with Asimovian font', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const fonts = await pdf.findFonts('Asimovian', 14);
        expect(fonts.length).toBeGreaterThan(0);
        const asimovian = fonts[0];

        const success = await pdf.page(0).newParagraph()
            .text('Awesomely\nObvious!')
            .font(asimovian)
            .lineSpacing(0.7)
            .at(300.1, 500)
            .apply();

        expect(success).toBe(true);
        await assertNewParagraphExists(pdf);
    });

    test('add paragraph with custom TTF font', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const ttf = readFontFixture('DancingScript-Regular.ttf');

        const success = await pdf.page(0).newParagraph()
            .text('Awesomely\nObvious!')
            .fontFile(ttf, 24)
            .lineSpacing(1.8)
            .color(new Color(0, 0, 255))
            .at(300.1, 500)
            .apply();

        expect(success).toBe(true);
        await assertNewParagraphExists(pdf);
    });
});
