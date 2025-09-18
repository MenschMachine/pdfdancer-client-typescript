/**
 * E2E tests for text line operations
 */

import * as fs from 'fs';
import { ClientV1, Position } from '../../index';
import { requireEnvAndFixture, createTempPath } from './test-helpers';

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
    expect(first.position.boundingRect?.x).toBeCloseTo(326, 1);
    expect(first.position.boundingRect?.y).toBeCloseTo(706, 1);

    const last = lines[lines.length - 1];
    expect(last.internalId).toBe('LINE_000340');
    expect(last.position).toBeDefined();
    expect(last.position.boundingRect?.x).toBeCloseTo(548, 2);
    expect(last.position.boundingRect?.y).toBeCloseTo(35, 2);
  });

  test('find lines by text', async () => {
    const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
    const client = new ClientV1(token, pdfData, baseUrl, 30000);
    await client.init();

    const pos = Position.fromPageIndex(0);
    pos.textStartsWith = 'the complete';
    const lines = await client.findTextLines(pos);
    expect(lines).toHaveLength(1);

    const line = lines[0];
    expect(line.internalId).toBe('LINE_000002');
    expect(line.position).toBeDefined();
    expect(line.position.boundingRect?.x).toBeCloseTo(54, 1);
    expect(line.position.boundingRect?.y).toBeCloseTo(606, 2);
  });

  test('delete line', async () => {
    const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
    const client = new ClientV1(token, pdfData, baseUrl, 30000);
    await client.init();

    const pos = Position.fromPageIndex(0);
    pos.textStartsWith = 'The Complete';
    const ref = (await client.findTextLines(pos))[0];
    expect(await client.delete(ref)).toBe(true);

    const pos2 = Position.fromPageIndex(0);
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

    const pos3 = Position.fromPageIndex(0);
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

    const pos4 = Position.fromPageIndex(0);
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
    const pos5 = Position.fromPageIndex(0);
    pos5.textStartsWith = 'The Complete';
    expect(await client.findTextLines(pos5)).toHaveLength(0);

    const pos6 = Position.fromPageIndex(0);
    pos6.textStartsWith = ' replaced ';
    expect(await client.findTextLines(pos6)).not.toHaveLength(0);

    const pos7 = Position.fromPageIndex(0);
    pos7.textStartsWith = ' replaced ';
    expect(await client.findParagraphs(pos7)).not.toHaveLength(0);

    // Cleanup
    fs.unlinkSync(outPath);
  });
});