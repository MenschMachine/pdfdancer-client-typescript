import {PDFDancer, RateLimitException, RetryConfig} from '..';

const sessionResponse = () => new Response('session-id', {status: 200});

describe('canonical retry policy', () => {
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
});
