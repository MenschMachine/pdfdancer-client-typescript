import {ValidationException} from '../exceptions';
import {
    PdfAffineTransform,
    PdfColorRequest,
    TextAlignment,
    TextDeleteRequest,
    TextInsertRequest,
    TextLayoutMode,
    TextLayoutProfile,
    TextLayoutRequest,
    TextOperationDiagnostic,
    TextReplaceRequest,
    TextReplacementImageRequest,
    TextSelectorRequest,
    TextStylePatchRequest,
    TextStyleRequest,
    TextStyleSetRequest
} from '../text-editing';

const json = (value: unknown): any => JSON.parse(JSON.stringify(value));

describe('v2 text editing requests', () => {
    test('serializes literal replacement with every selector and layout option', () => {
        const request = TextReplaceRequest.literal('Acme', 'Globex')
            .pages(1, 2)
            .caseSensitive(false)
            .wholeWords(true)
            .maxMatches(3)
            .sourceAnchored()
            .build();

        expect(json(request)).toEqual({
            pages: [1, 2],
            select: {literal: 'Acme', caseSensitive: false, wholeWords: true, maxMatches: 3},
            replaceWith: 'Globex',
            layout: {mode: 'sourceAnchored'}
        });
    });

    test('serializes atomic replacement style overrides', () => {
        const request = TextReplaceRequest.regex('\\bINV-[0-9]{6}\\b', 'invoice')
            .font('Helvetica-Bold')
            .size(17)
            .fillColor(PdfColorRequest.rgb(0.1, 0.2, 0.3))
            .strokeColor(PdfColorRequest.gray(0.4))
            .characterSpacing(0.25)
            .wordSpacing(1.5)
            .requireReflow(TextLayoutProfile.BODY_TEXT)
            .hyphenationEnabled(false)
            .build();

        expect(json(request)).toMatchObject({
            select: {regex: '\\bINV-[0-9]{6}\\b'},
            replaceWith: 'invoice',
            style: {
                font: 'Helvetica-Bold', size: 17,
                fillColor: {space: 'rgb', components: [0.1, 0.2, 0.3]},
                strokeColor: {space: 'gray', components: [0.4]},
                characterSpacing: 0.25, wordSpacing: 1.5
            },
            layout: {mode: 'requireReflow', profile: 'bodyText', hyphenationEnabled: false}
        });
    });

    test('serializes caret-relative image replacement in PDF matrix order', () => {
        const transform = PdfAffineTransform.builder().scale(20, 10).translate(3, -2).build();
        const request = TextReplaceRequest.builder()
            .literal('{{logo}}')
            .replaceWithImage(new Uint8Array([1, 2, 3]), transform)
            .build();

        expect(json(request)).toEqual({
            select: {literal: '{{logo}}'},
            replaceWithImage: {data: 'AQID', transformationMatrix: [20, 0, 0, 10, 3, -2]},
            layout: {mode: 'sourceAnchored'}
        });
    });

    test('serializes delete and anchor insertion requests', () => {
        expect(json(TextDeleteRequest.regex('\\bDRAFT\\b')
            .reflowWhenSupported(TextLayoutProfile.NO_REFLOW).build())).toEqual({
            select: {regex: '\\bDRAFT\\b'},
            layout: {mode: 'reflowWhenSupported', profile: 'noReflow'}
        });

        expect(json(TextInsertRequest.after('Assumptions', ' Overview')
            .pages([1, 2]).wholeWords(true).size(12.5).build())).toEqual({
            target: {anchor: {pages: [1, 2], select: {literal: 'Assumptions', wholeWords: true}, caret: 'after'}},
            insert: ' Overview',
            style: {from: 'anchor', patch: {size: 12.5}}
        });
    });

    test('serializes coordinate insertion with a complete style patch', () => {
        const request = TextInsertRequest.at(1, 72, 144, 'Coordinate Text')
            .rotationDegrees(90)
            .font('Helvetica')
            .size(12)
            .fillColor(PdfColorRequest.rgb(1, 0, 0))
            .build();

        expect(json(request)).toEqual({
            target: {coordinate: {page: 1, x: 72, y: 144, rotationDegrees: 90}},
            insert: 'Coordinate Text',
            style: {patch: {font: 'Helvetica', size: 12, fillColor: {space: 'rgb', components: [1, 0, 0]}}}
        });
    });

    test('allows page clients to complete a coordinate target without a page', () => {
        const request = TextInsertRequest.builder()
            .coordinate(72, 144)
            .insert('Coordinate Text')
            .font('Helvetica')
            .build();

        expect(() => request.validated()).toThrow();
        expect(json(request.withPages([3])).target.coordinate.page).toBe(3);
    });

    test('fluent insertion style fields merge with an explicit patch', () => {
        const patch = TextStylePatchRequest.builder().font('Helvetica').size(11).build();
        const request = TextInsertRequest.after('x', 'y').stylePatch(patch).font('Helvetica-Bold').build();
        expect(json(request).style.patch).toEqual({font: 'Helvetica-Bold', size: 11});
    });

    test('serializes literal and run-filter style selectors', () => {
        const literal = TextStyleRequest.literal('Important')
            .pages(1, 2).font('Helvetica-Bold').resetSpacingOverrides().sourceAnchored().build();
        expect(json(literal)).toMatchObject({
            pages: [1, 2], select: {literal: 'Important'},
            style: {font: 'Helvetica-Bold', resetSpacingOverrides: true},
            layout: {mode: 'sourceAnchored'}
        });

        const runs = TextStyleRequest.runsWhere()
            .whereTextContains('Total')
            .whereFont('Helvetica-Bold')
            .whereSize(12, 0.01)
            .whereWordSpacing(2.5, 0.1)
            .whereContainsUnmappedGlyphs(false)
            .maxMatches(100)
            .fillColor(PdfColorRequest.rgb(1, 0, 0))
            .build();
        expect(json(runs)).toMatchObject({
            select: {runs: {where: {
                textContains: 'Total', font: 'Helvetica-Bold',
                size: {eq: 12, tolerance: 0.01},
                wordSpacing: {eq: 2.5, tolerance: 0.1},
                containsUnmappedGlyphs: false
            }, maxMatches: 100}},
            style: {fillColor: {space: 'rgb', components: [1, 0, 0]}}
        });
    });

    test('page scoping overrides document request scope', () => {
        expect(json(TextReplaceRequest.literal('x', 'y').pages(9).build().withPages([2])).pages).toEqual([2]);
        expect(json(TextInsertRequest.before('x', 'y').pages(9).build().withPages([2])).target.anchor.pages).toEqual([2]);
    });
});

