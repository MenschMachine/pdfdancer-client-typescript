/**
 * E2E tests for template replacement with line breaks (\n).
 *
 * Exposes a bug: after replacing a placeholder with text containing \n
 * using noReflow(), both lines render in the PDF but selectTextLines()
 * only returns the first line within the same session. A save/reopen
 * cycle is required for the second line to become selectable.
 */

import {Color, PDFDancer} from '../../index';
import {getBaseUrl, readToken, serverUp} from './test-helpers';
import {PDFAssertions} from './pdf-assertions';

describe('Template Replace with Line Breaks', () => {
    let baseUrl: string;
    let token: string;

    beforeAll(async () => {
        baseUrl = getBaseUrl();
        const tokenValue = readToken();

        if (!await serverUp(baseUrl)) {
            throw new Error(`PDFDancer server not reachable at ${baseUrl}; set PDFDANCER_BASE_URL or start server`);
        }

        if (!tokenValue) {
            throw new Error('PDFDANCER_API_TOKEN not set and no token file found; set env or place jwt-token-*.txt in repo');
        }

        token = tokenValue;
    });

    async function createTemplateWithPlaceholder(): Promise<PDFDancer> {
        const pdf = await PDFDancer.new(
            {pageSize: {width: 612, height: 792}},
            token,
            baseUrl
        );

        await pdf.page(1).newParagraph()
            .text('{{DESCRIPTION}} trailing text.')
            .font('Helvetica', 12)
            .color(new Color(0, 0, 0))
            .at(50, 650)
            .apply();

        return pdf;
    }

    test('noReflow: both lines should be selectable in the same session', async () => {
        const pdf = await createTemplateWithPlaceholder();

        await pdf.replace('{{DESCRIPTION}}', 'First line\nSecond line')
            .noReflow()
            .apply();

        const textLines = await pdf.page(1).selectTextLines();
        const texts = textLines.map(l => l.getText());

        // BUG: only the first line is returned; the second line is missing
        expect(texts).toContain('First line');
        expect(texts).toContain('Second line trailing text.');
    });

    test('noReflow: both lines should be selectable after save/reopen', async () => {
        const pdf = await createTemplateWithPlaceholder();

        await pdf.replace('{{DESCRIPTION}}', 'First line\nSecond line')
            .noReflow()
            .apply();

        // Save and reopen (PDFAssertions does this internally)
        const assertions = await PDFAssertions.create(pdf);
        await assertions.assertTextlineExists('First line', 1);
        await assertions.assertTextlineExists('Second line', 1);
    });

    test('noReflow: lineSpacing edit should take effect in same session', async () => {
        const pdf = await createTemplateWithPlaceholder();

        await pdf.replace('{{DESCRIPTION}}', 'First line\nSecond line')
            .noReflow()
            .apply();

        const paragraphs = await pdf.page(1).selectParagraphsStartingWith('First line');
        expect(paragraphs.length).toBe(1);

        await paragraphs[0].edit().lineSpacing(1.5).apply();

        // Get snapshot to check if lineSpacing was actually applied
        const snapshot = await pdf.page(1).getSnapshot();
        const para = snapshot.elements.find(
            (e: any) => e.type === 'PARAGRAPH' && e._text?.startsWith('First line')
        );

        expect(para).toBeDefined();
        // BUG: _lineSpacings is null in-session because the paragraph
        // has only one internal text line object (the \n split hasn't materialized)
        expect((para as any)._lineSpacings).not.toBeNull();
        expect((para as any)._lineSpacings[0]).toBeCloseTo(1.5, 1);
    });

    test('bestEffort: both lines should be selectable in the same session', async () => {
        const pdf = await createTemplateWithPlaceholder();

        await pdf.replace('{{DESCRIPTION}}', 'First line\nSecond line')
            .bestEffort()
            .apply();

        const textLines = await pdf.page(1).selectTextLines();
        const texts = textLines.map(l => l.getText());

        expect(texts).toContain('First line');
        // With bestEffort, remaining text gets appended to the second line
        expect(texts.some(t => t !== undefined && t.startsWith('Second line'))).toBe(true);
    });

    test('bestEffort: lineSpacing edit should take effect in same session', async () => {
        const pdf = await createTemplateWithPlaceholder();

        await pdf.replace('{{DESCRIPTION}}', 'First line\nSecond line')
            .bestEffort()
            .apply();

        // Get line positions before
        let lines = await pdf.page(1).selectTextLines();
        const linesBefore = lines.map(l => ({
            text: l.getText(),
            y: l.position.getY()
        }));

        const firstBefore = linesBefore.find(l => l.text === 'First line');
        const secondBefore = linesBefore.find(l => l.text?.startsWith('Second line'));
        expect(firstBefore).toBeDefined();
        expect(secondBefore).toBeDefined();
        const gapBefore = firstBefore!.y! - secondBefore!.y!;

        // Edit lineSpacing
        const paragraphs = await pdf.page(1).selectParagraphsStartingWith('First line');
        await paragraphs[0].edit().lineSpacing(3.0).apply();

        // Get line positions after
        lines = await pdf.page(1).selectTextLines();
        const linesAfter = lines.map(l => ({
            text: l.getText(),
            y: l.position.getY()
        }));

        const firstAfter = linesAfter.find(l => l.text === 'First line');
        const secondAfter = linesAfter.find(l => l.text?.startsWith('Second line'));
        expect(firstAfter).toBeDefined();
        expect(secondAfter).toBeDefined();
        const gapAfter = firstAfter!.y! - secondAfter!.y!;

        // lineSpacing(3.0) should produce a larger gap than the default
        expect(gapAfter).toBeGreaterThan(gapBefore);
    });
});
