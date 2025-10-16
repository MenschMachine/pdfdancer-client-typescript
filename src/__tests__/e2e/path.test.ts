/**
 * E2E tests for path operations (new PDFDancer API)
 */

import {requireEnvAndFixture} from './test-helpers';
import {PDFDancer} from "../../pdfdancer_v1";

describe('Path E2E Tests (New API)', () => {

    test('select paths', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('basic-paths.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl, 30000);

        const paths = await pdf.selectPaths();
        expect(paths).toHaveLength(9);
        expect(paths[0].type).toBe('PATH');

        const p1 = paths[0];
        expect(p1).toBeDefined();
        expect(p1.internalId).toBe('PATH_000001');
        expect(p1.position.getX()).toBeCloseTo(80, 1);
        expect(p1.position.getY()).toBeCloseTo(720, 1);
    });

    test('select paths by position', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('basic-paths.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl, 30000);

        const paths = await pdf.page(0).selectPathsAt(80, 720);
        expect(paths).toHaveLength(1);
        expect(paths[0].internalId).toBe('PATH_000001');
    });

    test('delete path', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('basic-paths.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl, 30000);

        let paths = await pdf.page(0).selectPathsAt(80, 720);
        expect(paths).toHaveLength(1);
        expect(paths[0].internalId).toBe('PATH_000001');

        const path = paths[0];
        await path.delete();

        const remainingAtOldPos = await pdf.page(0).selectPathsAt(80, 720);
        expect(remainingAtOldPos).toHaveLength(0);

        const allPaths = await pdf.selectPaths();
        expect(allPaths).toHaveLength(8);
    });

    test('move path', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('basic-paths.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl, 30000);

        const [path] = await pdf.page(0).selectPathsAt(80, 720);
        const pos = path.position;
        expect(pos.getX()).toBeCloseTo(80, 1);
        expect(pos.getY()).toBeCloseTo(720, 1);

        await path.moveTo(50.1, 100);

        const oldPos = await pdf.page(0).selectPathsAt(80, 720);
        expect(oldPos).toHaveLength(0);

        const moved = await pdf.page(0).selectPathsAt(50.1, 100);
        const movedPos = moved[0].position;
        expect(movedPos.getX()).toBeCloseTo(50.1, 1);
        expect(movedPos.getY()).toBeCloseTo(100, 1);
    });
});
