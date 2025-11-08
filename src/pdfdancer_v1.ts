/**
 * PDFDancer TypeScript Client V1
 *
 * A TypeScript client that provides session-based PDF manipulation operations with strict validation.
 */

import {
    FontNotFoundException,
    HttpClientException,
    PdfDancerException,
    SessionException,
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
    DocumentSnapshot,
    FindRequest,
    Font,
    DocumentFontInfo,
    FontType,
    FormFieldRef,
    Image,
    ModifyRequest,
    ModifyTextRequest,
    MovePageRequest,
    MoveRequest,
    ObjectRef,
    ObjectType,
    Orientation,
    PageRef,
    PageSize,
    PageSizeInput,
    PageSnapshot,
    Paragraph,
    Position,
    PositionMode,
    ShapeType,
    TextObjectRef,
    TextStatus
} from './models';
import {ParagraphBuilder} from './paragraph-builder';
import {PageBuilder} from './page-builder';
import {FormFieldObject, FormXObject, ImageObject, ParagraphObject, PathObject, TextLineObject} from "./types";
import {ImageBuilder} from "./image-builder";
import {generateFingerprint} from "./fingerprint";
import fs from "fs";
import path from "node:path";

const DEFAULT_TOLERANCE = 0.01;

// Debug flag - set to true to enable timing logs
const DEBUG =
    (process.env.PDFDANCER_CLIENT_DEBUG ?? '').toLowerCase() === 'true' ||
    (process.env.PDFDANCER_CLIENT_DEBUG ?? '') === '1' ||
    (process.env.PDFDANCER_CLIENT_DEBUG ?? '').toLowerCase() === 'yes';

/**
 * Configuration for retry mechanism on REST API calls.
 */
export interface RetryConfig {
    /**
     * Maximum number of retry attempts (default: 3)
     */
    maxRetries?: number;

    /**
     * Initial delay in milliseconds before first retry (default: 1000)
     * Subsequent delays use exponential backoff
     */
    initialDelay?: number;

    /**
     * Maximum delay in milliseconds between retries (default: 10000)
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
     * Whether to add random jitter to retry delays to prevent thundering herd (default: true)
     */
    useJitter?: boolean;
}

/**
 * Default retry configuration
 */
const DEFAULT_RETRY_CONFIG: Required<RetryConfig> = {
    maxRetries: 3,
    initialDelay: 1000,
    maxDelay: 10000,
    retryableStatusCodes: [429, 500, 502, 503, 504],
    retryOnNetworkError: true,
    backoffMultiplier: 2,
    useJitter: true
};

/**
 * Static helper function for retry logic with exponential backoff.
 * Used by static methods that don't have access to instance retry config.
 */
