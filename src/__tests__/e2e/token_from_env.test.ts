import {requireEnvAndFixture} from "./test-helpers";
import {PDFDancer} from "../../pdfdancer_v1";
import {ObjectType} from "../../models";

describe('Env Token E2E Tests', () => {

    test('get pages with token from env', async () => {
        process.env.PDFDANCER_TOKEN = "42";
        process.env.PDFDANCER_BASE_URL = "http://localhost:8080";
        const [, , pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const client = await PDFDancer.open(pdfData);
        const pages = await client.pages();
        expect(pages).toBeDefined();
        expect(pages[0].type).toBe(ObjectType.PAGE);
        expect(pages).toHaveLength(12);
    });

    test('fail without token', async () => {
        delete process.env.PDFDANCER_TOKEN;
        delete process.env.PDFDANCER_BASE_URL;
        const [, , pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        await expect(PDFDancer.open(pdfData))
            .rejects
            .toThrow("Missing PDFDancer token");
    });

    test('fail with wrong token', async () => {
        process.env.PDFDANCER_TOKEN = "43";
        process.env.PDFDANCER_BASE_URL = "http://localhost:8080";
        const [, , pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        await expect(PDFDancer.open(pdfData))
            .rejects
            .toThrow("Failed to create session: Unauthorized");
    });
});
