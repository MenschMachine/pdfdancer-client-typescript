import {PDFDancer, RateLimitException, RetryConfig} from '..';

const sessionResponse = () => new Response('session-id', {status: 200});

describe('retry and rate-limit behavior', () => {
    const originalFetch = global.fetch;

    afterEach(() => {
        global.fetch = originalFetch;
        jest.restoreAllMocks();
    });

    test('maxAttempts includes the initial request', async () => {
        const fetchMock = jest.fn()
            .mockResolvedValueOnce(new Response('temporary', {status: 503}))
            .mockResolvedValueOnce(new Response('temporary', {status: 503}))
            .mockResolvedValueOnce(sessionResponse());
        global.fetch = fetchMock as typeof fetch;

        const retryConfig: RetryConfig = {maxAttempts: 3, initialDelay: 0};
        await PDFDancer.open(new Uint8Array([1]), 'token', 'https://example.test', 30_000, retryConfig);

        expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    test('does not retry a non-retryable response', async () => {
        const fetchMock = jest.fn().mockResolvedValue(new Response('bad request', {status: 400}));
        global.fetch = fetchMock as typeof fetch;

        await expect(PDFDancer.open(
            new Uint8Array([1]),
            'token',
            'https://example.test',
            30_000,
            {maxAttempts: 3, initialDelay: 0}
        )).rejects.toThrow('Failed to create session');
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    test('raises RateLimitException after the final 429', async () => {
        const fetchMock = jest.fn().mockResolvedValue(
            new Response('limited', {status: 429, headers: {'Retry-After': '0'}})
        );
        global.fetch = fetchMock as typeof fetch;

        await expect(PDFDancer.open(
            new Uint8Array([1]),
            'token',
            'https://example.test',
            30_000,
            {maxAttempts: 3, initialDelay: 0}
        )).rejects.toBeInstanceOf(RateLimitException);
        expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    test('retries a network failure when configured', async () => {
        const fetchMock = jest.fn()
            .mockRejectedValueOnce(new TypeError('connection failed'))
            .mockResolvedValueOnce(sessionResponse());
        global.fetch = fetchMock as typeof fetch;

        await PDFDancer.open(
            new Uint8Array([1]), 'token', 'https://example.test', 30_000,
            {maxAttempts: 2, initialDelay: 0, retryOnNetworkError: true}
        );

        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    test.each([0, -1, 1.5])('rejects invalid maxAttempts value %s', async maxAttempts => {
        await expect(PDFDancer.open(
            new Uint8Array([1]), 'token', 'https://example.test', 30_000,
            {maxAttempts} as RetryConfig
        )).rejects.toThrow(/maxAttempts/);
    });

    test.each([
        ['5', 5],
        [undefined, undefined],
        ['invalid', undefined],
        ['-1', undefined],
        ['+1', undefined],
        ['1.5', undefined],
        ['5seconds', undefined],
        ['Mon, 31 Feb 2025 00:00:00 GMT', undefined]
    ])('exposes Retry-After value %s on the final 429', async (header, expected) => {
        const headers: Record<string, string> = header === undefined ? {} : {'Retry-After': header};
        global.fetch = jest.fn().mockResolvedValue(
            new Response('limited', {status: 429, headers})
        ) as typeof fetch;

        try {
            await PDFDancer.open(
                new Uint8Array([1]), 'token', 'https://example.test', 30_000,
                {maxAttempts: 1, initialDelay: 0}
            );
            throw new Error('Expected RateLimitException');
        } catch (error) {
            expect(error).toBeInstanceOf(RateLimitException);
            expect((error as RateLimitException).retryAfter).toBe(expected);
        }
    });

    test('parses an HTTP-date Retry-After value on the final 429', async () => {
        const retryAt = new Date(Date.now() + 30_000).toUTCString();
        global.fetch = jest.fn().mockResolvedValue(
            new Response('limited', {status: 429, headers: {'Retry-After': retryAt}})
        ) as typeof fetch;

        try {
            await PDFDancer.open(
                new Uint8Array([1]), 'token', 'https://example.test', 30_000,
                {maxAttempts: 1, initialDelay: 0}
            );
            throw new Error('Expected RateLimitException');
        } catch (error) {
            expect(error).toBeInstanceOf(RateLimitException);
            expect((error as RateLimitException).retryAfter).toBeGreaterThanOrEqual(0);
            expect((error as RateLimitException).retryAfter).toBeLessThanOrEqual(30);
        }
    });

    test.each([
        'Sun, 06 Nov 1994 08:49:37 GMT',
        'Sunday, 06-Nov-94 08:49:37 GMT',
        'Sun Nov  6 08:49:37 1994'
    ])('parses HTTP-date format %s', async retryAt => {
        global.fetch = jest.fn().mockResolvedValue(
            new Response('limited', {status: 429, headers: {'Retry-After': retryAt}})
        ) as typeof fetch;

        try {
            await PDFDancer.open(
                new Uint8Array([1]), 'token', 'https://example.test', 30_000,
                {maxAttempts: 1, initialDelay: 0}
            );
            throw new Error('Expected RateLimitException');
        } catch (error) {
            expect(error).toBeInstanceOf(RateLimitException);
            expect((error as RateLimitException).retryAfter).toBe(0);
        }
    });
});
