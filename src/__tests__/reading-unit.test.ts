import {
    ReadingUnit,
    ReadingUnitBounds,
    ReadingUnitPageAnalysis,
    ReadingUnitProvenance,
    ReadingUnitRelationship,
    ReadingUnitRole,
    ReadingUnitStreamMembership
} from '../models';
import {PDFDancer} from '../pdfdancer_v2';

describe('reading-unit models', () => {
    test('preserves unknown enum values while exposing UNKNOWN', () => {
        const relationship = new ReadingUnitRelationship('SIDEBAR_FOR', 'u2');
        const unit = new ReadingUnit(
            'u1', 'SIDEBAR', 'Body',
            {PRIMARY: new ReadingUnitStreamMembership(true, 1)},
            new ReadingUnitProvenance(1, ['text-1'], new ReadingUnitBounds(1, 2, 3, 4)),
            [relationship]
        );
        expect(unit.role).toBe(ReadingUnitRole.UNKNOWN);
        expect(unit.rawRole).toBe('SIDEBAR');
        expect(relationship.rawType).toBe('SIDEBAR_FOR');
    });

    test('keeps complete provenance and stream data', () => {
        const unit = new ReadingUnit(
            'u1', 'PARAGRAPH', 'Body',
            {PRIMARY: new ReadingUnitStreamMembership(true, 1)},
            new ReadingUnitProvenance(2, ['text-1'], new ReadingUnitBounds(10, 20, 30, 40)),
            []
        );
        const page = new ReadingUnitPageAnalysis(2, 'PRIMARY', [unit]);
        expect(page.pageNumber).toBe(2);
        expect(page.units[0].provenance.bounds.width).toBe(30);
        expect(page.units[0].stream.PRIMARY.order).toBe(1);
    });

    test('uses fresh document and page requests without a mode parameter', async () => {
        const client = Object.create(PDFDancer.prototype) as PDFDancer;
        const requests: Array<[string, string, unknown, unknown]> = [];
        (client as any)._makeRequest = jest.fn(async (method: string, path: string, data?: unknown, params?: unknown) => {
            requests.push([method, path, data, params]);
            return {json: async () => path.includes('/page/')
                ? {pageNumber: 2, mode: 'PRIMARY', units: []}
                : {pageCount: 2, mode: 'PRIMARY', pages: []}};
        });

        await client.analyzeReadingUnits();
        await client.analyzeReadingUnits();
        await client.analyzeReadingUnits(2);

        expect(requests).toEqual([
            ['GET', '/pdf/document/reading-units', undefined, undefined],
            ['GET', '/pdf/document/reading-units', undefined, undefined],
            ['GET', '/pdf/page/2/reading-units', undefined, undefined]
        ]);
        await expect(client.analyzeReadingUnits(0)).rejects.toThrow(/pageNumber/);
    });
});
