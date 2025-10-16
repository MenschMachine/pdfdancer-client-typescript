/**
 * E2E tests for page operations
 */

import {ObjectType, PDFDancer} from '../../index';
import {requireEnvAndFixture} from './test-helpers';

describe('Page E2E Tests', () => {
    // Tests should fail properly if environment is not configured

    test('get pages', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const client = await PDFDancer.open(pdfData, token, baseUrl, 30000);

        const pages = await client.getPages();
        expect(pages).toBeDefined();
        expect(pages[0].type).toBe(ObjectType.PAGE);
        expect(pages).toHaveLength(12);
    });

    test('get page', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const client = await PDFDancer.open(pdfData, token, baseUrl, 30000);

        const page = await client.getPage(2);
        expect(page).toBeDefined();
        expect(page!.position.pageIndex).toBe(2);
        expect(page!.internalId).toBeDefined();
    });

    test('delete page', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const client = await PDFDancer.open(pdfData, token, baseUrl, 30000);

        const page3 = await client.getPage(3);
        expect(page3).toBeDefined();
        expect(await client.deletePage(page3!)).toBe(true);

        const newPages = await client.getPages();
        expect(newPages).toHaveLength(11);
    });
});
