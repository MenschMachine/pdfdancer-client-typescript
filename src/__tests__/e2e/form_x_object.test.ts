/**
 * E2E tests for form operations
 */

import * as fs from 'fs';
import {ClientV1, ObjectType, Position} from '../../index';
import {createTempPath, requireEnvAndFixture} from './test-helpers';

describe('Form E2E Tests', () => {
    // Tests should fail properly if environment is not configured

    test('delete forms', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('form-xobject-example.pdf');
        const client = await ClientV1.create(token, pdfData, baseUrl);

        const forms = await client.findFormXObjects();
        expect(forms).toHaveLength(17);
        expect(forms[0].type).toBe(ObjectType.FORM_X_OBJECT);

        // Delete all forms
        for (const f of forms) {
            expect(await client.delete(f)).toBe(true);
        }

        expect(await client.findFormXObjects()).toHaveLength(0);

        // Save PDF to verify operation
        const outPath = createTempPath('forms-after-delete.pdf');
        const outputPdfData = await client.getPdfFile();
        fs.writeFileSync(outPath, outputPdfData);
        expect(fs.existsSync(outPath)).toBe(true);
        expect(fs.statSync(outPath).size).toBeGreaterThan(0);

        // Cleanup
        fs.unlinkSync(outPath);
    });

    test('find form by position', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('form-xobject-example.pdf');
        const client = await ClientV1.create(token, pdfData, baseUrl);

        let forms = await client.findFormXObjects(Position.atPageCoordinates(0, 0, 0));
        expect(forms).toHaveLength(0);

        forms = await client.findFormXObjects(Position.atPageCoordinates(0, 321, 601));
        expect(forms).toHaveLength(1);
        expect(forms[0].internalId).toBe('FORM_000005');
    });
});
