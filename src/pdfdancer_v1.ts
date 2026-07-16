/**
 * PDFDancer TypeScript client for the v2 API
 *
 * A TypeScript client that provides session-based PDF manipulation operations with strict validation.
 */

import {
    FontNotFoundException,
    HttpClientException,
    PdfDancerException,
    RateLimitException,
    SessionException,
    SessionNotFoundException,
    ValidationException
} from './exceptions';
import {
    AddPageRequest,
    AddRequest,
    BoundingRect,
    ChangeFormFieldRequest,
    Color,
    CommandResult,
    CreatePdfRequest,
    DeleteRequest,
    DocumentFontInfo,
    DocumentSnapshot,
    FindRequest,
    Font,
    FormFieldRef,
    Image,
    ImageTransformRequest,
    ModifyPathRequest,
    MovePageRequest,
    MoveRequest,
    ObjectRef,
    ObjectType,
    Orientation,
    PageRef,
    PageSize,
    PageSizeInput,
    PageSnapshot,
    Path,
    PathObjectRef,
    Position,
    PositionMode,
    ShapeType,
    PathGroupInfo,
    PathGroupTransformType
} from './models';
import {PageBuilder} from './page-builder';
import {loadEnv} from './env-loader';
import {
    FormFieldObject,
    FormXObject,
    ImageObject,
    PathObject,
    PathGroupObject
} from "./types";
import {ImageBuilder} from "./image-builder";
import {BezierBuilder, LineBuilder, PathBuilder, RectangleBuilder} from "./path-builder";
import {generateFingerprint} from "./fingerprint";
import {VERSION} from "./version";
import {
    TextClient,
    TextDeleteRequest,
    TextEditResponse,
    TextInsertRequest,
    TextOperation,
    TextReplaceRequest,
    TextStyleRequest
} from './text-editing';
import fs from "fs";
import path from "node:path";

/**
 * Configuration for retry mechanism on REST API calls.
 */
export interface RetryConfig {
    /**
     * Total number of attempts, including the initial request (default: 3)
     */
    maxAttempts?: number;

    /**
     * Initial delay in milliseconds before first retry (default: 1000)
     * Subsequent delays use exponential backoff
     */
    initialDelay?: number;

    /**
     * Maximum delay in milliseconds between retries (default: 5000)
     */
    maxDelay?: number;

    /**
     * HTTP status codes that should trigger a retry (default: [429, 500, 502, 503, 504])
     */
    retryableStatusCodes?: number[];

    /**
     * Whether to retry on network errors (connection failures, timeouts) (default: true)
     */
    retryOnNetworkError?: boolean;

    /**
     * Exponential backoff multiplier (default: 2)
     */
    backoffMultiplier?: number;

    /**
     * Whether to respect Retry-After headers from server responses (default: true)
     * When enabled, the client will use the server-specified delay instead of exponential backoff
     * for responses that include a Retry-After header (typically 429 or 503 responses)
     */
    respectRetryAfter?: boolean;
}

/**
 * Default retry configuration
 */
const DEFAULT_RETRY_CONFIG: Required<RetryConfig> = {
    maxAttempts: 3,
    initialDelay: 1000,
    maxDelay: 5000,
    retryableStatusCodes: [408, 429, 500, 502, 503, 504, 520],
    retryOnNetworkError: true,
    backoffMultiplier: 2,
    respectRetryAfter: true
};

function resolveRetryConfig(config?: RetryConfig): Required<RetryConfig> {
    const resolved = {...DEFAULT_RETRY_CONFIG, ...config};
    if (!Number.isInteger(resolved.maxAttempts) || resolved.maxAttempts < 1) {
        throw new ValidationException('Retry maxAttempts must be an integer of at least 1');
    }
    if (![resolved.initialDelay, resolved.maxDelay].every(value => Number.isFinite(value) && value >= 0)) {
        throw new ValidationException('Retry delays must be finite nonnegative numbers');
    }
    if (!Number.isFinite(resolved.backoffMultiplier) || resolved.backoffMultiplier < 1) {
        throw new ValidationException('Retry backoffMultiplier must be at least 1');
    }
    return resolved;
}

const API_VERSION_PATH = 'v2';

function buildVersionedUrl(baseUrl: string, path: string): string {
    const base = baseUrl.replace(/\/+$/, '');
    const endpoint = path.replace(/^\/+/, '');
    const versionPrefix = `/${API_VERSION_PATH}`;

    if (base.endsWith(versionPrefix)) {
        return `${base}/${endpoint}`;
    }

    return `${base}${versionPrefix}/${endpoint}`;
}

/**
 * Static helper function for retry logic with exponential backoff.
 * Used by static methods that don't have access to instance retry config.
 */
async function fetchWithRetry(
    url: string,
    // eslint-disable-next-line no-undef
    options: RequestInit,
    retryConfig: Required<RetryConfig>,
    timeout?: number
): Promise<Response> {
    let lastError: Error | null = null;
    let lastResponse: Response | null = null;

    for (let attempt = 0; attempt < retryConfig.maxAttempts; attempt++) {
        try {
            const attemptOptions = {
                ...options,
                signal: timeout && timeout > 0 ? AbortSignal.timeout(timeout) : options.signal
            };
            const response = await fetch(url, attemptOptions);

            // Check if we should retry based on status code
            if (!response.ok && retryConfig.retryableStatusCodes.includes(response.status)) {
                lastResponse = response;

                // If this is not the last attempt, wait and retry
                if (attempt < retryConfig.maxAttempts - 1) {
                    let delay: number;

                    // Check for Retry-After header if configured
                    if (retryConfig.respectRetryAfter && response.status === 429) {
                        const retryAfterDelay = parseRetryAfter(response);
                        if (retryAfterDelay !== null) {
                            // Use Retry-After header value, but cap at maxDelay
                            delay = Math.min(retryAfterDelay, retryConfig.maxDelay);
                        } else {
                            // Fall back to exponential backoff
                            delay = calculateRetryDelay(attempt, retryConfig);
                        }
                    } else {
                        // Use exponential backoff
                        delay = calculateRetryDelay(attempt, retryConfig);
                    }
                    await sleep(delay);
                    continue;
                }
            }

            // Request succeeded or non-retryable error
            return response;

        } catch (error) {
            lastError = error as Error;

            // Check if this is a network error and we should retry
            if (retryConfig.retryOnNetworkError && attempt < retryConfig.maxAttempts - 1) {
                const delay = calculateRetryDelay(attempt, retryConfig);
                await sleep(delay);
                continue;
            }

            // Non-retryable error or last attempt
            throw error;
        }
    }

    // If we exhausted all retries due to retryable status codes, return the last response
    if (lastResponse) {
        return lastResponse;
    }

    // If we exhausted all retries due to network errors, throw the last error
    if (lastError) {
        throw lastError;
    }

    // This should never happen, but just in case
    throw new Error('Unexpected retry exhaustion');
}

/**
 * Parses the Retry-After header from a response.
 * Supports both delay-seconds (integer) and HTTP-date formats.
 * Returns the delay in milliseconds, or null if the header is invalid or missing.
 */
function parseRetryAfter(response: Response): number | null {
    const retryAfter = response.headers.get('Retry-After');
    if (!retryAfter) {
        return null;
    }

    // Try parsing as delay-seconds (integer)
    const delaySeconds = parseInt(retryAfter, 10);
    if (!isNaN(delaySeconds) && delaySeconds >= 0) {
        return delaySeconds * 1000; // Convert to milliseconds
    }

    // Try parsing as HTTP-date
    try {
        const retryDate = new Date(retryAfter);
        if (!isNaN(retryDate.getTime())) {
            const now = Date.now();
            const delay = retryDate.getTime() - now;
            // Only return positive delays
            return delay > 0 ? delay : 0;
        }
    } catch {
        // Invalid date format
    }

    return null;
}

/**
 * Calculates the delay for the next retry attempt using exponential backoff.
 */
function calculateRetryDelay(attemptNumber: number, retryConfig: Required<RetryConfig>): number {
    // Calculate base delay: initialDelay * (backoffMultiplier ^ attemptNumber)
    let delay = retryConfig.initialDelay * Math.pow(retryConfig.backoffMultiplier, attemptNumber);

    // Cap at maxDelay
    delay = Math.min(delay, retryConfig.maxDelay);

    return Math.floor(delay);
}

/**
 * Sleep for the specified number of milliseconds.
 */
function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Generate a timestamp string in the format expected by the API.
 * Format: YYYY-MM-DDTHH:MM:SS.ffffffZ (with microseconds)
 */
