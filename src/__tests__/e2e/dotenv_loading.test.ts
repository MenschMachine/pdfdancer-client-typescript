import * as fs from 'fs';
import * as path from 'path';
import {PDFDancer} from "../../pdfdancer_v1";
import {requireEnvAndFixture} from "./test-helpers";

describe('.env file loading E2E Tests', () => {
    let originalToken: string | undefined;
    let originalBaseUrl: string | undefined;
    let baseUrl: string;
    let pdfData: Uint8Array;
    let validToken: string;
    let tempEnvPath: string;
    let originalEnvContent: string | null;

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

        if (originalEnvContent !== null) {
            fs.writeFileSync(tempEnvPath, originalEnvContent);
        } else if (fs.existsSync(tempEnvPath)) {
            fs.unlinkSync(tempEnvPath);
        }
    };

    beforeAll(async () => {
        originalToken = process.env.PDFDANCER_API_TOKEN;
        originalBaseUrl = process.env.PDFDANCER_BASE_URL;
        tempEnvPath = path.resolve(process.cwd(), '.env');
        originalEnvContent = fs.existsSync(tempEnvPath) ? fs.readFileSync(tempEnvPath, 'utf-8') : null;

        [baseUrl, validToken, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
    });

    beforeEach(() => {
        delete process.env.PDFDANCER_API_TOKEN;
        delete process.env.PDFDANCER_BASE_URL;
        if (fs.existsSync(tempEnvPath)) {
            fs.unlinkSync(tempEnvPath);
        }
    });

    afterEach(() => {
        restoreEnv();
    });

    afterAll(() => {
        restoreEnv();
    });

    test('loads token from .env file', async () => {
        fs.writeFileSync(tempEnvPath, `PDFDANCER_API_TOKEN=${validToken}\nPDFDANCER_BASE_URL=${baseUrl}\n`);

        const client = await PDFDancer.open(pdfData);
        expect(client).toBeInstanceOf(PDFDancer);
    });

    test('direct parameter overrides .env file', async () => {
        fs.writeFileSync(tempEnvPath, `PDFDANCER_API_TOKEN=wrong-token\nPDFDANCER_BASE_URL=wrong-url\n`);

        const client = await PDFDancer.open(pdfData, validToken, baseUrl);
        expect(client).toBeInstanceOf(PDFDancer);
    });

    test('works without .env file using anonymous token', async () => {
        const client = await PDFDancer.open(pdfData, undefined, baseUrl);
        expect(client).toBeInstanceOf(PDFDancer);
    });
});
