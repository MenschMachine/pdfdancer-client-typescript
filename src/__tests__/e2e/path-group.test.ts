import {requireEnvAndFixture} from './test-helpers';
import {PDFDancer} from "../../pdfdancer_v2";
import {BoundingRect} from "../../models";
import {PDFAssertions} from './pdf-assertions';
import {PathGroupObject} from "../../types";
import {pathIdsWithBounds, pathWithBounds} from './path-test-support';

const HORIZONTAL_PATH_BOUNDS = new BoundingRect(80, 720, 220, 0);
const RECTANGLE_PATH_BOUNDS = new BoundingRect(80, 580, 220, 160);

describe('Path Group E2E Tests', () => {

    let baseUrl: string;
    let token: string;
    let pdfData: Uint8Array;
    let pdf: PDFDancer;

    beforeEach(async () => {
        [baseUrl, token, pdfData] = await requireEnvAndFixture('basic-paths.pdf');
        pdf = await PDFDancer.open(pdfData, token, baseUrl);
    });

    async function groupFirstTwo(): Promise<PathGroupObject> {
        const paths = await pdf.page(1).selectPaths();
        const pathIds = pathIdsWithBounds(paths, HORIZONTAL_PATH_BOUNDS, RECTANGLE_PATH_BOUNDS);
        return pdf.page(1).groupPaths(pathIds);
    }

    test('create group by path IDs', async () => {
        const paths = await pdf.page(1).selectPaths();
        expect(paths.length).toBeGreaterThanOrEqual(2);

        const pathIds = pathIdsWithBounds(paths, HORIZONTAL_PATH_BOUNDS, RECTANGLE_PATH_BOUNDS);
        const group = await pdf.page(1).groupPaths(pathIds);

        expect(group.pathCount).toBe(2);
        expect(group.boundingBox).not.toBeNull();

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertNumberOfPaths(9, 1);
        expect((await assertions.getPdf().page(1).selectPathsAt(80, 720))).toHaveLength(1);
    });

    test('create group by region', async () => {
        const region = new BoundingRect(70, 710, 100, 100);
        const group = await pdf.page(1).groupPathsInRegion(region);

        expect(group).toBeDefined();
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
        expect((await assertions.getPdf().page(1).selectPathsAt(80, 720))).toHaveLength(1);
    });

    test('group and move', async () => {
        const group = await groupFirstTwo();
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
        const pathIds = pathIdsWithBounds(paths, HORIZONTAL_PATH_BOUNDS);
        const group = await pdf.page(1).groupPaths(pathIds);

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
        const path = pathWithBounds(paths, HORIZONTAL_PATH_BOUNDS);
        const origBounds = path.position.boundingRect!;
        const origW = origBounds.width;
        const origH = origBounds.height;

        const pathIds = pathIdsWithBounds(paths, HORIZONTAL_PATH_BOUNDS, RECTANGLE_PATH_BOUNDS);
        const group = await pdf.page(1).groupPaths(pathIds);
        await group.scale(2.0);

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertNumberOfPaths(9, 1);
        const resized = (await assertions.getPdf().page(1).selectPaths()).filter(p => {
            const bounds = p.position.boundingRect;
            return bounds && Math.abs(bounds.width - origW * 2) <= 2.0 && Math.abs(bounds.height - origH * 2) <= 2.0;
        });
        expect(resized).toHaveLength(1);
    });

    test('rotate path group', async () => {
        const group = await groupFirstTwo();
        await group.rotate(90.0);

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertNumberOfPaths(9, 1);
        await assertions.assertNoPathAt(80, 720);
    });

    test('resize path group', async () => {
        const paths = await pdf.page(1).selectPaths();
        const path = pathWithBounds(paths, HORIZONTAL_PATH_BOUNDS);
        const originalBounds = path.position.boundingRect!;
        const pathIds = pathIdsWithBounds(paths, HORIZONTAL_PATH_BOUNDS, RECTANGLE_PATH_BOUNDS);

        const group = await pdf.page(1).groupPaths(pathIds);
        await group.resize(50.0, 50.0);

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertNumberOfPaths(9, 1);

        const reloadedPaths = await assertions.getPdf().page(1).selectPaths();
        const horizontalPaths = reloadedPaths.filter(p => Math.abs(p.position.boundingRect?.height ?? Infinity) < 0.1);
        expect(horizontalPaths).toHaveLength(1);
        expect(horizontalPaths[0].position.boundingRect!.width).not.toBeCloseTo(originalBounds.width, 1);
    });

    test('scale via reference', async () => {
        const paths = await pdf.page(1).selectPaths();
        const path = pathWithBounds(paths, HORIZONTAL_PATH_BOUNDS);
        const origBounds = path.position.boundingRect!;
        const origW = origBounds.width;
        const origH = origBounds.height;

        const pathIds = pathIdsWithBounds(paths, HORIZONTAL_PATH_BOUNDS, RECTANGLE_PATH_BOUNDS);
        const group = await pdf.page(1).groupPaths(pathIds);
        await group.scale(0.5);

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertNumberOfPaths(9, 1);
        const resized = (await assertions.getPdf().page(1).selectPaths()).filter(p => {
            const bounds = p.position.boundingRect;
            return bounds && Math.abs(bounds.width - origW * 0.5) <= 2.0 && Math.abs(bounds.height - origH * 0.5) <= 2.0;
        });
        expect(resized).toHaveLength(1);
    });

    test('rotate via reference', async () => {
        const group = await groupFirstTwo();
        await group.rotate(45);

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertNumberOfPaths(9, 1);
        await assertions.assertNoPathAt(80, 720);
    });

    test('move and remove via reference', async () => {
        const group = await groupFirstTwo();
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
