/**
 * Tests for the retry mechanism in REST API calls.
 */

import {PDFDancer} from '../pdfdancer_v1';
import {RetryConfig} from '../pdfdancer_v1';

// Mock the fetch function
global.fetch = jest.fn();

// Helper to create a mock response
function createMockResponse(status: number, body: unknown = {}): Response {
    const bodyString = typeof body === 'string' ? body : JSON.stringify(body);
    return {
        ok: status >= 200 && status < 300,
        status,
        statusText: status === 200 ? 'OK' : 'Error',
        headers: new Headers(),
        text: async () => bodyString,
        json: async () => typeof body === 'object' ? body : JSON.parse(body as string),
        arrayBuffer: async () => new ArrayBuffer(0),
        blob: async () => new Blob(),
        formData: async () => new FormData(),
        clone: function() {
            return createMockResponse(status, body);
        },
        body: null,
        bodyUsed: false,
        redirected: false,
        type: 'basic',
        url: ''
    } as Response;
}

describe('Retry Mechanism', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (global.fetch as jest.Mock).mockReset();
    });

    describe('RetryConfig', () => {
        test('should use default retry config when none provided', async () => {
            // Mock successful responses
            (global.fetch as jest.Mock)
                .mockResolvedValueOnce(createMockResponse(200, {token: 'test-token'}))
                .mockResolvedValueOnce(createMockResponse(200, 'session-123'));

            const pdfData = new Uint8Array([0x25, 0x50, 0x44, 0x46]); // PDF header

            // Should use default retry config
            await expect(PDFDancer.open(pdfData, 'test-token')).resolves.toBeDefined();
        });

        test('should accept custom retry config', async () => {
            const customRetryConfig: RetryConfig = {
                maxRetries: 5,
                initialDelay: 500,
                maxDelay: 5000,
                retryableStatusCodes: [429, 503],
                retryOnNetworkError: true,
                backoffMultiplier: 3,
                useJitter: false
            };

            (global.fetch as jest.Mock)
                .mockResolvedValueOnce(createMockResponse(200, {token: 'test-token'}))
                .mockResolvedValueOnce(createMockResponse(200, 'session-123'));

            const pdfData = new Uint8Array([0x25, 0x50, 0x44, 0x46]);

            await expect(
                PDFDancer.open(pdfData, 'test-token', undefined, undefined, customRetryConfig)
            ).resolves.toBeDefined();
        });
    });

    describe('Retryable Status Codes', () => {
        test('should retry on 429 (rate limit)', async () => {
            const mockFetch = global.fetch as jest.Mock;

            // First call returns 429, second call succeeds
            // When token is provided, no token fetch call is made
            mockFetch
                .mockResolvedValueOnce(createMockResponse(429, 'Rate limit exceeded'))
                .mockResolvedValueOnce(createMockResponse(200, 'session-123'));

            const pdfData = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
            const retryConfig: RetryConfig = {
                maxRetries: 2,
                initialDelay: 10, // Use short delay for tests
                useJitter: false
            };

            await expect(
                PDFDancer.open(pdfData, 'test-token', undefined, undefined, retryConfig)
            ).resolves.toBeDefined();

            // Should have made 2 fetch calls: 1 failed session + 1 retry
            expect(mockFetch).toHaveBeenCalledTimes(2);
        });

        test('should retry on 500 (server error)', async () => {
            const mockFetch = global.fetch as jest.Mock;

            mockFetch
                .mockResolvedValueOnce(createMockResponse(500, 'Internal server error'))
                .mockResolvedValueOnce(createMockResponse(200, 'session-123'));

            const pdfData = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
            const retryConfig: RetryConfig = {
                maxRetries: 2,
                initialDelay: 10,
                useJitter: false
            };

            await expect(
                PDFDancer.open(pdfData, 'test-token', undefined, undefined, retryConfig)
            ).resolves.toBeDefined();

            expect(mockFetch).toHaveBeenCalledTimes(2);
        });

        test('should retry on 502, 503, 504', async () => {
            for (const statusCode of [502, 503, 504]) {
                jest.clearAllMocks();
                const mockFetch = global.fetch as jest.Mock;

                mockFetch
                    .mockResolvedValueOnce(createMockResponse(statusCode, 'Service unavailable'))
                    .mockResolvedValueOnce(createMockResponse(200, 'session-123'));

                const pdfData = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
                const retryConfig: RetryConfig = {
                    maxRetries: 2,
                    initialDelay: 10,
                    useJitter: false
                };

                await expect(
                    PDFDancer.open(pdfData, 'test-token', undefined, undefined, retryConfig)
                ).resolves.toBeDefined();

                expect(mockFetch).toHaveBeenCalledTimes(2);
            }
        });

        test('should NOT retry on 400 (bad request)', async () => {
            const mockFetch = global.fetch as jest.Mock;

            mockFetch
                .mockResolvedValueOnce(createMockResponse(400, 'Bad request'));

            const pdfData = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
            const retryConfig: RetryConfig = {
                maxRetries: 3,
                initialDelay: 10,
                useJitter: false
            };

            await expect(
                PDFDancer.open(pdfData, 'test-token', undefined, undefined, retryConfig)
            ).rejects.toThrow();

            // Should only make 1 call (no retries for 400)
            expect(mockFetch).toHaveBeenCalledTimes(1);
        });

        test('should NOT retry on 404 (not found)', async () => {
            const mockFetch = global.fetch as jest.Mock;

            mockFetch
                .mockResolvedValueOnce(createMockResponse(404, 'Not found'));

            const pdfData = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
            const retryConfig: RetryConfig = {
                maxRetries: 3,
                initialDelay: 10,
                useJitter: false
            };

            await expect(
                PDFDancer.open(pdfData, 'test-token', undefined, undefined, retryConfig)
            ).rejects.toThrow();

            expect(mockFetch).toHaveBeenCalledTimes(1);
        });
    });

    describe('Network Errors', () => {
        test('should retry on network errors when retryOnNetworkError is true', async () => {
            const mockFetch = global.fetch as jest.Mock;

            mockFetch
                .mockRejectedValueOnce(new Error('Network error'))
                .mockResolvedValueOnce(createMockResponse(200, 'session-123'));

            const pdfData = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
            const retryConfig: RetryConfig = {
                maxRetries: 2,
                initialDelay: 10,
                retryOnNetworkError: true,
                useJitter: false
            };

            await expect(
                PDFDancer.open(pdfData, 'test-token', undefined, undefined, retryConfig)
            ).resolves.toBeDefined();

            expect(mockFetch).toHaveBeenCalledTimes(2);
        });

        test('should NOT retry on network errors when retryOnNetworkError is false', async () => {
            const mockFetch = global.fetch as jest.Mock;

            mockFetch
                .mockRejectedValueOnce(new Error('Network error'));

            const pdfData = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
            const retryConfig: RetryConfig = {
                maxRetries: 3,
                initialDelay: 10,
                retryOnNetworkError: false,
                useJitter: false
            };

            await expect(
                PDFDancer.open(pdfData, 'test-token', undefined, undefined, retryConfig)
            ).rejects.toThrow('Network error');

            expect(mockFetch).toHaveBeenCalledTimes(1);
        });
    });

    describe('Max Retries', () => {
        test('should respect maxRetries limit', async () => {
            const mockFetch = global.fetch as jest.Mock;

            // All calls fail with 503
            mockFetch
                .mockResolvedValue(createMockResponse(503, 'Service unavailable'));

            const pdfData = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
            const retryConfig: RetryConfig = {
                maxRetries: 3,
                initialDelay: 10,
                useJitter: false
            };

            await expect(
                PDFDancer.open(pdfData, 'test-token', undefined, undefined, retryConfig)
            ).rejects.toThrow();

            // Should make: 1 initial session call + 3 retries = 4 total
            expect(mockFetch).toHaveBeenCalledTimes(4);
        });

        test('should not retry when maxRetries is 0', async () => {
            const mockFetch = global.fetch as jest.Mock;

            mockFetch
                .mockResolvedValueOnce(createMockResponse(503, 'Service unavailable'));

            const pdfData = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
            const retryConfig: RetryConfig = {
                maxRetries: 0,
                initialDelay: 10,
                useJitter: false
            };

            await expect(
                PDFDancer.open(pdfData, 'test-token', undefined, undefined, retryConfig)
            ).rejects.toThrow();

            // Should only make 1 call (no retries)
            expect(mockFetch).toHaveBeenCalledTimes(1);
        });
    });

    describe('Exponential Backoff', () => {
        test('should apply exponential backoff between retries', async () => {
            const mockFetch = global.fetch as jest.Mock;
            const delays: number[] = [];
            const originalSetTimeout = global.setTimeout;

            // Mock setTimeout to capture delays
            global.setTimeout = jest.fn((callback: () => void, delay?: number) => {
                if (delay) delays.push(delay);
                return originalSetTimeout(callback, 0);
            }) as unknown as typeof setTimeout;

            mockFetch
                .mockResolvedValueOnce(createMockResponse(503, 'Unavailable'))
                .mockResolvedValueOnce(createMockResponse(503, 'Unavailable'))
                .mockResolvedValueOnce(createMockResponse(200, 'session-123'));

            const pdfData = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
            const retryConfig: RetryConfig = {
                maxRetries: 3,
                initialDelay: 100,
                backoffMultiplier: 2,
                useJitter: false
            };

            await PDFDancer.open(pdfData, 'test-token', undefined, undefined, retryConfig);

            // Restore original setTimeout
            global.setTimeout = originalSetTimeout;

            // Should have 2 delays (for 2 retries that eventually succeeded)
            expect(delays.length).toBeGreaterThanOrEqual(2);

            // First retry delay should be around initialDelay (100ms)
            expect(delays[0]).toBeGreaterThanOrEqual(100);
            expect(delays[0]).toBeLessThan(110);

            // Second retry delay should be around initialDelay * backoffMultiplier (200ms)
            expect(delays[1]).toBeGreaterThanOrEqual(200);
            expect(delays[1]).toBeLessThan(210);
        });

        test('should cap delay at maxDelay', async () => {
            const mockFetch = global.fetch as jest.Mock;
            const delays: number[] = [];
            const originalSetTimeout = global.setTimeout;

            global.setTimeout = jest.fn((callback: () => void, delay?: number) => {
                if (delay) delays.push(delay);
                return originalSetTimeout(callback, 0);
            }) as unknown as typeof setTimeout;

            mockFetch
                .mockResolvedValueOnce(createMockResponse(503, 'Unavailable'))
                .mockResolvedValueOnce(createMockResponse(503, 'Unavailable'))
                .mockResolvedValueOnce(createMockResponse(503, 'Unavailable'))
                .mockResolvedValueOnce(createMockResponse(200, 'session-123'));

            const pdfData = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
            const retryConfig: RetryConfig = {
                maxRetries: 4,
                initialDelay: 1000,
                maxDelay: 2000,
                backoffMultiplier: 2,
                useJitter: false
            };

            await PDFDancer.open(pdfData, 'test-token', undefined, undefined, retryConfig);

            global.setTimeout = originalSetTimeout;

            // All delays should be capped at maxDelay (2000ms)
            delays.forEach(delay => {
                expect(delay).toBeLessThanOrEqual(2000);
            });
        });
    });

    describe('Jitter', () => {
        test('should apply jitter when useJitter is true', async () => {
            const mockFetch = global.fetch as jest.Mock;
            const delays: number[] = [];
            const originalSetTimeout = global.setTimeout;

            global.setTimeout = jest.fn((callback: () => void, delay?: number) => {
                if (delay) delays.push(delay);
                return originalSetTimeout(callback, 0);
            }) as unknown as typeof setTimeout;

            mockFetch
                .mockResolvedValueOnce(createMockResponse(503, 'Unavailable'))
                .mockResolvedValueOnce(createMockResponse(200, 'session-123'));

            const pdfData = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
            const retryConfig: RetryConfig = {
                maxRetries: 2,
                initialDelay: 1000,
                backoffMultiplier: 2,
                useJitter: true
            };

            await PDFDancer.open(pdfData, 'test-token', undefined, undefined, retryConfig);

            global.setTimeout = originalSetTimeout;

            // With jitter, delay should be between 50% and 100% of calculated delay
            // For first retry: should be between 500 (50% of 1000) and 1000
            expect(delays[0]).toBeGreaterThanOrEqual(500);
            expect(delays[0]).toBeLessThanOrEqual(1000);
        });

        test('should not apply jitter when useJitter is false', async () => {
            const mockFetch = global.fetch as jest.Mock;
            const delays: number[] = [];
            const originalSetTimeout = global.setTimeout;

            global.setTimeout = jest.fn((callback: () => void, delay?: number) => {
                if (delay) delays.push(delay);
                return originalSetTimeout(callback, 0);
            }) as unknown as typeof setTimeout;

            mockFetch
                .mockResolvedValueOnce(createMockResponse(503, 'Unavailable'))
                .mockResolvedValueOnce(createMockResponse(200, 'session-123'));

            const pdfData = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
            const retryConfig: RetryConfig = {
                maxRetries: 2,
                initialDelay: 1000,
                backoffMultiplier: 2,
                useJitter: false
            };

            await PDFDancer.open(pdfData, 'test-token', undefined, undefined, retryConfig);

            global.setTimeout = originalSetTimeout;

            // Without jitter, delay should be exactly the calculated value
            expect(delays[0]).toBe(1000);
        });
    });
});
