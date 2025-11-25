/**
 * E2E tests for page operations
 */

import {ObjectType, PDFDancer} from '../../index';
import {requireEnvAndFixture} from './test-helpers';
import {PDFAssertions} from './pdf-assertions';

describe('Page E2E Tests', () => {
    // Tests should fail properly if environment is not configured

    test('get pages', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const client = await PDFDancer.open(pdfData, token, baseUrl);

        const pages = await client.pages();
        expect(pages).toBeDefined();
        expect(pages[0].type).toBe(ObjectType.PAGE);
        expect(pages).toHaveLength(12);
    });

    test('get page', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const client = await PDFDancer.open(pdfData, token, baseUrl);

        const page = client.page(2);
        expect(page).toBeDefined();
        expect(page!.position.pageNumber).toBe(2);
        expect(page!.internalId).toBeDefined();
    });

    test('delete page', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const client = await PDFDancer.open(pdfData, token, baseUrl);

        expect(await client.pages()).toHaveLength(12);
        const page3 = client.page(3);
        expect(page3).toBeDefined();
        expect(await page3.delete()).toBe(true);

        const newPages = await client.pages();
        expect(newPages).toHaveLength(11);

        const assertions = await PDFAssertions.create(client);
        await assertions.assertPageCount(11);
    });
});
