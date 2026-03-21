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

        const result = await path!.edit().strokeColor(new Color(255, 0, 0)).apply();
        expect(result.success).toBe(true);

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertPathStrokeColor('PATH_0_000001', new Color(255, 0, 0), 1);
        await assertions.assertPathPaintOperator('PATH_0_000001', ['S', 's'], 1);
    });

    test('change path fill color', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('basic-paths.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const path = (await pdf.selectPaths()).find(item => item.internalId === 'PATH_0_000004');
        expect(path).toBeDefined();

        const result = await path!.edit().fillColor(new Color(0, 0, 255)).apply();
        expect(result.success).toBe(true);

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertPathFillColor('PATH_0_000004', new Color(0, 0, 255), 1);
        await assertions.assertPathPaintOperator('PATH_0_000004', ['f', 'F', 'f*'], 1);
    });

    test('add stroke to fill-only path', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('basic-paths.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const path = (await pdf.selectPaths()).find(item => item.internalId === 'PATH_0_000004');
        expect(path).toBeDefined();

        const result = await path!.edit().strokeColor(new Color(255, 0, 0)).apply();
        expect(result.success).toBe(true);

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertPathStrokeColor('PATH_0_000004', new Color(255, 0, 0), 1);
        await assertions.assertPathFillColor('PATH_0_000004', new Color(0, 0, 0), 1);
        await assertions.assertPathPaintOperator('PATH_0_000004', ['B', 'B*', 'b', 'b*'], 1);
    });

    test('set path stroke and fill simultaneously', async () => {
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
        await assertions.assertPathStrokeColor('PATH_0_000003', new Color(255, 0, 0), 1);
        await assertions.assertPathFillColor('PATH_0_000003', new Color(0, 0, 255), 1);
        await assertions.assertPathPaintOperator('PATH_0_000003', ['B', 'B*', 'b', 'b*'], 1);
    });

    test('reusing one path edit session resets staged changes after apply', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('basic-paths.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const path = await pdf.page(1).selectPathAt(80, 720);
        expect(path).not.toBeNull();

        const session = path!.edit();

        const firstResult = await session.strokeColor(new Color(255, 0, 0)).apply();
        expect(firstResult.success).toBe(true);

        const noOpResult = await session.apply();
        expect(noOpResult).toEqual({
            commandName: 'ModifyPath',
            elementId: 'PATH_0_000001',
            message: null,
            success: true,
            warning: null
        });

        const secondResult = await session.fillColor(new Color(0, 0, 255)).apply();
        expect(secondResult.success).toBe(true);

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertPathStrokeColor('PATH_0_000001', new Color(255, 0, 0), 1);
        await assertions.assertPathFillColor('PATH_0_000001', new Color(0, 0, 255), 1);
        await assertions.assertPathPaintOperator('PATH_0_000001', ['B', 'B*', 'b', 'b*'], 1);
    });

    test('change path colors preserves stroke and fill alpha', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('basic-paths.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const path = (await pdf.selectPaths()).find(item => item.internalId === 'PATH_0_000003');
        expect(path).toBeDefined();

        const stroke = new Color(255, 0, 0, 128);
        const fill = new Color(0, 0, 255, 64);
        const result = await path!.edit().strokeColor(stroke).fillColor(fill).apply();
        expect(result.success).toBe(true);

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertPathStrokeColor('PATH_0_000003', stroke, 1);
        await assertions.assertPathFillColor('PATH_0_000003', fill, 1);
        await assertions.assertPathStrokeOpacity('PATH_0_000003', stroke.a / 255, 1);
        await assertions.assertPathFillOpacity('PATH_0_000003', fill.a / 255, 1);
        await assertions.assertPathPaintOperator('PATH_0_000003', ['B', 'B*', 'b', 'b*'], 1);
    });

    test('apply with no edits is a no-op', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('basic-paths.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const path = await pdf.page(1).selectPathAt(80, 720);
        expect(path).not.toBeNull();

        const result = await path!.edit().apply();
        expect(result.success).toBe(true);

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertNumberOfPaths(9);
        await assertions.assertPathIsAt('PATH_0_000001', 80, 720, 1, 1);
        await assertions.assertPathStrokeColor('PATH_0_000001', new Color(0, 0, 0), 1);
        await assertions.assertPathPaintOperator('PATH_0_000001', ['S', 's'], 1);
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
