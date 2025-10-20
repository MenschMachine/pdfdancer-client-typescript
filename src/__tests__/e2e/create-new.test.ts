/**
 * E2E tests for creating new PDF documents
 */

import {Color, Orientation, PDFDancer, StandardFonts} from '../../index';
import {getBaseUrl, readToken, serverUp} from './test-helpers';
import {expectWithin} from '../assertions';
import {PDFAssertions} from './pdf-assertions';

describe('Create New PDF E2E Tests', () => {
    let baseUrl: string;
    let token: string;

    beforeAll(async () => {
        baseUrl = getBaseUrl();
        const tokenValue = readToken();

        if (!await serverUp(baseUrl)) {
            throw new Error(`PDFDancer server not reachable at ${baseUrl}; set PDFDANCER_BASE_URL or start server`);
        }

        if (!tokenValue) {
            throw new Error('PDFDANCER_TOKEN not set and no token file found; set env or place jwt-token-*.txt in repo');
        }

        token = tokenValue;
    });

    const expectPdfSignature = (bytes: Uint8Array) => {
        expect(bytes.length).toBeGreaterThan(4);
        const signature = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
        expect(signature).toBe('%PDF');
    };

    test('create new PDF with defaults', async () => {
        const client = await PDFDancer.new(undefined, token, baseUrl);

        const pages = await client.pages();
        expect(pages).toHaveLength(1);

        const bytes = await client.getBytes();
        expectPdfSignature(bytes);

        const assertions = await PDFAssertions.create(client);
        await assertions.assertTotalNumberOfElements(0);
    });

    test('create new PDF with custom params', async () => {
        const client = await PDFDancer.new(
            {
                pageSize: 'A4',
                orientation: Orientation.LANDSCAPE,
                initialPageCount: 3
            },
            token,
            baseUrl
        );

        const pages = await client.pages();
        expect(pages).toHaveLength(3);

        const assertions = await PDFAssertions.create(client);
        await assertions.assertTotalNumberOfElements(0);
        await assertions.assertPageCount(3);
        for (let index = 0; index < pages.length; index++) {
            await assertions.assertPageDimension(842.0, 595.0, undefined, index);
        }
    });

    test('create new PDF with string params', async () => {
        const client = await PDFDancer.new(
            {
                pageSize: 'LETTER',
                orientation: Orientation.PORTRAIT,
                initialPageCount: 2
            },
            token,
            baseUrl
        );

        const pages = await client.pages();
        expect(pages).toHaveLength(2);

        const assertions = await PDFAssertions.create(client);
        await assertions.assertTotalNumberOfElements(0);
        await assertions.assertPageCount(2);
        for (let index = 0; index < pages.length; index++) {
            await assertions.assertPageDimension(612.0, 792.0, Orientation.PORTRAIT, index);
        }
    });

    test('create new PDF add content and verify placement', async () => {
        const client = await PDFDancer.new(undefined, token, baseUrl);

        await client.page(0)
            .newParagraph()
            .text('Hello from blank PDF')
            .font(StandardFonts.COURIER_BOLD_OBLIQUE, 9)
            .color(new Color(0, 255, 0))
            .at(100, 201.5)
            .apply();

        const paragraphs = await client.selectParagraphs();
        expect(paragraphs).toHaveLength(1);
        const paragraph = paragraphs[0];
        expect(paragraph.getText()).toContain('Hello from blank PDF');
        expect(paragraph.getFontName()).toBe(StandardFonts.COURIER_BOLD_OBLIQUE);
        expectWithin(paragraph.getFontSize(), 9, 1e-6);
        expect(paragraph.getColor()).toEqual(new Color(0, 255, 0));

        expectWithin(paragraph.position.getX()!, 100, 1e-6);
        expectWithin(paragraph.position.getY()!, 201.5, 1e-6);

        const textLines = await (await client.pages())[0].selectTextLines();
        expect(textLines).toHaveLength(1);
        expect(textLines[0].getText()).toContain('Hello from blank PDF');

        const assertions = await PDFAssertions.create(client);
        await assertions.assertPageCount(1);
        await assertions.assertTotalNumberOfElements(2);
        await assertions.assertParagraphIsAt('Hello from blank PDF', 100, 201.5);
        await assertions.assertTextHasFont('Hello from blank PDF', StandardFonts.COURIER_BOLD_OBLIQUE, 9);
        await assertions.assertTextHasColor('Hello from blank PDF', new Color(0, 255, 0));
    });

    test('create new PDF rejects invalid page count', async () => {
        await expect(PDFDancer.new(
            {initialPageCount: 0},
            token,
            baseUrl
        )).rejects.toThrow('Initial page count must be at least 1');
    });
});
