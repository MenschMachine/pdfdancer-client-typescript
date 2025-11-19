import {Color, PDFDancer, StandardFonts} from '../../index';
import {requireEnvAndFixture} from './test-helpers';
import {PDFAssertions} from './pdf-assertions';

const SAMPLE_PARAGRAPH = 'This is regular Sans text showing alignment and styles.';

describe('Paragraph Edit Session E2E Tests (Showcase)', () => {
    test('basic usage', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('Showcase.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const paragraphs = await pdf.selectParagraphs();
        expect(paragraphs.length).toBeGreaterThanOrEqual(20);
        expect(paragraphs.length).toBeLessThanOrEqual(22);
    });

    test('edit text only', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('Showcase.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const [paragraph] = await pdf.page(0).selectParagraphsStartingWith(SAMPLE_PARAGRAPH);
        await paragraph.edit().replace('This is replaced\ntext on two lines').apply();

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertTextlineExists('This is replaced', 0);
        await assertions.assertTextlineExists('text on two lines', 0);
        await assertions.assertTextlineDoesNotExist(SAMPLE_PARAGRAPH, 0);
    });

    test('edit font only', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('Showcase.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const [paragraph] = await pdf.page(0).selectParagraphsStartingWith(SAMPLE_PARAGRAPH);
        await paragraph.edit().font('Helvetica', 28).apply();

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertTextlineHasFont(SAMPLE_PARAGRAPH, 'Helvetica', 28);
        await assertions.assertTextlineHasColor(SAMPLE_PARAGRAPH, new Color(0, 0, 0));
    });

    test('edit text and font', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('Showcase.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const [paragraph] = await pdf.page(0).selectParagraphsStartingWith(SAMPLE_PARAGRAPH);
        await paragraph.edit().replace('New Text\nHere').font('Helvetica', 16).apply();

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertTextlineHasFont('New Text', 'Helvetica', 16);
        await assertions.assertTextlineHasFont('Here', 'Helvetica', 16);
        await assertions.assertTextlineDoesNotExist(SAMPLE_PARAGRAPH);
    });

    test('edit all properties', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('Showcase.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const [paragraph] = await pdf.page(0).selectParagraphsStartingWith(SAMPLE_PARAGRAPH);
        await paragraph.edit()
            .replace('Fully\nModified')
            .font('Helvetica', 18)
            .color(new Color(255, 0, 0))
            .lineSpacing(1.5)
            .moveTo(100, 200)
            .apply();

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertTextlineHasFont('Fully', 'Helvetica', 18);
        await assertions.assertTextlineHasFont('Modified', 'Helvetica', 18);
        await assertions.assertTextlineHasColor('Fully', new Color(255, 0, 0));
        await assertions.assertTextlineHasColor('Modified', new Color(255, 0, 0));
        await assertions.assertParagraphIsAt('Fully', 100, 200, 0);
    });

    test('edit color only', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('Showcase.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const [paragraph] = await pdf.page(0).selectParagraphsStartingWith(SAMPLE_PARAGRAPH);
        await paragraph.edit().color(new Color(0, 255, 0)).apply();

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertTextlineHasColor(SAMPLE_PARAGRAPH, new Color(0, 255, 0));
    });

    test('edit line spacing only', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('Showcase.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const [paragraph] = await pdf.page(0).selectParagraphsStartingWith(SAMPLE_PARAGRAPH);
        await paragraph.edit().lineSpacing(2.0).apply();

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertTextlineExists(SAMPLE_PARAGRAPH);
    });

    test('edit move only', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('Showcase.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const [paragraph] = await pdf.page(0).selectParagraphsStartingWith(SAMPLE_PARAGRAPH);
        await paragraph.edit().moveTo(150, 300).apply();

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertTextlineHasFont(SAMPLE_PARAGRAPH, 'AAAZPH+Roboto-Regular', 12);
        await assertions.assertParagraphIsAt(SAMPLE_PARAGRAPH, 150, 300, 0);
    });

    test('multiple edits sequential', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('Showcase.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const [first] = await pdf.page(0).selectParagraphsStartingWith(SAMPLE_PARAGRAPH);
        await first.edit().replace('First Edit').apply();

        const [second] = await pdf.page(0).selectParagraphsStartingWith('First Edit');
        await second.edit().replace('Second Edit').font('Helvetica', 20).apply();

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertTextlineHasFont('Second Edit', 'Helvetica', 20);
        await assertions.assertTextlineDoesNotExist('First Edit');
        await assertions.assertTextlineDoesNotExist(SAMPLE_PARAGRAPH);
    });

    test('edit multiple paragraphs', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('Showcase.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const paragraphs = await pdf.page(0).selectParagraphs();
        await paragraphs[0].edit().replace('Modified First').font('Helvetica', 14).apply();
        await paragraphs[1].edit().replace('Modified Second').font('Helvetica', 14).apply();

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertTextlineHasFont('Modified First', 'Helvetica', 14);
        await assertions.assertTextlineHasFont('Modified Second', 'Helvetica', 14);
    });

    test('edit with exception does not apply', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('Showcase.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const [paragraph] = await pdf.page(0).selectParagraphsStartingWith(SAMPLE_PARAGRAPH);
        const editor = paragraph.edit();
        editor.replace('Should Fail');

        await expect(async () => {
            throw new Error('boom');
        }).rejects.toThrow('boom');

        const remaining = await pdf.page(0).selectParagraphsStartingWith(SAMPLE_PARAGRAPH);
        expect(remaining.length).toBeGreaterThan(0);
    });

    test('nested PDF and edit sessions', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('Showcase.pdf');
        const pdf1 = await PDFDancer.open(pdfData, token, baseUrl);
        const pdf2 = await PDFDancer.new({initialPageCount: 1}, token, baseUrl);

        await pdf2.page(0).newParagraph()
            .text('Temporary Text')
            .font(StandardFonts.HELVETICA, 12)
            .at(50, 50)
            .apply();

        const [paragraph] = await pdf1.page(0).selectParagraphsStartingWith(SAMPLE_PARAGRAPH);
        await paragraph.edit().replace('Nested Edit').apply();

        const assertions = await PDFAssertions.create(pdf1);
        await assertions.assertTextlineExists('Nested Edit');
    });

    test('edit preserves position when not specified', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('Showcase.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const [paragraph] = await pdf.page(0).selectParagraphsStartingWith(SAMPLE_PARAGRAPH);
        const original = paragraph.position;
        await paragraph.edit().replace('No Move').apply();

        const [updated] = await pdf.page(0).selectParagraphsStartingWith('No Move');
        expect(updated.position.getX()).toBeCloseTo(original.getX()!, 5);
        expect(updated.position.getY()).toBeCloseTo(original.getY()!, 5);
    });

    test('edit chaining', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('Showcase.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const [paragraph] = await pdf.page(0).selectParagraphsStartingWith(SAMPLE_PARAGRAPH);
        await paragraph.edit()
            .replace('Chained\nEdits')
            .font('Helvetica', 15)
            .color(new Color(128, 128, 128))
            .lineSpacing(1.8)
            .apply();

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertTextlineHasFont('Chained', 'Helvetica', 15);
        await assertions.assertTextlineHasFont('Edits', 'Helvetica', 15);
        await assertions.assertTextlineHasColor('Chained', new Color(128, 128, 128));
    });

    test('edit with standard fonts', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('Showcase.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const [paragraph] = await pdf.page(0).selectParagraphsStartingWith(SAMPLE_PARAGRAPH);
        await paragraph.edit().replace('Times Roman').font(StandardFonts.TIMES_ROMAN, 18).apply();

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertTextlineHasFont('Times Roman', StandardFonts.TIMES_ROMAN, 18);
    });

    test('edit with multiline text', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('Showcase.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const [paragraph] = await pdf.page(0).selectParagraphsStartingWith(SAMPLE_PARAGRAPH);
        await paragraph.edit().replace('Line 1\nLine 2').font('Helvetica', 12).apply();

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertTextlineExists('Line 1');
        await assertions.assertTextlineExists('Line 2');
    });

    test('edit with empty text', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('Showcase.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const [paragraph] = await pdf.page(0).selectParagraphsStartingWith(SAMPLE_PARAGRAPH);
        await paragraph.edit().replace('').font('Helvetica', 12).apply();

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertTextlineDoesNotExist(SAMPLE_PARAGRAPH);
    });

    test('example from docs', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('Showcase.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const [paragraph] = await pdf.page(0).selectParagraphsStartingWith(SAMPLE_PARAGRAPH);
        await paragraph.edit().replace('Awesomely\nObvious!').font('Helvetica', 12).apply();

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertTextlineHasFont('Awesomely', 'Helvetica', 12);
        await assertions.assertTextlineHasFont('Obvious!', 'Helvetica', 12);
        await assertions.assertTextlineDoesNotExist(SAMPLE_PARAGRAPH);
    });

    test('vs manual apply', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('Showcase.pdf');
        const pdf1 = await PDFDancer.open(pdfData, token, baseUrl);

        const [paragraph1] = await pdf1.page(0).selectParagraphsStartingWith(SAMPLE_PARAGRAPH);
        await paragraph1.edit().replace('Test Text').font('Helvetica', 14).color(new Color(255, 0, 0)).apply();

        const assertions1 = await PDFAssertions.create(pdf1);
        await assertions1.assertTextlineHasFont('Test Text', 'Helvetica', 14);

        const pdf2 = await PDFDancer.open(pdfData, token, baseUrl);
        const [paragraph2] = await pdf2.page(0).selectParagraphsStartingWith(SAMPLE_PARAGRAPH);
        await paragraph2.edit().replace('Test Text').font('Helvetica', 14).color(new Color(255, 0, 0)).apply();

        const assertions2 = await PDFAssertions.create(pdf2);
        await assertions2.assertTextlineHasFont('Test Text', 'Helvetica', 14);
    });
});
