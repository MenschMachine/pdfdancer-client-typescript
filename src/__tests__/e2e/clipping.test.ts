import {requireEnvAndFixture} from './test-helpers';
import {PDFDancer} from '../../pdfdancer_v1';
import {PDFAssertions} from './pdf-assertions';

const CLIPPING_FIXTURE = 'invisible-content-clipping-test.pdf';
const TARGET_PATH_ID = 'PATH_0_000004';
const CONTROL_PATH_ID = 'PATH_0_000003';
const CLIPPED_TEXT = 'Clipped endstream endobj text line';
const MULTI_STREAM_CLIPPED_TEXT = 'Clipped text line from second stream';

function createPdfWithContentStreams(contentStreams: string[]): Uint8Array {
    const contentObjectIds = contentStreams.map((_, index) => 5 + index);
    const contentsEntry = contentObjectIds.length === 1
        ? `${contentObjectIds[0]} 0 R`
        : `[${contentObjectIds.map(id => `${id} 0 R`).join(' ')}]`;

    const objects: Array<{ id: number; body: string }> = [
        {id: 1, body: '<< /Type /Catalog /Pages 2 0 R >>'},
        {id: 2, body: '<< /Type /Pages /Kids [3 0 R] /Count 1 >>'},
        {
            id: 3,
            body: `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents ${contentsEntry} >>`
        },
        {id: 4, body: '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'}
    ];

    contentStreams.forEach((contentStream, index) => {
        objects.push({
            id: contentObjectIds[index],
            body: `<< /Length ${Buffer.byteLength(contentStream, 'latin1')} >>\nstream\n${contentStream}endstream`
        });
    });

    let pdf = '%PDF-1.4\n';
    const offsets: number[] = [0];
    for (const object of objects) {
        offsets[object.id] = Buffer.byteLength(pdf, 'latin1');
        pdf += `${object.id} 0 obj\n${object.body}\nendobj\n`;
    }

    const xrefOffset = Buffer.byteLength(pdf, 'latin1');
    pdf += `xref\n0 ${objects.length + 1}\n`;
    pdf += '0000000000 65535 f \n';
    for (let objectId = 1; objectId <= objects.length; objectId += 1) {
        pdf += `${offsets[objectId].toString().padStart(10, '0')} 00000 n \n`;
    }
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

    return new Uint8Array(Buffer.from(pdf, 'latin1'));
}

function createClippedTextPdf(): Uint8Array {
    const clippedTextStream = [
        'q',
        '0 0 50 50 re',
        'W n',
        'BT',
        '/F1 24 Tf',
        '1 0 0 1 200 400 Tm',
        `(${CLIPPED_TEXT}) Tj`,
        'ET',
        'Q',
        ''
    ].join('\n');

    return createPdfWithContentStreams([clippedTextStream]);
}

function createMultiStreamClippedTextPdf(): Uint8Array {
    const clippingSetupStream = [
        'q',
        '0 0 50 50 re',
        'W n',
        ''
    ].join('\n');
    const clippedTextStream = [
        'BT',
        '/F1 24 Tf',
        '1 0 0 1 200 400 Tm',
        `(${MULTI_STREAM_CLIPPED_TEXT}) Tj`,
        'ET',
        'Q',
        ''
    ].join('\n');

    return createPdfWithContentStreams([clippingSetupStream, clippedTextStream]);
}

