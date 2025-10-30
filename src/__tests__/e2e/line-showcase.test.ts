import {FontType, PDFDancer} from '../../index';
import {requireEnvAndFixture} from './test-helpers';
import {PDFAssertions} from './pdf-assertions';

const SAMPLE_PARAGRAPH = 'This is regular Sans text showing alignment and styles.';

describe('Text Line E2E Tests (Showcase)', () => {
    test('find lines by position multi', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('Showcase.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl, 60000);

        for (let i = 0; i < 10; i++) {
            const lines = await pdf.selectTextLines();
            for (const line of lines) {
                const status = line.objectRef().status;
                expect(status).toBeDefined();
                expect(status?.isModified()).toBe(false);
                expect(status?.isEncodable()).toBe(true);
            }
        }
    });

    test('find lines by position', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('Showcase.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl, 60000);

        const lines = await pdf.selectTextLines();
        expect(lines.length).toBe(36);

        const first = lines[0];
        expect(first.internalId).toBe('TEXTLINE_000001');
        expect(first.position).toBeDefined();
        expect(Math.abs(first.position.getX()! - 180)).toBeLessThanOrEqual(1);
        expect(Math.abs(first.position.getY()! - 750)).toBeLessThanOrEqual(1);
        expect(first.objectRef().status?.isModified()).toBe(false);
        expect(first.objectRef().status?.isEncodable()).toBe(true);

        const last = lines[lines.length - 1];
        expect(last.internalId).toBe('TEXTLINE_000036');
        expect(Math.abs(last.position.getX()! - 69.3)).toBeLessThanOrEqual(2);
        expect(Math.abs(last.position.getY()! - 45)).toBeLessThanOrEqual(2);
        expect(last.objectRef().status?.isModified()).toBe(false);
        expect(last.objectRef().status?.isEncodable()).toBe(true);
    });

    test('find lines by text', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('Showcase.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl, 60000);

        const lines = await pdf.page(0).selectTextLinesStartingWith(SAMPLE_PARAGRAPH);
        expect(lines.length).toBe(1);

        const line = lines[0];
        expect(line.internalId).toBe('TEXTLINE_000002');
        expect(Math.abs(line.position.getX()! - 65)).toBeLessThanOrEqual(1);
        expect(Math.abs(line.position.getY()! - 706.8)).toBeLessThanOrEqual(2);
    });

    test('delete line', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('Showcase.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl, 60000);

        const [line] = await pdf.page(0).selectTextLinesStartingWith(SAMPLE_PARAGRAPH);
        await line.delete();

        const remaining = await pdf.page(0).selectTextLinesStartingWith(SAMPLE_PARAGRAPH);
        expect(remaining.length).toBe(0);

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertTextlineDoesNotExist(SAMPLE_PARAGRAPH);
    });

    test('move line', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('Showcase.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl, 60000);

        const [line] = await pdf.page(0).selectTextLinesStartingWith(SAMPLE_PARAGRAPH);
        const pos = line.position;
        const newX = pos.getX()! + 100;
        const newY = pos.getY()! + 18;

        await line.moveTo(newX, newY);

        const moved = (await pdf.page(0).selectTextLinesAt(newX, newY, 1))[0];
        const status = moved.objectRef().status;
        expect(status).toBeDefined();
        expect(status?.isEncodable()).toBe(true);
        expect(status?.getFontType()).toBe(FontType.EMBEDDED);
        expect(status?.isModified()).toBe(false);

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertTextlineIsAt(SAMPLE_PARAGRAPH, newX, newY);
    });

    test('modify line', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('Showcase.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl, 60000);

        const [line] = await pdf.page(0).selectTextLinesStartingWith(SAMPLE_PARAGRAPH);
        await line.edit().text(' replaced ').apply();

        expect(await pdf.page(0).selectTextLinesStartingWith(SAMPLE_PARAGRAPH)).toHaveLength(0);
        expect(await pdf.page(0).selectParagraphsStartingWith(' replaced ')).not.toHaveLength(0);

        const lines = await pdf.page(0).selectTextLinesStartingWith(' replaced ');
        expect(lines.length).toBeGreaterThan(0);
        const status = lines[0].objectRef().status;
        expect(status).toBeDefined();
        expect(status?.isEncodable()).toBe(true);
        expect(status?.getFontType()).toBe(FontType.EMBEDDED);
        expect(status?.isModified()).toBe(true);

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertTextlineDoesNotExist(SAMPLE_PARAGRAPH);
        await assertions.assertTextlineExists(' replaced ');
        await assertions.assertParagraphExists(' replaced ');
    });
});
