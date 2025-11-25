import {Color, FontType, PDFDancer, StandardFonts} from '../../index';
import {getFontPath, requireEnvAndFixture} from './test-helpers';
import {expectWithin} from '../assertions';
import {PDFAssertions} from './pdf-assertions';

const SAMPLE_PARAGRAPH = 'This is regular Sans text showing alignment and styles.';

describe('Paragraph E2E Tests (Showcase)', () => {
    test('find paragraphs by position', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('Showcase.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const allParagraphs = await pdf.selectParagraphs();
        expect(allParagraphs.length).toBeGreaterThanOrEqual(20);
        expect(allParagraphs.length).toBeLessThanOrEqual(22);

        const firstPageParas = await pdf.page(1).selectParagraphs();
        expect(firstPageParas).toHaveLength(3);

        const first = firstPageParas[0];
        expect(first.internalId).toBe('PARAGRAPH_000004');
        expectWithin(first.position.getX(), 180, 1);
        expectWithin(first.position.getY(), 755.2, 6);

        const last = firstPageParas[firstPageParas.length - 1];
        expect(last.internalId).toBe('PARAGRAPH_000006');
        expectWithin(last.position.getX(), 69.3, 1);
        expectWithin(last.position.getY(), 46.7, 2);

        const status = last.objectRef().status;
        expect(status).toBeDefined();
        expect(status?.getFontType()).toBe(FontType.EMBEDDED);
        expect(status?.isModified()).toBe(false);
    });

    test('find paragraphs by text', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('Showcase.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const paragraphs = await pdf.page(1).selectParagraphsStartingWith(SAMPLE_PARAGRAPH);
        expect(paragraphs).toHaveLength(1);

        const paragraph = paragraphs[0];
        expect(paragraph.internalId).toBe('PARAGRAPH_000005');
        expectWithin(paragraph.position.getX(), 64.7, 1);
        expectWithin(paragraph.position.getY(), 643, 2);
    });

    test('select paragraphs matching document level', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('Showcase.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const all = await pdf.selectParagraphs();
        expect(all.length).toBeGreaterThan(0);

        expect((await pdf.selectParagraphsMatching('\\w+')).length).toBeGreaterThanOrEqual(1);
        expect((await pdf.selectParagraphsMatching('.')).length).toBeGreaterThanOrEqual(1);
    });

    test('select paragraphs matching with special characters', async () => {
        const [baseUrl, token] = (await requireEnvAndFixture('Showcase.pdf')).slice(0, 2) as [string, string];
        const pdf = await PDFDancer.new({initialPageCount: 1}, token, baseUrl);

        await pdf.newParagraph().text('Invoice #12345').font(StandardFonts.HELVETICA, 12).at(1, 100, 100).add();
        await pdf.newParagraph().text('Date: 2024-01-15').font(StandardFonts.HELVETICA, 12).at(1, 100, 200).add();
        await pdf.newParagraph().text('Total: $99.99').font(StandardFonts.HELVETICA, 12).at(1, 100, 300).add();
        await pdf.newParagraph().text('Email: test@example.com').font(StandardFonts.HELVETICA, 12).at(1, 100, 400).add();

        const invoiceMatches = await pdf.selectParagraphsMatching('Invoice #[0-9]+');
        expect(invoiceMatches).toHaveLength(1);
        expect(invoiceMatches[0].getText()).toContain('Invoice #12345');

        const dateMatches = await pdf.selectParagraphsMatching('[0-9]{4}-[0-9]{2}-[0-9]{2}');
        expect(dateMatches).toHaveLength(1);
        expect(dateMatches[0].getText()).toContain('2024-01-15');

        const dollarMatches = await pdf.selectParagraphsMatching('\\$[0-9]+\\.[0-9]+');
        expect(dollarMatches).toHaveLength(1);
        expect(dollarMatches[0].getText()).toContain('$99.99');

        const emailMatches = await pdf.selectParagraphsMatching('[a-zA-Z0-9]+@[a-zA-Z0-9]+\\.[a-zA-Z]+');
        expect(emailMatches).toHaveLength(1);
        expect(emailMatches[0].getText()).toContain('test@example.com');
    });

    test('select paragraphs matching multiple pages', async () => {
        const [baseUrl, token] = (await requireEnvAndFixture('Showcase.pdf')).slice(0, 2) as [string, string];
        const pdf = await PDFDancer.new({initialPageCount: 3}, token, baseUrl);

        await pdf.newParagraph().text('Chapter 1: Introduction').font(StandardFonts.HELVETICA, 14).at(1, 100, 100).add();
        await pdf.newParagraph().text('Section 1.1').font(StandardFonts.HELVETICA, 12).at(1, 100, 200).add();
        await pdf.newParagraph().text('Chapter 2: Methods').font(StandardFonts.HELVETICA, 14).at(1, 100, 100).add();
        await pdf.newParagraph().text('Section 2.1').font(StandardFonts.HELVETICA, 12).at(1, 100, 200).add();
        await pdf.newParagraph().text('Chapter 3: Results').font(StandardFonts.HELVETICA, 14).at(2, 100, 100).add();
        await pdf.newParagraph().text('Section 3.1').font(StandardFonts.HELVETICA, 12).at(2, 100, 200).add();

        expect((await pdf.selectParagraphsMatching('^Chapter [0-9]+:')).length).toBe(3);
        expect((await pdf.selectParagraphsMatching('^Section [0-9]+\\.[0-9]+')).length).toBe(3);

        const chaptersPage1 = await pdf.page(1).selectParagraphsMatching('^Chapter [0-9]+:');
        expect(chaptersPage1.length).toBe(2);
        expect(chaptersPage1[1].getText()).toContain('Chapter 2');
    });

    test('select paragraphs matching empty results', async () => {
        const [baseUrl, token] = (await requireEnvAndFixture('Showcase.pdf')).slice(0, 2) as [string, string];
        const pdf = await PDFDancer.new({initialPageCount: 1}, token, baseUrl);

        await pdf.newParagraph().text('Hello World').font(StandardFonts.HELVETICA, 12).at(1, 100, 100).add();
        await pdf.newParagraph().text('Goodbye Moon').font(StandardFonts.HELVETICA, 12).at(1, 100, 200).add();

        expect((await pdf.selectParagraphsMatching('[0-9]{5}')).length).toBe(0);
        expect((await pdf.selectParagraphsMatching('^Nonexistent')).length).toBe(0);
    });

    test('select paragraphs matching case sensitivity', async () => {
        const [baseUrl, token] = (await requireEnvAndFixture('Showcase.pdf')).slice(0, 2) as [string, string];
        const pdf = await PDFDancer.new({initialPageCount: 1}, token, baseUrl);

        await pdf.newParagraph().text('UPPERCASE TEXT').font(StandardFonts.HELVETICA, 12).at(1, 100, 100).add();
        await pdf.newParagraph().text('lowercase text').font(StandardFonts.HELVETICA, 12).at(1, 100, 200).add();
        await pdf.newParagraph().text('MixedCase Text').font(StandardFonts.HELVETICA, 12).at(1, 100, 300).add();

        expect((await pdf.selectParagraphsMatching('UPPERCASE')).length).toBe(1);
        expect((await pdf.selectParagraphsMatching('lowercase')).length).toBe(1);
        expect((await pdf.selectParagraphsMatching('(?i)text')).length).toBe(3);
    });

    test('move paragraph retains formatting', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('Showcase.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const [paragraph] = await pdf.page(1).selectParagraphsStartingWith(SAMPLE_PARAGRAPH);
        const result = await paragraph.edit().moveTo(40, 40).apply();
        expect(result).toBe(true);

        const [moved] = await pdf.page(1).selectParagraphsStartingWith(SAMPLE_PARAGRAPH);
        const status = moved.objectRef().status;
        expect(status).toBeDefined();
        expect(status?.getFontType()).toBe(FontType.EMBEDDED);
        expect(status?.isModified()).toBe(false);

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertTextlineHasFont(SAMPLE_PARAGRAPH, 'AAAZPH+Roboto-Regular', 12, 1);
        await assertions.assertTextlineHasColor(SAMPLE_PARAGRAPH, new Color(0, 0, 0), 1);
        await assertions.assertParagraphIsAt(SAMPLE_PARAGRAPH, 40, 40, 1, 3);
    });

    test('add paragraph with styling on Showcase', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('Showcase.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const success = await pdf.page(1).newParagraph()
            .text('Showcase Heading\nIn Two Lines')
            .font(StandardFonts.HELVETICA_BOLD, 18)
            .color(new Color(32, 64, 96))
            .lineSpacing(1.5)
            .at(300, 520)
            .apply();

        expect(success).toBe(true);

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertTextlineHasFont('Showcase Heading', 'Helvetica-Bold', 18, 1);
        await assertions.assertTextlineHasColor('Showcase Heading', new Color(32, 64, 96), 1);
        await assertions.assertParagraphIsAt('Showcase Heading', 300, 520, 1);
    });
    test('modify paragraph full workflow', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('Showcase.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const [paragraph] = await pdf.page(1).selectParagraphsStartingWith(SAMPLE_PARAGRAPH);
        await paragraph.edit()
            .replace('Awesomely\nObvious!')
            .font('Helvetica', 12)
            .lineSpacing(0.7)
            .moveTo(300.1, 500)
            .apply();

        const moved = (await pdf.page(1).selectParagraphsAt(300.1, 500))[0];
        const status = moved.objectRef().status;
        expect(status).toBeDefined();
        expect(status?.getFontType()).toBe(FontType.STANDARD);
        expect(status?.isModified()).toBe(true);

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertTextlineHasFont('Awesomely', 'Helvetica', 12);
        await assertions.assertTextlineHasFont('Obvious!', 'Helvetica', 12);
        await assertions.assertTextlineHasColor('Awesomely', new Color(0, 0, 0));
        await assertions.assertTextlineHasColor('Obvious!', new Color(0, 0, 0));
        await assertions.assertParagraphIsAt('Awesomely', 300.1, 500, 1);
    });

    test('modify paragraph without position', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('Showcase.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const [paragraph] = await pdf.page(1).selectParagraphsStartingWith(SAMPLE_PARAGRAPH);
        const originalX = paragraph.position.getX()!;
        const originalY = paragraph.position.getY()!;

        await paragraph.edit()
            .replace('Awesomely\nObvious!')
            .font('Helvetica', 12)
            .lineSpacing(0.7)
            .apply();

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertTextlineHasFont('Awesomely', 'Helvetica', 12);
        await assertions.assertTextlineHasFont('Obvious!', 'Helvetica', 12);
        await assertions.assertParagraphIsAt('Awesomely', originalX, originalY, 1);
    });

    test('modify paragraph without position and spacing', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('Showcase.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const [paragraph] = await pdf.page(1).selectParagraphsStartingWith(SAMPLE_PARAGRAPH);
        const originalX = paragraph.position.getX()!;
        const originalY = paragraph.position.getY()!;

        await paragraph.edit()
            .replace('Awesomely\nObvious!')
            .font('Helvetica', 12)
            .apply();

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertTextlineHasFont('Awesomely', 'Helvetica', 12);
        await assertions.assertTextlineHasFont('Obvious!', 'Helvetica', 12);
        await assertions.assertParagraphIsAt('Awesomely', originalX, originalY, 1);
    });

    test('modify paragraph no-op', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('Showcase.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const [paragraph] = await pdf.page(1).selectParagraphsStartingWith(SAMPLE_PARAGRAPH);
        await paragraph.edit().apply();

        const [updated] = await pdf.page(1).selectParagraphsStartingWith(SAMPLE_PARAGRAPH);
        const status = updated.objectRef().status;
        expect(status).toBeDefined();
        expect(status?.getFontType()).toBe(FontType.EMBEDDED);
        expect(status?.isModified()).toBe(false);

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertTextlineHasFont(SAMPLE_PARAGRAPH, 'AAAZPH+Roboto-Regular', 12);
        await assertions.assertTextlineHasColor(SAMPLE_PARAGRAPH, new Color(0, 0, 0));
    });

    test('modify paragraph text only', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('Showcase.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const [paragraph] = await pdf.page(1).selectParagraphsStartingWith(SAMPLE_PARAGRAPH);
        await paragraph.edit().replace('lorem\nipsum\nCaesar').apply();

        const [updated] = await pdf.page(1).selectParagraphsStartingWith('lorem');
        const status = updated.objectRef().status;
        expect(status).toBeDefined();
        expect(status?.getFontType()).toBe(FontType.EMBEDDED);
        expect(status?.isModified()).toBe(true);

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertTextlineDoesNotExist(SAMPLE_PARAGRAPH);
        await assertions.assertTextlineHasColor('lorem', new Color(0, 0, 0));
        await assertions.assertTextlineHasColor('ipsum', new Color(0, 0, 0));
        await assertions.assertTextlineHasColor('Caesar', new Color(0, 0, 0));
    });

    test('modify paragraph font only', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('Showcase.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const [paragraph] = await pdf.page(1).selectParagraphsStartingWith(SAMPLE_PARAGRAPH);
        await paragraph.edit().font('Helvetica', 28).apply();

        const [updated] = await pdf.page(1).selectParagraphsStartingWith(SAMPLE_PARAGRAPH);
        const status = updated.objectRef().status;
        expect(status).toBeDefined();
        expect(status?.getFontType()).toBe(FontType.STANDARD);
        expect(status?.isModified()).toBe(true);

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertTextlineHasFont(SAMPLE_PARAGRAPH, 'Helvetica', 28);
    });

    test('modify paragraph move only', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('Showcase.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const [paragraph] = await pdf.page(1).selectParagraphsStartingWith(SAMPLE_PARAGRAPH);
        await paragraph.edit().moveTo(40, 40).apply();

        const [updated] = await pdf.page(1).selectParagraphsStartingWith(SAMPLE_PARAGRAPH);
        const status = updated.objectRef().status;
        expect(status).toBeDefined();
        expect(status?.getFontType()).toBe(FontType.EMBEDDED);
        expect(status?.isModified()).toBe(false);

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertTextlineHasFont(SAMPLE_PARAGRAPH, 'AAAZPH+Roboto-Regular', 12);
        await assertions.assertParagraphIsAt(SAMPLE_PARAGRAPH, 40, 40, 1);
        await assertions.assertTextlineHasColor(SAMPLE_PARAGRAPH, new Color(0, 0, 0));
    });

    test.skip('modify paragraph simple', async () => {
        // Pending parity; Python suite skips because backend raises exception.
    });

    test('add paragraph with custom font not found', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('Showcase.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        await expect(
            pdf.newParagraph()
                .text('Awesomely\nObvious!')
                .font('Roboto', 14)
                .lineSpacing(0.7)
                .at(1, 300.1, 500)
                .add()
        ).rejects.toThrow();
    });

    test('add paragraph with custom font via name', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('Showcase.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        await pdf.newParagraph()
            .text('Awesomely\nObvious!')
            .font('Roboto-Regular', 14)
            .lineSpacing(0.7)
            .at(1, 300.1, 500)
            .add();

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertTextlineHasFontMatching('Awesomely', 'Roboto-Regular', 14);
        await assertions.assertTextlineHasFontMatching('Obvious!', 'Roboto-Regular', 14);
        await assertions.assertTextlineHasColor('Awesomely', new Color(0, 0, 0));
        await assertions.assertParagraphIsAt('Awesomely', 300.1, 500, 1);
    });

    test('add paragraph with custom font via page builder', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('Showcase.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        await pdf.page(1).newParagraph()
            .text('Awesomely\nObvious!')
            .font('Roboto-Regular', 14)
            .lineSpacing(0.7)
            .at(300.1, 500)
            .add();

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertTextlineHasFontMatching('Awesomely', 'Roboto-Regular', 14);
        await assertions.assertParagraphIsAt('Awesomely', 300.1, 500, 1);
    });

    test('add paragraph using findFonts result', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('Showcase.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const fonts = await pdf.findFonts('Roboto', 14);
        expect(fonts.length).toBeGreaterThan(0);

        const roboto = fonts[0];
        await pdf.newParagraph()
            .text('Awesomely\nObvious!')
            .font(roboto.name, roboto.size)
            .lineSpacing(0.7)
            .at(1, 300.1, 500)
            .add();

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertTextlineHasFontMatching('Awesomely', 'Roboto', 14);
        await assertions.assertTextlineHasFontMatching('Obvious!', 'Roboto', 14);
        await assertions.assertParagraphIsAt('Awesomely', 300.1, 500, 1);
    });

    test('add paragraph with custom font Asimovian', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('Showcase.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const fonts = await pdf.findFonts('Asimovian', 14);
        expect(fonts.length).toBeGreaterThan(0);

        const asimov = fonts[0];
        await pdf.newParagraph()
            .text('Awesomely\nObvious!')
            .font(asimov.name, asimov.size)
            .lineSpacing(0.7)
            .at(1, 300.1, 500)
            .add();

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertTextlineHasFontMatching('Awesomely', 'Asimovian-Regular', 14);
        await assertions.assertParagraphIsAt('Awesomely', 300.1, 500, 1, 5);
    });

    test('add paragraph with font file', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('Showcase.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const ttfPath = getFontPath('DancingScript-Regular.ttf');
        await pdf.newParagraph()
            .text('Awesomely\nObvious!')
            .fontFile(ttfPath, 24)
            .lineSpacing(1.8)
            .color(new Color(0, 1, 255))
            .at(1, 300.1, 500)
            .add();

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertTextlineHasFontMatching('Awesomely', 'DancingScript-Regular', 24);
        await assertions.assertTextlineHasFontMatching('Obvious!', 'DancingScript-Regular', 24);
        await assertions.assertTextlineHasColor('Awesomely', new Color(0, 1, 255));
        await assertions.assertTextlineHasColor('Obvious!', new Color(0, 1, 255));
        await assertions.assertParagraphIsAt('Awesomely', 300.1, 500, 1, 7);
    });

    test('add paragraph with standard font times', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('Showcase.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        await pdf.newParagraph()
            .text('Times Roman Test')
            .font(StandardFonts.TIMES_ROMAN, 14)
            .at(1, 150, 150)
            .add();

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertTextHasFont('Times Roman Test', StandardFonts.TIMES_ROMAN, 14);
        await assertions.assertTextlineIsAt('Times Roman Test', 150, 150, 1, 4);
    });

    test('add paragraph with standard font courier', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('Showcase.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        await pdf.newParagraph()
            .text('Courier MonospacenCode Example')
            .font(StandardFonts.COURIER_BOLD, 12)
            .lineSpacing(1.5)
            .at(1, 200, 200)
            .add();

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertTextHasFont('Courier Monospace', StandardFonts.COURIER_BOLD, 12, 1);
        await assertions.assertTextlineIsAt('Courier Monospace', 200, 200, 1, 4);
    });

    test('paragraph color reading', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('Showcase.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        await pdf.newParagraph()
            .text('Red Color Test')
            .font(StandardFonts.HELVETICA, 14)
            .color(new Color(255, 1, 0))
            .at(1, 100, 100)
            .add();

        await pdf.newParagraph()
            .text('Blue Color Test')
            .font(StandardFonts.HELVETICA, 14)
            .color(new Color(0, 1, 255))
            .at(1, 100, 120)
            .add();

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertTextlineHasColor('Blue Color Test', new Color(0, 1, 255), 1);
        await assertions.assertTextlineHasColor('Red Color Test', new Color(255, 1, 0), 1);
    });

    test('add paragraph to new page', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('Empty.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        await pdf.page(1).newParagraph()
            .text('Awesome')
            .font('Roboto-Regular', 14)
            .at(50, 100)
            .add();

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertTextlineHasFontMatching('Awesome', 'Roboto-Regular', 14);
        await assertions.assertTextlineHasColor('Awesome', new Color(0, 0, 0));
        await assertions.assertParagraphIsAt('Awesome', 50, 100, 1, 4);
    });
});
test('delete paragraph', async () => {
    const [baseUrl, token, pdfData] = await requireEnvAndFixture('Showcase.pdf');
    const pdf = await PDFDancer.open(pdfData, token, baseUrl);

    const [paragraph] = await pdf.page(1).selectParagraphsStartingWith(SAMPLE_PARAGRAPH);
    await paragraph.delete();

    const remaining = await pdf.page(1).selectParagraphsStartingWith(SAMPLE_PARAGRAPH);
    expect(remaining).toHaveLength(0);
});

test('move paragraph via moveTo', async () => {
    const [baseUrl, token, pdfData] = await requireEnvAndFixture('Showcase.pdf');
    const pdf = await PDFDancer.open(pdfData, token, baseUrl);

    const [paragraph] = await pdf.page(1).selectParagraphsStartingWith(SAMPLE_PARAGRAPH);
    await paragraph.moveTo(0.1, 300);

    const moved = await pdf.page(1).selectParagraphsAt(0.1, 300);
    expect(moved.length).toBeGreaterThan(0);

    const status = moved[0].objectRef().status;
    expect(status).toBeDefined();
    expect(status?.getFontType()).toBe(FontType.EMBEDDED);
    expect(status?.isModified()).toBe(false);
});
