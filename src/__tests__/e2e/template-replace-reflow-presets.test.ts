/**
 * E2E tests for template replacement with reflow presets
 */

import {PDFDancer, ReflowPreset, TemplateReplacement, TemplateReplaceRequest} from '../../index';
import {requireEnvAndFixture} from './test-helpers';
import {PDFAssertions} from './pdf-assertions';

describe('Template Replace With Reflow Presets E2E Tests', () => {

    async function loadFixture(): Promise<PDFDancer> {
        const [baseUrl, token, pdfData] = await requireEnvAndFixture('examples/text/three-column-paragraphs.pdf');
        return PDFDancer.open(pdfData, token, baseUrl);
    }

    test('NONE reflow keeps line', async () => {
        const pdf = await loadFixture();

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
        const pdf = await loadFixture();

        const success = await pdf.applyReplacements(
            new TemplateReplaceRequest(
                [new TemplateReplacement('Left aligned text starts each measure with a', 'YABBA!')],
                undefined,
                ReflowPreset.BEST_EFFORT
            )
        );
        expect(success).toBe(true);

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertTextlineExists('YABBA', 1);

        const textLine = await pdf.page(1).selectTextLineStartingWith('YABBA!');
        expect(textLine).not.toBeNull();
        expect(textLine!.getText()).toBe('YABBA! stable edge, making the rhythm of');
    });

    test('FIT_OR_FAIL fails when replacement too long', async () => {
        const pdf = await loadFixture();

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
        const pdf = await loadFixture();

        const success = await pdf.applyReplacements(
            new TemplateReplaceRequest(
                [new TemplateReplacement('Left aligned text starts each measure with a', 'YABBA!')],
                undefined,
                ReflowPreset.FIT_OR_FAIL
            )
        );
        expect(success).toBe(true);

        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertTextlineExists('YABBA', 1);

        const textLine = await pdf.page(1).selectTextLineStartingWith('YABBA!');
        expect(textLine).not.toBeNull();
        expect(textLine!.getText()).toBe('YABBA! stable edge, making the rhythm of');
    });
});
