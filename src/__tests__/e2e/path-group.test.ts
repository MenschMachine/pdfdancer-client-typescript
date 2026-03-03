import {requireEnvAndFixture} from './test-helpers';
import {PDFDancer} from "../../pdfdancer_v1";
import {BoundingRect} from "../../models";
import {PDFAssertions} from './pdf-assertions';

describe('Path Group E2E Tests', () => {

    test('create group by path IDs', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('basic-paths.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const paths = await pdf.page(1).selectPaths();
        expect(paths.length).toBeGreaterThanOrEqual(2);

        const pathIds = [paths[0].internalId, paths[1].internalId];
        const group = await pdf.page(1).groupPaths('by-ids', pathIds);

        expect(group.groupId).toBe('by-ids');
        expect(group.pathCount).toBe(2);
        expect(group.boundingBox).not.toBeNull();

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertNumberOfPaths(9, 1);
        await assertions.assertPathIsAt('PATH_0_000001', 80, 720);
    });

    test('create group by region', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('basic-paths.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const region = new BoundingRect(70, 710, 100, 100);
        const group = await pdf.page(1).groupPathsInRegion('region-test', region);

        expect(group).toBeDefined();
        expect(group.groupId).toBe('region-test');
        expect(group.pathCount).toBeGreaterThan(0);

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertNumberOfPaths(9, 1);
        await assertions.assertPathIsAt('PATH_0_000001', 80, 720);
    });

    test('list empty groups', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('basic-paths.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const groups = await pdf.page(1).getPathGroups();
        expect(groups).toBeDefined();
        expect(groups.length).toBe(0);

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertNumberOfPaths(9, 1);
        await assertions.assertPathIsAt('PATH_0_000001', 80, 720);
    });

    test('group and move', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('basic-paths.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const paths = await pdf.page(1).selectPaths();
        const pathIds = [paths[0].internalId, paths[1].internalId];

        await pdf.page(1).groupPaths('move-test', pathIds);
        await pdf.movePathGroup(0, 'move-test', 200.0, 300.0);

        const groups = await pdf.page(1).getPathGroups();
        expect(groups.length).toBe(1);
        expect(groups[0].x).toBeCloseTo(200.0, 1);
        expect(groups[0].y).toBeCloseTo(300.0, 1);

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertNumberOfPaths(9, 1);
        await assertions.assertNoPathAt(80, 720);
    });

    test('group and remove', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('basic-paths.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const paths = await pdf.page(1).selectPaths();
        const pathIds = [paths[0].internalId];

        await pdf.page(1).groupPaths('remove-test', pathIds);

        let groups = await pdf.page(1).getPathGroups();
        expect(groups.length).toBe(1);

        await pdf.removePathGroup(0, 'remove-test');

        groups = await pdf.page(1).getPathGroups();
        expect(groups.length).toBe(0);

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertNumberOfPaths(8, 1);
        await assertions.assertNoPathAt(80, 720);
    });

    test('scale path group', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('basic-paths.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const paths = await pdf.page(1).selectPaths();
        const pathIds = [paths[0].internalId, paths[1].internalId];

        await pdf.page(1).groupPaths('scale-test', pathIds);
        await pdf.scalePathGroup(0, 'scale-test', 2.0);

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertNumberOfPaths(9, 1);
    });

    test('rotate path group', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('basic-paths.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const paths = await pdf.page(1).selectPaths();
        const pathIds = [paths[0].internalId, paths[1].internalId];

        await pdf.page(1).groupPaths('rotate-test', pathIds);
        await pdf.rotatePathGroup(0, 'rotate-test', 90.0);

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertNumberOfPaths(9, 1);
        await assertions.assertNoPathAt(80, 720);
    });

    test('resize path group', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('basic-paths.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const paths = await pdf.page(1).selectPaths();
        const pathIds = [paths[0].internalId, paths[1].internalId];

        await pdf.page(1).groupPaths('resize-test', pathIds);
        await pdf.resizePathGroup(0, 'resize-test', 50.0, 50.0);

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertNumberOfPaths(9, 1);
    });

    test('scale via reference', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('basic-paths.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const paths = await pdf.page(1).selectPaths();
        const pathIds = [paths[0].internalId, paths[1].internalId];

        const group = await pdf.page(1).groupPaths('scale-ref-test', pathIds);
        await group.scale(0.5);

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertNumberOfPaths(9, 1);
    });

    test('move and remove via reference', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('basic-paths.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const paths = await pdf.page(1).selectPaths();
        const pathIds = [paths[0].internalId, paths[1].internalId];

        const group = await pdf.page(1).groupPaths('ref-test', pathIds);
        await group.moveTo(150.0, 250.0);

        let groups = await pdf.page(1).getPathGroups();
        expect(groups.length).toBe(1);
        expect(groups[0].x).toBeCloseTo(150.0, 1);
        expect(groups[0].y).toBeCloseTo(250.0, 1);

        await group.remove();

        groups = await pdf.page(1).getPathGroups();
        expect(groups.length).toBe(0);

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertNumberOfPaths(7, 1);
        await assertions.assertNoPathAt(80, 720);
    });
});
