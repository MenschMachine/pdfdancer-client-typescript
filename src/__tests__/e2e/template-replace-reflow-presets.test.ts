/**
 * E2E tests for template replacement with reflow presets
 */

import {PDFDancer, ReflowPreset, TemplateReplacement, TemplateReplaceRequest} from '../../index';
import {requireEnvAndFixture} from './test-helpers';
import {PDFAssertions} from './pdf-assertions';

describe('Template Replace With Reflow Presets E2E Tests', () => {

    async function loadThreeColumnFixture(): Promise<PDFDancer> {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('examples/text/three-column-paragraphs.pdf');
        return PDFDancer.open(pdfData, token, baseUrl);
    }

    async function loadObviouslyAwesomeFixture(): Promise<PDFDancer> {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
        return PDFDancer.open(pdfData, token, baseUrl);
    }

    async function getObviouslyAwesomeTitle(pdf: PDFDancer): Promise<string> {
        const paragraph = await pdf.page(1).selectParagraphStartingWith('The Complete');
        expect(paragraph).not.toBeNull();
        return paragraph!.getText()!;
    }

    test('NONE reflow keeps line', async () => {
        const pdf = await loadThreeColumnFixture();

        const success = await pdf.applyReplacements(
            new TemplateReplaceRequest(
                [new TemplateReplacement('Left aligned text starts each measure with a', 'YABBA!')],
                undefined,
                ReflowPreset.NONE
            )
        );
        expect(success).toBe(true);

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertTextlineExists('YABBA', 1);

        const textLine = await pdf.page(1).selectTextLineStartingWith('YABBA!');
        expect(textLine).not.toBeNull();
        expect(textLine!.getText()).toBe('YABBA!');
    });

    test('BEST_EFFORT reflows', async () => {
        const pdf = await loadObviouslyAwesomeFixture();
        const placeholder = await getObviouslyAwesomeTitle(pdf);

        const success = await pdf.applyReplacements(
            new TemplateReplaceRequest(
                [new TemplateReplacement(placeholder, 'BEST_EFFORT_REFLOW_TEXT')],
                undefined,
                ReflowPreset.BEST_EFFORT
            )
        );
        expect(success).toBe(true);

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertParagraphDoesNotExist('The Complete', 1);
        await assertions.assertParagraphExists('BEST_EFFORT_REFLOW_TEXT', 1);
    });

    test('FIT_OR_FAIL fails when replacement too long', async () => {
        const pdf = await loadThreeColumnFixture();

        await expect(pdf.applyReplacements(
            new TemplateReplaceRequest(
                [new TemplateReplacement(
                    'Left aligned text starts each measure with a',
                    'YABBAYABBAYABBAYABBAYABBAYABBAYABBAYABBAYABBAYABBA!'
                )],
                undefined,
                ReflowPreset.FIT_OR_FAIL
            )
        )).rejects.toThrow();
    });

    test('FIT_OR_FAIL fits when replacement fits', async () => {
        const pdf = await loadObviouslyAwesomeFixture();
        const placeholder = await getObviouslyAwesomeTitle(pdf);

        const success = await pdf.applyReplacements(
            new TemplateReplaceRequest(
                [new TemplateReplacement(placeholder, 'FIT_OR_FAIL_TEXT')],
                undefined,
                ReflowPreset.FIT_OR_FAIL
            )
        );
        expect(success).toBe(true);

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertParagraphDoesNotExist('The Complete', 1);
        await assertions.assertParagraphExists('FIT_OR_FAIL_TEXT', 1);
    });
});