describe('Clear Clipping E2E Tests', () => {
    let baseUrl: string;
    let token: string;
    let pdfData: Uint8Array;
    let pdf: PDFDancer;

    beforeEach(async () => {
        [baseUrl, token, pdfData] = await requireEnvAndFixture(CLIPPING_FIXTURE);
        pdf = await PDFDancer.open(pdfData, token, baseUrl);
    });

    test('clear clipping via path reference', async () => {
        const paths = await pdf.page(1).selectPaths();
        const path = paths.find(pathObject => pathObject.internalId === TARGET_PATH_ID);
        expect(path).toBeDefined();

        const beforeAssertions = await PDFAssertions.create(pdf);
        await beforeAssertions.assertPathHasClipping(TARGET_PATH_ID);
        await beforeAssertions.assertPathHasClipping(CONTROL_PATH_ID);
        await beforeAssertions.assertNumberOfPaths(3, 1);

        expect(await path!.clearClipping()).toBe(true);

        const afterAssertions = await PDFAssertions.create(pdf);
        await afterAssertions.assertPathHasNoClipping(TARGET_PATH_ID);
        await afterAssertions.assertPathHasClipping(CONTROL_PATH_ID);
        await afterAssertions.assertNumberOfPaths(3, 1);
    });

    test('clear clipping via PDFDancer objectRef API', async () => {
        const paths = await pdf.page(1).selectPaths();
        const path = paths.find(pathObject => pathObject.internalId === TARGET_PATH_ID);
        expect(path).toBeDefined();

        const beforeAssertions = await PDFAssertions.create(pdf);
        await beforeAssertions.assertPathHasClipping(TARGET_PATH_ID);

        expect(await pdf.clearClipping(path!.objectRef())).toBe(true);

        const afterAssertions = await PDFAssertions.create(pdf);
        await afterAssertions.assertPathHasNoClipping(TARGET_PATH_ID);
        await afterAssertions.assertPathHasClipping(CONTROL_PATH_ID);
    });

    test('clear path-group clipping via reference', async () => {
        const beforeAssertions = await PDFAssertions.create(pdf);
        await beforeAssertions.assertPathHasClipping(TARGET_PATH_ID);
        await beforeAssertions.assertPathHasClipping(CONTROL_PATH_ID);

        const group = await pdf.page(1).groupPaths([TARGET_PATH_ID]);
        expect(await group.clearClipping()).toBe(true);

        const afterAssertions = await PDFAssertions.create(pdf);
        await afterAssertions.assertPathHasNoClipping(TARGET_PATH_ID);
        await afterAssertions.assertPathHasClipping(CONTROL_PATH_ID);
        await afterAssertions.assertNumberOfPaths(3, 1);
    });

    test('clear path-group clipping via PDFDancer API', async () => {
        const beforeAssertions = await PDFAssertions.create(pdf);
        await beforeAssertions.assertPathHasClipping(TARGET_PATH_ID);
        await beforeAssertions.assertPathHasClipping(CONTROL_PATH_ID);

        const group = await pdf.page(1).groupPaths([TARGET_PATH_ID]);
        expect(await pdf.clearPathGroupClipping(1, group.groupId)).toBe(true);

        const afterAssertions = await PDFAssertions.create(pdf);
        await afterAssertions.assertPathHasNoClipping(TARGET_PATH_ID);
        await afterAssertions.assertPathHasClipping(CONTROL_PATH_ID);
        await afterAssertions.assertNumberOfPaths(3, 1);
    });

    test('clear clipping via image reference', async () => {
        const image = (await pdf.page(1).selectImages())[0];
        expect(image).toBeDefined();

        const beforeAssertions = await PDFAssertions.create(pdf);
        await beforeAssertions.assertImageHasClipping(image.internalId);
        await beforeAssertions.assertPathHasClipping(TARGET_PATH_ID);

        expect(await image.clearClipping()).toBe(true);

        const afterAssertions = await PDFAssertions.create(pdf);
        await afterAssertions.assertImageHasNoClipping(image.internalId);
        await afterAssertions.assertPathHasClipping(TARGET_PATH_ID);
        await afterAssertions.assertImageWithIdAt(image.internalId, 200, 400);
    });

    test('clear clipping via text-line reference', async () => {
        const clippedTextPdf = await PDFDancer.open(createClippedTextPdf(), token, baseUrl);
        const line = await clippedTextPdf.page(1).selectTextLineStartingWith(CLIPPED_TEXT);
        expect(line).toBeDefined();

        const beforeAssertions = await PDFAssertions.create(clippedTextPdf);
        await beforeAssertions.assertTextlineHasClipping(CLIPPED_TEXT);

        expect(await line!.clearClipping()).toBe(true);

        const afterAssertions = await PDFAssertions.create(clippedTextPdf);
        await afterAssertions.assertTextlineHasNoClipping(CLIPPED_TEXT);
        await afterAssertions.assertTextlineExists(CLIPPED_TEXT);
    });

    test('detects clipping across multiple content streams', async () => {
        const clippedTextPdf = await PDFDancer.open(createMultiStreamClippedTextPdf(), token, baseUrl);
        const line = await clippedTextPdf.page(1).selectTextLineStartingWith(MULTI_STREAM_CLIPPED_TEXT);
        expect(line).toBeDefined();

        const beforeAssertions = await PDFAssertions.create(clippedTextPdf);
        await beforeAssertions.assertTextlineHasClipping(MULTI_STREAM_CLIPPED_TEXT);

        expect(await line!.clearClipping()).toBe(true);

        const afterAssertions = await PDFAssertions.create(clippedTextPdf);
        await afterAssertions.assertTextlineHasNoClipping(MULTI_STREAM_CLIPPED_TEXT);
        await afterAssertions.assertTextlineExists(MULTI_STREAM_CLIPPED_TEXT);
    });
});
