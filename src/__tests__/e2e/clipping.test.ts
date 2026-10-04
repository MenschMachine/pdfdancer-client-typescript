import {requireEnvAndFixture} from './test-helpers';
import {PDFDancer} from '../../pdfdancer_v2';
import {BoundingRect} from '../../models';
import {PDFAssertions} from './pdf-assertions';
import {pathWithBounds as selectPathWithBounds} from './path-test-support';

const CLIPPING_FIXTURE = 'invisible-content-clipping-test.pdf';
// The fixture's blue circle is the target; its red stroked rectangle is the control path.
const TARGET_PATH_BOUNDS = new BoundingRect(260, 460, 80, 80);
const CONTROL_PATH_BOUNDS = new BoundingRect(100, 300, 120, 80);

async function findPathWithBounds(pdf: PDFDancer, bounds: BoundingRect) {
    const paths = await pdf.page(1).selectPaths();
    return selectPathWithBounds(paths, bounds);
}

async function assertPathClipping(pdf: PDFDancer, bounds: BoundingRect, clipped: boolean) {
    const assertions = await PDFAssertions.create(pdf);
    // PDFAssertions saves and reopens the document, which can regenerate path IDs.
    const path = await findPathWithBounds(assertions.getPdf(), bounds);
    if (clipped) {
        await assertions.assertPathHasClipping(path.internalId);
    } else {
        await assertions.assertPathHasNoClipping(path.internalId);
    }
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
        const path = await findPathWithBounds(pdf, TARGET_PATH_BOUNDS);

        await assertPathClipping(pdf, TARGET_PATH_BOUNDS, true);
        await assertPathClipping(pdf, CONTROL_PATH_BOUNDS, true);
        const beforeAssertions = await PDFAssertions.create(pdf);
        await beforeAssertions.assertNumberOfPaths(3, 1);

        expect(await path.clearClipping()).toBe(true);

        await assertPathClipping(pdf, TARGET_PATH_BOUNDS, false);
        await assertPathClipping(pdf, CONTROL_PATH_BOUNDS, true);
        const afterAssertions = await PDFAssertions.create(pdf);
        await afterAssertions.assertNumberOfPaths(3, 1);
    });

    test('clear clipping via PDFDancer objectRef API', async () => {
        const path = await findPathWithBounds(pdf, TARGET_PATH_BOUNDS);

        await assertPathClipping(pdf, TARGET_PATH_BOUNDS, true);
        await assertPathClipping(pdf, CONTROL_PATH_BOUNDS, true);

        expect(await pdf.clearClipping(path.objectRef())).toBe(true);

        await assertPathClipping(pdf, TARGET_PATH_BOUNDS, false);
        await assertPathClipping(pdf, CONTROL_PATH_BOUNDS, true);
    });

    test('clear path-group clipping via reference', async () => {
        await assertPathClipping(pdf, TARGET_PATH_BOUNDS, true);
        await assertPathClipping(pdf, CONTROL_PATH_BOUNDS, true);

        const path = await findPathWithBounds(pdf, TARGET_PATH_BOUNDS);
        const group = await pdf.page(1).groupPaths([path.internalId]);
        expect(await group.clearClipping()).toBe(true);

        await assertPathClipping(pdf, TARGET_PATH_BOUNDS, false);
        await assertPathClipping(pdf, CONTROL_PATH_BOUNDS, true);
        const afterAssertions = await PDFAssertions.create(pdf);
        await afterAssertions.assertNumberOfPaths(3, 1);
    });

    test('clear path-group clipping via PDFDancer API', async () => {
        await assertPathClipping(pdf, TARGET_PATH_BOUNDS, true);
        await assertPathClipping(pdf, CONTROL_PATH_BOUNDS, true);

        const path = await findPathWithBounds(pdf, TARGET_PATH_BOUNDS);
        const group = await pdf.page(1).groupPaths([path.internalId]);
        expect(await pdf.clearPathGroupClipping(1, group.groupId)).toBe(true);

        await assertPathClipping(pdf, TARGET_PATH_BOUNDS, false);
        await assertPathClipping(pdf, CONTROL_PATH_BOUNDS, true);
        const afterAssertions = await PDFAssertions.create(pdf);
        await afterAssertions.assertNumberOfPaths(3, 1);
    });

    test('clear clipping via image reference', async () => {
        const image = (await pdf.page(1).selectImages())[0];
        expect(image).toBeDefined();

        const beforeAssertions = await PDFAssertions.create(pdf);
        await beforeAssertions.assertImageHasClipping(image.internalId);
        await assertPathClipping(pdf, TARGET_PATH_BOUNDS, true);

        expect(await image.clearClipping()).toBe(true);

        const afterAssertions = await PDFAssertions.create(pdf);
        await afterAssertions.assertImageHasNoClipping(image.internalId);
        await assertPathClipping(pdf, TARGET_PATH_BOUNDS, true);
        await afterAssertions.assertImageWithIdAt(image.internalId, 200, 400);
    });

});
