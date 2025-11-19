/**
 * Fingerprint generation for PDFDancer client
 * Generates a unique fingerprint hash to identify client requests
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * Get the install salt from localStorage (browser) or file storage (Node.js)
 * This creates a persistent identifier for this client installation
 */
function getInstallSalt(): string {
    const storageKey = 'pdfdancer_install_salt';

    // Check if we're in a browser environment with functional localStorage
    if (typeof localStorage !== 'undefined' && typeof localStorage.getItem === 'function') {
        let salt = localStorage.getItem(storageKey);
        if (!salt) {
            salt = crypto.randomBytes(16).toString('hex');
            localStorage.setItem(storageKey, salt);
        }
        return salt;
    }

    // Node.js environment - use file storage
    try {
        const saltDir = path.join(os.homedir(), '.pdfdancer');
        const saltFile = path.join(saltDir, 'install_salt');

        // Create directory if it doesn't exist
        if (!fs.existsSync(saltDir)) {
            fs.mkdirSync(saltDir, {recursive: true, mode: 0o700});
        }

        // Read existing salt or generate new one
        if (fs.existsSync(saltFile)) {
            return fs.readFileSync(saltFile, 'utf8').trim();
        } else {
            const salt = crypto.randomBytes(16).toString('hex');
            fs.writeFileSync(saltFile, salt, {mode: 0o600});
            return salt;
        }
    } catch (error) {
        // Fallback to generating a new salt if file operations fail
        return crypto.randomBytes(16).toString('hex');
    }
}

/**
 * Attempt to get the client's IP address
 * Note: This is limited on the client side and may not always be accurate
 */
async function getClientIP(): Promise<string> {
    // In the browser, just return a placeholder
    if (typeof window !== 'undefined') {
        return 'client-unknown';
    }

    // --- Running on server side ---
    // Try to find a non-internal IPv4 address from network interfaces
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        const netList = interfaces[name];
        if (!netList) continue;
        for (const net of netList) {
            if (net.family === 'IPv4' && !net.internal) {
                return net.address;
            }
        }
    }

    // Fallback if nothing found
    return 'server-unknown';
}

/**
 * Get the OS type
 */
function getOSType(): string {
    // Check if we're in Node.js
    if (typeof process !== 'undefined' && process.platform) {
        return process.platform;
    }

    // Browser environment
    if (typeof navigator !== 'undefined') {
        const userAgent = navigator.userAgent.toLowerCase();
        if (userAgent.includes('win')) return 'windows';
        if (userAgent.includes('mac')) return 'macos';
        if (userAgent.includes('linux')) return 'linux';
        if (userAgent.includes('android')) return 'android';
        if (userAgent.includes('iphone') || userAgent.includes('ipad')) return 'ios';
    }

    return 'unknown';
}

/**
 * Get the current hostname
 */
function getHostname(): string {
    // Node.js environment
    if (typeof process !== 'undefined') {
        try {
            return os.hostname();
        } catch {
            // Fall through to browser logic
        }
    }

    // Browser environment
    if (typeof window !== 'undefined' && window.location) {
        return window.location.hostname;
    }

    return 'unknown';
}

/**
 * Get the timezone
 */
function getTimezone(): string {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
        return 'unknown';
    }
}

/**
 * Get the locale
 */
function getLocale(): string {
    try {
        if (typeof navigator !== 'undefined' && navigator.language) {
            return navigator.language;
        }
        return Intl.DateTimeFormat().resolvedOptions().locale;
    } catch {
        return 'unknown';
    }
}

/**
 * Generate a fingerprint hash from client data points
 *
 * @param userId Optional user ID to include in the fingerprint
 * @returns SHA256 hash of fingerprint components
 */
export async function generateFingerprint(userId?: string): Promise<string> {
    const ip = await getClientIP();
    const uid = userId || 'unknown';
    const osType = getOSType();
    const sdkLanguage = 'typescript';
    const timezone = getTimezone();
    const locale = getLocale();
    const domain = getHostname();
    const installSalt = getInstallSalt();

    // Hash individual components
    const ipHash = crypto.createHash('sha256').update(ip).digest('hex');
    const uidHash = crypto.createHash('sha256').update(uid).digest('hex');
    const domainHash = crypto.createHash('sha256').update(domain).digest('hex');

    // Concatenate all components and hash
    const fingerprintData =
        ipHash +
        uidHash +
        osType +
        sdkLanguage +
        timezone +
        locale +
        domainHash +
        installSalt;

    const fingerprintHash = crypto.createHash('sha256').update(fingerprintData).digest('hex');

    return fingerprintHash;
}
