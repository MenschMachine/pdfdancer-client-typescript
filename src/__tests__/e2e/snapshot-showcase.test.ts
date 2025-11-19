import {ObjectType, PDFDancer} from '../../index';
import {requireEnvAndFixture} from './test-helpers';

describe('Snapshot E2E Tests (Showcase)', () => {
    test('page snapshot matches select paragraphs', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('Showcase.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const snapshot = await pdf.getPageSnapshot(0);
        const snapshotParagraphs = snapshot.elements.filter(e => e.type === ObjectType.PARAGRAPH);
        const selected = await pdf.page(0).selectParagraphs();

        expect(selected.length).toBe(snapshotParagraphs.length);
        const snapshotIds = new Set(snapshotParagraphs.map(e => e.internalId));
        const selectedIds = new Set(selected.map(p => p.internalId));
        expect(selectedIds).toEqual(snapshotIds);
    });

    test('page snapshot matches select images', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('Showcase.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const snapshot = await pdf.getPageSnapshot(0);
        const snapshotImages = snapshot.elements.filter(e => e.type === ObjectType.IMAGE);
        const selected = await pdf.page(0).selectImages();

        expect(selected.length).toBe(snapshotImages.length);
        if (selected.length > 0) {
            const snapshotIds = new Set(snapshotImages.map(e => e.internalId));
            const selectedIds = new Set(selected.map(img => img.internalId));
            expect(selectedIds).toEqual(snapshotIds);
        }
    });

    test('page snapshot matches select forms', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('Showcase.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const snapshot = await pdf.getPageSnapshot(0);
        const snapshotForms = snapshot.elements.filter(e => e.type === ObjectType.FORM_X_OBJECT);
        const selected = await pdf.page(0).selectForms();

        expect(selected.length).toBe(snapshotForms.length);
        if (selected.length > 0) {
            const snapshotIds = new Set(snapshotForms.map(e => e.internalId));
            const selectedIds = new Set(selected.map(form => form.internalId));
            expect(selectedIds).toEqual(snapshotIds);
        }
    });

    test('page snapshot matches select form fields', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('Showcase.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const snapshot = await pdf.getPageSnapshot(0);
        const snapshotFields = snapshot.elements.filter(e => [
            ObjectType.FORM_FIELD,
            ObjectType.TEXT_FIELD,
            ObjectType.CHECKBOX,
            ObjectType.RADIO_BUTTON
        ].includes(e.type));
        const selected = await pdf.page(0).selectFormFields();

        expect(selected.length).toBe(snapshotFields.length);
        if (selected.length > 0) {
            const snapshotIds = new Set(snapshotFields.map(e => e.internalId));
            const selectedIds = new Set(selected.map(field => field.internalId));
            expect(selectedIds).toEqual(snapshotIds);
        }
    });

    test('page snapshot contains all element types', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('Showcase.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const snapshot = await pdf.getPageSnapshot(0);
        const paragraphCount = snapshot.elements.filter(e => e.type === ObjectType.PARAGRAPH).length;
        const textLineCount = snapshot.elements.filter(e => e.type === ObjectType.TEXT_LINE).length;

        expect(paragraphCount > 0 || textLineCount > 0).toBe(true);
        for (const element of snapshot.elements) {
            expect(element.type).toBeDefined();
            expect(element.internalId).toBeDefined();
            expect(element.position).toBeDefined();
        }
    });

    test('document snapshot matches all pages', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('Showcase.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const docSnapshot = await pdf.getDocumentSnapshot();
        for (let i = 0; i < docSnapshot.pageCount; i++) {
            const docPage = docSnapshot.pages[i];
            const pageSnapshot = await pdf.getPageSnapshot(i);
            expect(pageSnapshot.elements.length).toBe(docPage.elements.length);

            const docIds = new Set(docPage.elements.map(e => e.internalId));
            const pageIds = new Set(pageSnapshot.elements.map(e => e.internalId));
            expect(pageIds).toEqual(docIds);
        }
    });

    test('type filter matches select method', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('Showcase.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const snapshot = await pdf.getPageSnapshot(0, [ObjectType.PARAGRAPH]);
        const selected = await pdf.page(0).selectParagraphs();

        expect(snapshot.elements.length).toBe(selected.length);
        expect(snapshot.elements.every(e => e.type === ObjectType.PARAGRAPH)).toBe(true);

        const snapshotIds = new Set(snapshot.elements.map(e => e.internalId));
        const selectedIds = new Set(selected.map(p => p.internalId));
        expect(selectedIds).toEqual(snapshotIds);
    });

    test('multiple type filters combined', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('Showcase.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const snapshot = await pdf.getPageSnapshot(0, [ObjectType.PARAGRAPH, ObjectType.TEXT_LINE]);
        expect(snapshot.elements.every(e => e.type === ObjectType.PARAGRAPH || e.type === ObjectType.TEXT_LINE)).toBe(true);

        const full = await pdf.getPageSnapshot(0);
        const expectedCount = full.elements.filter(e => e.type === ObjectType.PARAGRAPH || e.type === ObjectType.TEXT_LINE).length;
        expect(snapshot.elements.length).toBe(expectedCount);
    });

    test('total element count matches expected', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('Showcase.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const elements = await pdf.selectElements();
        expect(elements.length).toBeGreaterThanOrEqual(95);
        expect(elements.length).toBeLessThanOrEqual(97);

        const docSnapshot = await pdf.getDocumentSnapshot();
        const snapshotTotal = docSnapshot.pages.reduce((count, page) => count + page.elements.length, 0);
        expect(snapshotTotal).toBe(elements.length);
        expect((await pdf.pages()).length).toBe(7);
    });

    test('snapshot consistency across multiple pages', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('Showcase.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const docSnapshot = await pdf.getDocumentSnapshot();
        expect(docSnapshot.pageCount).toBeGreaterThan(1);

        const limit = Math.min(3, docSnapshot.pageCount);
        for (let i = 0; i < limit; i++) {
            const pageSnapshot = await pdf.getPageSnapshot(i);
            expect(pageSnapshot).toBeDefined();
            expect(pageSnapshot.pageRef.position.pageIndex).toBe(i);
        }
    });
});
