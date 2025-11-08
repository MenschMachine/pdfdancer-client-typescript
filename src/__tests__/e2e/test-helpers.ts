/**
 * Helper functions for e2e tests
 */

import * as fs from 'fs';
import * as path from 'path';
import os from "os";

/**
 * Get the base URL from environment variable or default
 */
export function getBaseUrl(): string {
    return (process.env.PDFDANCER_BASE_URL || 'http://localhost:8080').trim();
}

/**
 * Read authentication token from environment or token files
 */
export function readToken(): string | null {
    const token = process.env.PDFDANCER_TOKEN;
    if (token) {
        return token.trim();
    }

    // Try common token files in project root
    const projectRoot = path.resolve(__dirname, '../../..');
    const candidates = findFiles(projectRoot, 'jwt-token-*.txt');

    for (const file of candidates) {
        try {
            return fs.readFileSync(file, 'utf-8').trim();
        } catch {
            continue;
        }
    }

    return null;
}

/**
 * Check if server is up and running
 */
export async function serverUp(baseUrl: string): Promise<boolean> {
    try {
        const response = await fetch(`${baseUrl}/ping`, {
            signal: AbortSignal.timeout(60000)
        });
        const text = await response.text();
        let pongReceived = response.status === 200 && text.includes('Pong');
        if (!pongReceived) {
            console.error(`Server did not respond with Pong. Response: ${text}, status ${response.status}`);
        }
        return pongReceived;
    } catch (e) {
        console.error("Server down", e)
        return false;
    }
}

/**
 * Helper to find files matching a pattern
 */
function findFiles(dir: string, pattern: string): string[] {
    try {
        const files = fs.readdirSync(dir);
        const regex = new RegExp(pattern.replace('*', '.*'));
        return files
            .filter(file => regex.test(file))
            .map(file => path.join(dir, file));
    } catch {
        return [];
    }
}

/**
 * Require environment variables and PDF fixture for testing
 */
export async function requireEnvAndFixture(pdfFilename: string): Promise<[string, string, Uint8Array]> {
    const baseUrl = getBaseUrl();
    const token = readToken();

    if (!await serverUp(baseUrl)) {
        throw new Error(`PDFDancer server not reachable at ${baseUrl}; set PDFDANCER_BASE_URL or start server`);
    }

    if (!token) {
        throw new Error('PDFDANCER_TOKEN not set and no token file found; set env or place jwt-token-*.txt in repo');
    }

    // Look for PDF fixture file
    const fixturesDir = path.resolve(__dirname, '../../../fixtures');
    const pdfPath = path.join(fixturesDir, pdfFilename);

    if (!fs.existsSync(pdfPath)) {
        throw new Error(`${pdfFilename} fixture not found at ${pdfPath}`);
    }

    const pdfData = fs.readFileSync(pdfPath);
    return [baseUrl, token, new Uint8Array(pdfData)];
}

/**
 * Helper to open temporary file path (for Node.js environment)
 */
export function createTempPath(filename: string): string {
    const tmpDir =
        process.env.TMPDIR ||
        process.env.TEMP ||
        process.env.TMP ||
        os.tmpdir(); // reliable built-in fallback

    return path.join(tmpDir, filename);
}

/**
 * Helper to read image file for tests
 */
export function readImageFixture(filename: string): Uint8Array {
    const imagePath = getImagePath(filename);

    if (!fs.existsSync(imagePath)) {
        throw new Error(`Image fixture not found: ${filename}`);
    }

    const imageData = fs.readFileSync(imagePath);
    return new Uint8Array(imageData);
}

export function getImagePath(filename: string): string {
    const fixturesDir = path.resolve(__dirname, '../../../fixtures');
    return path.join(fixturesDir, filename);
}

export function getFontPath(filename: string) {
    const fixturesDir = path.resolve(__dirname, '../../../fixtures');
    const fontPath = path.join(fixturesDir, filename);
    return fontPath;
}

/**
 * Helper to read font file for tests
 */
export function readFontFixture(filename: string): Uint8Array {
    const fontPath = getFontPath(filename);

    if (!fs.existsSync(fontPath)) {
        throw new Error(`Font fixture not found: ${filename}`);
    }

    const fontData = fs.readFileSync(fontPath);
    return new Uint8Array(fontData);
}
