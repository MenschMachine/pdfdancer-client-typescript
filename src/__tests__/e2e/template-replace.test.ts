/**
 * E2E tests for template replacement operations
 */

import {PDFDancer, ReflowPreset, TemplateReplacement, TemplateReplaceRequest} from '../../index';
import {requireEnvAndFixture} from './test-helpers';
import {PDFAssertions} from './pdf-assertions';

describe('Template Replace E2E Tests', () => {

    test('replace single template placeholder removes original text', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const para = await pdf.page(1).selectParagraphStartingWith('The Complete');
        expect(para).not.toBeNull();
        const originalText = para!.getText()!;

        const replacement = new TemplateReplacement(originalText, 'SINGLE_REPLACEMENT');
        const request = new TemplateReplaceRequest(
            [replacement],
            undefined,
            ReflowPreset.NONE
        );

        const result = await pdf.applyReplacements(request);
        expect(result).toBe(true);

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertParagraphDoesNotExist('The Complete', 1);
        await assertions.assertParagraphExists('SINGLE_REPLACEMENT', 1);
    });

    test('replace multiple template placeholders', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const paragraphs = await pdf.page(1).selectParagraphs();
        expect(paragraphs.length).toBeGreaterThan(1);

        const first = paragraphs[0];
        const second = paragraphs[1];
        const firstText = first.getText()!;
        const secondText = second.getText()!;

        const replacements = [
            new TemplateReplacement(firstText, 'MULTI_REPLACE_1'),
            new TemplateReplacement(secondText, 'MULTI_REPLACE_2')
        ];

        const request = new TemplateReplaceRequest(replacements);
        const result = await pdf.applyReplacements(request);
        expect(result).toBe(true);

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertParagraphExists('MULTI_REPLACE_1', 1);
        await assertions.assertParagraphExists('MULTI_REPLACE_2', 1);
    });

    test('replace templates with BEST_EFFORT reflow preset', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const para = await pdf.page(1).selectParagraphStartingWith('The Complete');
        expect(para).not.toBeNull();
        const originalText = para!.getText()!;

        const replacement = new TemplateReplacement(
            originalText,
            'BEST_EFFORT_REFLOW_TEXT'
        );
        const request = new TemplateReplaceRequest(
            [replacement],
            undefined,
            ReflowPreset.BEST_EFFORT
        );

        const result = await pdf.applyReplacements(request);
        expect(result).toBe(true);

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertParagraphDoesNotExist('The Complete', 1);
        await assertions.assertParagraphExists('BEST_EFFORT_REFLOW_TEXT', 1);
    });

    test('replace templates with FIT_OR_FAIL reflow preset', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const para = await pdf.page(1).selectParagraphStartingWith('The Complete');
        expect(para).not.toBeNull();
        const originalText = para!.getText()!;

        const replacement = new TemplateReplacement(originalText, 'FIT_OR_FAIL_TEXT');
        const request = new TemplateReplaceRequest(
            [replacement],
            undefined,
            ReflowPreset.FIT_OR_FAIL
        );

        const result = await pdf.applyReplacements(request);
        expect(result).toBe(true);

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertParagraphDoesNotExist('The Complete', 1);
        await assertions.assertParagraphExists('FIT_OR_FAIL_TEXT', 1);
    });

    test('replace templates with NONE reflow preset', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const para = await pdf.page(1).selectParagraphStartingWith('The Complete');
        expect(para).not.toBeNull();
        const originalText = para!.getText()!;

        const replacement = new TemplateReplacement(originalText, 'NONE_REFLOW_TEXT');
        const request = new TemplateReplaceRequest(
            [replacement],
            undefined,
            ReflowPreset.NONE
        );

        const result = await pdf.applyReplacements(request);
        expect(result).toBe(true);

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertParagraphDoesNotExist('The Complete', 1);
        await assertions.assertParagraphExists('NONE_REFLOW_TEXT', 1);
    });

    test('replace templates on specific page', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const para = await pdf.page(1).selectParagraphStartingWith('The Complete');
        expect(para).not.toBeNull();
        const originalText = para!.getText()!;

        const replacement = new TemplateReplacement(originalText, 'PAGE_SPECIFIC_TEXT');
        const request = new TemplateReplaceRequest(
            [replacement],
            0  // pageIndex 0 = page 1
        );

        const result = await pdf.applyReplacements(request);
        expect(result).toBe(true);

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertParagraphDoesNotExist('The Complete', 1);
        await assertions.assertParagraphExists('PAGE_SPECIFIC_TEXT', 1);
    });

    test('empty replacements array returns success without changes', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const request = new TemplateReplaceRequest([]);
        const result = await pdf.applyReplacements(request);
        expect(result).toBe(true);

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertParagraphExists('The Complete', 1);
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
