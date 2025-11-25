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
        expect(fields[4].type).toBe('CHECKBOX');
        expect(fields[6].type).toBe('RADIO_BUTTON');

        let allAtOrigin = true;
        for (const f of fields) {
            const pos = f.position;
            if ((pos.getX() ?? 0) !== 0.0 || (pos.getY() ?? 0) !== 0.0) {
                allAtOrigin = false;
            }
        }
        expect(allAtOrigin).toBe(false);

        const firstPageFields = await pdf.page(1).selectFormFields();
        expect(firstPageFields).toHaveLength(10);

        const firstForm = await pdf.page(1).selectFormFieldsAt(280, 455, 1);
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

        let fields = await pdf.page(1).selectFormFieldsAt(280, 455, 1);
        expect(fields).toHaveLength(1);
        const field = fields[0];
        expect(Math.abs((field.position.getX() ?? 0) - 280)).toBeLessThan(0.1);
        expect(Math.abs((field.position.getY() ?? 0) - 455)).toBeLessThan(0.1);

        await field.moveTo(30, 40);

        fields = await pdf.page(1).selectFormFieldsAt(280, 455, 1);
        expect(fields).toHaveLength(0);

        fields = await pdf.page(1).selectFormFieldsAt(30, 40, 1);
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

    // Tests for singular select methods
    test('selectFormField returns first field or null', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('mixed-form-types.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        // Test with results
        const field = await pdf.page(1).selectFormField();
        expect(field).not.toBeNull();
        expect(field!.internalId).toBe('FORM_FIELD_000001');

        // Test with PDFDancer class
        const fieldFromPdf = await pdf.selectFormField();
        expect(fieldFromPdf).not.toBeNull();
        expect(fieldFromPdf!.internalId).toBe('FORM_FIELD_000001');
    });

    test('selectFormFieldByName returns first field by name or null', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('mixed-form-types.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const field = await pdf.page(1).selectFormFieldByName('firstName');
        expect(field).not.toBeNull();
        expect(field!.name).toBe('firstName');
        expect(field!.internalId).toBe('FORM_FIELD_000001');

        // Test with no match
        const noMatch = await pdf.page(1).selectFormFieldByName('nonExistent');
        expect(noMatch).toBeNull();
    });

    test('selectFieldByName returns first field by name or null', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('mixed-form-types.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const field = await pdf.selectFieldByName('firstName');
        expect(field).not.toBeNull();
        expect(field!.name).toBe('firstName');
        expect(field!.internalId).toBe('FORM_FIELD_000001');

        // Test with no match
        const noMatch = await pdf.selectFieldByName('nonExistent');
        expect(noMatch).toBeNull();
    });

    test('selectFormFieldAt returns first field at position or null', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('mixed-form-types.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const field = await pdf.page(1).selectFormFieldAt(280, 455, 1);
        expect(field).not.toBeNull();
        expect(field!.type).toBe('RADIO_BUTTON');
        expect(field!.internalId).toBe('FORM_FIELD_000008');

        // Test with no match
        const noMatch = await pdf.page(1).selectFormFieldAt(1000, 1000, 1);
        expect(noMatch).toBeNull();
    });
});
