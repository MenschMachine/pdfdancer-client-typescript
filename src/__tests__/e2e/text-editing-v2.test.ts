import {
    PDFDancer,
    PdfAffineTransform,
    PdfColorRequest,
    TextDeleteRequest,
    TextInsertRequest,
    TextLayoutProfile,
    TextReplaceRequest,
    TextStyleRequest
} from '../../index';
import {PDFAssertions} from './pdf-assertions';
import {readImageFixture, requireEnvAndFixture} from './test-helpers';

describe('v2 selector-based text editing', () => {
    let baseUrl: string;
    let token: string;
    let source: Uint8Array;

    beforeAll(async () => {
        [baseUrl, token, source] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
    });

    const open = (): Promise<PDFDancer> => PDFDancer.open(source, token, baseUrl);

    test('document-wide literal replacement persists all matches', async () => {
        const pdf = await open();
        const response = await pdf.text().replace(TextReplaceRequest.literal('Sales Pitch', 'Revenue Pitch').build());

        expect(response.matched).toBe(9);
        expect(response.changed).toBe(9);
        expect(response.pagesChanged?.length).toBeGreaterThan(0);

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertPdfTextOccurrenceCount('Sales Pitch', 0);
        await assertions.assertPdfTextOccurrenceCount('Revenue Pitch', 9);
        await assertions.assertPdfTextContains('Obviously Awesome');
        await assertions.assertPdfTextContains('April Dunford');
    });

    test('page-scoped replacement overrides request pages and leaves other pages unchanged', async () => {
        const pdf = await open();
        const response = await pdf.page(3).text().replace(
            TextReplaceRequest.literal('Sales Pitch', 'Page Scoped Pitch').pages(9).build());

        expect(response.matched).toBe(4);
        expect(response.changed).toBe(4);
        expect(response.pagesChanged).toEqual([3]);

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertPdfTextOccurrenceCount('Page Scoped Pitch', 4, 3);
        await assertions.assertPdfTextOccurrenceCount('Sales Pitch', 0, 3);
        await assertions.assertPdfTextOccurrenceCount('Sales Pitch', 1, 1);
        await assertions.assertPdfTextOccurrenceCount('Sales Pitch', 1, 8);
    });

    test('regex replacement with reflow persists expanded text', async () => {
        const pdf = await open();
        const response = await pdf.text().replace(
            TextReplaceRequest.regex('\\bB2B\\b', 'Business-to-business')
                .reflowWhenSupported(TextLayoutProfile.DEFAULT)
                .build());

        expect(response.matched).toBe(1);
        expect(response.changed).toBe(1);
        expect(response.errors ?? []).toHaveLength(0);

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertPdfTextOccurrenceCount('B2B', 0);
        await assertions.assertPdfTextOccurrenceCount('Business-to-business', 1);
        await assertions.assertPdfTextContains('consumer products');
    });

    test('whole-word and max-match replacement options constrain changes', async () => {
        const pdf = await open();
        const response = await pdf.text().replace(
            TextReplaceRequest.literal('book', 'monograph').wholeWords(true).maxMatches(2).build());

        expect(response.matched).toBe(2);
        expect(response.changed).toBe(2);

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertPdfTextOccurrenceCount('monograph', 2);
        await assertions.assertPdfTextContains('books');
        await assertions.assertPdfTextContains('This Workbook');
    });

    test('case-insensitive replacement persists every selected match', async () => {
        const pdf = await open();
        const response = await pdf.text().replace(
            TextReplaceRequest.literal('april dunford', 'April D.').caseSensitive(false).build());

        expect(response.matched).toBe(3);
        expect(response.changed).toBe(3);

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertPdfTextOccurrenceCount('April Dunford', 0);
        await assertions.assertPdfTextOccurrenceCount('April D.', 3);
        await assertions.assertPdfTextContains('aprildunford.com');
    });

    test('empty replacement behaves as deletion and persists surrounding text', async () => {
        const pdf = await open();
        const response = await pdf.text().replace(
            TextReplaceRequest.literal('Please do not distribute this workbook', '').build());

        expect(response.matched).toBe(1);
        expect(response.changed).toBe(1);

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertPdfTextOccurrenceCount('Please do not distribute this workbook', 0);
        await assertions.assertPdfTextContains('I like to make updates');
        await assertions.assertPdfTextContains('April Dunford');
    });

    test('no-match replacement returns zero diagnostics and preserves the PDF', async () => {
        const pdf = await open();
        const response = await pdf.text().replace(
            TextReplaceRequest.literal('DOES_NOT_EXIST_IN_WORKBOOK', 'SHOULD_NOT_APPEAR').build());

        expect(response.matched).toBe(0);
        expect(response.changed).toBe(0);

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertPdfTextOccurrenceCount('SHOULD_NOT_APPEAR', 0);
        await assertions.assertPdfTextOccurrenceCount('Sales Pitch', 9);
    });

    test('image replacement persists generated image geometry and diagnostics', async () => {
        const pdf = await open();
        const response = await pdf.text().replace(TextReplaceRequest.builder()
            .literal('Please do not distribute this workbook')
            .maxMatches(1)
            .replaceWithImage(
                readImageFixture('logo-80.png'),
                PdfAffineTransform.builder().scale(20, 10).translate(3, -2).build())
            .build());

        expect(response.matched).toBe(1);
        expect(response.changed).toBe(1);
        expect(response.change?.[0].operation).toBe('replaceWithImage');
        expect(response.change?.[0].generatedElementIds).toHaveLength(1);
        const imageId = response.change![0].generatedElementIds![0];

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertPdfTextDoesNotContain('Please do not distribute this workbook');
        await assertions.assertImageSize(imageId, 20, 10, response.change![0].page, 1);
    });

    test('delete supports case-insensitive document selection', async () => {
        const pdf = await open();
        const response = await pdf.text().delete(
            TextDeleteRequest.literal('april dunford').caseSensitive(false).build());

        expect(response.matched).toBe(3);
        expect(response.changed).toBe(3);

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertPdfTextOccurrenceCount('April Dunford', 0);
        await assertions.assertPdfTextContains('aprildunford.com');
    });

    test('delete honors whole-word and max-match constraints', async () => {
        const pdf = await open();
        const response = await pdf.text().delete(
            TextDeleteRequest.literal('book').wholeWords(true).maxMatches(2).build());

        expect(response.matched).toBe(2);
        expect(response.changed).toBe(2);

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertPdfTextOccurrenceCount('books', 9);
        await assertions.assertPdfTextContains('This Workbook');
    });

    test('delete no-match response preserves the saved PDF', async () => {
        const pdf = await open();
        const response = await pdf.text().delete(
            TextDeleteRequest.literal('DOES_NOT_EXIST_IN_WORKBOOK').build());

        expect(response.matched).toBe(0);
        expect(response.changed).toBe(0);

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertPdfTextOccurrenceCount('Sales Pitch', 9);
        await assertions.assertPdfTextContains('Obviously Awesome');
    });

    test('implicit-layout insertion persists and preserves selected text', async () => {
        const pdf = await open();
        const response = await pdf.text().insert(
            TextInsertRequest.before('B2B', 'Modern ').wholeWords(true).build());

        expect(response.matched).toBe(1);
        expect(response.changed).toBe(1);

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertPdfTextOccurrenceCount('Modern', 1);
        await assertions.assertPdfTextOccurrenceCount('B2B', 1);
        await assertions.assertPdfTextContains('consumer products');
    });

    test('source-anchored insertion persists and preserves selected text', async () => {
        const pdf = await open();
        const response = await pdf.text().insert(
            TextInsertRequest.before('B2B', 'Modern ').wholeWords(true).sourceAnchored().build());

        expect(response.matched).toBe(1);
        expect(response.changed).toBe(1);
        expect(response.change?.[0]).toMatchObject({
            requestedLayoutMode: 'sourceAnchored',
            appliedLayoutMode: 'SOURCE_ANCHORED'
        });

        const assertions = await PDFAssertions.create(pdf);
        // PDF text extraction orders positioned drawing operations independently;
        // the response diagnostics establish the BEFORE anchor relationship.
        await assertions.assertPdfTextOccurrenceCount('Modern', 1);
        await assertions.assertPdfTextOccurrenceCount('B2B', 1);
        await assertions.assertPdfTextContains('consumer products');
    });

    test('reflow-when-supported insertion persists and preserves selected text', async () => {
        const pdf = await open();
        const response = await pdf.text().insert(
            TextInsertRequest.before('B2B', 'Modern ')
                .wholeWords(true)
                .reflowWhenSupported(TextLayoutProfile.DEFAULT)
                .build());

        expect(response.matched).toBe(1);
        expect(response.changed).toBe(1);
        expect(response.change).toHaveLength(1);
        expect(response.change?.[0]).toMatchObject({
            requestedLayoutMode: 'reflowWhenSupported',
            requestedLayoutProfile: 'default',
            appliedLayoutMode: 'REFLOWED'
        });
        expect(response.errors ?? []).toHaveLength(0);

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertPdfTextOccurrenceCount('Modern', 1);
        await assertions.assertPdfTextOccurrenceCount('B2B', 1);
        await assertions.assertPdfTextContains('consumer products');
    });

    test('insert honors whole-word and max-match constraints', async () => {
        const pdf = await open();
        const response = await pdf.text().insert(
            TextInsertRequest.after('book', ' item').wholeWords(true).maxMatches(2).build());

        expect(response.matched).toBe(2);
        expect(response.changed).toBe(2);

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertPdfTextOccurrenceCount('item', 2);
        await assertions.assertPdfTextOccurrenceCount('books', 9);
        await assertions.assertPdfTextContains('This Workbook');
    });

    test('insert no-match response preserves the saved PDF', async () => {
        const pdf = await open();
        const response = await pdf.text().insert(
            TextInsertRequest.after('DOES_NOT_EXIST_IN_WORKBOOK', ' SHOULD_NOT_APPEAR').build());

        expect(response.matched).toBe(0);
        expect(response.changed).toBe(0);

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertPdfTextOccurrenceCount('SHOULD_NOT_APPEAR', 0);
        await assertions.assertPdfTextOccurrenceCount('Sales Pitch', 9);
    });

    test('coordinate insertion persists with an explicit complete style patch', async () => {
        const pdf = await open();
        const response = await pdf.text().insert(
            TextInsertRequest.at(1, 72, 720, 'Coordinate Text')
                .font('Helvetica-Bold')
                .size(12)
                .fillColor(PdfColorRequest.rgb(0.8, 0.1, 0.1))
                .build());

        expect(response.changed).toBe(1);
        expect(response.errors ?? []).toHaveLength(0);

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertPdfTextOccurrenceCount('Coordinate Text', 1, 1);
        await assertions.assertPdfUsesFont('Helvetica-Bold');
    });

    test('style applies atomic font, color, and spacing fields without changing text', async () => {
        const pdf = await open();
        const response = await pdf.text().style(TextStyleRequest.literal('Before we begin')
            .font('Helvetica-Bold')
            .size(12)
            .fillColor(PdfColorRequest.rgb(0.8, 0.1, 0.1))
            .strokeColor(PdfColorRequest.gray(0))
            .characterSpacing(0.5)
            .wordSpacing(1)
            .build());

        expect(response.matched).toBe(1);
        expect(response.changed).toBe(1);
        expect(response.errors ?? []).toHaveLength(0);

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertPdfTextContains('Differentiated Value');
        await assertions.assertPdfUsesFont('Helvetica-Bold');
    });

    test('run-filter styling selects the intended text run', async () => {
        const pdf = await open();
        const response = await pdf.text().style(TextStyleRequest.runsWhere()
            .whereTextContains('B2B')
            .fillColor(PdfColorRequest.rgb(1, 0, 0))
            .build());

        expect(response.matched).toBe(1);
        expect(response.changed).toBe(1);

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertPdfTextOccurrenceCount('B2B', 1);
        await assertions.assertPdfTextContains('consumer products');
    });

    test('style honors whole-word and max-match constraints without changing text', async () => {
        const pdf = await open();
        const response = await pdf.text().style(TextStyleRequest.literal('book')
            .wholeWords(true).maxMatches(2)
            .fillColor(PdfColorRequest.rgb(0, 0.5, 0)).build());

        expect(response.matched).toBe(2);
        expect(response.changed).toBe(2);

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertPdfTextOccurrenceCount('books', 9);
        await assertions.assertPdfTextContains('This Workbook');
    });

    test('style no-match response preserves the saved PDF', async () => {
        const pdf = await open();
        const response = await pdf.text().style(TextStyleRequest.literal('DOES_NOT_EXIST_IN_WORKBOOK')
            .fillColor(PdfColorRequest.rgb(1, 0, 0)).build());

        expect(response.matched).toBe(0);
        expect(response.changed).toBe(0);

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertPdfTextOccurrenceCount('Sales Pitch', 9);
        await assertions.assertPdfTextContains('Obviously Awesome');
    });

    test('required reflow exposes applied-layout and hyphenation diagnostics', async () => {
        const pdf = await open();
        const response = await pdf.text().replace(TextReplaceRequest.literal('Assumptions', 'Operating Context')
            .requireReflow(TextLayoutProfile.BODY_TEXT)
            .hyphenationEnabled(false)
            .build());

        expect(response.matched).toBe(2);
        expect(response.changed).toBe(2);
        expect(response.change).toHaveLength(2);
        for (const change of response.change ?? []) {
            expect(change.requestedLayoutMode).toBe('requireReflow');
            expect(change.requestedLayoutProfile).toBe('bodyText');
            expect(change.effectiveHyphenationEnabled).toBe(false);
            expect(change.appliedLayoutMode).toBe('REFLOWED');
        }
        expect(response.errors ?? []).toHaveLength(0);

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertPdfTextOccurrenceCount('Assumptions', 0);
        await assertions.assertPdfTextOccurrenceCount('Operating Context', 2);
    });
});
