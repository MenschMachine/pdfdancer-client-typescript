import {FontType, PDFDancer} from '../../index';
import {requireEnvAndFixture} from './test-helpers';
import {PDFAssertions} from './pdf-assertions';

const SAMPLE_PARAGRAPH = 'This is regular Sans text showing alignment and styles.';
const SHOWCASE_TITLE = 'PDFDancer Showcase';
const SHOWCASE_FOOTER = 'Showcase.pdf';
const REPLACEMENT_LINE = 'REPLACED_LINE_TEXT';

describe('Text Line E2E Tests (Showcase)', () => {
    test('find lines by position multi', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('Showcase.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        for (let i = 0; i < 10; i++) {
            const lines = await pdf.selectTextLines();
            for (const line of lines) {
                const status = line.objectRef().status;
                expect(status).toBeDefined();
                expect(status?.isModified()).toBe(false);
            }
        }
    });

    test('find lines by position', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('Showcase.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const lines = await pdf.selectTextLines();
        expect(lines.length).toBeGreaterThan(0);

        const [title] = await pdf.page(1).selectTextLinesStartingWith(SHOWCASE_TITLE);
        expect(title).toBeDefined();
        expect(title.position).toBeDefined();
        expect(Math.abs(title.position.getX()! - 180)).toBeLessThanOrEqual(1);
        expect(Math.abs(title.position.getY()! - 750)).toBeLessThanOrEqual(1);
        expect(title.objectRef().status?.isModified()).toBe(false);

        const [footer] = await pdf.page(1).selectTextLinesStartingWith(SHOWCASE_FOOTER);
        expect(footer).toBeDefined();
        expect(Math.abs(footer.position.getX()! - 69.3)).toBeLessThanOrEqual(2);
        expect(Math.abs(footer.position.getY()! - 45)).toBeLessThanOrEqual(2);
        expect(footer.objectRef().status?.isModified()).toBe(false);
    });

    test('find lines by text', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('Showcase.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const lines = await pdf.page(1).selectTextLinesStartingWith(SAMPLE_PARAGRAPH);
        expect(lines.length).toBe(1);

        const line = lines[0];
        expect(Math.abs(line.position.getX()! - 65)).toBeLessThanOrEqual(1);
        expect(Math.abs(line.position.getY()! - 706.8)).toBeLessThanOrEqual(2);
    });

    test('delete line', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('Showcase.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const [line] = await pdf.page(1).selectTextLinesStartingWith(SAMPLE_PARAGRAPH);
        await line.delete();

        const remaining = await pdf.page(1).selectTextLinesStartingWith(SAMPLE_PARAGRAPH);
        expect(remaining.length).toBe(0);

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertTextlineDoesNotExist(SAMPLE_PARAGRAPH);
    });

    test('move line', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('Showcase.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const [line] = await pdf.page(1).selectTextLinesStartingWith(SAMPLE_PARAGRAPH);
        const pos = line.position;
        const newX = pos.getX()! + 100;
        const newY = pos.getY()! + 18;

        await line.moveTo(newX, newY);

        const moved = (await pdf.page(1).selectTextLinesAt(newX, newY, 1))[0];
        const status = moved.objectRef().status;
        expect(status).toBeDefined();
        expect(status?.getFontType()).toBe(FontType.EMBEDDED);
        expect(status?.isModified()).toBe(false);

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertTextlineIsAt(SAMPLE_PARAGRAPH, newX, newY);
    });

    test('modify line', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('Showcase.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const [line] = await pdf.page(1).selectTextLinesStartingWith(SAMPLE_PARAGRAPH);
        await line.edit().text(REPLACEMENT_LINE).apply();

        expect(await pdf.page(1).selectTextLinesStartingWith(SAMPLE_PARAGRAPH)).toHaveLength(0);
        expect(await pdf.page(1).selectParagraphsStartingWith(REPLACEMENT_LINE)).not.toHaveLength(0);

        const lines = await pdf.page(1).selectTextLinesStartingWith(REPLACEMENT_LINE);
        expect(lines.length).toBeGreaterThan(0);
        const status = lines[0].objectRef().status;
        expect(status).toBeDefined();
        expect(status?.getFontType()).toBe(FontType.EMBEDDED);
        expect(status?.isModified()).toBe(true);

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertTextlineDoesNotExist(SAMPLE_PARAGRAPH);
        await assertions.assertTextlineExists(REPLACEMENT_LINE);
        await assertions.assertParagraphExists(REPLACEMENT_LINE);
    });
});
