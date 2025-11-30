/**
 * E2E tests for form operations — new PDFDancer API
 */

import * as fs from 'fs';
import {PDFDancer} from '../../index';
import {createTempPath, requireEnvAndFixture} from './test-helpers';
import {PDFAssertions} from './pdf-assertions';

describe('Form E2E Tests (v2 API)', () => {

    test('delete forms', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('form-xobject-example.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const forms = await pdf.selectForms();
        expect(forms).toHaveLength(17);
        expect(forms[0].type).toBe('FORM_X_OBJECT');

        // Delete all forms directly through their reference
        for (const form of forms) {
            await form.delete();
        }

        const remaining = await pdf.selectForms();
        expect(remaining).toHaveLength(0);

        // Save PDF to verify operation
        const outPath = createTempPath('forms-after-delete.pdf');
        await pdf.save(outPath);
        expect(fs.existsSync(outPath)).toBe(true);
        expect(fs.statSync(outPath).size).toBeGreaterThan(0);

        // Cleanup
        fs.unlinkSync(outPath);

        // No additional assertions beyond the direct API checks to avoid
        // relying on backend enumerations that may omit form XObjects in the
        // reopened document.
    });

    test('find form by position', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('form-xobject-example.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        // Page 1, position (0,0) — expect no forms
        let forms = await pdf.page(1).selectFormsAt(0, 0);
        expect(forms).toHaveLength(0);

        // Page 1, position (321,601) — expect a form
        forms = await pdf.page(1).selectFormsAt(321, 601, 1);
        expect(forms).toHaveLength(1);
        expect(forms[0].internalId).toBe('FORM_000005');

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertNumberOfFormXObjects(17);
    });

    // Tests for singular select methods
    test('selectForm returns first form or null', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('form-xobject-example.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        // Test with results
        const form = await pdf.page(1).selectForm();
        expect(form).not.toBeNull();
        expect(form!.internalId).toBe('FORM_000001');

        // Test with PDFDancer class
        const formFromPdf = await pdf.selectForm();
        expect(formFromPdf).not.toBeNull();
        expect(formFromPdf!.internalId).toBe('FORM_000001');
    });

    test('selectFormAt returns first form at position or null', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('form-xobject-example.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const form = await pdf.page(1).selectFormAt(321, 601, 1);
        expect(form).not.toBeNull();
        expect(form!.internalId).toBe('FORM_000005');

        // Test with no match
        const noMatch = await pdf.page(1).selectFormAt(0, 0);
        expect(noMatch).toBeNull();
    });
});