function generateTimestamp(): string {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    const day = String(now.getUTCDate()).padStart(2, '0');
    const hours = String(now.getUTCHours()).padStart(2, '0');
    const minutes = String(now.getUTCMinutes()).padStart(2, '0');
    const seconds = String(now.getUTCSeconds()).padStart(2, '0');
    const milliseconds = String(now.getUTCMilliseconds()).padStart(3, '0');
    // Add 3 more zeros for microseconds (JavaScript doesn't have microsecond precision)
    const microseconds = milliseconds + '000';
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${microseconds}Z`;
}


// 👇 Internal view of PDFDancer methods, not exported
interface PDFDancerInternals {

    toImageObjects(objectRefs: ObjectRef[]): ImageObject[];

    toPathObjects(objectRefs: ObjectRef[]): PathObject[];

    toFormXObjects(objectRefs: ObjectRef[]): FormXObject[];

    toFormFields(formFieldRefs: FormFieldRef[]): FormFieldObject[];

    findFormFields(position?: Position): Promise<FormFieldRef[]>;

    findPaths(position?: Position): Promise<ObjectRef[]>;

    findFormXObjects(position?: Position): Promise<ObjectRef[]>;

    _findImages(position?: Position): Promise<ObjectRef[]>;

    createPathGroup(pageIndex: number, pathIds: string[]): Promise<PathGroupObject>;
    createPathGroupInRegion(pageIndex: number, region: BoundingRect): Promise<PathGroupObject>;
    listPathGroups(pageIndex: number): Promise<PathGroupObject[]>;
    clearPathGroupClipping(pageNumber: number, groupId: string): Promise<boolean>;
    createTextClient(pageNumber?: number): TextClient;
}

export class PageClient {

    private _pageNumber: number;
    private _client: PDFDancer;
    type: ObjectType = ObjectType.PAGE;
    position: Position;
    internalId: string;
    pageSize?: PageSize;
    orientation?: Orientation;
    private _internals: PDFDancerInternals;

    constructor(client: PDFDancer, pageNumber: number, pageRef?: PageRef) {
        this._client = client;
        this._pageNumber = pageNumber;
        this.internalId = pageRef?.internalId ?? `PAGE-${this._pageNumber}`;
        this.position = pageRef?.position ?? Position.atPage(this._pageNumber);
        this.pageSize = pageRef?.pageSize;
        this.orientation = pageRef?.orientation;
        // Cast to the internal interface to get access
        this._internals = this._client as unknown as PDFDancerInternals;
    }

    async selectPathsAt(x: number, y: number, tolerance: number = 0.01) {
        return this._internals.toPathObjects(await this._internals.findPaths(Position.atPageCoordinates(this._pageNumber, x, y, tolerance)));
    }

    async selectPaths() {
        return this._internals.toPathObjects(await this._internals.findPaths(Position.atPage(this._pageNumber)));
    }

    async groupPaths(pathIds: string[]): Promise<PathGroupObject> {
        const pageIndex = this._pageNumber - 1;
        return this._internals.createPathGroup(pageIndex, pathIds);
    }

    async groupPathsInRegion(region: BoundingRect): Promise<PathGroupObject> {
        const pageIndex = this._pageNumber - 1;
        return this._internals.createPathGroupInRegion(pageIndex, region);
    }

    async getPathGroups(): Promise<PathGroupObject[]> {
        const pageIndex = this._pageNumber - 1;
        return this._internals.listPathGroups(pageIndex);
    }

    async selectImages() {
        return this._internals.toImageObjects(await this._internals._findImages(Position.atPage(this._pageNumber)));
    }

    async selectImagesAt(x: number, y: number, tolerance: number = 0.01) {
        return this._internals.toImageObjects(await this._internals._findImages(Position.atPageCoordinates(this._pageNumber, x, y, tolerance)));
    }

    async delete(): Promise<boolean> {
        return this._client.deletePage(this._pageNumber);
    }

    async moveTo(targetPageNumber: number): Promise<boolean> {
        const moved = await this._client.movePage(this._pageNumber, targetPageNumber);
        if (moved) {
            this._pageNumber = targetPageNumber;
            this.position = Position.atPage(targetPageNumber);
        }
        return moved;
    }

    // noinspection JSUnusedGlobalSymbols
    async selectForms() {
        return this._internals.toFormXObjects(await this._internals.findFormXObjects(Position.atPage(this._pageNumber)));
    }

    async selectFormsAt(x: number, y: number, tolerance: number = 0.01) {
        return this._internals.toFormXObjects(await this._internals.findFormXObjects(Position.atPageCoordinates(this._pageNumber, x, y, tolerance)));
    }

    async selectFormFields() {
        return this._internals.toFormFields(await this._internals.findFormFields(Position.atPage(this._pageNumber)));
    }

    async selectFormFieldsAt(x: number, y: number, tolerance: number = 0.01) {
        return this._internals.toFormFields(await this._internals.findFormFields(Position.atPageCoordinates(this._pageNumber, x, y, tolerance)));
    }

    // noinspection JSUnusedGlobalSymbols
    async selectFormFieldsByName(fieldName: string) {
        let pos = Position.atPage(this._pageNumber);
        pos.name = fieldName;
        return this._internals.toFormFields(await this._internals.findFormFields(pos));
    }


    async selectElements(types?: ObjectType[]) {
        const snapshot = await this._client.getPageSnapshot(this._pageNumber, types);
        return snapshot.elements;
    }


    newImage() {
        return new ImageBuilder(this._client, this._pageNumber);
    }

    newPath() {
        return new PathBuilder(this._client, this._pageNumber);
    }

    newLine() { return new LineBuilder(this._client, this._pageNumber); }
    newBezier() { return new BezierBuilder(this._client, this._pageNumber); }
    newRectangle() { return new RectangleBuilder(this._client, this._pageNumber); }


    /**
     * Gets a snapshot of this page, including all elements.
     * Optionally filter by object types.
     */
    async getSnapshot(types?: ObjectType[]): Promise<PageSnapshot> {
        return this._client.getPageSnapshot(this._pageNumber, types);
    }

    text(): TextClient {
        return this._internals.createTextClient(this._pageNumber);
    }

    // Singular convenience methods - return the first element or null

    async selectPath() {
        const paths = await this.selectPaths();
        return paths.length > 0 ? paths[0] : null;
    }

    async selectPathAt(x: number, y: number, tolerance: number = 0.01) {
        const paths = await this.selectPathsAt(x, y, tolerance);
        return paths.length > 0 ? paths[0] : null;
    }

    async selectImage() {
        const images = await this.selectImages();
        return images.length > 0 ? images[0] : null;
    }

    async selectImageAt(x: number, y: number, tolerance: number = 0.01) {
        const images = await this.selectImagesAt(x, y, tolerance);
        return images.length > 0 ? images[0] : null;
    }

    async selectForm() {
        const forms = await this.selectForms();
        return forms.length > 0 ? forms[0] : null;
    }

    async selectFormAt(x: number, y: number, tolerance: number = 0.01) {
        const forms = await this.selectFormsAt(x, y, tolerance);
        return forms.length > 0 ? forms[0] : null;
    }

    async selectFormField() {
        const fields = await this.selectFormFields();
        return fields.length > 0 ? fields[0] : null;
    }

    async selectFormFieldAt(x: number, y: number, tolerance: number = 0.01) {
        const fields = await this.selectFormFieldsAt(x, y, tolerance);
        return fields.length > 0 ? fields[0] : null;
    }

    async selectFormFieldByName(fieldName: string) {
        const fields = await this.selectFormFieldsByName(fieldName);
        return fields.length > 0 ? fields[0] : null;
    }

}

// noinspection ExceptionCaughtLocallyJS,JSUnusedLocalSymbols
/**
 * REST API client for interacting with the PDFDancer PDF manipulation service.
 * This client provides a convenient TypeScript interface for performing PDF operations
 * including session management, object searching, manipulation, and retrieval.
 * Handles authentication, session lifecycle, and HTTP communication transparently.
 *
 */
export class PDFDancer {
    private _token: string;
    private _baseUrl: string;
    private _readTimeout: number;
    private _pdfBytes: Uint8Array;
    private _sessionId!: string;
    private _userId?: string;
    private _fingerprintCache?: string;
    private _retryConfig: Required<RetryConfig>;

    // Snapshot caches for optimizing find operations
    private _documentSnapshotCache: DocumentSnapshot | null = null;
    private _pageSnapshotCache: Map<number, PageSnapshot> = new Map();
    private _pagesCache: PageRef[] | null = null;

    /**
     * Creates a new client with PDF data.
     * This constructor initializes the client, uploads the PDF data to open
     * a new session, and prepares the client for PDF manipulation operations.
     */
    private constructor(
        token: string,
        pdfData: Uint8Array | ArrayBuffer | string,
        baseUrl: string | null = null,
        readTimeout: number = 30000,
        retryConfig?: RetryConfig
    ) {

        if (!token || !token.trim()) {
            throw new ValidationException("Authentication token cannot be null or empty");
        }


        // Normalize baseUrl
        const resolvedBaseUrl =
            (baseUrl && baseUrl.trim()) ||
            process.env.PDFDANCER_BASE_URL ||
            "https://api.pdfdancer.com";

        // Basic validation — ensures it's a valid absolute URL
        try {
            new URL(resolvedBaseUrl);
        } catch {
            throw new ValidationException(`Invalid base URL: ${resolvedBaseUrl}`);
        }

        this._token = token.trim();
        this._baseUrl = resolvedBaseUrl.replace(/\/$/, ''); // Remove trailing slash
        this._readTimeout = readTimeout;

        // Merge retry config with defaults
        this._retryConfig = resolveRetryConfig(retryConfig);

        // Process PDF data with validation
        this._pdfBytes = this._processPdfData(pdfData);

        // Initialize caches
        this._documentSnapshotCache = null;
        this._pageSnapshotCache = new Map();
        this._pagesCache = null;
    }

    /**
     * Initialize the client by creating a session.
     * Must be called after constructor before using the client.
     */
    private async init(): Promise<this> {
        this._sessionId = await this._createSession();
        return this;
    }

    /**
     * Opens a PDF document for manipulation.
     *
     * @param pdfData PDF data as Uint8Array (raw bytes) or string (filepath)
     * @param token Authentication token (optional, falls back to PDFDANCER_API_TOKEN or PDFDANCER_TOKEN env var)
     * @param baseUrl Base URL for the PDFDancer API (optional)
     * @param timeout Request timeout in milliseconds (default: 30000)
     * @param retryConfig Retry configuration (optional, uses defaults if not specified)
     * @returns A PDFDancer client instance
     */
    static async open(
        pdfData: Uint8Array | string | ArrayBuffer,
        token?: string,
        baseUrl?: string,
        timeout?: number,
        retryConfig?: RetryConfig
    ): Promise<PDFDancer> {
        loadEnv();

        const resolvedBaseUrl =
            baseUrl ??
            process.env.PDFDANCER_BASE_URL ??
            "https://api.pdfdancer.com";
        const resolvedTimeout = timeout ?? 30000;

        let resolvedToken = token?.trim() ?? process.env.PDFDANCER_API_TOKEN?.trim() ?? process.env.PDFDANCER_TOKEN?.trim() ?? null;
        if (!resolvedToken) {
            resolvedToken = await PDFDancer._obtainAnonymousToken(resolvedBaseUrl, resolvedTimeout, retryConfig);
        }

        const client = new PDFDancer(resolvedToken, pdfData, resolvedBaseUrl, resolvedTimeout, retryConfig);
        return await client.init();
    }

    /**
     * Creates a new, blank PDF document with the specified parameters.
     *
     * @param options Configuration options for the new PDF
     * @param options.pageSize Page size (default: "A4")
     * @param options.orientation Page orientation (default: "PORTRAIT")
     * @param options.initialPageCount Number of initial pages (default: 1)
     * @param token Authentication token (optional, falls back to PDFDANCER_API_TOKEN or PDFDANCER_TOKEN env var)
     * @param baseUrl Base URL for the PDFDancer API (optional)
     * @param timeout Request timeout in milliseconds (default: 30000)
     * @param retryConfig Retry configuration (optional, uses defaults if not specified)
     */
    static async new(
        options?: {
            pageSize?: PageSizeInput;
            orientation?: Orientation;
            initialPageCount?: number;
        },
        token?: string,
        baseUrl?: string,
        timeout?: number,
        retryConfig?: RetryConfig
    ): Promise<PDFDancer> {
        loadEnv();

        const resolvedBaseUrl =
            baseUrl ??
            process.env.PDFDANCER_BASE_URL ??
            "https://api.pdfdancer.com";
        const resolvedTimeout = timeout ?? 30000;

        let resolvedToken = token?.trim() ?? process.env.PDFDANCER_API_TOKEN?.trim() ?? process.env.PDFDANCER_TOKEN?.trim() ?? null;
        if (!resolvedToken) {
            resolvedToken = await PDFDancer._obtainAnonymousToken(resolvedBaseUrl, resolvedTimeout, retryConfig);
        }

        let createRequest: CreatePdfRequest;
        try {
            createRequest = new CreatePdfRequest(
                options?.pageSize ?? "A4",
                options?.orientation ?? Orientation.PORTRAIT,
                options?.initialPageCount ?? 1
            );
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            throw new ValidationException(message);
        }

        try {
            const url = buildVersionedUrl(resolvedBaseUrl, '/session/new');

            // Generate fingerprint for this request
            const fingerprint = await generateFingerprint();

            // Make request to create endpoint with retry logic
            const response = await fetchWithRetry(
                url,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${resolvedToken}`,
                        'Content-Type': 'application/json',
                        'X-Generated-At': generateTimestamp(),
                        'X-Fingerprint': fingerprint,
                        'X-API-VERSION': '2',
                        'X-PDFDancer-Client': `typescript/${VERSION}`
                    },
                    body: JSON.stringify(createRequest.toDict()),
                },
                resolveRetryConfig(retryConfig),
                resolvedTimeout
            );

            if (!response.ok) {
                const errorText = await response.text();
                if (response.status === 429) {
                    const delay = parseRetryAfter(response);
                    throw new RateLimitException(
                        `API rate limit exceeded while creating PDF: ${errorText}`,
                        response,
                        delay === null ? undefined : Math.ceil(delay / 1000)
                    );
                }
                throw new HttpClientException(`Failed to create new PDF: ${errorText}`, response);
            }

            const sessionId = (await response.text()).trim();

            if (!sessionId) {
                throw new SessionException("Server returned empty session ID");
            }

            const client = Object.create(PDFDancer.prototype) as PDFDancer;
            client._token = resolvedToken.trim();
            client._baseUrl = resolvedBaseUrl.replace(/\/+$/, '');
            client._readTimeout = resolvedTimeout;
            client._pdfBytes = new Uint8Array();
            client._sessionId = sessionId;
            // Initialize retry config
            client._retryConfig = resolveRetryConfig(retryConfig);
            // Initialize caches
            client._documentSnapshotCache = null;
            client._pageSnapshotCache = new Map();
            client._pagesCache = null;
            return client;
        } catch (error) {
            if (error instanceof HttpClientException || error instanceof SessionException || error instanceof ValidationException) {
                throw error;
            }
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new HttpClientException(`Failed to create new PDF: ${errorMessage}`, undefined, error as Error);
        }
    }

    private static async _obtainAnonymousToken(
        baseUrl: string,
        timeout: number = 30000,
        retryConfig?: RetryConfig
    ): Promise<string> {
        const url = buildVersionedUrl(baseUrl || "https://api.pdfdancer.com", '/keys/anon');

        try {
            const fingerprint = await generateFingerprint();
            const response = await fetchWithRetry(
                url,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Fingerprint': fingerprint,
                        'X-Generated-At': generateTimestamp(),
                        'X-API-VERSION': '2',
                        'X-PDFDancer-Client': `typescript/${VERSION}`
                    }
                },
                resolveRetryConfig(retryConfig),
                timeout
            );

            if (!response.ok) {
                const errorText = await response.text().catch(() => '');
                if (response.status === 429) {
                    const delay = parseRetryAfter(response);
                    throw new RateLimitException(
                        'API rate limit exceeded while obtaining anonymous token',
                        response,
                        delay === null ? undefined : Math.ceil(delay / 1000)
                    );
                }
                throw new HttpClientException(
                    `Failed to obtain anonymous token: ${errorText || `HTTP ${response.status}`}`,
                    response
                );
            }

            const tokenPayload: any = await response.json().catch(() => null);
            const tokenValue = typeof tokenPayload?.token === 'string' ? tokenPayload.token.trim() : '';

            if (!tokenValue) {
                throw new HttpClientException("Invalid anonymous token response format", response);
            }

            return tokenValue;
        } catch (error) {
            if (error instanceof HttpClientException) {
                throw error;
            }
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new HttpClientException(`Failed to obtain anonymous token: ${errorMessage}`, undefined, error as Error);
        }
    }

    /**
     * Process PDF data from various input types with strict validation.
     */
    private _processPdfData(pdfData: Uint8Array | ArrayBuffer | string): Uint8Array {
        if (!pdfData) {
            throw new ValidationException("PDF data cannot be null");
        }

        try {
            if (pdfData && (pdfData.constructor === Uint8Array || Buffer.isBuffer(pdfData))) {
                if (pdfData.length === 0) {
                    throw new ValidationException("PDF data cannot be empty");
                }
                return pdfData;
            } else if (pdfData instanceof ArrayBuffer) {
                const uint8Array = new Uint8Array(pdfData);
                if (uint8Array.length === 0) {
                    throw new ValidationException("PDF data cannot be empty");
                }
                return uint8Array;
            } else if (typeof pdfData === 'string') {
                // Handle string as filepath
                if (!fs.existsSync(pdfData)) {
                    throw new ValidationException(`PDF file not found: ${pdfData}`);
                }
                const fileData = new Uint8Array(fs.readFileSync(pdfData));
                if (fileData.length === 0) {
                    throw new ValidationException("PDF file is empty");
                }
                return fileData;
            } else {
                throw new ValidationException(`Unsupported PDF data type: ${typeof pdfData}`);
            }
        } catch (error) {
            if (error instanceof ValidationException) {
                throw error;
            }
            throw new PdfDancerException(`Failed to process PDF data: ${error}`, error as Error);
        }
    }

    /**
     * Build a URL path ensuring no double slashes.
     * Combines baseUrl and path while handling trailing/leading slashes.
     */
    private _buildUrl(path: string): string {
        return buildVersionedUrl(this._baseUrl, path);
    }

    /**
     * Extract meaningful error messages from API response.
     * Parses JSON error responses with _embedded.errors structure.
     */
    private async _extractErrorMessage(response?: Response): Promise<string> {
        if (!response) {
            return "Unknown error";
        }

        try {
            const errorData = await response.json() as any;

            // Check for embedded errors structure
            if (errorData._embedded?.errors) {
                const errors = errorData._embedded.errors;
                if (Array.isArray(errors)) {
                    const messages = errors
                        .filter(error => error.message)
                        .map(error => error.message);

                    if (messages.length > 0) {
                        return messages.join("; ");
                    }
                }
            }

            // Check for top-level message
            if (errorData.message) {
                return errorData.message;
            }

            // Fallback to response text or status
            return await response.text() || `HTTP ${response.status}`;
        } catch {
            // If JSON parsing fails, return response text or status
            try {
                return await response.text() || `HTTP ${response.status}`;
            } catch {
                return `HTTP ${response.status}`;
            }
        }
    }

    /**
     * Creates a new PDF processing session by uploading the PDF data.
     */
    private async _createSession(): Promise<string> {
        try {
            const formData = new FormData();

            const blob = new Blob([this._pdfBytes.buffer as ArrayBuffer], {type: 'application/pdf'});
            formData.append('pdf', blob, 'document.pdf');

            const fingerprint = await this._getFingerprint();

            const response = await this._fetchWithRetry(
                this._buildUrl('/session/create'),
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this._token}`,
                        'X-Generated-At': generateTimestamp(),
                        'X-Fingerprint': fingerprint,
                        'X-API-VERSION': '2',
                        'X-PDFDancer-Client': `typescript/${VERSION}`
                    },
                    body: formData
                },
                this._readTimeout
            );

            if (!response.ok) {
                const errorMessage = await this._extractErrorMessage(response);

                if (response.status === 401 || response.status === 403) {
                    const defaultMessage = "Authentication with the PDFDancer API failed. Confirm that your API token is valid, has not expired, and is authorized for the requested environment.";
                    const normalized = errorMessage?.trim() ?? "";
                    const message = normalized && normalized !== "Unauthorized" && normalized !== "Forbidden"
                        ? normalized
                        : defaultMessage;
                    throw new ValidationException(message);
                }

                if (response.status === 429) {
                    const delay = parseRetryAfter(response);
                    throw new RateLimitException(
                        `API rate limit exceeded while creating session: ${errorMessage}`,
                        response,
                        delay === null ? undefined : Math.ceil(delay / 1000)
                    );
                }

                throw new HttpClientException(`Failed to create session: ${errorMessage}`, response);
            }

            const sessionId = (await response.text()).trim();

            if (!sessionId) {
                throw new SessionException("Server returned empty session ID");
            }

            return sessionId;
        } catch (error) {
            if (error instanceof HttpClientException || error instanceof SessionException || error instanceof ValidationException) {
                throw error;
            }
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new HttpClientException(`Failed to create session: ${errorMessage}`, undefined, error as Error);
        }
    }

    /**
     * Get or generate the fingerprint for this client
     */
    private async _getFingerprint(): Promise<string> {
        if (!this._fingerprintCache) {
            this._fingerprintCache = await generateFingerprint(this._userId);
        }
        return this._fingerprintCache;
    }

    /**
     * Executes a fetch request with retry logic based on the configured retry policy.
     * Implements exponential backoff with optional jitter.
     */
    private async _fetchWithRetry(
        url: string,
        // eslint-disable-next-line no-undef
        options: RequestInit,
        timeout?: number
    ): Promise<Response> {
        return fetchWithRetry(url, options, this._retryConfig, timeout);
    }

    /**
     * Make HTTP request with session headers and error handling.
     */
    private async _makeRequest(
        method: string,
        path: string,
        data?: Record<string, any>,
        params?: Record<string, string>
    ): Promise<Response> {
        const url = new URL(this._buildUrl(path));
        if (params) {
            Object.entries(params).forEach(([key, value]) => {
                url.searchParams.append(key, value);
            });
        }

        const fingerprint = await this._getFingerprint();

        const headers: Record<string, string> = {
            'Authorization': `Bearer ${this._token}`,
            'X-Session-Id': this._sessionId,
            'Content-Type': 'application/json',
            'X-Generated-At': generateTimestamp(),
            'X-Fingerprint': fingerprint,
            'X-API-VERSION': '2',
            'X-PDFDancer-Client': `typescript/${VERSION}`
        };

        try {
            const response = await this._fetchWithRetry(
                url.toString(),
                {
                    method,
                    headers,
                    body: data ? JSON.stringify(data) : undefined
                },
                this._readTimeout
            );

            // Handle 404 errors
            if (response.status === 404) {
                try {
                    const errorData = await response.json() as any;
                    if (errorData.error === 'FontNotFoundException') {
                        throw new FontNotFoundException(errorData.message || 'Font not found');
                    }
                    if (errorData.error === 'SessionNotFoundException') {
                        throw new SessionNotFoundException(errorData.message || 'Session not found');
                    }
                } catch (e) {
                    if (e instanceof FontNotFoundException || e instanceof SessionNotFoundException) {
                        throw e;
                    }
                    // Continue with normal error handling if JSON parsing fails
                }
            }

            if (!response.ok) {
                const errorMessage = await this._extractErrorMessage(response);
                if (response.status === 429) {
                    const delay = parseRetryAfter(response);
                    throw new RateLimitException(
                        `API rate limit exceeded: ${errorMessage}`,
                        response,
                        delay === null ? undefined : Math.ceil(delay / 1000)
                    );
                }
                throw new HttpClientException(`API request failed: ${errorMessage}`, response);
            }

            return response;
        } catch (error) {
            if (error instanceof FontNotFoundException || error instanceof SessionNotFoundException || error instanceof HttpClientException) {
                throw error;
            }
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new HttpClientException(`API request failed: ${errorMessage}`, undefined, error as Error);
        }
    }

    // Search Operations

    /**
     * Searches for PDF objects matching the specified criteria.
     * This method provides flexible search capabilities across all PDF content,
     * allowing filtering by object type and position constraints.
     *
     * Now uses snapshot caching for better performance.
     */
    private async find(objectType?: ObjectType, position?: Position): Promise<ObjectRef[]> {

        // Determine if we should use snapshot or fall back to HTTP
        // For paths with coordinates, we need to use HTTP (backend requirement)
        const isPathWithCoordinates = objectType === ObjectType.PATH &&
            position?.shape === ShapeType.POINT;

        if (isPathWithCoordinates) {
            // Fall back to HTTP for path coordinate queries
            const requestData = new FindRequest(objectType, position).toDict();
            const response = await this._makeRequest('POST', '/pdf/find', requestData);
            const objectsData = await response.json() as any[];
            return objectsData.map((objData: any) => this._parseObjectRef(objData));
        }

        // Use snapshot-based search
        let elements: ObjectRef[];

        if (position?.pageNumber !== undefined) {
            // Page-specific query - use page snapshot
            const pageSnapshot = await this._getOrFetchPageSnapshot(position.pageNumber);
            elements = pageSnapshot.elements;
        } else {
            // Document-wide query - use document snapshot
            const docSnapshot = await this._getOrFetchDocumentSnapshot();
            elements = docSnapshot.getAllElements();
        }

        // Filter by object type
        if (objectType) {
            elements = elements.filter(el => el.type === objectType);
        }

        // Apply position-based filtering
        return this._filterByPosition(elements, position);
    }


    /**
     * Searches for image objects at the specified position.
     */
    private async _findImages(position?: Position): Promise<ObjectRef[]> {
        return this.find(ObjectType.IMAGE, position);
    }

    async selectImages(): Promise<ImageObject[]> {
        return this.toImageObjects(await this.find(ObjectType.IMAGE));
    }

    /**
     * Searches for form X objects at the specified position.
     */
    private async findFormXObjects(position?: Position): Promise<ObjectRef[]> {
        return this.find(ObjectType.FORM_X_OBJECT, position);
    }

    /**
     * Searches for vector path objects at the specified position.
     */
    private async findPaths(position?: Position): Promise<ObjectRef[]> {
        return this.find(ObjectType.PATH, position);
    }

    async selectPaths() {
        return this.toPathObjects(await this.find(ObjectType.PATH));
    }

    async selectForms() {
        return this.toFormXObjects(await this.find(ObjectType.FORM_X_OBJECT));
    }

    async selectFormFields() {
        return this.toFormFields(await this.findFormFields());
    }

    async selectFormFieldsByName(fieldName: string) {
        return this.toFormFields(await this.findFormFields(Position.byName(fieldName)));
    }


    /**
     * Searches for form fields at the specified position.
     * Returns FormFieldRef objects with name and value properties.
     *
     * Now uses snapshot caching for better performance.
     */
    private async findFormFields(position?: Position): Promise<FormFieldRef[]> {
        // Use snapshot-based search
        let elements: ObjectRef[];

        if (position?.pageNumber !== undefined) {
            // Page-specific query - use page snapshot
            const pageSnapshot = await this._getOrFetchPageSnapshot(position.pageNumber);
            elements = pageSnapshot.elements;
        } else {
            // Document-wide query - use document snapshot
            const docSnapshot = await this._getOrFetchDocumentSnapshot();
            elements = docSnapshot.getAllElements();
        }

        // Filter by form field types (FORM_FIELD, TEXT_FIELD, CHECKBOX, RADIO_BUTTON, DROPDOWN, BUTTON)
        const formFieldTypes = [
            ObjectType.FORM_FIELD,
            ObjectType.TEXT_FIELD,
            ObjectType.CHECKBOX,
            ObjectType.RADIO_BUTTON,
            ObjectType.DROPDOWN,
            ObjectType.BUTTON
        ];
        const formFields = elements.filter(el => formFieldTypes.includes(el.type)) as FormFieldRef[];

        // Apply position-based filtering
        return this._filterFormFieldsByPosition(formFields, position);
    }

    // Page Operations

    /**
     * Retrieves references to all pages in the PDF document.
     * Now uses snapshot caching to avoid HTTP requests.
     */
    private async getPages(): Promise<PageRef[]> {
        // Check if we have cached pages
        if (this._pagesCache) {
            return this._pagesCache;
        }

        // Try to get from document snapshot cache first
        if (this._documentSnapshotCache) {
            this._pagesCache = this._documentSnapshotCache.pages.map(p => p.pageRef);
            return this._pagesCache;
        }

        // Fetch document snapshot to get pages (this will cache it)
        const docSnapshot = await this._getOrFetchDocumentSnapshot();
        this._pagesCache = docSnapshot.pages.map(p => p.pageRef);
        return this._pagesCache;
    }

    /**
     * Retrieves a reference to a specific page by its page index.
     * Now uses snapshot caching to avoid HTTP requests.
     */
    private async _getPage(pageNumber: number): Promise<PageRef | null> {
        if (pageNumber < 0) {
            throw new ValidationException(`Page index must be >= 0, got ${pageNumber}`);
        }

        // Try page snapshot cache first
        if (this._pageSnapshotCache.has(pageNumber)) {
            return this._pageSnapshotCache.get(pageNumber)!.pageRef;
        }

        // Try document snapshot cache
        if (this._documentSnapshotCache) {
            const pageSnapshot = this._documentSnapshotCache.getPageSnapshot(pageNumber);
            if (pageSnapshot) {
                return pageSnapshot.pageRef;
            }
        }

        // Fetch document snapshot to get page (this will cache it)
        const docSnapshot = await this._getOrFetchDocumentSnapshot();
        const pageSnapshot = docSnapshot.getPageSnapshot(pageNumber);
        return pageSnapshot?.pageRef ?? null;
    }

    /**
     * Moves an existing page to a new position.
     *
     * @param fromPage - The source page number (1-based, page 1 is first page)
     * @param toPage - The target page number (1-based)
     * @returns The page reference at the new position
     * @throws ValidationException if fromPage or toPage is less than 1
     */
    async movePage(fromPage: number, toPage: number): Promise<boolean> {
        this._validatePageNumber(fromPage, 'fromPage');
        this._validatePageNumber(toPage, 'toPage');

        // Ensure the source page exists before attempting the move
        await this._requirePageRef(fromPage);

        const request = new MovePageRequest(fromPage, toPage).toDict();
        const response = await this._makeRequest('PUT', '/pdf/page/move', request);
        const success = await response.json() as boolean;

        if (!success) {
            throw new HttpClientException(`Failed to move page from ${fromPage} to ${toPage}`, response);
        }

        // Invalidate cache after mutation
        this._invalidateCache();

        return true;
    }

    /**
     * Deletes the page at the specified page number.
     *
     * @param pageNumber - The page number to delete (1-based, page 1 is first page)
     * @throws ValidationException if pageNumber is less than 1
     */
    async deletePage(pageNumber: number): Promise<boolean> {
        this._validatePageNumber(pageNumber, 'pageNumber');

        const pageRef = await this._requirePageRef(pageNumber);
        const result = await this._deletePage(pageRef);

        // Invalidate cache after mutation
        this._invalidateCache();

        return result;
    }

    private _validatePageNumber(pageNumber: number, fieldName: string): void {
        if (!Number.isInteger(pageNumber)) {
            throw new ValidationException(`${fieldName} must be an integer, got ${pageNumber}`);
        }
        if (pageNumber < 1) {
            throw new ValidationException(`${fieldName} must be >= 1 (1-based indexing), got ${pageNumber}`);
        }
    }

    private async _requirePageRef(pageNumber: number): Promise<PageRef> {
        const pageRef = await this._getPage(pageNumber);
        if (!pageRef) {
            throw new ValidationException(`Page not found at page number ${pageNumber}`);
        }
        return pageRef;
    }

    /**
     * Deletes a page from the PDF document.
     */
    private async _deletePage(pageRef: ObjectRef): Promise<boolean> {
        if (!pageRef) {
            throw new ValidationException("Page reference cannot be null");
        }

        const requestData = pageRef.toDict();
        const response = await this._makeRequest('DELETE', '/pdf/page/delete', requestData);
        return await response.json() as boolean;
    }

    // Snapshot Operations

    /**
     * Gets a snapshot of the entire PDF document.
     * Returns page count, fonts, and snapshots of all pages with their elements.
     *
     * @param types Optional array of ObjectType to filter elements by type
     * @returns DocumentSnapshot containing all document information
     */
    async getDocumentSnapshot(types?: ObjectType[]): Promise<DocumentSnapshot> {
        const params: Record<string, string> = {};
        if (types && types.length > 0) {
            params.types = types.join(',');
        }

        const response = await this._makeRequest('GET', '/pdf/document/snapshot', undefined, params);
        const data = await response.json() as any;

        return this._parseDocumentSnapshot(data);
    }

    /**
     * Gets a snapshot of a specific page.
     * Returns the page reference and all elements on that page.
     *
     * @param pageNumber - The page number to retrieve (1-based, page 1 is first page)
     * @param types - Optional array of ObjectType to filter elements by type
     * @returns PageSnapshot containing page information and elements
     * @throws ValidationException if pageNumber is less than 1
     */
    async getPageSnapshot(pageNumber: number, types?: ObjectType[]): Promise<PageSnapshot> {
        this._validatePageNumber(pageNumber, 'pageNumber');

        const params: Record<string, string> = {};
        if (types && types.length > 0) {
            params.types = types.join(',');
        }

        const response = await this._makeRequest('GET', `/pdf/page/${pageNumber}/snapshot`, undefined, params);
        const data = await response.json() as any;

        return this._parsePageSnapshot(data);
    }

    // Cache Management

    /**
     * Gets a page snapshot from cache or fetches it.
     * First checks page cache, then document cache, then fetches from server.
     *
     * @param pageNumber - 1-based page number
     */
    private async _getOrFetchPageSnapshot(pageNumber: number): Promise<PageSnapshot> {
        // Check page cache first
        if (this._pageSnapshotCache.has(pageNumber)) {
            return this._pageSnapshotCache.get(pageNumber)!;
        }

        // Check if we have document snapshot and can extract the page
        // Convert 1-based page number to 0-based index for array access
        if (this._documentSnapshotCache) {
            const pageSnapshot = this._documentSnapshotCache.getPageSnapshot(pageNumber);
            if (pageSnapshot) {
                // Cache it for future use
                this._pageSnapshotCache.set(pageNumber, pageSnapshot);
                return pageSnapshot;
            }
        }

        // Fetch page snapshot from server
        const pageSnapshot = await this.getPageSnapshot(pageNumber);
        this._pageSnapshotCache.set(pageNumber, pageSnapshot);

        return pageSnapshot;
    }

    /**
     * Gets the document snapshot from cache or fetches it.
     */
    private async _getOrFetchDocumentSnapshot(): Promise<DocumentSnapshot> {
        if (!this._documentSnapshotCache) {
            this._documentSnapshotCache = await this.getDocumentSnapshot();
        }
        return this._documentSnapshotCache;
    }

    /**
     * Invalidates all snapshot caches.
     * Called after any mutation operation.
     */
    private _invalidateCache(): void {

        this._documentSnapshotCache = null;
        this._pageSnapshotCache.clear();
        this._pagesCache = null;
    }

    /**
     * Filters snapshot elements by Position criteria.
     * Handles coordinates, text matching, and field name filtering.
     */
    private _filterByPosition(elements: ObjectRef[], position?: Position): ObjectRef[] {


        if (!position) {
            return elements;
        }

        let filtered = elements;

        // Filter by page index
        if (position.pageNumber !== undefined) {
            filtered = filtered.filter(el => el.position.pageNumber === position.pageNumber);
        }

        // Filter by coordinates (point containment with tolerance)
        if (position.boundingRect && position.shape === ShapeType.POINT) {

            const x = position.boundingRect.x;
            const y = position.boundingRect.y;
            const tolerance = position.tolerance || 0;
            filtered = filtered.filter(el => {
                const rect = el.position.boundingRect;
                if (!rect) return false;
                return x >= rect.x - tolerance && x <= rect.x + rect.width + tolerance &&
                    y >= rect.y - tolerance && y <= rect.y + rect.height + tolerance;
            });
        }


        // Filter by name (for form fields)
        if (position.name && filtered.length > 0) {

            filtered = filtered.filter(el => {
                const formField = el as FormFieldRef;
                return formField.name === position.name;
            });
        }


        return filtered;
    }

    /**
     * Filters FormFieldRef elements by Position criteria.
     */
    private _filterFormFieldsByPosition(elements: FormFieldRef[], position?: Position): FormFieldRef[] {
        return this._filterByPosition(elements as ObjectRef[], position) as FormFieldRef[];
    }


    // Manipulation Operations

    /**
     * Deletes the specified PDF object from the document.
     */
    private async delete(objectRef: ObjectRef): Promise<boolean> {
        if (!objectRef) {
            throw new ValidationException("Object reference cannot be null");
        }

        const requestData = new DeleteRequest(objectRef).toDict();
        const response = await this._makeRequest('DELETE', '/pdf/delete', requestData);
        const result = await response.json() as boolean;

        // Invalidate cache after mutation
        this._invalidateCache();

        return result;
    }


    async clearClipping(objectRef: ObjectRef): Promise<boolean> {
        return this._clearClipping(objectRef);
    }


    private async _clearClipping(objectRef: ObjectRef): Promise<boolean> {
        if (!objectRef) {
            throw new ValidationException("Object reference cannot be null");
        }

        const requestData = {objectRef: objectRef.toDict()};
        const response = await this._makeRequest('PUT', '/pdf/clipping/clear', requestData);
        const result = await response.json() as boolean;

        this._invalidateCache();

        return result;
    }


    /**
     * Transforms an image in the PDF document.
     * Supports replace, scale, rotate, crop, opacity, and flip operations.
     * @param request The transformation request containing the image reference and transformation parameters
     * @returns CommandResult indicating success or failure
     */
    private async transformImage(request: ImageTransformRequest): Promise<CommandResult> {
        if (!request.objectRef) {
            throw new ValidationException("Object reference cannot be null");
        }

        const response = await this._makeRequest('PUT', '/pdf/image/transform', request.toDict());
        const result = CommandResult.fromDict(await response.json());

        // Invalidate cache after mutation
        this._invalidateCache();

        return result;
    }

    // Path Group Operations

    private async createPathGroup(pageIndex: number, pathIds: string[]): Promise<PathGroupObject> {
        const data: Record<string, any> = { pageIndex, groupId: null, pathIds };
        const response = await this._makeRequest('POST', '/pdf/path-group/create', data);
        this._invalidateCache();
        const info = PathGroupInfo.fromDict(await response.json());
        return new PathGroupObject(this, pageIndex, info);
    }

    private async createPathGroupInRegion(pageIndex: number, region: BoundingRect): Promise<PathGroupObject> {
        const data: Record<string, any> = {
            pageIndex, groupId: null,
            region: { x: region.x, y: region.y, width: region.width, height: region.height }
        };
        const response = await this._makeRequest('POST', '/pdf/path-group/create', data);
        this._invalidateCache();
        const info = PathGroupInfo.fromDict(await response.json());
        return new PathGroupObject(this, pageIndex, info);
    }

    private async movePathGroup(pageIndex: number, groupId: string, x: number, y: number): Promise<boolean> {
        const data = { pageIndex, groupId, x, y };
        const response = await this._makeRequest('PUT', '/pdf/path-group/move', data);
        this._invalidateCache();
        return await response.json() as boolean;
    }

    private async scalePathGroup(pageIndex: number, groupId: string, factor: number): Promise<boolean> {
        const data = { pageIndex, groupId, transformType: PathGroupTransformType.SCALE, scaleFactor: factor };
        const response = await this._makeRequest('PUT', '/pdf/path-group/transform', data);
        this._invalidateCache();
        return await response.json() as boolean;
    }

    private async rotatePathGroup(pageIndex: number, groupId: string, degrees: number): Promise<boolean> {
        const data = { pageIndex, groupId, transformType: PathGroupTransformType.ROTATE, rotationAngle: degrees };
        const response = await this._makeRequest('PUT', '/pdf/path-group/transform', data);
        this._invalidateCache();
        return await response.json() as boolean;
    }

    private async resizePathGroup(pageIndex: number, groupId: string, width: number, height: number): Promise<boolean> {
        const data = { pageIndex, groupId, transformType: PathGroupTransformType.RESIZE, targetWidth: width, targetHeight: height };
        const response = await this._makeRequest('PUT', '/pdf/path-group/transform', data);
        this._invalidateCache();
        return await response.json() as boolean;
    }

    private async removePathGroup(pageIndex: number, groupId: string): Promise<boolean> {
        const data = { pageIndex, groupId };
        const response = await this._makeRequest('DELETE', '/pdf/path-group/remove', data);
        this._invalidateCache();
        return await response.json() as boolean;
    }

    private async listPathGroups(pageIndex: number): Promise<PathGroupObject[]> {
        const pageNumber = pageIndex + 1;
        const response = await this._makeRequest('GET', `/pdf/page/${pageNumber}/path-groups`);
        const infos = (await response.json() as any[]).map((d: any) => PathGroupInfo.fromDict(d));
        return infos.map(info => new PathGroupObject(this, pageIndex, info));
    }

    async clearPathGroupClipping(pageNumber: number, groupId: string): Promise<boolean> {
        return this._clearPathGroupClipping(pageNumber, groupId);
    }

    private async _clearPathGroupClipping(pageNumber: number, groupId: string): Promise<boolean> {
        this._validatePageNumber(pageNumber, 'pageNumber');
        if (!groupId || !groupId.trim()) {
            throw new ValidationException("Group ID cannot be null or empty");
        }

        const data = {pageNumber, groupId};
        const response = await this._makeRequest('PUT', '/pdf/path-group/clipping/clear', data);
        const result = await response.json() as boolean;
        this._invalidateCache();
        return result;
    }

    /**
     * Moves a PDF object to a new position within the document.
     */
    private async move(objectRef: ObjectRef, position: Position): Promise<boolean> {
        if (!objectRef) {
            throw new ValidationException("Object reference cannot be null");
        }
        if (!position) {
            throw new ValidationException("Position cannot be null");
        }

        const requestData = new MoveRequest(objectRef, position).toDict();
        const response = await this._makeRequest('PUT', '/pdf/move', requestData);
        const result = await response.json() as boolean;

        // Invalidate cache after mutation
        this._invalidateCache();

        return result;
    }

    /**
     * Changes the value of a form field.
     */
    private async changeFormField(formFieldRef: FormFieldRef, newValue: string): Promise<boolean> {
        if (!formFieldRef) {
            throw new ValidationException("Form field reference cannot be null");
        }

        const requestData = new ChangeFormFieldRequest(formFieldRef, newValue).toDict();
        const response = await this._makeRequest('PUT', '/pdf/modify/formField', requestData);
        const result = await response.json() as boolean;

        // Invalidate cache after mutation
        this._invalidateCache();

        return result;
    }

    // Add Operations

    /**
     * Adds an image to the PDF document.
     */
    private async addImage(image: Image, position?: Position): Promise<boolean> {
        if (!image) {
            throw new ValidationException("Image cannot be null");
        }

        if (position) {
            image.setPosition(position);
        }

        if (!image.getPosition()) {
            throw new ValidationException("Image position is null");
        }

        return this._addObject(image);
    }


    /**
     * Adds a path to the PDF document.
     */
    private async addPath(path: Path): Promise<boolean> {
        if (!path) {
            throw new ValidationException("Path cannot be null");
        }
        if (!path.getPosition()) {
            throw new ValidationException("Path position is null, you need to specify a position for the new path, using .at(x,y)");
        }
        if (path.getPosition()!.pageNumber === undefined) {
            throw new ValidationException("Path position page number is null");
        }
        if (path.getPosition()!.pageNumber! < 1) {
            throw new ValidationException("Path position page number is less than 1");
        }

        return await this._addObject(path);
    }

    /**
     * Adds a page to the PDF document.
     */
    private async addPage(request?: AddPageRequest | null): Promise<PageRef> {
        const payload = request ? request.toDict() : {};
        const data = Object.keys(payload).length > 0 ? payload : undefined;
        const response = await this._makeRequest('POST', '/pdf/page/add', data);
        const result = await response.json();
        const pageRef = this._parsePageRef(result);

        this._invalidateCache();

        return pageRef;
    }

    /**
     * Internal method to add any PDF object.
     */
    private async _addObject(pdfObject: Image | Path): Promise<boolean> {
        const requestData = new AddRequest(pdfObject).toDict();
        const response = await this._makeRequest('POST', '/pdf/add', requestData);
        const result = await response.json() as boolean;

        // Invalidate cache after mutation
        this._invalidateCache();

        return result;
    }

    // Modify Operations


    /**
     * Modifies a path object's stroke and fill colors.
     * Setting colors to null means "don't change them".
     */
    private async modifyPath(objectRef: ObjectRef, strokeColor?: Color | null, fillColor?: Color | null): Promise<CommandResult> {
        if (!objectRef) {
            throw new ValidationException("Object reference cannot be null");
        }

        const requestData = new ModifyPathRequest(objectRef, strokeColor, fillColor).toDict();
        const response = await this._makeRequest('PUT', '/pdf/modify/path', requestData);
        const result = CommandResult.fromDict(await response.json());
        this._invalidateCache();
        return result;
    }

    private _positionToDict(position: Position): Record<string, any> {
        const result: Record<string, any> = {
            pageNumber: position.pageNumber,
            name: position.name
        };
        if (position.shape) result.shape = position.shape;
        if (position.mode) result.mode = position.mode;
        if (position.boundingRect) {
            result.boundingRect = {
                x: position.boundingRect.x,
                y: position.boundingRect.y,
                width: position.boundingRect.width,
                height: position.boundingRect.height
            };
        }
        return result;
    }

    // Font Operations

    /**
     * Finds available fonts matching the specified name and size.
     */
    async findFonts(fontName: string, fontSize: number): Promise<Font[]> {
        if (!fontName || !fontName.trim()) {
            throw new ValidationException("Font name cannot be null or empty");
        }
        if (fontSize <= 0) {
            throw new ValidationException(`Font size must be positive, got ${fontSize}`);
        }

        const params = {fontName: fontName.trim()};
        const response = await this._makeRequest('GET', '/font/find', undefined, params);

        const fontNames = await response.json() as string[];
        return fontNames.map((name: string) => new Font(name, fontSize));
    }

    /**
     * Registers a custom font for use in PDF operations.
     */
    async registerFont(ttfFile: Uint8Array | string): Promise<string> {
        if (!ttfFile) {
            throw new ValidationException("TTF file cannot be null");
        }

        try {
            let fontData: Uint8Array;
            let filename: string;

            if (ttfFile && ttfFile.constructor === Uint8Array) {
                if (ttfFile.length === 0) {
                    throw new ValidationException("Font data cannot be empty");
                }
                fontData = ttfFile;
                filename = 'font.ttf';
            } else if (typeof ttfFile === 'string') {
                if (!fs.existsSync(ttfFile)) {
                    throw new Error(`Font file not found: ${ttfFile}`);
                }
                fontData = new Uint8Array(fs.readFileSync(ttfFile));
                filename = path.basename(ttfFile);
            } else {
                throw new ValidationException(`Unsupported font file type: ${typeof ttfFile}`);
            }

            // Upload font file
            const formData = new FormData();
            const blob = new Blob([fontData.buffer as ArrayBuffer], {type: 'font/ttf'});
            formData.append('ttfFile', blob, filename);

            const fingerprint = await this._getFingerprint();

            const response = await this._fetchWithRetry(
                this._buildUrl('/font/register'),
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this._token}`,
                        'X-Session-Id': this._sessionId,
                        'X-Generated-At': generateTimestamp(),
                        'X-Fingerprint': fingerprint,
                        'X-API-VERSION': '2',
                        'X-PDFDancer-Client': `typescript/${VERSION}`
                    },
                    body: formData
                },
                this._readTimeout
            );

            if (!response.ok) {
                const errorMessage = await this._extractErrorMessage(response);
                throw new HttpClientException(`Font registration failed: ${errorMessage}`, response);
            }

            return (await response.text()).trim();
        } catch (error) {
            if (error instanceof ValidationException || error instanceof HttpClientException) {
                throw error;
            }
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new PdfDancerException(`Failed to read font file: ${errorMessage}`, error as Error);
        }
    }

    // Document Operations

    /**
     * Downloads the current state of the PDF document with all modifications applied.
     */
    async getBytes(): Promise<Uint8Array> {
        const response = await this._makeRequest('GET', `/session/${this._sessionId}/pdf`);
        return new Uint8Array(await response.arrayBuffer());
    }

    /**
     * Saves the current PDF to a file (browser environment).
     * Downloads the PDF in the browser.
     */
    async save(filename: string): Promise<void> {
        if (!filename) {
            throw new ValidationException("Filename cannot be null or empty");
        }

        try {
            const pdfData = await this.getBytes();
            fs.writeFileSync(filename, pdfData);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new PdfDancerException(`Failed to save PDF file: ${errorMessage}`, error as Error);
        }
    }

    // Utility Methods

    /**
     * Parse JSON object data into ObjectRef instance.
     */
    private _parseObjectRef(objData: any): ObjectRef {

        const positionData = objData.position || {};
        const position = positionData ? this._parsePosition(positionData) : new Position();

        const objectType = objData.type as ObjectType;

        if (objectType === ObjectType.PAGE) {
            return this._parsePageRef(objData);
        }


        // Check if this is a form field type
        const formFieldTypes = [
            ObjectType.FORM_FIELD,
            ObjectType.TEXT_FIELD,
            ObjectType.CHECKBOX,
            ObjectType.RADIO_BUTTON,
            ObjectType.DROPDOWN,
            ObjectType.BUTTON
        ];
        if (formFieldTypes.includes(objectType)) {
            return this._parseFormFieldRef(objData);
        }

        // Check if this is a path type
        if (objectType === ObjectType.PATH) {
            return new PathObjectRef(
                objData.internalId,
                position,
                objectType,
                objData.strokeColor ? this._parseColor(objData.strokeColor) : null,
                objData.fillColor ? this._parseColor(objData.fillColor) : null,
                objData.strokeWidth ?? null,
                objData.dashArray ?? null,
                objData.dashPhase ?? null
            );
        }

        return new ObjectRef(
            objData.internalId,
            position,
            objectType
        );
    }

    private _parsePageRef(objData: any): PageRef {
        return new PageRef(
            objData.internalId,
            this._parsePosition(objData.position || {}),
            ObjectType.PAGE,
            this._parsePageSize(objData.pageSize),
            this._parseOrientation(objData.orientation)
        );
    }

    private _parsePageSize(data: any): PageSize | undefined {
        if (!data || typeof data !== 'object') return undefined;
        const pageSize: PageSize = {
            name: typeof data.name === 'string' ? data.name : undefined,
            width: typeof data.width === 'number' ? data.width : undefined,
            height: typeof data.height === 'number' ? data.height : undefined
        };
        return pageSize.name === undefined && pageSize.width === undefined && pageSize.height === undefined
            ? undefined
            : pageSize;
    }

    private _parseOrientation(data: any): Orientation | undefined {
        if (typeof data !== 'string') return undefined;
        const normalized = data.trim().toUpperCase();
        return normalized === Orientation.PORTRAIT || normalized === Orientation.LANDSCAPE
            ? normalized as Orientation
            : undefined;
    }

    private _parseColor(data: any): Color | undefined {
        if (!data || typeof data !== 'object') return undefined;
        const {red, green, blue, alpha} = data;
        if (![red, green, blue].every(value => typeof value === 'number')) return undefined;
        try {
            return new Color(red, green, blue, typeof alpha === 'number' ? alpha : 255);
        } catch {
            return undefined;
        }
    }

    private _parseFormFieldRef(objData: any): FormFieldRef {
        const positionData = objData.position || {};
        const position = positionData ? this._parsePosition(positionData) : new Position();

        const objectType = objData.type as ObjectType;

        return new FormFieldRef(
            objData.internalId,
            position,
            objectType,
            objData.name || undefined,
            objData.value !== undefined ? objData.value : null
        );
    }

    /**
     * Parse JSON position data into Position instance.
     */
    private _parsePosition(posData: any): Position {

        const position = new Position();
        position.pageNumber = posData.pageNumber;
        if (posData.shape) {
            position.shape = ShapeType[posData.shape as keyof typeof ShapeType];
        }
        if (posData.mode) {
            position.mode = PositionMode[posData.mode as keyof typeof PositionMode];
        }

        if (posData.boundingRect) {
            const rectData = posData.boundingRect;
            position.boundingRect = new BoundingRect(
                rectData.x,
                rectData.y,
                rectData.width,
                rectData.height
            );
        }

        return position;
    }

    /**
     * Parse JSON data into DocumentSnapshot instance.
     */
    private _parseDocumentSnapshot(data: any): DocumentSnapshot {
        const pageCount = typeof data.pageCount === 'number' ? data.pageCount : 0;

        // Parse fonts
        const fonts: DocumentFontInfo[] = [];
        if (Array.isArray(data.fonts)) {
            for (const fontData of data.fonts) {
                if (fontData && typeof fontData === 'object') {
                    const documentFontName = typeof fontData.documentFontName === 'string'
                        ? fontData.documentFontName
                        : (typeof fontData.fontName === 'string' ? fontData.fontName : '');
                    const systemFontName = typeof fontData.systemFontName === 'string'
                        ? fontData.systemFontName
                        : (typeof fontData.fontName === 'string' ? fontData.fontName : '');
                    fonts.push(new DocumentFontInfo(documentFontName, systemFontName));
                }
            }
        }

        // Parse pages
        const pages: PageSnapshot[] = [];
        if (Array.isArray(data.pages)) {
            for (const pageData of data.pages) {
                pages.push(this._parsePageSnapshot(pageData));
            }
        }

        return new DocumentSnapshot(pageCount, fonts, pages);
    }

    /**
     * Parse JSON data into PageSnapshot instance.
     */
    private _parsePageSnapshot(data: any): PageSnapshot {
        // Parse page reference
        const pageRef = this._parsePageRef(data.pageRef || {});

        // Parse elements
        const elements: ObjectRef[] = [];
        if (Array.isArray(data.elements)) {
            for (const elementData of data.elements) {
                const element = this._parseObjectRef(elementData);

                // If the element's position doesn't have a pageNumber, inherit it from the page
                if (element.position && element.position.pageNumber === undefined) {
                    element.position.pageNumber = pageRef.position.pageNumber;

                }

                elements.push(element);
            }
        }

        return new PageSnapshot(pageRef, elements);
    }

    // Builder Pattern Support


    private toPathObjects(objectRefs: ObjectRef[]) {
        return objectRefs.map(ref => PathObject.fromRef(this, ref));
    }

    private toFormXObjects(objectRefs: ObjectRef[]) {
        return objectRefs.map(ref => FormXObject.fromRef(this, ref));
    }

    private toImageObjects(objectRefs: ObjectRef[]) {
        return objectRefs.map(ref => ImageObject.fromRef(this, ref));
    }

    newImage(pageNumber?: number) {
        return new ImageBuilder(this, pageNumber);
    }


    newPath(pageNumber?: number) {
        return new PathBuilder(this, pageNumber);
    }

    newLine(pageNumber: number) { return new LineBuilder(this, pageNumber); }
    newBezier(pageNumber: number) { return new BezierBuilder(this, pageNumber); }
    newRectangle(pageNumber: number) { return new RectangleBuilder(this, pageNumber); }

    newPage() {
        return new PageBuilder(this);
    }

    text(): TextClient {
        return this.createTextClient();
    }

    private createTextClient(pageNumber?: number): TextClient {
        return new TextClient((operation, request) => this.editTextInternal(operation, request), pageNumber);
    }

    private async editTextInternal(
        operation: TextOperation,
        request: TextReplaceRequest | TextDeleteRequest | TextInsertRequest | TextStyleRequest
    ): Promise<TextEditResponse> {
        request.validated();
        const response = await this._makeRequest('POST', `/pdf/text/${operation}`, request);
        const result = await response.json() as TextEditResponse;
        if (result.change) {
            result.change = result.change.map(change => ({
                ...change,
                effectiveHyphenationEnabled: Boolean(change.effectiveHyphenationEnabled)
            }));
        }
        this._invalidateCache();
        return result;
    }


    /**
     * Creates a client for working with a specific page.
     *
     * @param pageNumber - The page number (1-based, page 1 is first page)
     * @returns A PageClient for the specified page
     * @throws ValidationException if pageNumber is less than 1
     */
    page(pageNumber: number) {
        if (pageNumber < 1) {
            throw new ValidationException(`Page number must be >= 1 (1-based indexing), got ${pageNumber}`);
        }
        return new PageClient(this, pageNumber);
    }

    async pages() {
        const pageRefs = await this.getPages();
        // Page numbers are 1-based
        return pageRefs.map((pageRef, index) => new PageClient(this, index + 1, pageRef));
    }

    private toFormFields(objectRefs: FormFieldRef[]) {
        return objectRefs.map(ref => FormFieldObject.fromRef(this, ref));
    }

    async selectElements(types?: ObjectType[]) {
        const snapshot = await this.getDocumentSnapshot(types);
        const elements: ObjectRef[] = [];
        for (const pageSnapshot of snapshot.pages) {
            elements.push(...pageSnapshot.elements);
        }
        return elements;
    }


    // Singular convenience methods - return the first element or null

    async selectImage() {
        const images = await this.selectImages();
        return images.length > 0 ? images[0] : null;
    }

    async selectPath() {
        const paths = await this.selectPaths();
        return paths.length > 0 ? paths[0] : null;
    }

    async selectForm() {
        const forms = await this.selectForms();
        return forms.length > 0 ? forms[0] : null;
    }

    async selectFormField() {
        const fields = await this.selectFormFields();
        return fields.length > 0 ? fields[0] : null;
    }

    async selectFormFieldByName(fieldName: string) {
        const fields = await this.selectFormFieldsByName(fieldName);
        return fields.length > 0 ? fields[0] : null;
    }

}