describe('v2 text editing validation', () => {
    test.each([
        () => TextReplaceRequest.literal('', 'x').build(),
        () => TextReplaceRequest.regex(' ', 'x').build(),
        () => TextReplaceRequest.literal('x', 'y').pages(0).build(),
        () => TextReplaceRequest.literal('x', 'y').pages().build(),
        () => TextReplaceRequest.literal('x', 'y').pages([]).build(),
        () => TextReplaceRequest.literal('x', 'y').build().withPages([]),
        () => new TextLayoutRequest('bogus' as TextLayoutMode, TextLayoutProfile.DEFAULT).validated(),
        () => new TextLayoutRequest(TextLayoutMode.REFLOW_WHEN_SUPPORTED, 'bogus' as TextLayoutProfile).validated(),
        () => TextReplaceRequest.literal('x', 'y').maxMatches(0).build(),
        () => TextStyleRequest.literal('x').build(),
        () => TextStyleRequest.runsWhere().fillColor(PdfColorRequest.rgb(1, 0, 0)).build(),
        () => TextInsertRequest.at(0, 1, 2, 'x').font('Helvetica').build(),
        () => TextInsertRequest.at(1, 1, 2, 'x').build(),
        () => TextStylePatchRequest.builder().build(),
        () => TextStyleSetRequest.builder().resetSpacingOverrides().wordSpacing(1).build(),
        () => PdfColorRequest.rgb(1.01, 0, 0),
        () => PdfAffineTransform.fromPdfMatrix([1, 0, 0])
    ])('rejects invalid requests', build => {
        expect(build).toThrow();
    });

    test('sourceAnchored resets a pending hyphenation override', () => {
        const request = TextReplaceRequest.literal('x', 'y')
            .hyphenationEnabled(false)
            .sourceAnchored()
            .build();
        expect(request.layout?.mode).toBe(TextLayoutMode.SOURCE_ANCHORED);
        expect(request.layout?.hyphenationEnabled).toBeUndefined();
    });

    test('image replacement rejects reflow and style overrides', () => {
        const transform = PdfAffineTransform.builder().build();
        expect(() => TextReplaceRequest.builder().literal('x')
            .replaceWithImage(new Uint8Array([1]), transform)
            .reflowWhenSupported(TextLayoutProfile.DEFAULT).build()).toThrow();
        expect(() => TextReplaceRequest.builder().literal('x')
            .replaceWithImage(new Uint8Array([1]), transform)
            .font('Helvetica').build()).toThrow();
    });
});

