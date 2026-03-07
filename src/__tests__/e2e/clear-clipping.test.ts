import {PDFDancer} from "../../pdfdancer_v1";
import {PDFAssertions} from "./pdf-assertions";
import {requireEnvAndFixture} from "./test-helpers";

describe('Clear Clipping E2E Tests', () => {

    test('clear clipping on text line keeps line editable and movable', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const [line] = await pdf.page(1).selectTextLinesStartingWith('The Complete');
        expect(line).toBeDefined();

        const cleared = await line.clearClipping();
        expect(cleared).toBe(true);

        const newX = 140.0;
        const newY = 300.0;
        const moved = await line.moveTo(newX, newY);
        expect(moved).toBe(true);

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertTextlineIsAt('The Complete', newX, newY, 1, 0.5);
        await assertions.assertTextlineHasFontMatching('The Complete', 'Poppins-Bold', 45, 1);
    });

    test('clear clipping on paragraph remains idempotent and preserves text', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const [paragraph] = await pdf.page(1).selectParagraphsStartingWith('The Complete');
        expect(paragraph).toBeDefined();

        expect(await paragraph.clearClipping()).toBe(true);
        expect(await paragraph.clearClipping()).toBe(true);

        const newX = 90.0;
        const newY = 260.0;
        expect(await paragraph.moveTo(newX, newY)).toBe(true);

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertParagraphExists('The Complete', 1);
        const moved = await assertions.getPdf().page(1).selectParagraphsAt(newX, newY, 30);
        expect(moved.length).toBeGreaterThan(0);
        expect(moved[0].getText()).toContain('The Complete');
        expect(moved[0].position.getX()).toBeCloseTo(newX, 1);
    });

    test('clear clipping on path preserves move behavior and path count', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('basic-paths.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const [path] = await pdf.page(1).selectPathsAt(80, 720);
        expect(path).toBeDefined();
        expect(path.internalId).toBe('PATH_0_000001');

        const cleared = await path.clearClipping();
        expect(cleared).toBe(true);

        const movedX = 50.1;
        const movedY = 100.0;
        expect(await path.moveTo(movedX, movedY)).toBe(true);

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertPathIsAt('PATH_0_000001', movedX, movedY, 1, 0.5);
        await assertions.assertNumberOfPaths(9, 1);
    });

    test('clear clipping on path group keeps group transformable', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('basic-paths.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const paths = await pdf.page(1).selectPaths();
        const group = await pdf.page(1).groupPaths([paths[0].internalId, paths[1].internalId]);
        expect(group.pathCount).toBe(2);

        expect(await group.clearClipping()).toBe(true);
        expect(await group.moveTo(210.0, 310.0)).toBe(true);

        const groups = await pdf.page(1).getPathGroups();
        expect(groups).toHaveLength(1);
        expect(groups[0].x).toBeCloseTo(210.0, 1);
        expect(groups[0].y).toBeCloseTo(310.0, 1);

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertNumberOfPaths(9, 1);
        await assertions.assertNoPathAt(80, 720, 1);
    });
});
