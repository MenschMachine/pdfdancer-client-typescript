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

        // Grouping without move should not change the PDF
        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertNumberOfPaths(9, 1);
        await assertions.assertPathIsAt('PATH_0_000001', 80, 720);
    });

    test('group paths auto id', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('basic-paths.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

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

        // Paths should have moved away from original positions
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

        // Removing a group deletes its paths from the PDF
        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertNumberOfPaths(8, 1);
        await assertions.assertNoPathAt(80, 720);
    });

    test('scale path group', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('basic-paths.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const paths = await pdf.page(1).selectPaths();
        const pathId = paths[0].internalId;
        const pathIds = [pathId, paths[1].internalId];

        // Record original bounds
        const origBounds = paths[0].position.boundingRect!;
        const origW = origBounds.width;
        const origH = origBounds.height;

        await pdf.page(1).groupPaths('scale-test', pathIds);
        await pdf.scalePathGroup(0, 'scale-test', 2.0);

        // After scaling 2x, path bounds should roughly double
        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertNumberOfPaths(9, 1);
        await assertions.assertPathHasBounds(pathId, origW * 2, origH * 2, 1, 2.0);
    });

    test('rotate path group', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('basic-paths.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const paths = await pdf.page(1).selectPaths();
        const pathIds = [paths[0].internalId, paths[1].internalId];

        await pdf.page(1).groupPaths('rotate-test', pathIds);
        await pdf.rotatePathGroup(0, 'rotate-test', 90.0);

        // Paths should have moved from original positions after 90° rotation
        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertNumberOfPaths(9, 1);
        await assertions.assertNoPathAt(80, 720);
    });

    test('resize path group', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('basic-paths.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const paths = await pdf.page(1).selectPaths();
        // Use paths that have non-zero bounding rects for meaningful resize
        const path = paths.find(p => {
            const br = p.position.boundingRect;
            return br && br.width > 0 && br.height > 0;
        }) ?? paths[1]; // fall back to second path
        const pathId = path.internalId;
        const pathIds = [pathId, paths[0].internalId];

        await pdf.page(1).groupPaths('resize-test', pathIds);
        await pdf.resizePathGroup(0, 'resize-test', 50.0, 50.0);

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertNumberOfPaths(9, 1);

        // Verify the resized path still exists with a bounding rect
        const reloadedPaths = await assertions.getPdf().page(1).selectPaths();
        const reloaded = reloadedPaths.find(p => p.internalId === pathId)!;
        expect(reloaded).toBeDefined();
        expect(reloaded.position.boundingRect).toBeDefined();
    });

    test('scale via reference', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('basic-paths.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const paths = await pdf.page(1).selectPaths();
        const pathId = paths[0].internalId;
        const pathIds = [pathId, paths[1].internalId];

        // Record original bounds
        const origBounds = paths[0].position.boundingRect!;
        const origW = origBounds.width;
        const origH = origBounds.height;

        const group = await pdf.page(1).groupPaths('scale-ref-test', pathIds);
        await group.scale(0.5);

        // After scaling 0.5x, path bounds should roughly halve
        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertNumberOfPaths(9, 1);
        await assertions.assertPathHasBounds(pathId, origW * 0.5, origH * 0.5, 1, 2.0);
    });

    test('rotate via reference', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('basic-paths.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const paths = await pdf.page(1).selectPaths();
        const pathIds = [paths[0].internalId, paths[1].internalId];

        const group = await pdf.page(1).groupPaths('rotate-ref-test', pathIds);
        await group.rotate(45);

        // 45° rotation should move paths from original position
        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertNumberOfPaths(9, 1);
        await assertions.assertNoPathAt(80, 720);
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

        // Move then remove: paths are deleted from the PDF
        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertNumberOfPaths(7, 1);
        await assertions.assertNoPathAt(80, 720);
    });
});
