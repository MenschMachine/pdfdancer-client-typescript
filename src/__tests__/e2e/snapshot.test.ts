/**
 * E2E tests for snapshot operations
 */

import {ObjectType, PDFDancer, DocumentSnapshot, PageSnapshot} from '../../index';
import {requireEnvAndFixture} from './test-helpers';

describe('Snapshot E2E Tests', () => {
    
    test('get document snapshot', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const client = await PDFDancer.open(pdfData, token, baseUrl);

        const snapshot = await client.getDocumentSnapshot();
        
        // Verify snapshot structure
        expect(snapshot).toBeDefined();
        expect(snapshot).toBeInstanceOf(DocumentSnapshot);
        
        // Verify page count
        expect(snapshot.pageCount).toBe(12);
        
        // Verify fonts array exists
        expect(snapshot.fonts).toBeDefined();
        expect(Array.isArray(snapshot.fonts)).toBe(true);
        
        // Verify pages array
        expect(snapshot.pages).toBeDefined();
        expect(Array.isArray(snapshot.pages)).toBe(true);
        expect(snapshot.pages.length).toBe(12);
        
        // Verify each page snapshot
        for (let i = 0; i < snapshot.pages.length; i++) {
            const pageSnapshot = snapshot.pages[i];
            expect(pageSnapshot).toBeInstanceOf(PageSnapshot);
            expect(pageSnapshot.pageRef).toBeDefined();
            expect(pageSnapshot.pageRef.position.pageIndex).toBe(i);
            expect(pageSnapshot.elements).toBeDefined();
            expect(Array.isArray(pageSnapshot.elements)).toBe(true);
        }
    });

    test('get document snapshot with type filter', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const client = await PDFDancer.open(pdfData, token, baseUrl);

        // Get snapshot filtered by paragraphs only
        const snapshot = await client.getDocumentSnapshot([ObjectType.PARAGRAPH]);
        
        expect(snapshot).toBeDefined();
        expect(snapshot.pageCount).toBe(12);
        
        // Verify all elements are paragraphs
        const allElements = snapshot.getAllElements();
        for (const element of allElements) {
            expect(element.type).toBe(ObjectType.PARAGRAPH);
        }
    });

    test('get document snapshot with multiple type filters', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const client = await PDFDancer.open(pdfData, token, baseUrl);

        // Get snapshot filtered by paragraphs and images
        const snapshot = await client.getDocumentSnapshot([ObjectType.PARAGRAPH, ObjectType.IMAGE]);
        
        expect(snapshot).toBeDefined();
        
        // Verify all elements are either paragraphs or images
        const allElements = snapshot.getAllElements();
        for (const element of allElements) {
            expect([ObjectType.PARAGRAPH, ObjectType.IMAGE]).toContain(element.type);
        }
    });

    test('get page snapshot', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const client = await PDFDancer.open(pdfData, token, baseUrl);

        const pageSnapshot = await client.getPageSnapshot(0);
        
        // Verify snapshot structure
        expect(pageSnapshot).toBeDefined();
        expect(pageSnapshot).toBeInstanceOf(PageSnapshot);
        
        // Verify page reference
        expect(pageSnapshot.pageRef).toBeDefined();
        expect(pageSnapshot.pageRef.position.pageIndex).toBe(0);
        expect(pageSnapshot.pageRef.type).toBe(ObjectType.PAGE);
        
        // Verify elements
        expect(pageSnapshot.elements).toBeDefined();
        expect(Array.isArray(pageSnapshot.elements)).toBe(true);
        expect(pageSnapshot.elements.length).toBeGreaterThan(0);
        
        // Verify each element has required properties
        for (const element of pageSnapshot.elements) {
            expect(element.internalId).toBeDefined();
            expect(element.type).toBeDefined();
            expect(element.position).toBeDefined();
        }
    });

    test('get page snapshot with type filter', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const client = await PDFDancer.open(pdfData, token, baseUrl);

        // Get page snapshot filtered by images only
        const pageSnapshot = await client.getPageSnapshot(0, [ObjectType.IMAGE]);
        
        expect(pageSnapshot).toBeDefined();
        
        // Verify all elements are images
        for (const element of pageSnapshot.elements) {
            expect(element.type).toBe(ObjectType.IMAGE);
        }
    });

    test('get page snapshot via PageClient', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const client = await PDFDancer.open(pdfData, token, baseUrl);

        const page = client.page(1);
        const pageSnapshot = await page.getSnapshot();
        
        // Verify snapshot structure
        expect(pageSnapshot).toBeDefined();
        expect(pageSnapshot).toBeInstanceOf(PageSnapshot);
        expect(pageSnapshot.pageRef.position.pageIndex).toBe(1);
        expect(pageSnapshot.elements.length).toBeGreaterThan(0);
    });

    test('get page snapshot via PageClient with type filter', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const client = await PDFDancer.open(pdfData, token, baseUrl);

        const page = client.page(0);
        const pageSnapshot = await page.getSnapshot([ObjectType.PARAGRAPH]);
        
        expect(pageSnapshot).toBeDefined();
        
        // Verify all elements are paragraphs
        for (const element of pageSnapshot.elements) {
            expect(element.type).toBe(ObjectType.PARAGRAPH);
        }
    });

    test('DocumentSnapshot helper methods', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const client = await PDFDancer.open(pdfData, token, baseUrl);

        const snapshot = await client.getDocumentSnapshot();
        
        // Test getPageSnapshot
        const page0 = snapshot.getPageSnapshot(0);
        expect(page0).toBeDefined();
        expect(page0!.getPageIndex()).toBe(0);
        
        const page5 = snapshot.getPageSnapshot(5);
        expect(page5).toBeDefined();
        expect(page5!.getPageIndex()).toBe(5);
        
        // Test getAllElements
        const allElements = snapshot.getAllElements();
        expect(allElements.length).toBeGreaterThan(0);
        
        // Test getTotalElementCount
        const totalCount = snapshot.getTotalElementCount();
        expect(totalCount).toBe(allElements.length);
        expect(totalCount).toBeGreaterThan(0);
        
        // Test getElementsByType
        const paragraphs = snapshot.getElementsByType(ObjectType.PARAGRAPH);
        expect(paragraphs.length).toBeGreaterThan(0);
        for (const para of paragraphs) {
            expect(para.type).toBe(ObjectType.PARAGRAPH);
        }
    });

    test('PageSnapshot helper methods', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const client = await PDFDancer.open(pdfData, token, baseUrl);

        const pageSnapshot = await client.getPageSnapshot(0);
        
        // Test getPageIndex
        expect(pageSnapshot.getPageIndex()).toBe(0);
        
        // Test getElementCount
        const elementCount = pageSnapshot.getElementCount();
        expect(elementCount).toBe(pageSnapshot.elements.length);
        expect(elementCount).toBeGreaterThan(0);
        
        // Test getElementsByType
        const paragraphs = pageSnapshot.getElementsByType(ObjectType.PARAGRAPH);
        for (const para of paragraphs) {
            expect(para.type).toBe(ObjectType.PARAGRAPH);
        }
    });

    test('snapshot with form fields', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('mixed-form-types.pdf');
        const client = await PDFDancer.open(pdfData, token, baseUrl);

        // Form fields can be TEXT_FIELD, CHECKBOX, or RADIO_BUTTON
        const snapshot = await client.getDocumentSnapshot([
            ObjectType.TEXT_FIELD,
            ObjectType.CHECKBOX,
            ObjectType.RADIO_BUTTON
        ]);

        expect(snapshot).toBeDefined();

        // Get all form field types
        const allFormFields = snapshot.getAllElements();
        expect(allFormFields.length).toBeGreaterThan(0);

        // Verify they are all form field types
        const formFieldTypes = [ObjectType.TEXT_FIELD, ObjectType.CHECKBOX, ObjectType.RADIO_BUTTON];
        for (const field of allFormFields) {
            expect(formFieldTypes).toContain(field.type);
        }
    });

    test('snapshot with paths', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('basic-paths.pdf');
        const client = await PDFDancer.open(pdfData, token, baseUrl);

        const snapshot = await client.getDocumentSnapshot([ObjectType.PATH]);
        
        expect(snapshot).toBeDefined();
        
        // Get all paths
        const paths = snapshot.getElementsByType(ObjectType.PATH);
        expect(paths.length).toBeGreaterThan(0);
        
        // Verify they are all paths
        for (const path of paths) {
            expect(path.type).toBe(ObjectType.PATH);
        }
    });

    test('compare snapshot with individual find operations', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const client = await PDFDancer.open(pdfData, token, baseUrl);

        // Get snapshot
        const snapshot = await client.getPageSnapshot(0);
        const snapshotParagraphs = snapshot.getElementsByType(ObjectType.PARAGRAPH);
        
        // Get paragraphs via page client
        const page = client.page(0);
        const paragraphs = await page.selectParagraphs();
        
        // Should have same count
        expect(snapshotParagraphs.length).toBe(paragraphs.length);
    });

    test('snapshot fonts information', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const client = await PDFDancer.open(pdfData, token, baseUrl);

        const snapshot = await client.getDocumentSnapshot();
        
        // Verify fonts array
        expect(snapshot.fonts).toBeDefined();
        expect(Array.isArray(snapshot.fonts)).toBe(true);
        
        // If there are fonts, verify their structure
        if (snapshot.fonts.length > 0) {
            for (const font of snapshot.fonts) {
                expect(font.fontName).toBeDefined();
                expect(font.fontType).toBeDefined();
                expect(typeof font.similarityScore).toBe('number');
            }
        }
    });

    test('snapshot on empty page', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('Empty.pdf');
        const client = await PDFDancer.open(pdfData, token, baseUrl);

        const snapshot = await client.getDocumentSnapshot();
        
        expect(snapshot).toBeDefined();
        expect(snapshot.pageCount).toBeGreaterThan(0);
        expect(snapshot.pages.length).toBeGreaterThan(0);
        
        // Empty pages might have no elements
        const page0Snapshot = snapshot.getPageSnapshot(0);
        expect(page0Snapshot).toBeDefined();
        expect(page0Snapshot!.elements).toBeDefined();
        expect(Array.isArray(page0Snapshot!.elements)).toBe(true);
    });
});