const NO_REFLOW_RIGHT = {mode: 'reflowWhenSupported', profile: 'noReflow', alignment: 'right'};
const NO_REFLOW_PLAIN = TextLayoutRequest.reflowWhenSupported(TextLayoutProfile.NO_REFLOW);
const imageRequest = (layout?: TextLayoutRequest): TextReplaceRequest => new TextReplaceRequest(
    undefined,
    new TextSelectorRequest('{{logo}}'),
    undefined,
    new TextReplacementImageRequest(new Uint8Array([1]), PdfAffineTransform.builder().build()),
    undefined,
    layout
);

describe('v2 text replace alignment', () => {
    test('alignment values match the API', () => {
        expect(Object.values(TextAlignment)).toEqual(['left', 'right', 'centered', 'justified']);
    });

    test.each(Object.values(TextAlignment))('alignment alone implies reflowWhenSupported with the noReflow profile (%s)', alignment => {
        const request = TextReplaceRequest.literal('a', 'b').alignment(alignment).build();
        expect(json(request).layout).toEqual({mode: 'reflowWhenSupported', profile: 'noReflow', alignment});
    });

    test.each([true, false])('alignment combines with an explicit layout in any order (alignment first: %s)', alignmentFirst => {
        let builder = TextReplaceRequest.literal('a', 'b');
        if (alignmentFirst) builder = builder.alignment(TextAlignment.RIGHT);
        builder = builder.reflowWhenSupported(TextLayoutProfile.NO_REFLOW);
        if (!alignmentFirst) builder = builder.alignment(TextAlignment.RIGHT);
        expect(json(builder.build()).layout).toEqual(NO_REFLOW_RIGHT);
    });

    test('alignment combines with hyphenation and requireReflow', () => {
        const request = TextReplaceRequest.literal('a', 'b')
            .requireReflow(TextLayoutProfile.BODY_TEXT)
            .hyphenationEnabled(false)
            .alignment(TextAlignment.CENTERED)
            .build();
        expect(json(request).layout).toEqual({
            mode: 'requireReflow', profile: 'bodyText', hyphenationEnabled: false, alignment: 'centered'
        });
    });

    test.each([true, false])('alignment with only hyphenation uses the default profile (alignment first: %s)', alignmentFirst => {
        const builder = TextReplaceRequest.literal('a', 'b');
        if (alignmentFirst) builder.alignment(TextAlignment.RIGHT).hyphenationEnabled(false);
        else builder.hyphenationEnabled(false).alignment(TextAlignment.RIGHT);
        expect(json(builder.build()).layout).toEqual({profile: 'noReflow', hyphenationEnabled: false, alignment: 'right'});
    });

    test('a request without alignment has no alignment key', () => {
        const request = TextReplaceRequest.literal('a', 'b').reflowWhenSupported(TextLayoutProfile.NO_REFLOW).build();
        expect(json(request).layout).not.toHaveProperty('alignment');
    });

    test.each([true, false])('alignment with sourceAnchored is rejected (alignment first: %s)', alignmentFirst => {
        const builder = TextReplaceRequest.literal('a', 'b');
        if (alignmentFirst) builder.alignment(TextAlignment.RIGHT).sourceAnchored();
        else builder.sourceAnchored().alignment(TextAlignment.RIGHT);
        expect(() => builder.build()).toThrow(ValidationException);
        expect(() => builder.build()).toThrow('layout.alignment is not valid');
    });

    test('alignment with replaceWithImage is rejected', () => {
        const builder = TextReplaceRequest.builder().literal('x')
            .alignment(TextAlignment.RIGHT)
            .replaceWithImage(new Uint8Array([1]), PdfAffineTransform.builder().build());
        expect(() => builder.build()).toThrow('layout.alignment is not valid with replaceWithImage');
    });

    test('layout() carries alignment and keeps an alignment set by alignment()', () => {
        const withAlignment = NO_REFLOW_PLAIN.withAlignment(TextAlignment.RIGHT);
        expect(json(TextReplaceRequest.literal('a', 'b').layout(withAlignment).build()).layout).toEqual(NO_REFLOW_RIGHT);

        const alignmentFirst = TextReplaceRequest.literal('a', 'b').alignment(TextAlignment.RIGHT).layout(NO_REFLOW_PLAIN).build();
        const layoutFirst = TextReplaceRequest.literal('a', 'b').layout(NO_REFLOW_PLAIN).alignment(TextAlignment.RIGHT).build();
        expect(json(alignmentFirst).layout).toEqual(NO_REFLOW_RIGHT);
        expect(json(layoutFirst).layout).toEqual(NO_REFLOW_RIGHT);

        // A layout with its own alignment replaces the earlier alignment.
        const replaced = TextReplaceRequest.literal('a', 'b')
            .alignment(TextAlignment.LEFT)
            .layout(NO_REFLOW_PLAIN.withAlignment(TextAlignment.CENTERED))
            .build();
        expect(json(replaced).layout.alignment).toBe('centered');
    });

    test('layout request serializes and validates alignment', () => {
        const layout = NO_REFLOW_PLAIN.withAlignment(TextAlignment.RIGHT);
        expect(layout.alignment).toBe(TextAlignment.RIGHT);
        expect(json(layout)).toEqual(NO_REFLOW_RIGHT);
        expect(() => TextLayoutRequest.sourceAnchored().withAlignment(TextAlignment.RIGHT).validated())
            .toThrow('layout.alignment is not valid');
        expect(() => new TextLayoutRequest(undefined, undefined, undefined, 'diagonal' as TextAlignment).validated())
            .toThrow('layout.alignment must be a TextAlignment');
    });

    test('withHyphenationEnabled keeps the alignment', () => {
        const layout = NO_REFLOW_PLAIN.withAlignment(TextAlignment.RIGHT).withHyphenationEnabled(true);
        expect(layout.alignment).toBe(TextAlignment.RIGHT);
        expect(layout.hyphenationEnabled).toBe(true);
    });

    test.each([
        ['delete', () => new TextDeleteRequest(undefined, new TextSelectorRequest('x'), NO_REFLOW_PLAIN.withAlignment(TextAlignment.RIGHT)).validated()],
        ['insert', () => TextInsertRequest.after('x', 'y').layout(NO_REFLOW_PLAIN.withAlignment(TextAlignment.RIGHT)).build()],
        ['style', () => TextStyleRequest.literal('x').font('Helvetica').layout(NO_REFLOW_PLAIN.withAlignment(TextAlignment.RIGHT)).build()]
    ])('%s rejects a layout that has an alignment', (_name, build) => {
        expect(build).toThrow('layout.alignment is valid only for text replace');
    });

    test('the not-honored code matches the API', () => {
        expect(TextOperationDiagnostic.ALIGNMENT_NOT_HONORED).toBe('TEXT_ALIGNMENT_NOT_HONORED');
    });
});

