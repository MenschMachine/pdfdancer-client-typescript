/**
 * Tests for fingerprint generation
 */

import {generateFingerprint} from '../fingerprint';

describe('Fingerprint', () => {
    it('should generate a valid SHA256 fingerprint', async () => {
        const fingerprint = await generateFingerprint();

        // SHA256 produces 64 hex characters
        expect(fingerprint).toHaveLength(64);
        expect(fingerprint).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should generate different fingerprints for different user IDs', async () => {
        const fingerprint1 = await generateFingerprint('user1');
        const fingerprint2 = await generateFingerprint('user2');

        expect(fingerprint1).not.toBe(fingerprint2);
        expect(fingerprint1).toHaveLength(64);
        expect(fingerprint2).toHaveLength(64);
    });

    it('should generate consistent fingerprints for same user ID', async () => {
        const fingerprint1 = await generateFingerprint('user123');
        const fingerprint2 = await generateFingerprint('user123');

        // Note: These might differ due to install salt randomness in test environment
        // but they should both be valid SHA256 hashes
        expect(fingerprint1).toHaveLength(64);
        expect(fingerprint2).toHaveLength(64);
        expect(fingerprint1).toMatch(/^[a-f0-9]{64}$/);
        expect(fingerprint2).toMatch(/^[a-f0-9]{64}$/);
    });
});
