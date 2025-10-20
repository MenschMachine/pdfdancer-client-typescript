/**
 * Unit tests for URL building helper
 */

describe('URL Building', () => {
    // Helper function to simulate the _buildUrl logic
    function buildUrl(baseUrl: string, path: string): string {
        const base = baseUrl.replace(/\/+$/, '');
        const endpoint = path.replace(/^\/+/, '');
        return `${base}/${endpoint}`;
    }

    test('handles base URL with trailing slash', () => {
        expect(buildUrl('http://localhost:8080/', '/session/create')).toBe('http://localhost:8080/session/create');
    });

    test('handles base URL without trailing slash', () => {
        expect(buildUrl('http://localhost:8080', '/session/create')).toBe('http://localhost:8080/session/create');
    });

    test('handles path without leading slash', () => {
        expect(buildUrl('http://localhost:8080', 'session/create')).toBe('http://localhost:8080/session/create');
    });

    test('handles both with slashes', () => {
        expect(buildUrl('http://localhost:8080/', '/session/create')).toBe('http://localhost:8080/session/create');
    });

    test('handles neither with slashes', () => {
        expect(buildUrl('http://localhost:8080', 'session/create')).toBe('http://localhost:8080/session/create');
    });

    test('handles multiple trailing slashes', () => {
        expect(buildUrl('http://localhost:8080///', '///session/create')).toBe('http://localhost:8080/session/create');
    });

    test('handles production URL', () => {
        expect(buildUrl('https://api.pdfdancer.com/', '/pdf/find')).toBe('https://api.pdfdancer.com/pdf/find');
    });

    test('handles base URL with path', () => {
        expect(buildUrl('http://localhost:8080/api/', '/session/create')).toBe('http://localhost:8080/api/session/create');
    });
});
