import {requireEnvAndFixture} from "./test-helpers";
import {PDFDancer} from "../../pdfdancer_v1";
import {HttpClientException, ValidationException} from "../../exceptions";

describe('Env Token E2E Tests', () => {
    let originalToken: string | undefined;
    let originalBaseUrl: string | undefined;
    let baseUrl: string;
    let pdfData: Uint8Array;
    let validToken: string;

    const restoreEnv = () => {
        if (originalToken !== undefined) {
            process.env.PDFDANCER_API_TOKEN = originalToken;
        } else {
            delete process.env.PDFDANCER_API_TOKEN;
        }

        if (originalBaseUrl !== undefined) {
            process.env.PDFDANCER_BASE_URL = originalBaseUrl;
        } else {
            delete process.env.PDFDANCER_BASE_URL;
        }
    };

    beforeAll(async () => {
        originalToken = process.env.PDFDANCER_API_TOKEN;
        originalBaseUrl = process.env.PDFDANCER_BASE_URL;

        [baseUrl, validToken, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
    });

    beforeEach(() => {
        restoreEnv();
    });

    afterEach(() => {
        restoreEnv();
    });

    afterAll(() => {
        restoreEnv();
    });

    test('opens with token from env', async () => {
        process.env.PDFDANCER_API_TOKEN = validToken;
        const client = await PDFDancer.open(pdfData, undefined, baseUrl);
        expect(client).toBeInstanceOf(PDFDancer);
    });

    test('fails with unreachable base url', async () => {
        process.env.PDFDANCER_API_TOKEN = validToken;
        process.env.PDFDANCER_BASE_URL = "http://www.google.com";

        await expect(async () => {
            try {
                await PDFDancer.open(pdfData);
            } catch (error) {
                expect(error).toBeInstanceOf(HttpClientException);
                throw error;
            }
        }).rejects.toThrow(HttpClientException);
    });

    test('fails with invalid token', async () => {
        process.env.PDFDANCER_API_TOKEN = "invalid-token";
        process.env.PDFDANCER_BASE_URL = "https://api.pdfdancer.com";

        await expect(async () => {
            try {
                await PDFDancer.open(pdfData);
            } catch (error) {
                expect(error).toBeInstanceOf(ValidationException);
                expect((error as Error).message)
                    .toContain("Authentication with the PDFDancer API failed. Confirm that your API token is valid, has not expired");
                throw error;
            }
        }).rejects.toThrow(ValidationException);
    });
});
