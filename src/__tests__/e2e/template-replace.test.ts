/**
 * E2E tests for template replacement operations
 */

import {Color, Image, PDFDancer, ReflowPreset, TemplateReplacement, TemplateReplaceRequest} from '../../index';
import {requireEnvAndFixture, readImageFixture} from './test-helpers';
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

describe('Fluent Replace API Tests', () => {

    test('simple fluent replacement', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const para = await pdf.page(1).selectParagraphStartingWith('The Complete');
        expect(para).not.toBeNull();
        const originalText = para!.getText()!;

        const result = await pdf.replace(originalText, 'FLUENT_SINGLE').apply();
        expect(result).toBe(true);

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertParagraphDoesNotExist('The Complete', 1);
        await assertions.assertParagraphExists('FLUENT_SINGLE', 1);
    });

    test('fluent batch replacement with and()', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const paragraphs = await pdf.page(1).selectParagraphs();
        expect(paragraphs.length).toBeGreaterThan(1);

        const firstText = paragraphs[0].getText()!;
        const secondText = paragraphs[1].getText()!;

        const result = await pdf
            .replace(firstText, 'FLUENT_BATCH_1')
            .and(secondText, 'FLUENT_BATCH_2')
            .apply();
        expect(result).toBe(true);

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertParagraphExists('FLUENT_BATCH_1', 1);
        await assertions.assertParagraphExists('FLUENT_BATCH_2', 1);
    });

    test('fluent replacement with bestEffort()', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const para = await pdf.page(1).selectParagraphStartingWith('The Complete');
        const originalText = para!.getText()!;

        const result = await pdf
            .replace(originalText, 'FLUENT_BEST_EFFORT')
            .bestEffort()
            .apply();
        expect(result).toBe(true);

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertParagraphExists('FLUENT_BEST_EFFORT', 1);
    });

    test('fluent replacement with onPage()', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const para = await pdf.page(1).selectParagraphStartingWith('The Complete');
        const originalText = para!.getText()!;

        const result = await pdf
            .replace(originalText, 'FLUENT_PAGE_SPECIFIC')
            .onPage(1)
            .apply();
        expect(result).toBe(true);

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertParagraphExists('FLUENT_PAGE_SPECIFIC', 1);
    });

    test('fluent replacement with font()', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const para = await pdf.page(1).selectParagraphStartingWith('The Complete');
        const originalText = para!.getText()!;

        const result = await pdf
            .replace(originalText, 'FLUENT_WITH_FONT')
            .font('Helvetica', 14)
            .apply();
        expect(result).toBe(true);

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertParagraphExists('FLUENT_WITH_FONT', 1);
    });

    test('fluent replacement with color()', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const para = await pdf.page(1).selectParagraphStartingWith('The Complete');
        const originalText = para!.getText()!;

        const result = await pdf
            .replace(originalText, 'FLUENT_WITH_COLOR')
            .color(new Color(255, 0, 0))
            .apply();
        expect(result).toBe(true);

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertParagraphExists('FLUENT_WITH_COLOR', 1);
    });

    test('fluent replacement with all options', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const para = await pdf.page(1).selectParagraphStartingWith('The Complete');
        const originalText = para!.getText()!;

        const result = await pdf
            .replace(originalText, 'FLUENT_FULL_OPTIONS')
            .font('Helvetica', 12)
            .color(new Color(0, 0, 255))
            .onPage(1)
            .bestEffort()
            .apply();
        expect(result).toBe(true);

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertParagraphExists('FLUENT_FULL_OPTIONS', 1);
    });

});

describe('Template Replace With Image E2E Tests', () => {

    test('replace placeholder with image using builder', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const para = await pdf.page(1).selectParagraphStartingWith('The Complete');
        expect(para).not.toBeNull();
        const placeholderText = para!.getText()!;

        const result = await pdf.replace()
            .replaceWithImage(placeholderText, 'fixtures/logo-80.png')
            .noReflow()
            .apply();

        expect(result).toBe(true);

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertParagraphDoesNotExist('The Complete', 1);
    });

    test('replace placeholder with image using Uint8Array', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const para = await pdf.page(1).selectParagraphStartingWith('The Complete');
        expect(para).not.toBeNull();
        const placeholderText = para!.getText()!;

        const imageData = readImageFixture('logo-80.png');
        const result = await pdf.replace()
            .replaceWithImage(placeholderText, imageData)
            .noReflow()
            .apply();

        expect(result).toBe(true);

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertParagraphDoesNotExist('The Complete', 1);
    });

    test('replace placeholder with image with explicit size', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const para = await pdf.page(1).selectParagraphStartingWith('The Complete');
        expect(para).not.toBeNull();
        const placeholderText = para!.getText()!;

        const result = await pdf.replace()
            .replaceWithImage(placeholderText, 'fixtures/logo-80.png', 100, 50)
            .noReflow()
            .apply();

        expect(result).toBe(true);

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertParagraphDoesNotExist('The Complete', 1);
    });

    test('mixed text and image replacements in one batch', async () => {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        const pdf = await PDFDancer.open(pdfData, token, baseUrl);

        const paragraphs = await pdf.page(1).selectParagraphs();
        expect(paragraphs.length).toBeGreaterThan(1);

        const firstText = paragraphs[0].getText()!;
        const secondText = paragraphs[1].getText()!;

        const result = await pdf.replace()
            .replaceWithImage(firstText, 'fixtures/logo-80.png')
            .and(secondText, 'TEXT_REPLACEMENT_IN_BATCH')
            .noReflow()
            .apply();

        expect(result).toBe(true);

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertParagraphExists('TEXT_REPLACEMENT_IN_BATCH', 1);
    });

    test('TemplateReplacement toDict serializes image correctly', () => {
        const imageData = new Uint8Array([0x89, 0x50, 0x4E, 0x47]);
        const image = new Image(undefined, 'png', 100, 50, imageData);
        const replacement = new TemplateReplacement('{{logo}}', undefined, undefined, undefined, image);
        const dict = replacement.toDict();

        expect(dict.placeholder).toBe('{{logo}}');
        expect(dict.text).toBeUndefined();
        expect(dict.image).toBeDefined();
        expect(dict.image.format).toBe('png');
        expect(dict.image.size).toEqual({ width: 100, height: 50 });
        expect(dict.image.data).toBe(btoa(String.fromCharCode(0x89, 0x50, 0x4E, 0x47)));
    });

    test('TemplateReplacement toDict omits image when not set', () => {
        const replacement = new TemplateReplacement('{{name}}', 'John');
        const dict = replacement.toDict();

        expect(dict.placeholder).toBe('{{name}}');
        expect(dict.text).toBe('John');
        expect(dict.image).toBeUndefined();
    });
});
