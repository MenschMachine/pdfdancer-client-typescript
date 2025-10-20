/**
 * E2E tests for AcroForm field operations — new PDFDancer API
 */

import {PDFDancer} from '../../index';
import {requireEnvAndFixture} from './test-helpers';
import {PDFAssertions} from './pdf-assertions';

describe('AcroForm Fields E2E Tests (v2 API)', () => {

    test('find form fields', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('mixed-form-types.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const fields = await pdf.selectFormFields();
        expect(fields).toHaveLength(10);
        expect(fields[0].type).toBe('TEXT_FIELD');
        expect(fields[4].type).toBe('CHECK_BOX');
        expect(fields[6].type).toBe('RADIO_BUTTON');

        let allAtOrigin = true;
        for (const f of fields) {
            const pos = f.position;
            if ((pos.getX() ?? 0) !== 0.0 || (pos.getY() ?? 0) !== 0.0) {
                allAtOrigin = false;
            }
        }
        expect(allAtOrigin).toBe(false);

        const firstPageFields = await pdf.page(0).selectFormFields();
        expect(firstPageFields).toHaveLength(10);

        const firstForm = await pdf.page(0).selectFormFieldsAt(290, 460);
        expect(firstForm).toHaveLength(1);
        expect(firstForm[0].type).toBe('RADIO_BUTTON');
        expect(firstForm[0].internalId).toBe('FORM_FIELD_000008');

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertNumberOfFormFields(10);
    });

    test('delete form fields', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('mixed-form-types.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const fields = await pdf.selectFormFields();
        expect(fields).toHaveLength(10);

        const toDelete = fields[5];
        await toDelete.delete();

        const remaining = await pdf.selectFormFields();
        expect(remaining).toHaveLength(9);
        for (const f of remaining) {
            expect(f.internalId).not.toBe(toDelete.internalId);
        }

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertNumberOfFormFields(9);
    });

    test('move form field', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('mixed-form-types.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        let fields = await pdf.page(0).selectFormFieldsAt(290, 460);
        expect(fields).toHaveLength(1);
        const field = fields[0];
        expect(Math.abs((field.position.getX() ?? 0) - 280)).toBeLessThan(0.1);
        expect(Math.abs((field.position.getY() ?? 0) - 455)).toBeLessThan(0.1);

        await field.moveTo(30, 40);

        fields = await pdf.page(0).selectFormFieldsAt(290, 460);
        expect(fields).toHaveLength(0);

        fields = await pdf.page(0).selectFormFieldsAt(30, 40);
        expect(fields).toHaveLength(1);
        expect(fields[0].internalId).toBe(field.internalId);

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertNumberOfFormFields(10);
    });

    test('edit form fields', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('mixed-form-types.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        let fields = await pdf.selectFieldsByName('firstName');
        expect(fields).toHaveLength(1);

        let field = fields[0];
        expect(field.name).toBe('firstName');
        expect(field.value).toBeNull();
        expect(field.type).toBe('TEXT_FIELD');
        expect(field.internalId).toBe('FORM_FIELD_000001');

        await field.fill('Donald Duck');

        fields = await pdf.selectFieldsByName('firstName');
        field = fields[0];
        expect(field.name).toBe('firstName');
        expect(field.value).toBe('Donald Duck');

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertNumberOfFormFields(10);
    });
});
