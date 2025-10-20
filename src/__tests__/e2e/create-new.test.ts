/**
 * E2E tests for creating new PDF documents
 */

import {PDFDancer, Orientation} from '../../index';
import {getBaseUrl, readToken, serverUp} from './test-helpers';

describe('Create New PDF E2E Tests', () => {
    let baseUrl: string;
    let token: string;

    beforeAll(async () => {
        baseUrl = getBaseUrl();
        const tokenValue = readToken();

        if (!await serverUp(baseUrl)) {
            throw new Error(`PDFDancer server not reachable at ${baseUrl}; set PDFDANCER_BASE_URL or start server`);
        }

        if (!tokenValue) {
            throw new Error('PDFDANCER_TOKEN not set and no token file found; set env or place jwt-token-*.txt in repo');
        }

        token = tokenValue;
    });

    test('create new PDF with defaults', async () => {
        const client = await PDFDancer.new(undefined, token, baseUrl);

        expect(client).toBeDefined();

        const pages = await client.pages();
        expect(pages).toBeDefined();
        expect(pages).toHaveLength(1);
    });

    test('create new PDF with custom page size', async () => {
        const client = await PDFDancer.new(
            { pageSize: 'LETTER' },
            token,
            baseUrl
        );

        expect(client).toBeDefined();

        const pages = await client.pages();
        expect(pages).toHaveLength(1);
    });

    test('create new PDF with landscape orientation', async () => {
        const client = await PDFDancer.new(
            { orientation: Orientation.LANDSCAPE },
            token,
            baseUrl
        );

        expect(client).toBeDefined();

        const pages = await client.pages();
        expect(pages).toHaveLength(1);
    });

    test('create new PDF with multiple pages', async () => {
        const client = await PDFDancer.new(
            { initialPageCount: 3 },
            token,
            baseUrl
        );

        expect(client).toBeDefined();

        const pages = await client.pages();
        expect(pages).toHaveLength(3);
    });

    test('create new PDF with all custom options', async () => {
        const client = await PDFDancer.new(
            {
                pageSize: 'A3',
                orientation: Orientation.LANDSCAPE,
                initialPageCount: 5
            },
            token,
            baseUrl
        );

        expect(client).toBeDefined();

        const pages = await client.pages();
        expect(pages).toHaveLength(5);
    });
});
