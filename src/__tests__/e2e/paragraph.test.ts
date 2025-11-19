/**
 * E2E tests for paragraph operations — new PDFDancer API
 */

import {Color, FontType, PDFDancer, StandardFonts} from '../../index';
import {getFontPath, readFontFixture, requireEnvAndFixture} from './test-helpers';
import {expectWithin} from '../assertions';
import {PDFAssertions} from './pdf-assertions';

describe('Paragraph E2E Tests (v2 API)', () => {

    test('find paragraphs by position', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const paras = await pdf.selectParagraphs();
        expect(paras.length).toBeGreaterThanOrEqual(112);
        expect(paras.length).toBeLessThanOrEqual(122);

        const parasPage0 = await pdf.page(0).selectParagraphs();
        expect(parasPage0).toHaveLength(2);

        const first = parasPage0[0];
        expect(first.internalId).toBe('PARAGRAPH_000003');
        expect(first.position).toBeDefined();
        expectWithin(first.position.boundingRect?.x, 326, 1);
        expectWithin(first.position.boundingRect?.y, 706, 5);

        const last = parasPage0[parasPage0.length - 1];
        expect(last.internalId).toBe('PARAGRAPH_000004');
        expect(last.position).toBeDefined();
        expectWithin(last.position.boundingRect?.x, 54, 1);
        expectWithin(last.position.boundingRect?.y, 496, 2);

        expect(last.objectRef().status).toBeDefined();
        expect(last.objectRef().status?.getFontType()).toBe(FontType.EMBEDDED);
        expect(last.objectRef().status?.isModified()).toBe(false);
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

        const moved = await pdf.page(0).selectParagraphsAt(0.1, 300, 1);
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

        const movedParas = await pdf.page(0).selectParagraphsAt(300.1, 500);
        expect(movedParas.length).toBeGreaterThan(0);
        const moved = movedParas[0];
        expect(moved.objectRef().status).toBeDefined();
        expect(moved.objectRef().status?.getFontType()).toBe(FontType.STANDARD);
        expect(moved.objectRef().status?.isModified()).toBe(true);

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertTextlineHasFont('Awesomely', 'Helvetica', 12, 0);
        await assertions.assertTextlineHasFont('Obvious!', 'Helvetica', 12, 0);
        await assertions.assertTextlineHasColor('Awesomely', new Color(255, 255, 255), 0);
        await assertions.assertTextlineHasColor('Obvious!', new Color(255, 255, 255), 0);
        await assertions.assertParagraphIsAt('Awesomely', 300.1, 500, 0, 3);
    });

    test('modify paragraph (simple)', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const [para] = await pdf.page(0).selectParagraphsStartingWith('The Complete');
        const result = await para.edit().replace('Awesomely\nObvious!').apply();

        // This should issue a warning about an embedded font modification
        expect(typeof result).toBe('object');

        await assertNewParagraphExists(pdf);

        const modifiedParas = await pdf.page(0).selectParagraphsStartingWith('Awesomely');
        expect(modifiedParas.length).toBeGreaterThan(0);
        const modified = modifiedParas[0];
        expect(modified.objectRef().status).toBeDefined();
        expect(modified.objectRef().status?.getFontType()).toBe(FontType.EMBEDDED);
        expect(modified.objectRef().status?.isModified()).toBe(true);

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertTextlineHasFontMatching('Awesomely', 'Poppins-Bold', 45, 0);
        await assertions.assertTextlineHasFontMatching('Obvious!', 'Poppins-Bold', 45, 0);
        await assertions.assertTextlineHasColor('Awesomely', new Color(255, 255, 255), 0);
        await assertions.assertTextlineHasColor('Obvious!', new Color(255, 255, 255), 0);
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

    test('add paragraph with custom TTF font from filename', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const pathToFontFile = getFontPath('DancingScript-Regular.ttf');

        const success = await pdf.page(0).newParagraph()
            .text('Awesomely\nObvious!')
            .fontFile(pathToFontFile, 24)
            .lineSpacing(1.8)
            .color(new Color(0, 0, 255))
            .at(300.1, 500)
            .apply();

        expect(success).toBe(true);
        await assertNewParagraphExists(pdf);
    });

    test('add paragraph with standard font - Helvetica', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const success = await pdf.page(0).newParagraph()
            .text('Standard Font Test\nHelvetica')
            .font(StandardFonts.HELVETICA, 14)
            .lineSpacing(1.2)
            .at(100, 600)
            .apply();

        expect(success).toBe(true);
        const lines = await pdf.page(0).selectTextLinesStartingWith('Standard Font Test');
        expect(lines.length).toBeGreaterThanOrEqual(1);
    });

    test('add paragraph with standard font - Times Bold', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const success = await pdf.page(0).newParagraph()
            .text('Times Bold Test')
            .font(StandardFonts.TIMES_BOLD, 16)
            .color(new Color(255, 0, 0))
            .at(100, 550)
            .apply();

        expect(success).toBe(true);
        const lines = await pdf.page(0).selectTextLinesStartingWith('Times Bold Test');
        expect(lines.length).toBeGreaterThanOrEqual(1);
    });

    test('add paragraph with standard font - Courier', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const success = await pdf.page(0).newParagraph()
            .text('Courier Monospace\nCode Example')
            .font(StandardFonts.COURIER, 12)
            .lineSpacing(1.5)
            .at(100, 500)
            .apply();

        expect(success).toBe(true);
        const lines = await pdf.page(0).selectTextLinesStartingWith('Courier Monospace');
        expect(lines.length).toBeGreaterThanOrEqual(1);
    });


    test('modify paragraph without position', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const [para] = await pdf.page(0).selectParagraphsStartingWith('The Complete');
        let originalX = para.position.getX();

        await para.edit()
            .replace('Modified with\nStandard Font')
            .font(StandardFonts.HELVETICA_BOLD, 14)
            .lineSpacing(1.3)
            .apply();

        const [newPara] = await pdf.page(0).selectParagraphsStartingWith('Modified with');
        // TODO should be at the original position
        expect(newPara.position.getX()).toBe(originalX);
        expect(Math.floor(newPara.position.getY()!)).toBe(493); // adjust for baseline vs bounding box
    });

    test('modify paragraph without position and lineSpacing', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const [para] = await pdf.page(0).selectParagraphsStartingWith('The Complete');
        let originalX = para.position.getX();

        await para.edit()
            .replace('Modified with\nStandard Font')
            .font(StandardFonts.HELVETICA_BOLD, 14)
            .apply();

        const [newPara] = await pdf.page(0).selectParagraphsStartingWith('Modified with');
        // TODO should be at the original position
        expect(newPara.position.getX()).toBe(originalX);
        expect(Math.floor(newPara.position.getY()!)).toBe(493); // adjust for baseline vs bounding box
    });

    test('modify paragraph only change font', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const [para] = await pdf.page(0).selectParagraphsStartingWith('The Complete');
        let originalX = para.position.getX();

        await para.edit()
            .font(StandardFonts.HELVETICA_BOLD, 28)
            .apply();

        const [newPara] = await pdf.page(0).selectParagraphsStartingWith('The Complete');
        // TODO should be at the original position
        expect(newPara.position.getX()).toBe(originalX);
        expect(Math.floor(newPara.position.getY()!)).toBe(490); // adjust for baseline vs bounding box
    });

    test('add paragraph without position', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        await expect(pdf.page(0).newParagraph()
            .text('Courier Monospace\nCode Example')
            .font(StandardFonts.COURIER, 12)
            .lineSpacing(1.5)
            .apply())
            .rejects
            .toThrow("Paragraph position is null, you need to specify a position for the new paragraph, using .at(x,y)");
    });

    test('modify paragraph to use standard font', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const [para] = await pdf.page(0).selectParagraphsStartingWith('The Complete');

        await para.edit()
            .replace('Modified with\nStandard Font')
            .font(StandardFonts.HELVETICA_BOLD, 14)
            .lineSpacing(1.3)
            .moveTo(100, 400)
            .apply();

        const lines = await pdf.page(0).selectTextLinesStartingWith('Modified with');
        expect(lines.length).toBeGreaterThanOrEqual(1);
    });

    test('use all Times family standard fonts', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const timesFonts = [
            StandardFonts.TIMES_ROMAN,
            StandardFonts.TIMES_BOLD,
            StandardFonts.TIMES_ITALIC,
            StandardFonts.TIMES_BOLD_ITALIC
        ];

        for (let i = 0; i < timesFonts.length; i++) {
            const success = await pdf.page(0).newParagraph()
                .text(`Times Font ${i}`)
                .font(timesFonts[i], 12)
                .at(50, 700 - (i * 30))
                .apply();
            expect(success).toBe(true);
        }

        const lines = await pdf.page(0).selectTextLinesStartingWith('Times Font');
        expect(lines.length).toBe(4);
    });

    test('use all Helvetica family standard fonts', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const helveticaFonts = [
            StandardFonts.HELVETICA,
            StandardFonts.HELVETICA_BOLD,
            StandardFonts.HELVETICA_OBLIQUE,
            StandardFonts.HELVETICA_BOLD_OBLIQUE
        ];

        for (let i = 0; i < helveticaFonts.length; i++) {
            const success = await pdf.page(0).newParagraph()
                .text(`Helvetica Font ${i}`)
                .font(helveticaFonts[i], 12)
                .at(200, 700 - (i * 30))
                .apply();
            expect(success).toBe(true);
        }

        const lines = await pdf.page(0).selectTextLinesStartingWith('Helvetica Font');
        expect(lines.length).toBe(4);
    });


    test('modify paragraph with assertions', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const [para] = await pdf.page(0).selectParagraphsStartingWith('The Complete');

        await para.edit().replace('Awesomely\nObvious!')
            .font("Helvetica", 12)
            .lineSpacing(0.7)
            .moveTo(300.1, 500)
            .apply();

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertTextlineHasFont('Awesomely', 'Helvetica', 12, 0);
        await assertions.assertTextlineHasFont('Obvious!', 'Helvetica', 12, 0);
        await assertions.assertTextlineHasColor('Awesomely', new Color(255, 255, 255), 0);
        await assertions.assertTextlineHasColor('Obvious!', new Color(255, 255, 255), 0);
        await assertions.assertParagraphIsAt('Awesomely', 300.1, 500, 0, 3);
    });

    test('modify paragraph without position', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const [para] = await pdf.page(0).selectParagraphsStartingWith('The Complete');
        let originalX = para.position.getX();
        let originalY = para.position.getY();

        await para.edit()
            .replace('Awesomely\nObvious!')
            .font('Helvetica', 12)
            .lineSpacing(0.7)
            .apply();

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertTextlineHasFont('Awesomely', 'Helvetica', 12, 0);
        await assertions.assertTextlineHasFont('Obvious!', 'Helvetica', 12, 0);
        await assertions.assertTextlineHasColor('Awesomely', new Color(255, 255, 255), 0);
        await assertions.assertTextlineHasColor('Obvious!', new Color(255, 255, 255), 0);
        await assertions.assertParagraphIsAt('Awesomely', originalX!, originalY!, 0, 3);
    });

    test('modify paragraph without position and spacing', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const [para] = await pdf.page(0).selectParagraphsStartingWith('The Complete');
        let originalX = para.position.getX();
        let originalY = para.position.getY();

        await para.edit()
            .replace('Awesomely\nObvious!')
            .font('Helvetica', 12)
            .apply();

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertTextlineHasFont('Awesomely', 'Helvetica', 12, 0);
        await assertions.assertTextlineHasFont('Obvious!', 'Helvetica', 12, 0);
        await assertions.assertTextlineHasColor('Awesomely', new Color(255, 255, 255), 0);
        await assertions.assertTextlineHasColor('Obvious!', new Color(255, 255, 255), 0);
        await assertions.assertParagraphIsAt('Awesomely', originalX!, originalY!, 0, 3);
    });

    test('modify paragraph only font', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const [para] = await pdf.page(0).selectParagraphsStartingWith('The Complete');

        await para.edit()
            .font('Helvetica', 28)
            .apply();

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertTextlineHasFont('The Complete', 'Helvetica', 28, 0);
        await assertions.assertTextlineHasColor('The Complete', new Color(255, 255, 255), 0);
    });

    test('modify paragraph only move', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const [para] = await pdf.page(0).selectParagraphsStartingWith('The Complete');

        await para.edit()
            .moveTo(40, 40)
            .apply();

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertTextlineHasFont('The Complete', 'IXKSWR+Poppins-Bold', 45, 0);
        await assertions.assertParagraphIsAt('The Complete', 40, 40, 0);
        await assertions.assertTextlineHasColor('The Complete', new Color(255, 255, 255), 0);
    });

    test('modify paragraph simple', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const [para] = await pdf.page(0).selectParagraphsStartingWith('The Complete');
        await para.edit().replace('Awesomely\nObvious!').apply();

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertTextlineHasFontMatching('Awesomely', 'Poppins-Bold', 45, 0);
        await assertions.assertTextlineHasFontMatching('Obvious!', 'Poppins-Bold', 45, 0);
        await assertions.assertTextlineHasColor('Awesomely', new Color(255, 255, 255), 0);
        await assertions.assertTextlineHasColor('Obvious!', new Color(255, 255, 255), 0);
    });

    test('add paragraph with standard font Times Roman', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        await pdf.page(0).newParagraph()
            .text('Times Roman Test')
            .font(StandardFonts.TIMES_ROMAN, 14)
            .at(150, 150)
            .apply();

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertTextHasFont('Times Roman Test', StandardFonts.TIMES_ROMAN, 14, 0);
        await assertions.assertParagraphIsAt('Times Roman Test', 150, 150, 0);
    });

    test('add paragraph with standard font Courier Bold', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        await pdf.page(0).newParagraph()
            .text('Courier Monospace\nCode Example')
            .font(StandardFonts.COURIER_BOLD, 12)
            .lineSpacing(1.5)
            .at(200, 200)
            .apply();

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertTextHasFont('Courier Monospace', StandardFonts.COURIER_BOLD, 12, 0);
        await assertions.assertParagraphIsAt('Courier Monospace', 200, 200, 0);
    });

    test('paragraph color reading', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        await pdf.page(0).newParagraph()
            .text('Red Color Test')
            .font(StandardFonts.HELVETICA, 14)
            .color(new Color(255, 0, 0))
            .at(100, 100)
            .apply();

        await pdf.page(0).newParagraph()
            .text('Blue Color Test')
            .font(StandardFonts.HELVETICA, 14)
            .color(new Color(0, 0, 255))
            .at(100, 120)
            .apply();

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertTextlineHasColor('Blue Color Test', new Color(0, 0, 255), 0);
        await assertions.assertTextlineHasColor('Red Color Test', new Color(255, 0, 0), 0);
    });

    test('add paragraph to new page', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('Empty.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        await pdf.page(0).newParagraph()
            .text('Awesome')
            .font('Roboto-Regular', 14)
            .at(50, 100)
            .apply();

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertTextlineHasFontMatching('Awesome', 'Roboto-Regular', 14, 0);
        await assertions.assertTextlineHasColor('Awesome', new Color(0, 0, 0), 0);
        await assertions.assertParagraphIsAt('Awesome', 50, 100, 0, 4);
    });

    test('Symbol and ZapfDingbats fonts are available as standard fonts', () => {
        expect(StandardFonts.SYMBOL).toBe('Symbol');
        expect(StandardFonts.ZAPF_DINGBATS).toBe('ZapfDingbats');
    });

    // Tests for singular select methods
    test('selectParagraph returns first paragraph or null', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        // Test with results
        const para = await pdf.page(0).selectParagraph();
        expect(para).not.toBeNull();
        expect(para!.internalId).toBe('PARAGRAPH_000003');

        // Test with PDFDancer class
        const paraFromPdf = await pdf.selectParagraph();
        expect(paraFromPdf).not.toBeNull();
        expect(paraFromPdf!.internalId).toBe('PARAGRAPH_000003');
    });

    test('selectParagraphStartingWith returns first match or null', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const para = await pdf.page(0).selectParagraphStartingWith('The Complete');
        expect(para).not.toBeNull();
        expect(para!.internalId).toBe('PARAGRAPH_000004');

        // Test with no match
        const noMatch = await pdf.page(0).selectParagraphStartingWith('NoMatch');
        expect(noMatch).toBeNull();
    });

    test('selectParagraphMatching returns first match or null', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const para = await pdf.page(0).selectParagraphMatching('.*Complete.*');
        expect(para).not.toBeNull();
        expect(para!.internalId).toBe('PARAGRAPH_000004');

        // Test with PDFDancer class
        const paraFromPdf = await pdf.selectParagraphMatching('.*Complete.*');
        expect(paraFromPdf).not.toBeNull();

        // Test with no match
        const noMatch = await pdf.page(0).selectParagraphMatching('.*NOT FOUND.*');
        expect(noMatch).toBeNull();
    });

    test('selectParagraphAt returns first paragraph at position or null', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const para = await pdf.page(0).selectParagraphAt(54, 496, 10);
        expect(para).not.toBeNull();
        expect(para!.internalId).toBe('PARAGRAPH_000004');

        // Test with no match
        const noMatch = await pdf.page(0).selectParagraphAt(1000, 1000, 1);
        expect(noMatch).toBeNull();
    });

});
