/**
 * E2E tests for text line operations — new PDFDancer API
 */

import * as fs from 'fs';
import {FontType, PDFDancer} from '../../index';
import {createTempPath, requireEnvAndFixture} from './test-helpers';
import {expectWithin} from '../assertions';
import {PDFAssertions} from './pdf-assertions';

describe('Text Line E2E Tests (v2 API)', () => {

    test('find lines by position', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const lines = await pdf.selectLines();
        expect(lines).toHaveLength(338);

        const first = lines[0];
        expect(first.position).toBeDefined();
        expectWithin(first.position.boundingRect?.x, 326, 1);
        expectWithin(first.position.boundingRect?.y, 706, 10);
        expect(first.objectRef().status).toBeDefined();
        expect(first.objectRef().status?.isModified()).toBe(false);

        const last = lines[lines.length - 1];
        expect(last.position).toBeDefined();
        expectWithin(last.position.boundingRect?.x, 548, 1);
        expectWithin(last.position.boundingRect?.y, 30, 5);
        expect(last.objectRef().status).toBeDefined();
        expect(last.objectRef().status?.isModified()).toBe(false);
    });

    test('find lines on page', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const lines = await pdf.page(2).selectTextLines();
        expect(lines).toHaveLength(26);

        const line = lines[0];
        expect(line.position).toBeDefined();
    });

    test('find lines by text', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const lines = await pdf.page(1).selectTextLinesStartingWith('the complete');
        expect(lines).toHaveLength(1);

        const line = lines[0];
        expect(line.position).toBeDefined();
        expectWithin(line.position.boundingRect?.x, 54, 1);
        expectWithin(line.position.boundingRect?.y, 595, 20);
    });

    test('delete line', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const [line] = await pdf.page(1).selectTextLinesStartingWith('The Complete');
        await line.delete();

        const remaining = await pdf.page(1).selectTextLinesStartingWith('The Complete');
        expect(remaining).toHaveLength(0);

        // Save PDF to verify operation
        const outPath = createTempPath('deleteLine.pdf');
        const data = await pdf.getBytes();
        fs.writeFileSync(outPath, data);
        expect(fs.existsSync(outPath)).toBe(true);
        expect(fs.statSync(outPath).size).toBeGreaterThan(0);

        fs.unlinkSync(outPath);

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertTextlineDoesNotExist('The Complete');
    });

    test('move line', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const [line] = await pdf.page(1).selectTextLinesStartingWith('The Complete');
        let newX = line.position!.getX()! + 100;
        let newY = line.position!.getY()!;
        await line.moveTo(newX, newY);

        const movedPara = await pdf.page(1).selectTextLinesAt(newX, newY);
        expect(movedPara.length).toBeGreaterThan(0);
        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertTextlineIsAt('The Complete', newX, newY, 1, 0.25);
    });

    test('modify line', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const [line] = await pdf.page(1).selectTextLinesStartingWith('The Complete');
        const result = await line.edit().text(' replaced ').apply();
        expect(result.success).toBe(true);

        const stillOld = await pdf.page(1).selectParagraphsStartingWith('The Complete');
        expect(stillOld).toHaveLength(0);

        const lines = await pdf.page(1).selectTextLinesMatching('.*replaced.*');
        expect(lines.length).toBeGreaterThan(0);
        expect(lines[0].objectRef().status).toBeDefined();
        expect(lines[0].objectRef().status?.getFontType()).toBe(FontType.EMBEDDED);
        expect(lines[0].objectRef().status?.isModified()).toBe(true);

        const replaced = await pdf.page(1).selectParagraphsStartingWith(' replaced ');
        expect(replaced.length).toBeGreaterThan(0);

        const containingParas = await pdf.page(1).selectParagraphsStartingWith(' replaced ');
        expect(containingParas.length).toBeGreaterThan(0);

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertTextlineExists(' replaced ');
    });

    // Tests for singular select methods
    test('selectTextLine returns first line or null', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        // Test with results
        const line = await pdf.page(2).selectTextLine();
        expect(line).not.toBeNull();

        // Test with PDFDancer class
        const lineFromPdf = await pdf.selectTextLine();
        expect(lineFromPdf).not.toBeNull();

        // Test alias selectLine
        const lineAlias = await pdf.selectLine();
        expect(lineAlias).not.toBeNull();
    });

    test('selectTextLineStartingWith returns first match or null', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const line = await pdf.page(1).selectTextLineStartingWith('the complete');
        expect(line).not.toBeNull();

        // Test with no match
        const noMatch = await pdf.page(1).selectTextLineStartingWith('NoMatch');
        expect(noMatch).toBeNull();
    });

    test('selectTextLineMatching returns first match or null', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const line = await pdf.page(1).selectTextLineMatching('.*Complete.*');
        expect(line).not.toBeNull();

        // Test with no match
        const noMatch = await pdf.page(1).selectTextLineMatching('.*NOT FOUND.*');
        expect(noMatch).toBeNull();
    });

    test('selectTextLineAt returns first line at position or null', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const line = await pdf.page(1).selectTextLineAt(54, 606, 10);
        expect(line).not.toBeNull();

        // Test with no match
        const noMatch = await pdf.page(1).selectTextLineAt(1000, 1000, 1);
        expect(noMatch).toBeNull();
    });
});