async function fetchWithRetry(
    url: string,
    options: RequestInit,
    retryConfig: Required<RetryConfig>,
    context: string = 'request'
): Promise<Response> {
    let lastError: Error | null = null;
    let lastResponse: Response | null = null;

    for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
        try {
            const response = await fetch(url, options);

            // Check if we should retry based on status code
            if (!response.ok && retryConfig.retryableStatusCodes.includes(response.status)) {
                lastResponse = response;

                // If this is not the last attempt, wait and retry
                if (attempt < retryConfig.maxRetries) {
                    const delay = calculateRetryDelay(attempt, retryConfig);
                    if (DEBUG) {
                        console.log(`${Date.now() / 1000}|Retry attempt ${attempt + 1}/${retryConfig.maxRetries} for ${context} after ${delay}ms (status: ${response.status})`);
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
            if (retryConfig.retryOnNetworkError && attempt < retryConfig.maxRetries) {
                const delay = calculateRetryDelay(attempt, retryConfig);
                if (DEBUG) {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    console.log(`${Date.now() / 1000}|Retry attempt ${attempt + 1}/${retryConfig.maxRetries} for ${context} after ${delay}ms (error: ${errorMessage})`);
                }
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
 * Calculates the delay for the next retry attempt using exponential backoff.
 */
function calculateRetryDelay(attemptNumber: number, retryConfig: Required<RetryConfig>): number {
    // Calculate base delay: initialDelay * (backoffMultiplier ^ attemptNumber)
    let delay = retryConfig.initialDelay * Math.pow(retryConfig.backoffMultiplier, attemptNumber);

    // Cap at maxDelay
    delay = Math.min(delay, retryConfig.maxDelay);

    // Add jitter if enabled (randomize between 50% and 100% of calculated delay)
    if (retryConfig.useJitter) {
        delay = delay * (0.5 + Math.random() * 0.5);
    }

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

/**
 * Parse timestamp string, handling both microseconds and nanoseconds precision.
 * @param timestampStr Timestamp string in format YYYY-MM-DDTHH:MM:SS.fffffffZ (with 6 or 9 fractional digits)
 */
function parseTimestamp(timestampStr: string): Date {
    // Remove the 'Z' suffix
    let ts = timestampStr.replace(/Z$/, '');

    // Handle nanoseconds (9 digits) by truncating to milliseconds (3 digits)
    // JavaScript's Date only supports millisecond precision
    if (ts.includes('.')) {
        const [datePart, fracPart] = ts.split('.');
        // Truncate to 3 digits (milliseconds)
        const truncatedFrac = fracPart.substring(0, 3);
        ts = `${datePart}.${truncatedFrac}`;
    }

    return new Date(ts + 'Z');
}

/**
 * Check for X-Generated-At and X-Received-At headers and log timing information if DEBUG=true.
 *
 * Expected timestamp formats:
 * - 2025-10-24T08:49:39.161945Z (microseconds - 6 digits)
 * - 2025-10-24T08:58:45.468131265Z (nanoseconds - 9 digits)
 */
function logGeneratedAtHeader(response: Response, method: string, path: string): void {
    if (!DEBUG) {
        return;
    }

    const generatedAt = response.headers.get('X-Generated-At');
    const receivedAt = response.headers.get('X-Received-At');

    if (generatedAt || receivedAt) {
        try {
            const logParts: string[] = [];
            const currentTime = new Date();

            // Parse and log X-Received-At
            let receivedTime: Date | null = null;
            if (receivedAt) {
                receivedTime = parseTimestamp(receivedAt);
                const timeSinceReceived = (currentTime.getTime() - receivedTime.getTime()) / 1000;
                logParts.push(`X-Received-At: ${receivedAt}, time since received on backend: ${timeSinceReceived.toFixed(3)}s`);
            }

            // Parse and log X-Generated-At
            let generatedTime: Date | null = null;
            if (generatedAt) {
                generatedTime = parseTimestamp(generatedAt);
                const timeSinceGenerated = (currentTime.getTime() - generatedTime.getTime()) / 1000;
                logParts.push(`X-Generated-At: ${generatedAt}, time since generated on backend: ${timeSinceGenerated.toFixed(3)}s`);
            }

            // Calculate processing time (X-Generated-At - X-Received-At)
            if (receivedTime && generatedTime) {
                const processingTime = (generatedTime.getTime() - receivedTime.getTime()) / 1000;
                logParts.push(`processing time on backend: ${processingTime.toFixed(3)}s`);
            }

            if (logParts.length > 0) {
                console.log(`${Date.now() / 1000}|${method} ${path} - ${logParts.join(', ')}`);
            }
        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : String(e);
            console.log(`${Date.now() / 1000}|${method} ${path} - Header parse error: ${errorMessage}`);
        }
    }
}

// 👇 Internal view of PDFDancer methods, not exported
interface PDFDancerInternals {

    toImageObjects(objectRefs: ObjectRef[]): ImageObject[];

    toPathObjects(objectRefs: ObjectRef[]): PathObject[];

    toFormXObjects(objectRefs: ObjectRef[]): FormXObject[];

    toTextLineObjects(objectRefs: ObjectRef[]): TextLineObject[];

    toFormFields(formFieldRefs: FormFieldRef[]): FormFieldObject[];

    toParagraphObjects(objectRefs: ObjectRef[]): ParagraphObject[];

    findFormFields(position?: Position): Promise<FormFieldRef[]>;

    findPaths(position?: Position): Promise<ObjectRef[]>;

    findFormXObjects(position?: Position): Promise<ObjectRef[]>;

    findParagraphs(position?: Position): Promise<ObjectRef[]>;

    findTextLines(pos?: Position): Promise<ObjectRef[]>;

    _findImages(position?: Position): Promise<ObjectRef[]>;
}

class PageClient {

    private _pageIndex: number;
    private _client: PDFDancer;
    type: ObjectType = ObjectType.PAGE;
    position: Position;
    internalId: string;
    pageSize?: PageSize;
    orientation?: Orientation;
    private _internals: PDFDancerInternals;

    constructor(client: PDFDancer, pageIndex: number, pageRef?: PageRef) {
        this._client = client;
        this._pageIndex = pageIndex;
        this.internalId = pageRef?.internalId ?? `PAGE-${this._pageIndex}`;
        this.position = pageRef?.position ?? Position.atPage(this._pageIndex);
        this.pageSize = pageRef?.pageSize;
        this.orientation = pageRef?.orientation;
        // Cast to the internal interface to get access
        this._internals = this._client as unknown as PDFDancerInternals;
    }

    async selectPathsAt(x: number, y: number, tolerance: number = 0) {
        return this._internals.toPathObjects(await this._internals.findPaths(Position.atPageCoordinates(this._pageIndex, x, y, tolerance)));
    }

    async selectPaths() {
        return this._internals.toPathObjects(await this._internals.findPaths(Position.atPage(this._pageIndex)));
    }

    async selectImages() {
        return this._internals.toImageObjects(await this._internals._findImages(Position.atPage(this._pageIndex)));
    }

    async selectImagesAt(x: number, y: number, tolerance: number = 0) {
        return this._internals.toImageObjects(await this._internals._findImages(Position.atPageCoordinates(this._pageIndex, x, y, tolerance)));
    }

    async delete(): Promise<boolean> {
        return this._client.deletePage(this._pageIndex);
    }

    async moveTo(targetPageIndex: number): Promise<PageRef> {
        const pageRef = await this._client.movePage(this._pageIndex, targetPageIndex);
        this._pageIndex = pageRef.position.pageIndex ?? targetPageIndex;
        this.position = pageRef.position;
        this.internalId = pageRef.internalId;
        this.pageSize = pageRef.pageSize;
        this.orientation = pageRef.orientation;
        return pageRef;
    }

    // noinspection JSUnusedGlobalSymbols
    async selectForms() {
        return this._internals.toFormXObjects(await this._internals.findFormXObjects(Position.atPage(this._pageIndex)));
    }

    async selectFormsAt(x: number, y: number, tolerance: number = 0) {
        return this._internals.toFormXObjects(await this._internals.findFormXObjects(Position.atPageCoordinates(this._pageIndex, x, y, tolerance)));
    }

    async selectFormFields() {
        return this._internals.toFormFields(await this._internals.findFormFields(Position.atPage(this._pageIndex)));
    }

    async selectFormFieldsAt(x: number, y: number, tolerance: number = 0) {
        return this._internals.toFormFields(await this._internals.findFormFields(Position.atPageCoordinates(this._pageIndex, x, y, tolerance)));
    }

    // noinspection JSUnusedGlobalSymbols
    async selectFormFieldsByName(fieldName: string) {
        let pos = Position.atPage(this._pageIndex);
        pos.name = fieldName;
        return this._internals.toFormFields(await this._internals.findFormFields(pos));
    }

    async selectParagraphs() {
        return this._internals.toParagraphObjects(await this._internals.findParagraphs(Position.atPage(this._pageIndex)));
    }

    async selectElements(types?: ObjectType[]) {
        const snapshot = await this._client.getPageSnapshot(this._pageIndex, types);
        return snapshot.elements;
    }

    async selectParagraphsStartingWith(text: string) {
        let pos = Position.atPage(this._pageIndex);
        pos.textStartsWith = text;
        return this._internals.toParagraphObjects(await this._internals.findParagraphs(pos));
    }

    async selectParagraphsMatching(pattern: string) {
        let pos = Position.atPage(this._pageIndex);
        pos.textPattern = pattern;
        return this._internals.toParagraphObjects(await this._internals.findParagraphs(pos));
    }

    async selectParagraphsAt(x: number, y: number, tolerance: number = DEFAULT_TOLERANCE) {
        return this._internals.toParagraphObjects(
            await this._internals.findParagraphs(Position.atPageCoordinates(this._pageIndex, x, y, tolerance))
        );
    }

    async selectTextLinesStartingWith(text: string) {
        let pos = Position.atPage(this._pageIndex);
        pos.textStartsWith = text;
        return this._internals.toTextLineObjects(await this._internals.findTextLines(pos));
    }

    /**
     * Creates a new ParagraphBuilder for fluent paragraph construction.
     */
    newParagraph(pageIndex?: number): ParagraphBuilder {
        const targetIndex = pageIndex ?? this.position.pageIndex;
        return new ParagraphBuilder(this._client, targetIndex);
    }

    newImage(pageIndex?: number) {
        const targetIndex = pageIndex ?? this.position.pageIndex;
        return new ImageBuilder(this._client, targetIndex);
    }

    async selectTextLines() {
        return this._internals.toTextLineObjects(await this._internals.findTextLines(Position.atPage(this._pageIndex)));
    }

    // noinspection JSUnusedGlobalSymbols
    async selectTextLinesMatching(pattern: string) {
        let pos = Position.atPage(this._pageIndex);
        pos.textPattern = pattern;
        return this._internals.toTextLineObjects(await this._internals.findTextLines(pos));
    }

    // noinspection JSUnusedGlobalSymbols
    async selectTextLinesAt(x: number, y: number, tolerance: number = DEFAULT_TOLERANCE) {
        return this._internals.toTextLineObjects(
            await this._internals.findTextLines(Position.atPageCoordinates(this._pageIndex, x, y, tolerance))
        );
    }

    /**
     * Gets a snapshot of this page, including all elements.
     * Optionally filter by object types.
     */
    async getSnapshot(types?: ObjectType[]): Promise<PageSnapshot> {
        return this._client.getPageSnapshot(this._pageIndex, types);
    }

    // Singular convenience methods - return the first element or null

    async selectPath() {
        const paths = await this.selectPaths();
        return paths.length > 0 ? paths[0] : null;
    }

    async selectPathAt(x: number, y: number, tolerance: number = 0) {
        const paths = await this.selectPathsAt(x, y, tolerance);
        return paths.length > 0 ? paths[0] : null;
    }

    async selectImage() {
        const images = await this.selectImages();
        return images.length > 0 ? images[0] : null;
    }

    async selectImageAt(x: number, y: number, tolerance: number = 0) {
        const images = await this.selectImagesAt(x, y, tolerance);
        return images.length > 0 ? images[0] : null;
    }

    async selectForm() {
        const forms = await this.selectForms();
        return forms.length > 0 ? forms[0] : null;
    }

    async selectFormAt(x: number, y: number, tolerance: number = 0) {
        const forms = await this.selectFormsAt(x, y, tolerance);
        return forms.length > 0 ? forms[0] : null;
    }

    async selectFormField() {
        const fields = await this.selectFormFields();
        return fields.length > 0 ? fields[0] : null;
    }

    async selectFormFieldAt(x: number, y: number, tolerance: number = 0) {
        const fields = await this.selectFormFieldsAt(x, y, tolerance);
        return fields.length > 0 ? fields[0] : null;
    }

    async selectFormFieldByName(fieldName: string) {
        const fields = await this.selectFormFieldsByName(fieldName);
        return fields.length > 0 ? fields[0] : null;
    }

    async selectParagraph() {
        const paragraphs = await this.selectParagraphs();
        return paragraphs.length > 0 ? paragraphs[0] : null;
    }

    async selectParagraphStartingWith(text: string) {
        const paragraphs = await this.selectParagraphsStartingWith(text);
        return paragraphs.length > 0 ? paragraphs[0] : null;
    }

    async selectParagraphMatching(pattern: string) {
        const paragraphs = await this.selectParagraphsMatching(pattern);
        return paragraphs.length > 0 ? paragraphs[0] : null;
    }

    async selectParagraphAt(x: number, y: number, tolerance: number = DEFAULT_TOLERANCE) {
        const paragraphs = await this.selectParagraphsAt(x, y, tolerance);
        return paragraphs.length > 0 ? paragraphs[0] : null;
    }

    async selectTextLine() {
        const lines = await this.selectTextLines();
        return lines.length > 0 ? lines[0] : null;
    }

    async selectTextLineStartingWith(text: string) {
        const lines = await this.selectTextLinesStartingWith(text);
        return lines.length > 0 ? lines[0] : null;
    }

    async selectTextLineMatching(pattern: string) {
        const lines = await this.selectTextLinesMatching(pattern);
        return lines.length > 0 ? lines[0] : null;
    }

    async selectTextLineAt(x: number, y: number, tolerance: number = DEFAULT_TOLERANCE) {
        const lines = await this.selectTextLinesAt(x, y, tolerance);
        return lines.length > 0 ? lines[0] : null;
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
        pdfData: Uint8Array | File | ArrayBuffer | string,
        baseUrl: string | null = null,
        readTimeout: number = 60000,
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
        this._retryConfig = {
            ...DEFAULT_RETRY_CONFIG,
            ...retryConfig
        };

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

    static async open(
        pdfData: Uint8Array,
        token?: string,
        baseUrl?: string,
        timeout?: number,
        retryConfig?: RetryConfig
    ): Promise<PDFDancer> {
        const resolvedBaseUrl =
            baseUrl ??
            process.env.PDFDANCER_BASE_URL ??
            "https://api.pdfdancer.com";
        const resolvedTimeout = timeout ?? 60000;

        let resolvedToken = token?.trim() ?? process.env.PDFDANCER_TOKEN?.trim() ?? null;
        if (!resolvedToken) {
            resolvedToken = await PDFDancer._obtainAnonymousToken(resolvedBaseUrl, resolvedTimeout);
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
     * @param token Authentication token (optional, can use PDFDANCER_TOKEN env var)
     * @param baseUrl Base URL for the PDFDancer API (optional)
     * @param timeout Request timeout in milliseconds (default: 60000)
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
        const resolvedBaseUrl =
            baseUrl ??
            process.env.PDFDANCER_BASE_URL ??
            "https://api.pdfdancer.com";
        const resolvedTimeout = timeout ?? 60000;

        let resolvedToken = token?.trim() ?? process.env.PDFDANCER_TOKEN?.trim() ?? null;
        if (!resolvedToken) {
            resolvedToken = await PDFDancer._obtainAnonymousToken(resolvedBaseUrl, resolvedTimeout);
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
            // Build URL ensuring no double slashes
            const base = resolvedBaseUrl.replace(/\/+$/, '');
            const endpoint = '/session/new'.replace(/^\/+/, '');
            const url = `${base}/${endpoint}`;

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
                        'X-Fingerprint': fingerprint
                    },
                    body: JSON.stringify(createRequest.toDict()),
                    signal: resolvedTimeout > 0 ? AbortSignal.timeout(resolvedTimeout) : undefined
                },
                DEFAULT_RETRY_CONFIG,
                'POST /session/new'
            );

            logGeneratedAtHeader(response, 'POST', '/session/new');

            if (!response.ok) {
                const errorText = await response.text();
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
            client._retryConfig = {
                ...DEFAULT_RETRY_CONFIG,
                ...retryConfig
            };
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

    private static async _obtainAnonymousToken(baseUrl: string, timeout: number = 60000): Promise<string> {
        const normalizedBaseUrl = (baseUrl || "https://api.pdfdancer.com").replace(/\/+$/, '');
        const url = `${normalizedBaseUrl}/keys/anon`;

        try {
            const fingerprint = await generateFingerprint();
            const response = await fetchWithRetry(
                url,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Fingerprint': fingerprint,
                        'X-Generated-At': generateTimestamp()
                    },
                    signal: timeout > 0 ? AbortSignal.timeout(timeout) : undefined
                },
                DEFAULT_RETRY_CONFIG,
                'POST /keys/anon'
            );

            if (!response.ok) {
                const errorText = await response.text().catch(() => '');
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
    private _processPdfData(pdfData: Uint8Array | File | ArrayBuffer | string): Uint8Array {
        if (!pdfData) {
            throw new ValidationException("PDF data cannot be null");
        }

        try {
            if (pdfData && pdfData.constructor === Uint8Array) {
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
            } else if (pdfData instanceof File) {
                // Note: File reading will be handled asynchronously in the session creation
                return new Uint8Array(); // Placeholder, will be replaced in _createSession
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
        const base = this._baseUrl.replace(/\/+$/, '');
        const endpoint = path.replace(/^\/+/, '');
        return `${base}/${endpoint}`;
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

            // Handle File objects by reading their content
            if (this._pdfBytes instanceof File) {
                formData.append('pdf', this._pdfBytes, 'document.pdf');
            } else {
                const blob = new Blob([this._pdfBytes.buffer as ArrayBuffer], {type: 'application/pdf'});
                formData.append('pdf', blob, 'document.pdf');
            }

            const fingerprint = await this._getFingerprint();

            const response = await this._fetchWithRetry(
                this._buildUrl('/session/create'),
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this._token}`,
                        'X-Generated-At': generateTimestamp(),
                        'X-Fingerprint': fingerprint
                    },
                    body: formData,
                    signal: this._readTimeout > 0 ? AbortSignal.timeout(this._readTimeout) : undefined
                },
                'POST /session/create'
            );

            logGeneratedAtHeader(response, 'POST', '/session/create');

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
        options: RequestInit,
        context: string = 'request'
    ): Promise<Response> {
        return fetchWithRetry(url, options, this._retryConfig, context);
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
            'X-Fingerprint': fingerprint
        };

        try {
            const response = await this._fetchWithRetry(
                url.toString(),
                {
                    method,
                    headers,
                    body: data ? JSON.stringify(data) : undefined,
                    signal: this._readTimeout > 0 ? AbortSignal.timeout(this._readTimeout) : undefined
                },
                `${method} ${path}`
            );

            logGeneratedAtHeader(response, method, path);

            // Handle FontNotFoundException
            if (response.status === 404) {
                try {
                    const errorData = await response.json() as any;
                    if (errorData.error === 'FontNotFoundException') {
                        throw new FontNotFoundException(errorData.message || 'Font not found');
                    }
                } catch (e) {
                    if (e instanceof FontNotFoundException) {
                        throw e;
                    }
                    // Continue with normal error handling if JSON parsing fails
                }
            }

            if (!response.ok) {
                const errorMessage = await this._extractErrorMessage(response);
                throw new HttpClientException(`API request failed: ${errorMessage}`, response);
            }

            return response;
        } catch (error) {
            if (error instanceof FontNotFoundException || error instanceof HttpClientException) {
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

        if (position?.pageIndex !== undefined) {
            // Page-specific query - use page snapshot
            const pageSnapshot = await this._getOrFetchPageSnapshot(position.pageIndex);
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
     * Searches for paragraph objects at the specified position.
     */
    private async findParagraphs(position?: Position): Promise<TextObjectRef[]> {
        return this.find(ObjectType.PARAGRAPH, position) as Promise<TextObjectRef[]>;
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

    async selectFieldsByName(fieldName: string) {
        return this.toFormFields(await this.findFormFields(Position.byName(fieldName)));
    }

    /**
     * Searches for text line objects at the specified position.
     */
    private async findTextLines(position?: Position): Promise<TextObjectRef[]> {
        return this.find(ObjectType.TEXT_LINE, position) as Promise<TextObjectRef[]>;
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

        if (position?.pageIndex !== undefined) {
            // Page-specific query - use page snapshot
            const pageSnapshot = await this._getOrFetchPageSnapshot(position.pageIndex);
            elements = pageSnapshot.elements;
        } else {
            // Document-wide query - use document snapshot
            const docSnapshot = await this._getOrFetchDocumentSnapshot();
            elements = docSnapshot.getAllElements();
        }

        // Filter by form field types (FORM_FIELD, TEXT_FIELD, CHECKBOX, RADIO_BUTTON)
        const formFieldTypes = [
            ObjectType.FORM_FIELD,
            ObjectType.TEXT_FIELD,
            ObjectType.CHECKBOX,
            ObjectType.RADIO_BUTTON
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
    private async _getPage(pageIndex: number): Promise<PageRef | null> {
        if (pageIndex < 0) {
            throw new ValidationException(`Page index must be >= 0, got ${pageIndex}`);
        }

        // Try page snapshot cache first
        if (this._pageSnapshotCache.has(pageIndex)) {
            return this._pageSnapshotCache.get(pageIndex)!.pageRef;
        }

        // Try document snapshot cache
        if (this._documentSnapshotCache) {
            const pageSnapshot = this._documentSnapshotCache.getPageSnapshot(pageIndex);
            if (pageSnapshot) {
                return pageSnapshot.pageRef;
            }
        }

        // Fetch document snapshot to get page (this will cache it)
        const docSnapshot = await this._getOrFetchDocumentSnapshot();
        const pageSnapshot = docSnapshot.getPageSnapshot(pageIndex);
        return pageSnapshot?.pageRef ?? null;
    }

    /**
     * Moves an existing page to a new index.
     */
    async movePage(pageIndex: number, targetPageIndex: number): Promise<PageRef> {
        this._validatePageIndex(pageIndex, 'pageIndex');
        this._validatePageIndex(targetPageIndex, 'targetPageIndex');

        // Ensure the source page exists before attempting the move
        await this._requirePageRef(pageIndex);

        const request = new MovePageRequest(pageIndex, targetPageIndex).toDict();
        const response = await this._makeRequest('PUT', '/pdf/page/move', request);
        const success = await response.json() as boolean;

        if (!success) {
            throw new HttpClientException(`Failed to move page from ${pageIndex} to ${targetPageIndex}`, response);
        }

        // Invalidate cache after mutation
        this._invalidateCache();

        // Fetch the page again at its new position for up-to-date metadata
        return await this._requirePageRef(targetPageIndex);
    }

    /**
     * Deletes the page at the specified index.
     */
    async deletePage(pageIndex: number): Promise<boolean> {
        this._validatePageIndex(pageIndex, 'pageIndex');

        const pageRef = await this._requirePageRef(pageIndex);
        const result = await this._deletePage(pageRef);

        // Invalidate cache after mutation
        this._invalidateCache();

        return result;
    }

    private _validatePageIndex(pageIndex: number, fieldName: string): void {
        if (!Number.isInteger(pageIndex)) {
            throw new ValidationException(`${fieldName} must be an integer, got ${pageIndex}`);
        }
        if (pageIndex < 0) {
            throw new ValidationException(`${fieldName} must be >= 0, got ${pageIndex}`);
        }
    }

    private async _requirePageRef(pageIndex: number): Promise<PageRef> {
        const pageRef = await this._getPage(pageIndex);
        if (!pageRef) {
            throw new ValidationException(`Page not found at index ${pageIndex}`);
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
     * @param pageIndex Zero-based page index
     * @param types Optional array of ObjectType to filter elements by type
     * @returns PageSnapshot containing page information and elements
     */
    async getPageSnapshot(pageIndex: number, types?: ObjectType[]): Promise<PageSnapshot> {
        this._validatePageIndex(pageIndex, 'pageIndex');

        const params: Record<string, string> = {};
        if (types && types.length > 0) {
            params.types = types.join(',');
        }

        const response = await this._makeRequest('GET', `/pdf/page/${pageIndex}/snapshot`, undefined, params);
        const data = await response.json() as any;

        return this._parsePageSnapshot(data);
    }

    // Cache Management

    /**
     * Gets a page snapshot from cache or fetches it.
     * First checks page cache, then document cache, then fetches from server.
     */
    private async _getOrFetchPageSnapshot(pageIndex: number): Promise<PageSnapshot> {
        // Check page cache first
        if (this._pageSnapshotCache.has(pageIndex)) {
            return this._pageSnapshotCache.get(pageIndex)!;
        }

        // Check if we have document snapshot and can extract the page
        if (this._documentSnapshotCache) {
            const pageSnapshot = this._documentSnapshotCache.getPageSnapshot(pageIndex);
            if (pageSnapshot) {
                // Cache it for future use
                this._pageSnapshotCache.set(pageIndex, pageSnapshot);
                return pageSnapshot;
            }
        }

        // Fetch page snapshot from server
        const pageSnapshot = await this.getPageSnapshot(pageIndex);
        this._pageSnapshotCache.set(pageIndex, pageSnapshot);
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
        if (position.pageIndex !== undefined) {
            filtered = filtered.filter(el => el.position.pageIndex === position.pageIndex);
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

        // Filter by text starts with
        if (position.textStartsWith && filtered.length > 0) {
            const textLower = position.textStartsWith.toLowerCase();
            filtered = filtered.filter(el => {
                const textObj = el as TextObjectRef;
                return textObj.text && textObj.text.toLowerCase().startsWith(textLower);
            });
        }

        // Filter by text pattern (regex)
        if (position.textPattern && filtered.length > 0) {
            const regex = this._compileTextPattern(position.textPattern);
            filtered = filtered.filter(el => {
                const textObj = el as TextObjectRef;
                return textObj.text && regex.test(textObj.text);
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

    private _compileTextPattern(pattern: string): RegExp {
        try {
            return new RegExp(pattern);
        } catch {
            const inlineMatch = pattern.match(/^\(\?([a-z]+)\)/i);
            if (inlineMatch) {
                const supportedFlags = inlineMatch[1]
                    .toLowerCase()
                    .split('')
                    .filter(flag => 'gimsuy'.includes(flag));
                const flags = Array.from(new Set(supportedFlags)).join('');
                const source = pattern.slice(inlineMatch[0].length);
                try {
                    return new RegExp(source, flags);
                } catch {
                    // fall through to literal fallback
                }
            }

            const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            return new RegExp(escaped);
        }
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
     * Adds a paragraph to the PDF document.
     */
    private async addParagraph(paragraph: Paragraph): Promise<boolean> {
        if (!paragraph) {
            throw new ValidationException("Paragraph cannot be null");
        }
        if (!paragraph.getPosition()) {
            throw new ValidationException("Paragraph position is null, you need to specify a position for the new paragraph, using .at(x,y)");
        }
        if (paragraph.getPosition()!.pageIndex === undefined) {
            throw new ValidationException("Paragraph position page index is null");
        }
        if (paragraph.getPosition()!.pageIndex! < 0) {
            throw new ValidationException("Paragraph position page index is less than 0");
        }

        return this._addObject(paragraph);
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
    private async _addObject(pdfObject: Image | Paragraph): Promise<boolean> {
        const requestData = new AddRequest(pdfObject).toDict();
        const response = await this._makeRequest('POST', '/pdf/add', requestData);
        const result = await response.json() as boolean;

        // Invalidate cache after mutation
        this._invalidateCache();

        return result;
    }

    // Modify Operations

    /**
     * Modifies a paragraph object or its text content.
     */
    private async modifyParagraph(objectRef: ObjectRef, newParagraph: Paragraph | string | null): Promise<CommandResult> {
        if (!objectRef) {
            throw new ValidationException("Object reference cannot be null");
        }
        if (newParagraph === null || newParagraph === undefined) {
            return CommandResult.empty("ModifyParagraph", objectRef.internalId);
        }

        let result: CommandResult;
        if (typeof newParagraph === 'string') {
            // Text modification - returns CommandResult
            const requestData = new ModifyTextRequest(objectRef, newParagraph).toDict();
            const response = await this._makeRequest('PUT', '/pdf/text/paragraph', requestData);
            result = CommandResult.fromDict(await response.json());
        } else {
            // Object modification
            const requestData = new ModifyRequest(objectRef, newParagraph).toDict();
            const response = await this._makeRequest('PUT', '/pdf/modify', requestData);
            result = CommandResult.fromDict(await response.json());
        }

        // Invalidate cache after mutation
        this._invalidateCache();

        return result;
    }

    /**
     * Modifies a text line object.
     */
    private async modifyTextLine(objectRef: ObjectRef, newText: string): Promise<CommandResult> {
        if (!objectRef) {
            throw new ValidationException("Object reference cannot be null");
        }
        if (newText === null || newText === undefined) {
            throw new ValidationException("New text cannot be null");
        }

        const requestData = new ModifyTextRequest(objectRef, newText).toDict();
        const response = await this._makeRequest('PUT', '/pdf/text/line', requestData);
        const result = CommandResult.fromDict(await response.json());

        // Invalidate cache after mutation
        this._invalidateCache();

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
    async registerFont(ttfFile: Uint8Array | File | string): Promise<string> {
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
            } else if (ttfFile instanceof File) {
                if (ttfFile.size === 0) {
                    throw new ValidationException("Font file is empty");
                }
                fontData = new Uint8Array(await ttfFile.arrayBuffer());
                filename = ttfFile.name;
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
                        'X-Fingerprint': fingerprint
                    },
                    body: formData,
                    signal: AbortSignal.timeout(60000)
                },
                'POST /font/register'
            );

            logGeneratedAtHeader(response, 'POST', '/font/register');

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

        if (this._isTextObjectData(objData, objectType)) {
            return this._parseTextObjectRef(objData);
        }

        // Check if this is a form field type
        const formFieldTypes = [
            ObjectType.FORM_FIELD,
            ObjectType.TEXT_FIELD,
            ObjectType.CHECKBOX,
            ObjectType.RADIO_BUTTON
        ];
        if (formFieldTypes.includes(objectType)) {
            return this._parseFormFieldRef(objData);
        }

        return new ObjectRef(
            objData.internalId,
            position,
            objectType
        );
    }

    private _isTextObjectData(objData: any, objectType: ObjectType): boolean {
        return objectType === ObjectType.PARAGRAPH ||
            objectType === ObjectType.TEXT_LINE ||
            objectType === ObjectType.TEXT_ELEMENT ||
            typeof objData.text === 'string' ||
            typeof objData.fontName === 'string' ||
            Array.isArray(objData.children);
    }

    private _parseTextObjectRef(objData: any, fallbackId?: string): TextObjectRef {
        const positionData = objData.position || {};
        const position = positionData ? this._parsePosition(positionData) : new Position();

        const objectType = (objData.type as ObjectType) ?? ObjectType.TEXT_LINE;
        const lineSpacings = Array.isArray(objData.lineSpacings) ? objData.lineSpacings : null;
        const internalId = objData.internalId ?? fallbackId ?? '';

        // Parse status if present
        let status: TextStatus | undefined;
        const statusData = objData.status;
        if (statusData && typeof statusData === 'object') {
            const fontInfoSource = statusData.fontInfoDto ?? statusData.fontRecommendation;
            let fontInfo: DocumentFontInfo | undefined;
            if (fontInfoSource && typeof fontInfoSource === 'object') {
                const documentFontName = typeof fontInfoSource.documentFontName === 'string'
                    ? fontInfoSource.documentFontName
                    : (typeof fontInfoSource.fontName === 'string' ? fontInfoSource.fontName : '');
                const systemFontName = typeof fontInfoSource.systemFontName === 'string'
                    ? fontInfoSource.systemFontName
                    : (typeof fontInfoSource.fontName === 'string' ? fontInfoSource.fontName : '');
                fontInfo = new DocumentFontInfo(documentFontName, systemFontName);
            }

            const modified = statusData.modified !== undefined ? Boolean(statusData.modified) : false;
            const encodable = statusData.encodable !== undefined ? Boolean(statusData.encodable) : true;
            const fontTypeValue = typeof statusData.fontType === 'string'
                && (Object.values(FontType) as string[]).includes(statusData.fontType)
                ? statusData.fontType as FontType
                : FontType.SYSTEM;

            status = new TextStatus(
                modified,
                encodable,
                fontTypeValue,
                fontInfo
            );
        }

        const textObject = new TextObjectRef(
            internalId,
            position,
            objectType,
            typeof objData.text === 'string' ? objData.text : undefined,
            typeof objData.fontName === 'string' ? objData.fontName : undefined,
            typeof objData.fontSize === 'number' ? objData.fontSize : undefined,
            lineSpacings,
            undefined,
            this._parseColor(objData.color),
            status
        );

        if (Array.isArray(objData.children) && objData.children.length > 0) {
            try {
                textObject.children = objData.children.map((childData: any, index: number) => {
                    const childFallbackId = `${internalId || 'child'}-${index}`;
                    return this._parseTextObjectRef(childData, childFallbackId);
                });
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                console.error(`Failed to parse children of ${internalId}: ${message}`);
            }
        }

        return textObject;
    }

    private _parsePageRef(objData: any): PageRef {
        const positionData = objData.position || {};
        const position = positionData ? this._parsePosition(positionData) : new Position();

        const pageSize = this._parsePageSize(objData.pageSize);
        const orientation = this._parseOrientation(objData.orientation);

        return new PageRef(
            objData.internalId,
            position,
            ObjectType.PAGE,
            pageSize,
            orientation
        );
    }

    private _parsePageSize(pageSizeData: any): PageSize | undefined {
        if (!pageSizeData || typeof pageSizeData !== 'object') {
            return undefined;
        }

        const name = typeof pageSizeData.name === 'string' ? pageSizeData.name : undefined;
        const width = typeof pageSizeData.width === 'number' ? pageSizeData.width : undefined;
        const height = typeof pageSizeData.height === 'number' ? pageSizeData.height : undefined;

        if (name === undefined && width === undefined && height === undefined) {
            return undefined;
        }

        return {name, width, height};
    }

    private _parseOrientation(orientationData: any): Orientation | undefined {
        if (typeof orientationData !== 'string') {
            return undefined;
        }

        if (orientationData === Orientation.PORTRAIT || orientationData === Orientation.LANDSCAPE) {
            return orientationData;
        }

        const normalized = orientationData.trim().toUpperCase();
        if (normalized === Orientation.PORTRAIT || normalized === Orientation.LANDSCAPE) {
            return normalized as Orientation;
        }

        return undefined;
    }

    private _parseColor(colorData: any): Color | undefined {
        if (!colorData || typeof colorData !== 'object') {
            return undefined;
        }

        // The API returns color as {red, green, blue, alpha}
        const {red, green, blue, alpha} = colorData;

        if (typeof red !== 'number' || typeof green !== 'number' || typeof blue !== 'number') {
            return undefined;
        }

        const resolvedAlpha = typeof alpha === 'number' ? alpha : 255;

        try {
            return new Color(red, green, blue, resolvedAlpha);
        } catch (_error) {
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
        position.pageIndex = posData.pageIndex;
        position.textStartsWith = posData.textStartsWith;

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
                elements.push(this._parseObjectRef(elementData));
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

    newImage(pageIndex?: number) {
        return new ImageBuilder(this, pageIndex);
    }

    newParagraph(pageIndex?: number) {
        return new ParagraphBuilder(this, pageIndex);
    }

    newPage() {
        return new PageBuilder(this);
    }

    page(pageIndex: number) {
        if (pageIndex < 0) {
            throw new ValidationException(`Page index must be >= 0, got ${pageIndex}`);
        }
        return new PageClient(this, pageIndex);
    }

    async pages() {
        const pageRefs = await this.getPages();
        return pageRefs.map((pageRef, pageIndex) => new PageClient(this, pageIndex, pageRef));
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

    async selectParagraphs() {
        return this.toParagraphObjects(await this.findParagraphs());
    }

    async selectParagraphsMatching(pattern: string) {
        if (!pattern) {
            throw new ValidationException('Pattern cannot be empty');
        }
        const position = new Position();
        position.textPattern = pattern;
        return this.toParagraphObjects(await this.findParagraphs(position));
    }

    private toParagraphObjects(objectRefs: TextObjectRef[]) {
        return objectRefs.map(ref => ParagraphObject.fromRef(this, ref));
    }

    private toTextLineObjects(objectRefs: TextObjectRef[]) {
        return objectRefs.map(ref => TextLineObject.fromRef(this, ref));
    }

    async selectTextLines() {
        return this.toTextLineObjects(await this.findTextLines());
    }

    async selectLines() {
        return this.selectTextLines();
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

    async selectFieldByName(fieldName: string) {
        const fields = await this.selectFieldsByName(fieldName);
        return fields.length > 0 ? fields[0] : null;
    }

    async selectParagraph() {
        const paragraphs = await this.selectParagraphs();
        return paragraphs.length > 0 ? paragraphs[0] : null;
    }

    async selectParagraphMatching(pattern: string) {
        const paragraphs = await this.selectParagraphsMatching(pattern);
        return paragraphs.length > 0 ? paragraphs[0] : null;
    }

    async selectTextLine() {
        const lines = await this.selectTextLines();
        return lines.length > 0 ? lines[0] : null;
    }

    async selectLine() {
        return this.selectTextLine();
    }
}
