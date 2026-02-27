import { config } from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

let envLoaded = false;

/**
 * Loads environment variables from .env file if it exists.
 * Only loads once per process, subsequent calls are no-ops.
 */
export function loadEnv(): void {
    if (envLoaded) {
        return;
    }

    const envPath = path.resolve(process.cwd(), '.env');

    if (fs.existsSync(envPath)) {
        config({ path: envPath });
    }

    envLoaded = true;
}

export function resetEnvLoader(): void {
    envLoaded = false;
}
