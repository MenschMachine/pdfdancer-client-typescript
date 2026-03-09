/**
 * PDF Assertions helper for e2e tests
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import zlib from 'zlib';
import {Color, Orientation, PDFDancer} from '../../index';
import {expectWithin} from '../assertions';

type Matrix = [number, number, number, number, number, number];
type BBox = [number, number, number, number];

interface DrawEvent {
    bbox: BBox;
    clipped: boolean;
    paintOp?: string;
    name?: string;
}

interface DrawEvents {
    paths: DrawEvent[];
    images: DrawEvent[];
}

interface ParsedObject {
    objectId: number;
    dictionary: string;
    stream?: Buffer;
}

export class PDFAssertions {
    private pdf: PDFDancer;
    private savedPdfPath: string | null;
    private drawEventsCache: Map<number, DrawEvents>;

    private constructor(pdf: PDFDancer, savedPdfPath?: string) {
        this.pdf = pdf;
        this.savedPdfPath = savedPdfPath ?? null;
        this.drawEventsCache = new Map();
    }

    static async create(sourcePdf: PDFDancer): Promise<PDFAssertions> {
        // Save and reload the PDF to ensure all changes are persisted
        // This matches the Python implementation
        const token = (sourcePdf as any)._token;
        const baseUrl = (sourcePdf as any)._baseUrl;

        // Create a temporary file
        const tempFile = path.join(os.tmpdir(), `test-${Date.now()}.pdf`);
        await sourcePdf.save(tempFile);

        // Reopen the PDF with the same token and baseUrl
        const pdfData = fs.readFileSync(tempFile);
        console.log(`PDF file saved to ${tempFile}`);
        const pdf = await PDFDancer.open(new Uint8Array(pdfData), token, baseUrl);

        return new PDFAssertions(pdf, tempFile);
    }

    private async aggregateCounts(pageNumber?: number) {
        const paragraphs = await this.pdf.selectParagraphs();
        const textLines = await this.pdf.selectLines();
        const images = await this.pdf.selectImages();
        const paths = await this.pdf.selectPaths();
        const forms = await this.pdf.selectForms();
        const fields = await this.pdf.selectFormFields();

        const filter = <T extends { position: { pageNumber?: number } }>(items: T[]): T[] => {
            if (pageNumber === undefined) {
                return items;
            }
            return items.filter(item => item.position.pageNumber === pageNumber);
        };

        return {
            paragraphs: filter(paragraphs).length,
            textLines: filter(textLines).length,
            images: filter(images).length,
            paths: filter(paths).length,
            forms: filter(forms).length,
            fields: filter(fields).length
        };
    }

    async assertTotalNumberOfElements(expected: number, pageNumber?: number): Promise<this> {
        const totals = await this.aggregateCounts(pageNumber);
        const actual = Object.values(totals).reduce((acc, count) => acc + count, 0);
        expect(actual).toBe(expected);
        return this;
    }

    async assertNumberOfPages(expected: number): Promise<this> {
        const pages = await this.pdf.pages();
        expect(pages.length).toBe(expected);
        return this;
    }

    async assertPageCount(expected: number): Promise<this> {
        const pages = await this.pdf.pages();
        expect(pages.length).toBe(expected);
        return this;
    }

    async assertPageDimension(width: number, height: number, orientation?: Orientation, pageNumber = 1): Promise<this> {
        const pages = await this.pdf.pages();
        expect(pageNumber).toBeLessThanOrEqual(pages.length);
        const page = pages[pageNumber - 1];
        expect(page.pageSize?.width).toBeCloseTo(width, 6);
        expect(page.pageSize?.height).toBeCloseTo(height, 6);
        if (orientation) {
            expect(page.orientation).toBe(orientation);
        }
        return this;
    }

    async assertParagraphIsAt(text: string, x: number, y: number, page = 1, epsilon = 4): Promise<this> { // adjust epsilon for baseline vs bounding box differences
        const paragraphs = await this.pdf.page(page).selectParagraphsMatching(`.*${text}.*`);
        expect(paragraphs.length).toBeGreaterThan(0);
        const reference = paragraphs[0].objectRef();
        expectWithin(reference.position.getX()!, x, epsilon);
        expectWithin(reference.position.getY()!, y, epsilon);

        const byPosition = await this.pdf.page(page).selectParagraphsAt(x, y, epsilon);
        expect(byPosition.length).toBeGreaterThan(0);
        return this;
    }

    async assertTextHasFont(text: string, fontName: string, fontSize: number, page = 1): Promise<this> {
        await this.assertTextlineHasFont(text, fontName, fontSize, page);

        const paragraphs = await this.pdf.page(page).selectParagraphsMatching(`.*${text}.*`);
        expect(paragraphs.length).toBeGreaterThan(0);
        const reference = paragraphs[0].objectRef();
        expect(reference.fontName).toBe(fontName);
        expectWithin(reference.fontSize!, fontSize, 1e-6);
        return this;
    }

    async assertTextHasFontMatching(text: string, fontName: string, fontSize: number, page = 1): Promise<this> {
        await this.assertTextlineHasFontMatching(text, fontName, fontSize, page);
        return this;
    }

    async assertTextHasColor(text: string, color: Color, page = 1): Promise<this> {
        await this.assertTextlineHasColor(text, color, page);
        return this;
    }

    async assertTextlineHasColor(text: string, color: Color, page = 1): Promise<this> {
        const lines = await this.pdf.page(page).selectTextLinesMatching(text);
        expect(lines.length).toBe(1);
        const reference = lines[0].objectRef();
        const refColor = reference.color;
        expect(refColor).toEqual(color);
        expect(reference.text).toContain(text);
        return this;
    }

    async assertTextlineHasFont(text: string, fontName: string, fontSize: number, page = 1): Promise<this> {
        const lines = await this.pdf.page(page).selectTextLinesStartingWith(text);
        expect(lines.length).toBe(1);
        const reference = lines[0].objectRef();
        expect(reference.fontName).toBe(fontName);
        expectWithin(reference.fontSize!, fontSize, 1e-6);
        return this;
    }

    async assertTextlineHasFontMatching(text: string, fontName: string, fontSize: number, page = 1): Promise<this> {
        const lines = await this.pdf.page(page).selectTextLinesStartingWith(text);
        expect(lines.length).toBe(1);
        const reference = lines[0].objectRef();
        expect((reference.fontName ?? '').includes(fontName)).toBe(true);
        expectWithin(reference.fontSize!, fontSize, 1e-6);
        return this;
    }

    async assertTextlineIsAt(text: string, x: number, y: number, page = 1, epsilon = 1e-4): Promise<this> {
        const lines = await this.pdf.page(page).selectTextLinesStartingWith(text);
        expect(lines.length).toBe(1);
        const reference = lines[0].objectRef();
        expectWithin(reference.position.getX()!, x, epsilon);
        expectWithin(reference.position.getY()!, y, epsilon);
        const byPosition = await this.pdf.page(page).selectTextLinesAt(x, y, epsilon);
        expect(byPosition.length).toBeGreaterThan(0);
        return this;
    }

    async assertPathIsAt(internalId: string, x: number, y: number, page = 1, epsilon = 1e-4): Promise<this> {
        const paths = await this.pdf.page(page).selectPathsAt(x, y);
        expect(paths.length).toBe(1);
        const reference = paths[0];
        expect(reference.internalId).toBe(internalId);
        expectWithin(reference.position.getX()!, x, epsilon);
        expectWithin(reference.position.getY()!, y, epsilon);
        return this;
    }

    async assertNoPathAt(x: number, y: number, page = 1): Promise<this> {
        const paths = await this.pdf.page(page).selectPathsAt(x, y);
        expect(paths.length).toBe(0);
        return this;
    }

    getPdf(): PDFDancer {
        return this.pdf;
    }

    private static matrixMultiply(left: Matrix, right: Matrix): Matrix {
        const [a1, b1, c1, d1, e1, f1] = left;
        const [a2, b2, c2, d2, e2, f2] = right;
        return [
            a1 * a2 + b1 * c2,
            a1 * b2 + b1 * d2,
            c1 * a2 + d1 * c2,
            c1 * b2 + d1 * d2,
            e1 * a2 + f1 * c2 + e2,
            e1 * b2 + f1 * d2 + f2
        ];
    }

    private static applyMatrix(matrix: Matrix, x: number, y: number): [number, number] {
        const [a, b, c, d, e, f] = matrix;
        return [a * x + c * y + e, b * x + d * y + f];
    }

    private static bboxArea(bbox: BBox): number {
        return Math.max(0, bbox[2] - bbox[0]) * Math.max(0, bbox[3] - bbox[1]);
    }

    private static bboxContainsPoint(bbox: BBox, x: number, y: number, tolerance = 0.5): boolean {
        return (
            bbox[0] - tolerance <= x && x <= bbox[2] + tolerance &&
            bbox[1] - tolerance <= y && y <= bbox[3] + tolerance
        );
    }

    private static bboxIntersectionArea(a: BBox, b: BBox): number {
        const left = Math.max(a[0], b[0]);
        const bottom = Math.max(a[1], b[1]);
        const right = Math.min(a[2], b[2]);
        const top = Math.min(a[3], b[3]);
        if (left >= right || bottom >= top) {
            return 0;
        }
        return (right - left) * (top - bottom);
    }

    private static parsePdfObjects(pdfBytes: Buffer): Map<number, ParsedObject> {
        const rawPdf = pdfBytes.toString('latin1');
        const objects = new Map<number, ParsedObject>();
        const objectRegex = /(\d+)\s+(\d+)\s+obj\b/g;
        let match: RegExpExecArray | null;

        while ((match = objectRegex.exec(rawPdf)) !== null) {
            const objectId = parseInt(match[1], 10);
            const bodyStart = objectRegex.lastIndex;
            const endObjIndex = rawPdf.indexOf('endobj', bodyStart);
            if (endObjIndex === -1) {
                break;
            }

            const body = rawPdf.slice(bodyStart, endObjIndex);
            const streamIndex = body.indexOf('stream');
            const parsed: ParsedObject = {
                objectId,
                dictionary: streamIndex >= 0 ? body.slice(0, streamIndex).trim() : body.trim()
            };

            if (streamIndex >= 0) {
                const endStreamRel = body.indexOf('endstream', streamIndex);
                if (endStreamRel >= 0) {
                    let streamStart = bodyStart + streamIndex + 'stream'.length;
                    if (rawPdf.startsWith('\r\n', streamStart)) {
                        streamStart += 2;
                    } else if (rawPdf[streamStart] === '\n' || rawPdf[streamStart] === '\r') {
                        streamStart += 1;
                    }

                    let streamEnd = bodyStart + endStreamRel;
                    while (
                        streamEnd > streamStart &&
                        (rawPdf[streamEnd - 1] === '\n' || rawPdf[streamEnd - 1] === '\r')
                    ) {
                        streamEnd -= 1;
                    }
                    parsed.stream = Buffer.from(pdfBytes.subarray(streamStart, streamEnd));
                }
            }

            objects.set(objectId, parsed);
            objectRegex.lastIndex = endObjIndex + 'endobj'.length;
        }

        return objects;
    }

    private static extractReferencedObjectIds(value: string): number[] {
        const refs = value.matchAll(/(\d+)\s+\d+\s+R/g);
        const ids: number[] = [];
        for (const ref of refs) {
            ids.push(parseInt(ref[1], 10));
        }
        return ids;
    }

    private static parseNumberOperands(operands: string[], count: number): number[] | null {
        if (operands.length < count) {
            return null;
        }
        const values = operands.slice(operands.length - count).map(v => Number(v));
        if (values.some(v => !Number.isFinite(v))) {
            return null;
        }
        return values;
    }

    private static tokenizeContentStream(content: string): string[] {
        const tokens: string[] = [];
        let i = 0;

        while (i < content.length) {
            const ch = content[i];

            if (/\s/.test(ch)) {
                i += 1;
                continue;
            }

            if (ch === '%') {
                while (i < content.length && content[i] !== '\n' && content[i] !== '\r') {
                    i += 1;
                }
                continue;
            }

            if (ch === '(') {
                i += 1;
                let depth = 1;
                while (i < content.length && depth > 0) {
                    if (content[i] === '\\') {
                        i += 2;
                        continue;
                    }
                    if (content[i] === '(') {
                        depth += 1;
                    } else if (content[i] === ')') {
                        depth -= 1;
                    }
                    i += 1;
                }
                continue;
            }

            if ('[]<>{}'.includes(ch)) {
                i += 1;
                continue;
            }

            let j = i;
            while (j < content.length && !/\s/.test(content[j]) && !'[]<>(){}'.includes(content[j])) {
                j += 1;
            }
            tokens.push(content.slice(i, j));
            i = j;
        }

        return tokens;
    }

    private decodeStreamContent(dictionary: string, stream: Buffer): string {
        if (/\/Filter[\s\S]*\/FlateDecode/.test(dictionary)) {
            try {
                return zlib.inflateSync(stream).toString('latin1');
            } catch {
                return '';
            }
        }
        return stream.toString('latin1');
    }

    private extractPageContentObjectIds(objects: Map<number, ParsedObject>, page: number): number[] {
        const pageObjects = Array.from(objects.values())
            .filter(obj => /\/Type\s*\/Page\b/.test(obj.dictionary) && !/\/Type\s*\/Pages\b/.test(obj.dictionary))
            .sort((a, b) => a.objectId - b.objectId);

        const streamObjectIds = Array.from(objects.values())
            .filter(obj => obj.stream)
            .map(obj => obj.objectId);

        if (pageObjects.length === 0) {
            return streamObjectIds;
        }

        if (page < 1 || page > pageObjects.length) {
            return streamObjectIds;
        }

        const pageObject = pageObjects[page - 1];
        const contentsMatch = pageObject.dictionary.match(/\/Contents\s+(\[[\s\S]*?]|\d+\s+\d+\s+R)/);
        if (!contentsMatch) {
            return streamObjectIds;
        }

        const referenced = PDFAssertions.extractReferencedObjectIds(contentsMatch[1]);
        return referenced.length > 0 ? referenced : streamObjectIds;
    }

    private extractPageDrawEvents(page: number): DrawEvents {
        if (this.drawEventsCache.has(page)) {
            return this.drawEventsCache.get(page)!;
        }

        expect(this.savedPdfPath).toBeTruthy();
        const pdfBytes = fs.readFileSync(this.savedPdfPath!);
        const objects = PDFAssertions.parsePdfObjects(pdfBytes);
        const contentObjectIds = this.extractPageContentObjectIds(objects, page);
        const pathEvents: DrawEvent[] = [];
        const imageEvents: DrawEvent[] = [];
        const paintOps = new Set(['S', 's', 'f', 'F', 'f*', 'B', 'B*', 'b', 'b*']);
        const pathOps = new Set(['m', 'l', 'c', 'v', 'y', 'h', 're']);

        for (const contentObjectId of contentObjectIds) {
            const object = objects.get(contentObjectId);
            if (!object || !object.stream) {
                continue;
            }

            const decoded = this.decodeStreamContent(object.dictionary, object.stream);
            if (!decoded) {
                continue;
            }

            const tokens = PDFAssertions.tokenizeContentStream(decoded);
            const hasRelevantOps = tokens.some(token =>
                paintOps.has(token) ||
                pathOps.has(token) ||
                token === 'Do' ||
                token === 'W' ||
                token === 'W*' ||
                token === 'q' ||
                token === 'Q' ||
                token === 'cm'
            );
            if (!hasRelevantOps) {
                continue;
            }
            const stateStack: Array<{hasClip: boolean; pendingClip: boolean; ctm: Matrix}> = [];
            let hasClip = false;
            let pendingClip = false;
            let ctm: Matrix = [1, 0, 0, 1, 0, 0];
            let currentPathPoints: Array<[number, number]> = [];
            let operands: string[] = [];

            const addPathPoint = (rawX: number, rawY: number): void => {
                currentPathPoints.push(PDFAssertions.applyMatrix(ctm, rawX, rawY));
            };

            for (const token of tokens) {
                const isOperator = /^[A-Za-z*'"]+$/.test(token);
                if (!isOperator) {
                    operands.push(token);
                    continue;
                }

                if (token === 'q') {
                    stateStack.push({hasClip, pendingClip, ctm: [...ctm] as Matrix});
                    operands = [];
                    continue;
                }
                if (token === 'Q') {
                    const previous = stateStack.pop();
                    if (previous) {
                        hasClip = previous.hasClip;
                        pendingClip = previous.pendingClip;
                        ctm = previous.ctm;
                    }
                    currentPathPoints = [];
                    operands = [];
                    continue;
                }
                if (token === 'cm') {
                    const values = PDFAssertions.parseNumberOperands(operands, 6);
                    if (values) {
                        ctm = PDFAssertions.matrixMultiply(values as Matrix, ctm);
                    }
                    operands = [];
                    continue;
                }
                if (token === 'W' || token === 'W*') {
                    pendingClip = true;
                    operands = [];
                    continue;
                }
                if (token === 'n') {
                    if (pendingClip) {
                        hasClip = true;
                        pendingClip = false;
                    }
                    currentPathPoints = [];
                    operands = [];
                    continue;
                }

                if (pathOps.has(token)) {
                    if (token === 'm' || token === 'l') {
                        const values = PDFAssertions.parseNumberOperands(operands, 2);
                        if (values) {
                            addPathPoint(values[0], values[1]);
                        }
                    } else if (token === 'c') {
                        const values = PDFAssertions.parseNumberOperands(operands, 6);
                        if (values) {
                            addPathPoint(values[0], values[1]);
                            addPathPoint(values[2], values[3]);
                            addPathPoint(values[4], values[5]);
                        }
                    } else if (token === 'v' || token === 'y') {
                        const values = PDFAssertions.parseNumberOperands(operands, 4);
                        if (values) {
                            addPathPoint(values[0], values[1]);
                            addPathPoint(values[2], values[3]);
                        }
                    } else if (token === 're') {
                        const values = PDFAssertions.parseNumberOperands(operands, 4);
                        if (values) {
                            const [x, y, w, h] = values;
                            addPathPoint(x, y);
                            addPathPoint(x + w, y);
                            addPathPoint(x + w, y + h);
                            addPathPoint(x, y + h);
                        }
                    }
                    operands = [];
                    continue;
                }

                if (paintOps.has(token)) {
                    if (currentPathPoints.length > 0) {
                        const xs = currentPathPoints.map(point => point[0]);
                        const ys = currentPathPoints.map(point => point[1]);
                        pathEvents.push({
                            bbox: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)],
                            clipped: hasClip || pendingClip,
                            paintOp: token
                        });
                    }
                    if (pendingClip) {
                        hasClip = true;
                        pendingClip = false;
                    }
                    currentPathPoints = [];
                    operands = [];
                    continue;
                }

                if (token === 'Do') {
                    const p0 = PDFAssertions.applyMatrix(ctm, 0, 0);
                    const p1 = PDFAssertions.applyMatrix(ctm, 1, 0);
                    const p2 = PDFAssertions.applyMatrix(ctm, 0, 1);
                    const p3 = PDFAssertions.applyMatrix(ctm, 1, 1);
                    const xs = [p0[0], p1[0], p2[0], p3[0]];
                    const ys = [p0[1], p1[1], p2[1], p3[1]];
                    imageEvents.push({
                        bbox: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)],
                        clipped: hasClip || pendingClip,
                        name: operands.length > 0 ? operands[operands.length - 1] : undefined
                    });
                    operands = [];
                    continue;
                }

                operands = [];
            }
        }

        const events = {paths: pathEvents, images: imageEvents};
        this.drawEventsCache.set(page, events);
        return events;
    }

    private async findPathClippingState(internalId: string, page: number): Promise<boolean> {
        const paths = await this.pdf.page(page).selectPaths();
        const pathRef = paths.find(pathObject => pathObject.internalId === internalId);
        expect(pathRef).toBeDefined();

        const x = pathRef!.position.getX();
        const y = pathRef!.position.getY();
        expect(x).toBeDefined();
        expect(y).toBeDefined();

        const events = this.extractPageDrawEvents(page).paths;
        const matches = events.filter(event => PDFAssertions.bboxContainsPoint(event.bbox, x!, y!));
        expect(matches.length).toBeGreaterThan(0);
        const best = matches.reduce((previous, current) =>
            PDFAssertions.bboxArea(current.bbox) < PDFAssertions.bboxArea(previous.bbox) ? current : previous
        );

        return Boolean(best.clipped);
    }

    private async findImageClippingState(internalId: string, page: number): Promise<boolean> {
        const images = await this.pdf.page(page).selectImages();
        const image = images.find(imageObject => imageObject.internalId === internalId);
        expect(image).toBeDefined();
        expect(image!.position.boundingRect).toBeDefined();

        const boundingRect = image!.position.boundingRect!;
        const targetBBox: BBox = [
            boundingRect.x,
            boundingRect.y,
            boundingRect.x + boundingRect.width,
            boundingRect.y + boundingRect.height
        ];

        const events = this.extractPageDrawEvents(page).images;
        const matches = events.filter(event => PDFAssertions.bboxIntersectionArea(targetBBox, event.bbox) > 0);
        expect(matches.length).toBeGreaterThan(0);
        const best = matches.reduce((previous, current) =>
            PDFAssertions.bboxIntersectionArea(targetBBox, current.bbox) >
            PDFAssertions.bboxIntersectionArea(targetBBox, previous.bbox) ? current : previous
        );

        return Boolean(best.clipped);
    }

    async assertPathHasClipping(internalId: string, page = 1): Promise<this> {
        const clipped = await this.findPathClippingState(internalId, page);
        expect(clipped).toBe(true);
        return this;
    }

    async assertPathHasNoClipping(internalId: string, page = 1): Promise<this> {
        const clipped = await this.findPathClippingState(internalId, page);
        expect(clipped).toBe(false);
        return this;
    }

    async assertImageHasClipping(internalId: string, page = 1): Promise<this> {
        const clipped = await this.findImageClippingState(internalId, page);
        expect(clipped).toBe(true);
        return this;
    }

    async assertImageHasNoClipping(internalId: string, page = 1): Promise<this> {
        const clipped = await this.findImageClippingState(internalId, page);
        expect(clipped).toBe(false);
        return this;
    }

    async assertPathHasBounds(internalId: string, expectedWidth: number, expectedHeight: number, page = 1, epsilon = 1.0): Promise<this> {
        const paths = await this.pdf.page(page).selectPaths();
        const ref = paths.find(p => p.internalId === internalId);
        expect(ref).toBeDefined();

        const bounds = ref!.position.boundingRect;
        expect(bounds).toBeDefined();
        expectWithin(bounds!.width, expectedWidth, epsilon);
        expectWithin(bounds!.height, expectedHeight, epsilon);
        return this;
    }

    async assertNumberOfPaths(expected: number, page?: number): Promise<this> {
        const paths = page === undefined ? await this.pdf.selectPaths() : await this.pdf.page(page).selectPaths();
        expect(paths.length).toBe(expected);
        return this;
    }

    async assertNumberOfImages(expected: number, page?: number): Promise<this> {
        const images = page === undefined ? await this.pdf.selectImages() : await this.pdf.page(page).selectImages();
        expect(images.length).toBe(expected);
        return this;
    }

    async assertImageAt(x: number, y: number, page = 1): Promise<this> {
        const images = await this.pdf.page(page).selectImagesAt(x, y, 0.1);
        expect(images.length).toBe(1);
        return this;
    }

    async assertNoImageAt(x: number, y: number, page = 1): Promise<this> {
        const images = await this.pdf.page(page).selectImagesAt(x, y);
        expect(images.length).toBe(0);
        return this;
    }

    async assertImageWithIdAt(internalId: string, x: number, y: number, page = 1): Promise<this> {
        const images = await this.pdf.page(page).selectImagesAt(x, y);
        expect(images.length).toBe(1);
        expect(images[0].internalId).toBe(internalId);
        return this;
    }

    /**
     * Asserts that an image has the expected dimensions.
     * @param internalId The internal ID of the image
     * @param expectedWidth Expected width in points
     * @param expectedHeight Expected height in points
     * @param page Page number (1-based)
     * @param epsilon Tolerance for comparison (default 0.5)
     */
    async assertImageSize(internalId: string, expectedWidth: number, expectedHeight: number, page = 1, epsilon = 0.5): Promise<this> {
        const images = await this.pdf.page(page).selectImages();
        const image = images.find(img => img.internalId === internalId);
        expect(image).toBeDefined();

        const boundingRect = image!.position.boundingRect;
        expect(boundingRect).toBeDefined();

        expectWithin(boundingRect!.width, expectedWidth, epsilon);
        expectWithin(boundingRect!.height, expectedHeight, epsilon);
        return this;
    }

    /**
     * Asserts that an image has the expected aspect ratio (width/height).
     * @param internalId The internal ID of the image
     * @param expectedRatio Expected aspect ratio (width / height)
     * @param page Page number (1-based)
     * @param epsilon Tolerance for comparison (default 0.01)
     */
    async assertImageAspectRatio(internalId: string, expectedRatio: number, page = 1, epsilon = 0.01): Promise<this> {
        const images = await this.pdf.page(page).selectImages();
        const image = images.find(img => img.internalId === internalId);
        expect(image).toBeDefined();

        const boundingRect = image!.position.boundingRect;
        expect(boundingRect).toBeDefined();

        const actualRatio = boundingRect!.width / boundingRect!.height;
        expectWithin(actualRatio, expectedRatio, epsilon);
        return this;
    }

    /**
     * Gets the dimensions of an image by its internal ID.
     * Useful for capturing dimensions before a transformation.
     * @param internalId The internal ID of the image
     * @param page Page number (1-based)
     * @returns Object with width and height, or undefined if not found
     */
    async getImageSize(internalId: string, page = 1): Promise<{ width: number; height: number } | undefined> {
        const images = await this.pdf.page(page).selectImages();
        const image = images.find(img => img.internalId === internalId);
        if (!image || !image.position.boundingRect) {
            return undefined;
        }
        return {
            width: image.position.boundingRect.width,
            height: image.position.boundingRect.height
        };
    }

    async assertNumberOfFormXObjects(expected: number, page?: number): Promise<this> {
        const forms = page === undefined ? await this.pdf.selectForms() : await this.pdf.page(page).selectForms();
        expect(forms.length).toBe(expected);
        return this;
    }

    async assertNumberOfFormFields(expected: number, page?: number): Promise<this> {
        const fields = page === undefined ? await this.pdf.selectFormFields() : await this.pdf.page(page).selectFormFields();
        expect(fields.length).toBe(expected);
        return this;
    }

    async assertParagraphExists(text: string, page = 1): Promise<this> {
        let params = await this.pdf.page(page).selectParagraphs();
        for (const param of params) {
            console.log(param.getText());
        }
        const paragraphs = await this.pdf.page(page).selectParagraphsMatching(".*" + text + ".*");
        expect(paragraphs.length).toBeGreaterThan(0);
        return this;
    }

    async assertParagraphDoesNotExist(text: string, page = 1): Promise<this> {
        const paragraphs = await this.pdf.page(page).selectParagraphsMatching(".*" + text + ".*");
        expect(paragraphs.length).toBe(0);
        return this;
    }

    async assertTextlineExists(text: string, page = 1): Promise<this> {
        const lines = await this.pdf.page(page).selectTextLinesStartingWith(text);
        expect(lines.length).toBeGreaterThan(0);
        return this;
    }

    async assertTextlineDoesNotExist(text: string, page = 1): Promise<this> {
        const lines = await this.pdf.page(page).selectTextLinesStartingWith(text);
        expect(lines.length).toBe(0);
        return this;
    }
}
