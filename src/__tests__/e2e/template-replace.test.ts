/**
 * E2E tests for template replacement operations
 */

import {PDFDancer, ReflowPreset, TemplateReplacement, TemplateReplaceRequest} from '../../index';
import {requireEnvAndFixture} from './test-helpers';

describe('Template Replace E2E Tests', () => {

    test('replace single template placeholder', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        // Use actual text from the PDF as placeholder
        const para = await pdf.page(1).selectParagraphStartingWith('The Complete');
        expect(para).not.toBeNull();

        const replacement = new TemplateReplacement(para!.getText()!, 'REPLACED TEXT');
        const request = new TemplateReplaceRequest([replacement]);

        const result = await pdf.applyReplacements(request);
        expect(result).toBe(true);
    });

    test('replace multiple template placeholders', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        // Get actual paragraphs from the PDF
        const paragraphs = await pdf.page(1).selectParagraphs();
        expect(paragraphs.length).toBeGreaterThan(1);

        const replacements = paragraphs.slice(0, 2).map((p, i) =>
            new TemplateReplacement(p.getText()!, `REPLACEMENT_${i + 1}`)
        );

        const request = new TemplateReplaceRequest(replacements);
        const result = await pdf.applyReplacements(request);

        expect(result).toBe(true);
    });

    test('replace templates with BEST_EFFORT reflow preset', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const para = await pdf.page(1).selectParagraphStartingWith('The Complete');
        expect(para).not.toBeNull();

        const replacement = new TemplateReplacement(
            para!.getText()!,
            'This is a much longer replacement text that might need reflow'
        );
        const request = new TemplateReplaceRequest(
            [replacement],
            undefined,
            ReflowPreset.BEST_EFFORT
        );

        const result = await pdf.applyReplacements(request);

        expect(result).toBe(true);
    });

    test('replace templates with FIT_OR_FAIL reflow preset', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const para = await pdf.page(1).selectParagraphStartingWith('The Complete');
        expect(para).not.toBeNull();

        const replacement = new TemplateReplacement(para!.getText()!, 'Short');
        const request = new TemplateReplaceRequest(
            [replacement],
            undefined,
            ReflowPreset.FIT_OR_FAIL
        );

        const result = await pdf.applyReplacements(request);

        expect(result).toBe(true);
    });

    test('replace templates with NONE reflow preset', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const para = await pdf.page(1).selectParagraphStartingWith('The Complete');
        expect(para).not.toBeNull();

        const replacement = new TemplateReplacement(para!.getText()!, 'No Reflow');
        const request = new TemplateReplaceRequest(
            [replacement],
            undefined,
            ReflowPreset.NONE
        );

        const result = await pdf.applyReplacements(request);

        expect(result).toBe(true);
    });

    test('replace templates on specific page', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        // Use actual text from the PDF
        const para = await pdf.page(1).selectParagraphStartingWith('The Complete');
        expect(para).not.toBeNull();

        const replacement = new TemplateReplacement(para!.getText()!, 'PAGE SPECIFIC');
        const request = new TemplateReplaceRequest(
            [replacement],
            0  // pageIndex 0 = page 1
        );

        const result = await pdf.applyReplacements(request);

        expect(result).toBe(true);
    });

    test('empty replacements array returns success', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const request = new TemplateReplaceRequest([]);
        const result = await pdf.applyReplacements(request);

        expect(result).toBe(true);
    });

    test('TemplateReplacement toDict serializes correctly', () => {
        const replacement = new TemplateReplacement('{{name}}', 'John Doe');
        const dict = replacement.toDict();

        expect(dict.placeholder).toBe('{{name}}');
        expect(dict.text).toBe('John Doe');
        expect(dict.font).toBeUndefined();
        expect(dict.color).toBeUndefined();
    });

    test('TemplateReplaceRequest toDict serializes correctly', () => {
        const replacement = new TemplateReplacement('{{name}}', 'John');
        const request = new TemplateReplaceRequest(
            [replacement],
            0,
            ReflowPreset.BEST_EFFORT
        );

        const dict = request.toDict();

        expect(dict.replacements).toHaveLength(1);
        expect(dict.pageIndex).toBe(0);
        expect(dict.reflowPreset).toBe('BEST_EFFORT');
    });

});
