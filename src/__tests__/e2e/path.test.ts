/**
 * E2E tests for path operations (new PDFDancer API)
 */

import {requireEnvAndFixture} from './test-helpers';
import {PDFDancer} from "../../pdfdancer_v1";
import {PDFAssertions} from './pdf-assertions';
import {Color} from "../../models";

describe('Path E2E Tests (New API)', () => {

    test('select paths', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('basic-paths.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const paths = await pdf.selectPaths();
        expect(paths).toHaveLength(9);
        expect(paths[0].type).toBe('PATH');

        const p1 = paths[0];
        expect(p1).toBeDefined();
        expect(p1.internalId).toBe('PATH_0_000001');
        expect(p1.position.getX()).toBeCloseTo(80, 1);
        expect(p1.position.getY()).toBeCloseTo(720, 1);
    });

    test('select paths by position', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('basic-paths.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const paths = await pdf.page(1).selectPathsAt(80, 720);
        expect(paths).toHaveLength(1);
        expect(paths[0].internalId).toBe('PATH_0_000001');
    });

    test('delete path', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('basic-paths.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        let paths = await pdf.page(1).selectPathsAt(80, 720);
        expect(paths).toHaveLength(1);
        expect(paths[0].internalId).toBe('PATH_0_000001');

        const path = paths[0];
        await path.delete();

        const remainingAtOldPos = await pdf.page(1).selectPathsAt(80, 720);
        expect(remainingAtOldPos).toHaveLength(0);

        const allPaths = await pdf.selectPaths();
        expect(allPaths).toHaveLength(8);

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertNoPathAt(80, 720);
        await assertions.assertNumberOfPaths(8);
    });

    test('move path', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('basic-paths.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const [path] = await pdf.page(1).selectPathsAt(80, 720);
        const pos = path.position;
        expect(pos.getX()).toBeCloseTo(80, 1);
        expect(pos.getY()).toBeCloseTo(720, 1);

        await path.moveTo(50.1, 100);

        const oldPos = await pdf.page(1).selectPathsAt(80, 720);
        expect(oldPos).toHaveLength(0);

        const moved = await pdf.page(1).selectPathsAt(50.1, 100);
        const movedPos = moved[0].position;
        expect(movedPos.getX()).toBeCloseTo(50.1, 1);
        expect(movedPos.getY()).toBeCloseTo(100, 1);

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertPathIsAt('PATH_0_000001', 50.1, 100);
    });

    test('change path stroke color', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('basic-paths.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const path = await pdf.page(1).selectPathAt(80, 720);
        expect(path).not.toBeNull();
        expect(path!.internalId).toBe('PATH_0_000001');

        const result = await path!.edit().strokeColor(new Color(255, 0, 0)).apply();
        expect(result.success).toBe(true);

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertPathHasStrokeColor('PATH_0_000001', new Color(255, 0, 0));
        await assertions.assertPathPaintOperator('PATH_0_000001', 'S');
    });

    test('change path fill color on fill-only path', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('basic-paths.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const path = (await pdf.selectPaths()).find(item => item.internalId === 'PATH_0_000004');
        expect(path).toBeDefined();

        const result = await path!.edit().fillColor(new Color(0, 0, 255)).apply();
        expect(result.success).toBe(true);

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertPathHasFillColor('PATH_0_000004', new Color(0, 0, 255));
        await assertions.assertPathPaintOperator('PATH_0_000004', 'f');
    });

    test('add stroke to fill-only path preserves fill and upgrades paint op', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('basic-paths.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const path = (await pdf.selectPaths()).find(item => item.internalId === 'PATH_0_000004');
        expect(path).toBeDefined();

        const result = await path!.edit().strokeColor(new Color(255, 0, 0)).apply();
        expect(result.success).toBe(true);

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertPathPaintOperator('PATH_0_000004', 'B');
        await assertions.assertPathHasStrokeColor('PATH_0_000004', new Color(255, 0, 0));
        await assertions.assertPathHasFillColor('PATH_0_000004', new Color(0, 0, 0));
    });

    test('set path stroke and fill colors simultaneously', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('basic-paths.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const path = (await pdf.selectPaths()).find(item => item.internalId === 'PATH_0_000003');
        expect(path).toBeDefined();

        const result = await path!.edit()
            .strokeColor(new Color(255, 0, 0))
            .fillColor(new Color(0, 0, 255))
            .apply();
        expect(result.success).toBe(true);

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertPathPaintOperator('PATH_0_000003', 'B');
        await assertions.assertPathHasStrokeColor('PATH_0_000003', new Color(255, 0, 0));
        await assertions.assertPathHasFillColor('PATH_0_000003', new Color(0, 0, 255));
    });

    test('example flow edits existing path colors through the fluent editor', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('basic-paths.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const strokeOnlyPath = await pdf.page(1).selectPathAt(80, 720);
        expect(strokeOnlyPath).not.toBeNull();

        const strokeResult = await strokeOnlyPath!.edit()
            .strokeColor(new Color(255, 120, 0))
            .apply();
        expect(strokeResult.success).toBe(true);

        const fillOnlyPath = (await pdf.selectPaths()).find(item => item.internalId === 'PATH_0_000004');
        expect(fillOnlyPath).toBeDefined();

        const fillResult = await fillOnlyPath!.edit()
            .fillColor(new Color(0, 120, 255))
            .strokeColor(new Color(20, 20, 20))
            .apply();
        expect(fillResult.success).toBe(true);

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertPathPaintOperator('PATH_0_000001', 'S');
        await assertions.assertPathHasStrokeColor('PATH_0_000001', new Color(255, 120, 0));
        await assertions.assertPathPaintOperator('PATH_0_000004', 'B');
        await assertions.assertPathHasFillColor('PATH_0_000004', new Color(0, 120, 255));
        await assertions.assertPathHasStrokeColor('PATH_0_000004', new Color(20, 20, 20));
    });

    // Tests for singular select methods
    test('selectPath returns first path or null', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('basic-paths.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        // Test with PDFDancer class (document-level)
        const pathFromPdf = await pdf.selectPath();
        expect(pathFromPdf).not.toBeNull();
        expect(pathFromPdf!.internalId).toBe('PATH_0_000001');

        // Test with page-level using position since paths may require coordinates
        const pathOnPage = await pdf.page(1).selectPathAt(80, 720);
        expect(pathOnPage).not.toBeNull();
        expect(pathOnPage!.internalId).toBe('PATH_0_000001');
    });

    test('selectPathAt returns first path at position or null', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('basic-paths.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const path = await pdf.page(1).selectPathAt(80, 720);
        expect(path).not.toBeNull();
        expect(path!.internalId).toBe('PATH_0_000001');

        // Test with no match
        const noMatch = await pdf.page(1).selectPathAt(1000, 1000);
        expect(noMatch).toBeNull();
    });
});
