import {PDFDancer} from '../pdfdancer_v2';
/* global RequestInit */
import {
    PdfAffineTransform,
    PdfColorRequest,
    TextAlignment,
    TextDeleteRequest,
    TextInsertRequest,
    TextOperationDiagnostic,
    TextReplaceRequest,
    TextReplacementImageRequest,
    TextSelectorRequest,
    TextStyleRequest
} from '../text-editing';

global.fetch = jest.fn();

function response(status: number, body: unknown): Response {
    const serialized = typeof body === 'string' ? body : JSON.stringify(body);
    return {
        ok: status >= 200 && status < 300,
        status,
        statusText: status === 200 ? 'OK' : 'Error',
        headers: new Headers(),
        text: async () => serialized,
        json: async () => typeof body === 'string' ? JSON.parse(body) : body,
        arrayBuffer: async () => new ArrayBuffer(0)
    } as Response;
}

const editResponse = {
    matched: 2,
    changed: 1,
    pagesChanged: [1],
    change: [{page: 1, operation: 'replace', effectiveHyphenationEnabled: false}],
    warnings: [],
    errors: []
};

describe('v2 text editing HTTP API', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (global.fetch as jest.Mock).mockReset();
    });

    async function openClient(): Promise<PDFDancer> {
        (global.fetch as jest.Mock).mockResolvedValueOnce(response(200, 'session-123'));
        return PDFDancer.open(new Uint8Array([0x25, 0x50, 0x44, 0x46]), 'token', 'https://example.test');
    }

    test.each([
        ['replace', () => TextReplaceRequest.literal('Acme', 'Globex').build()],
        ['delete', () => TextDeleteRequest.literal('Acme').build()],
        ['insert', () => TextInsertRequest.after('Acme', ' Corp').build()],
        ['style', () => TextStyleRequest.literal('Acme').fillColor(PdfColorRequest.rgb(1, 0, 0)).build()]
    ] as const)('posts document %s requests to the v2 endpoint', async (operation, makeRequest) => {
        const pdf = await openClient();
        (global.fetch as jest.Mock).mockResolvedValueOnce(response(200, editResponse));

        const result = await pdf.text()[operation](makeRequest() as never);

        expect(result).toEqual(editResponse);
        const [url, options] = (global.fetch as jest.Mock).mock.calls[1] as [string, RequestInit];
        expect(url).toBe(`https://example.test/v2/pdf/text/${operation}`);
        expect(options.method).toBe('POST');
        expect((options.headers as Record<string, string>)['Authorization']).toBe('Bearer token');
        expect((options.headers as Record<string, string>)['X-Session-Id']).toBe('session-123');
        expect((options.headers as Record<string, string>)['X-API-VERSION']).toBe('2');
    });

    test('page client overrides an existing document page scope', async () => {
        const pdf = await openClient();
        (global.fetch as jest.Mock).mockResolvedValueOnce(response(200, editResponse));

        await pdf.page(2).text().replace(TextReplaceRequest.literal('Acme', 'Globex').pages(9).build());

        const [, options] = (global.fetch as jest.Mock).mock.calls[1] as [string, RequestInit];
        expect(JSON.parse(options.body as string).pages).toEqual([2]);
    });

    test('page client scopes anchor and coordinate insertion', async () => {
        const pdf = await openClient();
        (global.fetch as jest.Mock)
            .mockResolvedValueOnce(response(200, editResponse))
            .mockResolvedValueOnce(response(200, editResponse));

        await pdf.page(2).text().insert(TextInsertRequest.before('Acme', 'The ').pages(9).build());
        await pdf.page(3).text().insert(TextInsertRequest.at(9, 72, 144, 'Text').font('Helvetica').build());

        const anchorBody = JSON.parse((global.fetch as jest.Mock).mock.calls[1][1].body as string);
        const coordinateBody = JSON.parse((global.fetch as jest.Mock).mock.calls[2][1].body as string);
        expect(anchorBody.target.anchor.pages).toEqual([2]);
        expect(coordinateBody.target.coordinate.page).toBe(3);
    });

    test('replace sends the alignment in the layout and returns the not-honored error without throwing', async () => {
        const pdf = await openClient();
        const notHonored = {
            ...editResponse,
            changed: 0,
            errors: [{page: 1, code: TextOperationDiagnostic.ALIGNMENT_NOT_HONORED, message: 'not honored'}]
        };
        (global.fetch as jest.Mock).mockResolvedValueOnce(response(200, notHonored));

        const result = await pdf.text().replace(
            TextReplaceRequest.literal('Acme', 'Globex').alignment(TextAlignment.RIGHT).build());

        const [, options] = (global.fetch as jest.Mock).mock.calls[1] as [string, RequestInit];
        expect(JSON.parse(options.body as string).layout).toEqual(
            {mode: 'reflowWhenSupported', profile: 'noReflow', alignment: 'right'});
        expect(result.errors?.map(error => error.code)).toEqual(['TEXT_ALIGNMENT_NOT_HONORED']);
    });

    test('image replacement without a layout is sent with a sourceAnchored layout', async () => {
        const pdf = await openClient();
        (global.fetch as jest.Mock).mockResolvedValueOnce(response(200, editResponse));
        const request = new TextReplaceRequest(
            undefined,
            new TextSelectorRequest('{{logo}}'),
            undefined,
            new TextReplacementImageRequest(new Uint8Array([1]), PdfAffineTransform.builder().build())
        );

        await pdf.text().replace(request);

        const [, options] = (global.fetch as jest.Mock).mock.calls[1] as [string, RequestInit];
        expect(JSON.parse(options.body as string).layout).toEqual({mode: 'sourceAnchored'});
    });

    test('session creation also sends the v2 API header', async () => {
        await openClient();
        const [, options] = (global.fetch as jest.Mock).mock.calls[0] as [string, RequestInit];
        expect((options.headers as Record<string, string>)['X-API-VERSION']).toBe('2');
    });
});
