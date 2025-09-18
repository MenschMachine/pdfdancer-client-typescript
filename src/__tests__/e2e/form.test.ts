/**
 * E2E tests for form operations
 */

import * as fs from 'fs';
import { ClientV1, Position, ObjectType } from '../../index';
import { requireEnvAndFixture, createTempPath } from './test-helpers';

describe('Form E2E Tests', () => {
  // Tests should fail properly if environment is not configured

  test('delete forms', async () => {
    const [baseUrl, token, pdfData] = await requireEnvAndFixture('mixed-form-types.pdf');
    const client = new ClientV1(token, pdfData, baseUrl, 30000);
    await client.init();

    const forms = await client.findForms();
    expect(forms).toHaveLength(79);
    expect(forms[0].type).toBe(ObjectType.FORM);

    // Delete all forms
    for (const f of forms) {
      expect(await client.delete(f)).toBe(true);
    }

    expect(await client.findForms()).toHaveLength(0);

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
    const [baseUrl, token, pdfData] = await requireEnvAndFixture('mixed-form-types.pdf');
    const client = new ClientV1(token, pdfData, baseUrl, 30000);
    await client.init();

    let forms = await client.findForms(Position.onPageCoordinates(0, 0, 0));
    expect(forms).toHaveLength(0);

    forms = await client.findForms(Position.onPageCoordinates(0, 17, 447));
    expect(forms).toHaveLength(1);
    expect(forms[0].internalId).toBe('FORM_000001');
  });
});