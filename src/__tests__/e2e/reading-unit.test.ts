import {PDFDancer, ReadingUnitRole, ReadingUnitMode} from '../../index';
import {requireEnvAndFixture} from './test-helpers';

describe('reading-unit endpoints', () => {
    test('document and page analyses expose the same complete page-local data', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('Showcase.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const document = await pdf.analyzeReadingUnits();
        expect(document.mode).toBe(ReadingUnitMode.PRIMARY);
        expect(document.pageCount).toBeGreaterThan(0);
        expect(document.pages).toHaveLength(document.pageCount);
        expect(document.pages.map(page => page.pageNumber)).toEqual(
            Array.from({length: document.pageCount}, (_, index) => index + 1)
        );

        const firstPage = await pdf.page(1).analyzeReadingUnits();
        const documentPage = document.pages[0];
        expect(firstPage).toEqual(documentPage);
        expect(firstPage.units.length).toBeGreaterThan(0);

        const unit = firstPage.units[0];
        expect(Object.values(ReadingUnitRole)).toContain(unit.role);
        expect(unit.rawRole).toBeTruthy();
        expect(typeof unit.id).toBe('string');
        expect(typeof unit.text).toBe('string');
        expect(unit.provenance.pageNumber).toBe(1);
        expect(unit.provenance.sourceElementIds.length).toBeGreaterThan(0);
        expect(unit.provenance.bounds.width).toBeGreaterThanOrEqual(0);
        expect(unit.provenance.bounds.height).toBeGreaterThanOrEqual(0);
        expect(unit.stream.PRIMARY).toBeDefined();
        expect(unit.stream.PRIMARY.included).toBe(true);
        expect(unit.stream.PRIMARY.order).toBeGreaterThan(0);
    });

    test('each analysis call is a fresh request', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('Showcase.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);
        const first = await pdf.page(1).analyzeReadingUnits();
        const second = await pdf.page(1).analyzeReadingUnits();
        expect(second).toEqual(first);
    });
});
