/**
 * E2E tests for text line operations — new PDFDancer API
 */

import * as fs from 'fs';
import {PDFDancer} from '../../index';
import {createTempPath, requireEnvAndFixture} from './test-helpers';
import {expectWithin} from '../assertions';

describe('Text Line E2E Tests (v2 API)', () => {

    test('find lines by position', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const lines = await pdf.selectLines();
        expect(lines).toHaveLength(340);

        const first = lines[0];
        expect(first.internalId).toBe('LINE_000001');
        expect(first.position).toBeDefined();
        expectWithin(first.position.boundingRect?.x, 326, 1);
        expectWithin(first.position.boundingRect?.y, 706, 1);

        const last = lines[lines.length - 1];
        expect(last.internalId).toBe('LINE_000340');
        expect(last.position).toBeDefined();
        expectWithin(last.position.boundingRect?.x, 548, 1);
        expectWithin(last.position.boundingRect?.y, 35, 1);
    });

    test('find lines on page', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const lines = await pdf.page(1).selectTextLines();
        expect(lines).toHaveLength(26);

        const line = lines[0];
        expect(line.internalId).toBe('LINE_000005');
        expect(line.position).toBeDefined();
    });

    test('find lines by text', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const lines = await pdf.page(0).selectTextLinesStartingWith('the complete');
        expect(lines).toHaveLength(1);

        const line = lines[0];
        expect(line.internalId).toBe('LINE_000002');
        expect(line.position).toBeDefined();
        expectWithin(line.position.boundingRect?.x, 54, 1);
        expectWithin(line.position.boundingRect?.y, 606, 2);
    });

    test('delete line', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const [line] = await pdf.page(0).selectTextLinesStartingWith('The Complete');
        await line.delete();

        const remaining = await pdf.page(0).selectTextLinesStartingWith('The Complete');
        expect(remaining).toHaveLength(0);

        // Save PDF to verify operation
        const outPath = createTempPath('deleteLine.pdf');
        const data = await pdf.getBytes();
        fs.writeFileSync(outPath, data);
        expect(fs.existsSync(outPath)).toBe(true);
        expect(fs.statSync(outPath).size).toBeGreaterThan(0);

        fs.unlinkSync(outPath);
    });

    test('move line', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const [line] = await pdf.page(0).selectTextLinesStartingWith('The Complete');
        let newX = line.position!.getX()! + 100;
        let newY = line.position!.getY()!;
        await line.moveTo(newX, newY);

        const movedPara = await pdf.page(0).selectParagraphsAt(newX, newY);
        expect(movedPara.length).toBeGreaterThan(0);

        const outPath = createTempPath('moveLine.pdf');
        await pdf.save(outPath);
        expect(fs.existsSync(outPath)).toBe(true);
        expect(fs.statSync(outPath).size).toBeGreaterThan(0);

        fs.unlinkSync(outPath);
    });

    test('modify line', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const [line] = await pdf.page(0).selectTextLinesStartingWith('The Complete');
        await line.edit().text(' replaced ').apply();

        const outPath = createTempPath('modifyLine.pdf');
        await pdf.save(outPath);
        expect(fs.existsSync(outPath)).toBe(true);
        expect(fs.statSync(outPath).size).toBeGreaterThan(0);

        const stillOld = await pdf.page(0).selectParagraphsStartingWith('The Complete');
        expect(stillOld).toHaveLength(0);

        const replaced = await pdf.page(0).selectParagraphsStartingWith(' replaced ');
        expect(replaced.length).toBeGreaterThan(0);

        const containingParas = await pdf.page(0).selectParagraphsStartingWith(' replaced ');
        expect(containingParas.length).toBeGreaterThan(0);

        fs.unlinkSync(outPath);
    });
});
