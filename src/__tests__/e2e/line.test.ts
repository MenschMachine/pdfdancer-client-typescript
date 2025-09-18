/**
 * E2E tests for text line operations
 */

import * as fs from 'fs';
import {ClientV1, Position} from '../../index';
import {createTempPath, requireEnvAndFixture} from './test-helpers';
import {expectWithin} from "../assertions";

describe('Line E2E Tests', () => {
    // Tests should fail properly if environment is not configured

    test('find lines by position', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const client = new ClientV1(token, pdfData, baseUrl, 30000);
        await client.init();

        const lines = await client.findTextLines();
        expect(lines).toHaveLength(340);

        const first = lines[0];
        expect(first.internalId).toBe('LINE_000001');
        expect(first.position).toBeDefined();
        expectWithin(first.position.boundingRect?.x, 326, 1.0);
        expectWithin(first.position.boundingRect?.y, 706, 1);

        const last = lines[lines.length - 1];
        expect(last.internalId).toBe('LINE_000340');
        expect(last.position).toBeDefined();
        expectWithin(last.position.boundingRect?.x, 548, 1);
        expectWithin(last.position.boundingRect?.y, 35, 1);
    });

    test('find lines by text', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const client = new ClientV1(token, pdfData, baseUrl, 30000);
        await client.init();

        const pos = Position.atPage(0);
        pos.textStartsWith = 'the complete';
        const lines = await client.findTextLines(pos);
        expect(lines).toHaveLength(1);

        const line = lines[0];
        expect(line.internalId).toBe('LINE_000002');
        expect(line.position).toBeDefined();
        expectWithin(line.position.boundingRect?.x, 54, 1);
        expectWithin(line.position.boundingRect?.y, 606, 2);
    });

    test('delete line', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const client = new ClientV1(token, pdfData, baseUrl, 30000);
        await client.init();

        const pos = Position.atPage(0);
        pos.textStartsWith = 'The Complete';
        const ref = (await client.findTextLines(pos))[0];
        expect(await client.delete(ref)).toBe(true);

        const pos2 = Position.atPage(0);
        pos2.textStartsWith = 'The Complete';
        expect(await client.findTextLines(pos2)).toHaveLength(0);

        // Save PDF to verify operation (Node.js environment)
        const outPath = createTempPath('deleteLine.pdf');
        const outputPdfData = await client.getPdfFile();
        fs.writeFileSync(outPath, outputPdfData);
        expect(fs.existsSync(outPath)).toBe(true);
        expect(fs.statSync(outPath).size).toBeGreaterThan(0);

        // Cleanup
        fs.unlinkSync(outPath);
    });

    test('move line', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const client = new ClientV1(token, pdfData, baseUrl, 30000);
        await client.init();

        const pos3 = Position.atPage(0);
        pos3.textStartsWith = 'The Complete';
        const ref = (await client.findTextLines(pos3))[0];
        const newPos = ref.position.copy();
        newPos.moveX(100);
        expect(await client.move(ref, newPos)).toBe(true);

        const ref2 = (await client.findParagraphs(newPos))[0];
        expect(ref2).toBeDefined();

        // Save PDF to verify operation
        const outPath = createTempPath('moveLine.pdf');
        const outputPdfData = await client.getPdfFile();
        fs.writeFileSync(outPath, outputPdfData);
        expect(fs.existsSync(outPath)).toBe(true);
        expect(fs.statSync(outPath).size).toBeGreaterThan(0);

        // Cleanup
        fs.unlinkSync(outPath);
    });

    test('modify line', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const client = new ClientV1(token, pdfData, baseUrl, 30000);
        await client.init();

        const pos4 = Position.atPage(0);
        pos4.textStartsWith = 'The Complete';
        const ref = (await client.findTextLines(pos4))[0];
        expect(await client.modifyTextLine(ref, ' replaced ')).toBe(true);

        // Save PDF to verify operation
        const outPath = createTempPath('modifyLine.pdf');
        const outputPdfData = await client.getPdfFile();
        fs.writeFileSync(outPath, outputPdfData);
        expect(fs.existsSync(outPath)).toBe(true);
        expect(fs.statSync(outPath).size).toBeGreaterThan(0);

        // Verify the text was replaced
        const pos5 = Position.atPage(0);
        pos5.textStartsWith = 'The Complete';
        expect(await client.findTextLines(pos5)).toHaveLength(0);

        const pos6 = Position.atPage(0);
        pos6.textStartsWith = ' replaced ';
        expect(await client.findTextLines(pos6)).not.toHaveLength(0);

        const pos7 = Position.atPage(0);
        pos7.textStartsWith = ' replaced ';
        expect(await client.findParagraphs(pos7)).not.toHaveLength(0);

        // Cleanup
        fs.unlinkSync(outPath);
    });
});
