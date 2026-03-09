import {requireEnvAndFixture} from './test-helpers';
import {PDFDancer} from '../../pdfdancer_v1';
import {PDFAssertions} from './pdf-assertions';

const CLIPPING_FIXTURE = 'invisible-content-clipping-test.pdf';
const TARGET_PATH_ID = 'PATH_0_000004';
const CONTROL_PATH_ID = 'PATH_0_000003';

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
});
