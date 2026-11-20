import {TextLayoutProfile, TextLayoutRequest, TextReplaceRequest} from '../text-editing';

describe('TextLayoutProfile', () => {
    test('KEEP_LINE_BREAKS sends the noReflow wire value', () => {
        expect(TextLayoutProfile.KEEP_LINE_BREAKS).toBe('noReflow');
    });

    test('the deprecated NO_REFLOW is the same value', () => {
        expect(TextLayoutProfile.NO_REFLOW).toBe(TextLayoutProfile.KEEP_LINE_BREAKS);
    });

    test('deprecated and new names produce identical layout JSON', () => {
        const viaOld = TextLayoutRequest.reflowWhenSupported(TextLayoutProfile.NO_REFLOW);
        const viaNew = TextLayoutRequest.reflowWhenSupported(TextLayoutProfile.KEEP_LINE_BREAKS);

        expect(JSON.parse(JSON.stringify(viaOld))).toEqual(JSON.parse(JSON.stringify(viaNew)));
        expect(JSON.parse(JSON.stringify(viaNew)).profile).toBe('noReflow');
    });

    test('a layout without mode or profile defaults to KEEP_LINE_BREAKS', () => {
        const request = JSON.parse(JSON.stringify(
            TextReplaceRequest.literal('a', 'b').layout(new TextLayoutRequest()).build()));

        expect(request.layout.profile).toBe('noReflow');
    });
});
