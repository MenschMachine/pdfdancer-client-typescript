import {ObjectType, PDFDancer} from '../../index';
import {requireEnvAndFixture} from './test-helpers';

describe('snapshot behavior', () => {
    test('document snapshot agrees with individual page snapshots', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const document = await pdf.getDocumentSnapshot();
        expect(document.pageCount).toBe((await pdf.pages()).length);
        expect(document.pages).toHaveLength(document.pageCount);

        let total = 0;
        for (let pageNumber = 1; pageNumber <= document.pageCount; pageNumber++) {
            const fromDocument = document.getPageSnapshot(pageNumber)!;
            const individual = await pdf.getPageSnapshot(pageNumber);
            expect(fromDocument.getPageNumber()).toBe(pageNumber);
            expect(individual.getPageNumber()).toBe(pageNumber);
            expect(individual.elements.map(element => element.internalId).sort())
                .toEqual(fromDocument.elements.map(element => element.internalId).sort());
            total += individual.getElementCount();
        }
        expect(document.getTotalElementCount()).toBe(total);
        expect(document.getAllElements()).toHaveLength(total);
    });

    test('page and document snapshot type filters contain only requested types', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const pageImages = await pdf.getPageSnapshot(1, [ObjectType.IMAGE]);
        expect(pageImages.elements.every(element => element.type === ObjectType.IMAGE)).toBe(true);
        expect(pageImages.getElementsByType(ObjectType.IMAGE)).toHaveLength(pageImages.getElementCount());

        const document = await pdf.getDocumentSnapshot([ObjectType.IMAGE, ObjectType.PATH]);
        expect(document.getAllElements().every(element =>
            element.type === ObjectType.IMAGE || element.type === ObjectType.PATH)).toBe(true);
        expect(document.getElementsByType(ObjectType.IMAGE).length).toBeGreaterThan(0);
    });
});
