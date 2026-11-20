/**
 * E2E tests for moving text lines and for the unified moveTo/moveX/moveY helpers.
 */

import {ObjectType, PDFDancer, TextLineObject} from '../../index';
import {requireEnvAndFixture} from './test-helpers';

const TOLERANCE = 0.05;

async function openPdf() {
    const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
    return PDFDancer.open(pdfData, token, baseUrl);
}

/** A line with unique non-empty text well inside the page. */
async function pickMovableLine(pdf: PDFDancer, pageNumber = 1): Promise<TextLineObject> {
    const lines = (await pdf.page(pageNumber).selectTextLines()).filter(line => line.text);
    const counts = new Map<string, number>();
    for (const line of lines) {
        counts.set(line.text!, (counts.get(line.text!) ?? 0) + 1);
    }
    const line = lines.find(l => {
        const x = l.position.getX()!;
        const y = l.position.getY()!;
        return counts.get(l.text!) === 1 && y > 100 && y < 600 && x > 50 && x < 400;
    });
    if (!line) {
        throw new Error('No uniquely identifiable text line found on the page');
    }
    return line;
}

async function reread(pdf: PDFDancer, text: string, pageNumber = 1): Promise<TextLineObject> {
    const matches = (await pdf.page(pageNumber).selectTextLines()).filter(line => line.text === text);
    expect(matches).toHaveLength(1);
    return matches[0];
}

describe('Text line move E2E Tests', () => {

    test('select text lines', async () => {
        const pdf = await openPdf();

        const lines = await pdf.selectTextLines();
        expect(lines.length).toBeGreaterThan(0);
        expect(lines.every(line => line.type === ObjectType.TEXT_LINE)).toBe(true);
        expect(lines.some(line => line.text)).toBe(true);

        const pageLines = await pdf.page(1).selectTextLines();
        expect(pageLines.length).toBeGreaterThan(0);
        expect(pageLines.every(line => line.position.pageNumber === 1)).toBe(true);
    });

    test('move text line to absolute coordinates', async () => {
        const pdf = await openPdf();
        const line = await pickMovableLine(pdf);
        const text = line.text!;
        const newX = line.position.getX()! + 40;
        const newY = line.position.getY()! - 30;

        expect(await line.moveTo(newX, newY)).toBe(true);

        const moved = await reread(pdf, text);
        expect(Math.abs(moved.position.getX()! - newX)).toBeLessThanOrEqual(TOLERANCE);
        expect(Math.abs(moved.position.getY()! - newY)).toBeLessThanOrEqual(TOLERANCE);
    });

    test('relative text line moves compose and match the requested offsets', async () => {
        const pdf = await openPdf();
        const line = await pickMovableLine(pdf);
        const text = line.text!;
        const oldX = line.position.getX()!;
        const oldY = line.position.getY()!;

        expect(await line.moveX(20)).toBe(true);
        expect(await line.moveY(-15)).toBe(true);

        // Observed deltas must match the requested offsets (this catches any mismatch
        // between the reported bounding box and the line's text origin).
        const moved = await reread(pdf, text);
        expect(Math.abs(moved.position.getX()! - oldX - 20)).toBeLessThanOrEqual(TOLERANCE);
        expect(Math.abs(moved.position.getY()! - oldY + 15)).toBeLessThanOrEqual(TOLERANCE);
    });

    test('delete text line', async () => {
        const pdf = await openPdf();
        const line = await pickMovableLine(pdf);
        const text = line.text!;

        expect(await line.delete()).toBe(true);

        const remaining = (await pdf.page(1).selectTextLines()).filter(l => l.text === text);
        expect(remaining).toHaveLength(0);
    });

    test('relative image moves match the requested offsets', async () => {
        const pdf = await openPdf();
        const image = (await pdf.selectImages())[2];
        const pageNumber = image.position.pageNumber!;
        const oldX = image.position.getX()!;
        const oldY = image.position.getY()!;

        expect(await image.moveX(20)).toBe(true);
        expect(await image.moveY(-15)).toBe(true);

        const moved = await pdf.page(pageNumber).selectImagesAt(oldX + 20, oldY - 15);
        expect(moved).toHaveLength(1);
        expect(Math.abs(moved[0].position.getX()! - (oldX + 20))).toBeLessThanOrEqual(TOLERANCE);
        expect(Math.abs(moved[0].position.getY()! - (oldY - 15))).toBeLessThanOrEqual(TOLERANCE);
    });
});
