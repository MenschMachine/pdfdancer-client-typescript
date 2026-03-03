import {requireEnvAndFixture} from './test-helpers';
import {PDFDancer} from "../../pdfdancer_v1";
import {BoundingRect} from "../../models";
import {PDFAssertions} from './pdf-assertions';
import {PathGroupObject} from "../../types";

describe('Path Group E2E Tests', () => {

    let baseUrl: string;
    let token: string;
    let pdfData: Uint8Array;
    let pdf: PDFDancer;

    beforeEach(async () => {
        [baseUrl, token, pdfData] = await requireEnvAndFixture('basic-paths.pdf');
        pdf = await PDFDancer.open(pdfData, token, baseUrl);
    });

    async function groupFirstTwo(groupId: string): Promise<PathGroupObject> {
        const paths = await pdf.page(1).selectPaths();
        const pathIds = [paths[0].internalId, paths[1].internalId];
        return pdf.page(1).groupPaths(groupId, pathIds);
    }

    test('create group by path IDs', async () => {
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

    test('group paths auto id', async () => {
        const paths = await pdf.page(1).selectPaths();
        const pathIds = [paths[0].internalId];
        const group = await pdf.page(1).groupPaths(null as any, pathIds);

        expect(group.groupId.startsWith('pathgroup-')).toBe(true);
        expect(group.pathCount).toBe(1);

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertNumberOfPaths(9, 1);
        await assertions.assertPathIsAt('PATH_0_000001', 80, 720);
    });

    test('create group by region', async () => {
        const region = new BoundingRect(70, 710, 100, 100);
        const group = await pdf.page(1).groupPathsInRegion('region-test', region);

        expect(group).toBeDefined();
        expect(group.groupId).toBe('region-test');
        expect(group.pathCount).toBeGreaterThan(0);

        // Region grouping merges matched paths into a single compound path
        const assertions = await PDFAssertions.create(pdf);
        const expectedPaths = 9 - group.pathCount + 1;
        await assertions.assertNumberOfPaths(expectedPaths, 1);
    });

    test('list empty groups', async () => {
        const groups = await pdf.page(1).getPathGroups();
        expect(groups).toBeDefined();
        expect(groups.length).toBe(0);

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertNumberOfPaths(9, 1);
        await assertions.assertPathIsAt('PATH_0_000001', 80, 720);
    });

    test('group and move', async () => {
        const group = await groupFirstTwo('move-test');
        await group.moveTo(200.0, 300.0);

        const groups = await pdf.page(1).getPathGroups();
        expect(groups.length).toBe(1);
        expect(groups[0].x).toBeCloseTo(200.0, 1);
        expect(groups[0].y).toBeCloseTo(300.0, 1);

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertNumberOfPaths(9, 1);
        await assertions.assertNoPathAt(80, 720);
    });

    test('group and remove', async () => {
        const paths = await pdf.page(1).selectPaths();
        const pathIds = [paths[0].internalId];
        const group = await pdf.page(1).groupPaths('remove-test', pathIds);

        let groups = await pdf.page(1).getPathGroups();
        expect(groups.length).toBe(1);

        await group.remove();

        groups = await pdf.page(1).getPathGroups();
        expect(groups.length).toBe(0);

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertNumberOfPaths(8, 1);
        await assertions.assertNoPathAt(80, 720);
    });

    test('scale path group', async () => {
        const paths = await pdf.page(1).selectPaths();
        const pathId = paths[0].internalId;
        const origBounds = paths[0].position.boundingRect!;
        const origW = origBounds.width;
        const origH = origBounds.height;

        const pathIds = [pathId, paths[1].internalId];
        const group = await pdf.page(1).groupPaths('scale-test', pathIds);
        await group.scale(2.0);

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertNumberOfPaths(9, 1);
        await assertions.assertPathHasBounds(pathId, origW * 2, origH * 2, 1, 2.0);
    });

    test('rotate path group', async () => {
        const group = await groupFirstTwo('rotate-test');
        await group.rotate(90.0);

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertNumberOfPaths(9, 1);
        await assertions.assertNoPathAt(80, 720);
    });

    test('resize path group', async () => {
        const paths = await pdf.page(1).selectPaths();
        const path = paths.find(p => {
            const br = p.position.boundingRect;
            return br && br.width > 0 && br.height > 0;
        }) ?? paths[1];
        const pathId = path.internalId;
        const pathIds = [pathId, paths[0].internalId];

        const group = await pdf.page(1).groupPaths('resize-test', pathIds);
        await group.resize(50.0, 50.0);

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertNumberOfPaths(9, 1);

        const reloadedPaths = await assertions.getPdf().page(1).selectPaths();
        const reloaded = reloadedPaths.find(p => p.internalId === pathId)!;
        expect(reloaded).toBeDefined();
        expect(reloaded.position.boundingRect).toBeDefined();
    });

    test('scale via reference', async () => {
        const paths = await pdf.page(1).selectPaths();
        const pathId = paths[0].internalId;
        const origBounds = paths[0].position.boundingRect!;
        const origW = origBounds.width;
        const origH = origBounds.height;

        const pathIds = [pathId, paths[1].internalId];
        const group = await pdf.page(1).groupPaths('scale-ref-test', pathIds);
        await group.scale(0.5);

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertNumberOfPaths(9, 1);
        await assertions.assertPathHasBounds(pathId, origW * 0.5, origH * 0.5, 1, 2.0);
    });

    test('rotate via reference', async () => {
        const group = await groupFirstTwo('rotate-ref-test');
        await group.rotate(45);

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertNumberOfPaths(9, 1);
        await assertions.assertNoPathAt(80, 720);
    });

    test('move and remove via reference', async () => {
        const group = await groupFirstTwo('ref-test');
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
