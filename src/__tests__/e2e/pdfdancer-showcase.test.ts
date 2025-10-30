import {PDFDancer, ValidationException} from '../../index';
import {readToken, requireEnvAndFixture} from './test-helpers';

describe('PDFDancer Environment Tests (Showcase)', () => {
    test.skip('environment variable handling matches python client', async () => {
        const [baseUrl, , pdfData] = await requireEnvAndFixture('Showcase.pdf');
        const originalBaseUrl = process.env.PDFDANCER_BASE_URL;
        const originalToken = process.env.PDFDANCER_TOKEN;

        try {
            delete process.env.PDFDANCER_TOKEN;

            // TypeScript client currently requires an explicit token; when parity is implemented,
            // this assertion should be updated to match the Python client's anonymous token fallback.
            await expect(PDFDancer.open(pdfData, undefined, baseUrl)).rejects.toThrow(ValidationException);

            process.env.PDFDANCER_TOKEN = readToken() ?? '';
            await expect(PDFDancer.open(pdfData, undefined, baseUrl)).resolves.toBeDefined();

            process.env.PDFDANCER_BASE_URL = 'https://www.google.com';
            await expect(PDFDancer.open(pdfData)).rejects.toThrow();

            process.env.PDFDANCER_BASE_URL = 'https://api.pdfdancer.com';
            delete process.env.PDFDANCER_TOKEN;
            await expect(PDFDancer.open(pdfData)).rejects.toThrow();
        } finally {
            if (originalBaseUrl === undefined) {
                delete process.env.PDFDANCER_BASE_URL;
            } else {
                process.env.PDFDANCER_BASE_URL = originalBaseUrl;
            }

            if (originalToken === undefined) {
                delete process.env.PDFDANCER_TOKEN;
            } else {
                process.env.PDFDANCER_TOKEN = originalToken;
            }
        }
    });
});