describe('v2 text layout defaults', () => {
    test.each([
        [new TextLayoutRequest(), {profile: 'noReflow'}],
        [new TextLayoutRequest(undefined, undefined, true), {profile: 'noReflow', hyphenationEnabled: true}]
    ])('an omitted mode without a profile uses the default profile', (layout, expected) => {
        expect(layout.validated()).toBe(layout);
        expect(json(layout)).toEqual(expected);
    });

    test('hyphenation alone uses the default profile on every builder', () => {
        const expected = {profile: 'noReflow', hyphenationEnabled: true};
        expect(json(TextReplaceRequest.literal('a', 'b').hyphenationEnabled(true).build()).layout).toEqual(expected);
        expect(json(TextDeleteRequest.literal('x').hyphenationEnabled(true).build()).layout).toEqual(expected);
    });

    test.each([
        [TextLayoutMode.REFLOW_WHEN_SUPPORTED, 'reflowWhenSupported profile'],
        [TextLayoutMode.REQUIRE_REFLOW, 'requireReflow profile']
    ])('an explicit reflow mode without a profile asks for a profile (%s)', (mode, message) => {
        expect(() => new TextLayoutRequest(mode).validated()).toThrow(message);
    });

    test('image replacement rejects a layout with an omitted mode', () => {
        expect(() => imageRequest(new TextLayoutRequest()).validated()).toThrow('replaceWithImage supports only sourceAnchored layout');
    });

    test('image replacement without a layout gets a sourceAnchored layout', () => {
        const request = imageRequest();
        expect(request.validated().layout).toEqual(TextLayoutRequest.sourceAnchored());
        expect(json(request).layout).toEqual({mode: 'sourceAnchored'});
        expect(json(request.withPages([1])).layout).toEqual({mode: 'sourceAnchored'});
    });

    test('image replacement keeps an explicit sourceAnchored layout', () => {
        const layout = TextLayoutRequest.sourceAnchored();
        expect(imageRequest(layout).validated().layout).toBe(layout);
    });
});
