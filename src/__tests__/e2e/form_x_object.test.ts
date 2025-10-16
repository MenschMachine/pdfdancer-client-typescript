/**
 * E2E tests for form operations — new PDFDancer API
 */

import * as fs from 'fs';
import {PDFDancer} from '../../index';
import {createTempPath, requireEnvAndFixture} from './test-helpers';

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
    });

    test('find form by position', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('form-xobject-example.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        // Page 0, position (0,0) — expect no forms
        let forms = await pdf.page(0).selectFormsAt(0, 0);
        expect(forms).toHaveLength(0);

        // Page 0, position (321,601) — expect a form
        forms = await pdf.page(0).selectFormsAt(321, 601);
        expect(forms).toHaveLength(1);
        expect(forms[0].internalId).toBe('FORM_000005');
    });
});
