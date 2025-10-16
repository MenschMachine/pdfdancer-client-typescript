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
    AddRequest,
    BoundingRect,
    ChangeFormFieldRequest,
    DeleteRequest,
    FindRequest,
    Font,
    FormFieldRef,
    Image,
    ModifyRequest,
    ModifyTextRequest,
    MoveRequest,
    ObjectRef,
    ObjectType,
    Paragraph,
    Position,
    PositionMode,
    ShapeType
} from './models';
import {ParagraphBuilder} from './paragraph-builder';
import {FormFieldObject, FormXObject, ImageObject, ParagraphObject, PathObject, TextLineObject} from "./types";
import {ImageBuilder} from "./image-builder";
import fs from "fs";

// 👇 Internal view of PDFDancer methods, not exported
interface PDFDancerInternals {

    toImageObjects(objectRefs: ObjectRef[]): ImageObject[];

    toPathObjects(objectRefs: ObjectRef[]): PathObject[];

    toFormXObjects(objectRefs: ObjectRef[]): FormXObject[];

    deletePage(objectRef: ObjectRef): Promise<boolean>;

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
    private _internals: PDFDancerInternals;

    constructor(client: PDFDancer, pageIndex: number) {
        this._client = client;
        this._pageIndex = pageIndex;
        this.internalId = `PAGE-${this._pageIndex}`;
        this.position = Position.atPage(this._pageIndex);
        // Cast to the internal interface to get access
        this._internals = this._client as unknown as PDFDancerInternals;
    }

    async selectPathsAt(x: number, y: number) {
        return this._internals.toPathObjects(await this._internals.findPaths(Position.atPageCoordinates(this._pageIndex, x, y)));
    }

    async selectImages() {
        return this._internals.toImageObjects(await this._internals._findImages(Position.atPage(this._pageIndex)));
    }

    async selectImagesAt(x: number, y: number) {
        return this._internals.toImageObjects(await this._internals._findImages(Position.atPageCoordinates(this._pageIndex, x, y)));
    }

    async delete() {
        return this._internals.deletePage(this.ref());
    }

    private ref() {
        return new ObjectRef(this.internalId, this.position, this.type);
    }

    // noinspection JSUnusedGlobalSymbols
    async selectForms() {
        return this._internals.toFormXObjects(await this._internals.findFormXObjects(Position.atPage(this._pageIndex)));
    }

    async selectFormsAt(x: number, y: number) {
        return this._internals.toFormXObjects(await this._internals.findFormXObjects(Position.atPageCoordinates(this._pageIndex, x, y)));
    }

    async selectFormFields() {
        return this._internals.toFormFields(await this._internals.findFormFields(Position.atPage(this._pageIndex)));
    }

    async selectFormFieldsAt(x: number, y: number) {
        return this._internals.toFormFields(await this._internals.findFormFields(Position.atPageCoordinates(this._pageIndex, x, y)));
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

    async selectParagraphsAt(x: number, y: number) {
        return this._internals.toParagraphObjects(await this._internals.findParagraphs(Position.atPageCoordinates(this._pageIndex, x, y)));
    }

    async selectTextLinesStartingWith(text: string) {
        let pos = Position.atPage(this._pageIndex);
        pos.textStartsWith = text;
        return this._internals.toTextLineObjects(await this._internals.findTextLines(pos));
    }

    /**
     * Creates a new ParagraphBuilder for fluent paragraph construction.
     */
    newParagraph(): ParagraphBuilder {
        return new ParagraphBuilder(this._client, this.position.pageIndex);
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
    async selectTextLinesAt(x: number, y: number) {
        return this._internals.toTextLineObjects(await this._internals.findTextLines(Position.atPageCoordinates(this._pageIndex, x, y)));
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

    /**
     * Creates a new client with PDF data.
     * This constructor initializes the client, uploads the PDF data to open
     * a new session, and prepares the client for PDF manipulation operations.
     */
    private constructor(
        token: string,
        pdfData: Uint8Array | File | ArrayBuffer,
        baseUrl: string = "http://localhost:8080",
        readTimeout: number = 30000
    ) {
        if (!token || !token.trim()) {
            throw new ValidationException("Authentication token cannot be null or empty");
        }

        this._token = token.trim();
        this._baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
        this._readTimeout = readTimeout;

        // Process PDF data with validation
        this._pdfBytes = this._processPdfData(pdfData);
    }

    /**
     * Initialize the client by creating a session.
     * Must be called after constructor before using the client.
     */
    private async init(): Promise<this> {
        this._sessionId = await this._createSession();
        return this;
    }

    static async open(pdfData: Uint8Array, token?: string, baseUrl?: string, timeout?: number): Promise<PDFDancer> {
        const resolvedToken = token ?? process.env.PDFDANCER_TOKEN;
        const resolvedBaseUrl =
            baseUrl ??
            process.env.PDFDANCER_BASE_URL ??
            "https://api.pdfdancer.com";
        const resolvedTimeout = timeout ?? 30000;

        if (!resolvedToken) {
            throw new Error("Missing PDFDancer token (pass it explicitly or set PDFDANCER_TOKEN in environment).");
        }

        const client = new PDFDancer(resolvedToken, pdfData, resolvedBaseUrl, resolvedTimeout);
        return await client.init();
    }

    /**
     * Process PDF data from various input types with strict validation.
     */
    private _processPdfData(pdfData: Uint8Array | File | ArrayBuffer): Uint8Array {
        if (!pdfData) {
            throw new ValidationException("PDF data cannot be null");
        }

        try {
            if (pdfData instanceof Uint8Array) {
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

            const response = await fetch(`${this._baseUrl}/session/create`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this._token}`
                },
                body: formData,
                signal: this._readTimeout > 0 ? AbortSignal.timeout(this._readTimeout) : undefined
            });

            if (!response.ok) {
                const errorMessage = await this._extractErrorMessage(response);
                throw new HttpClientException(`Failed to create session: ${errorMessage}`, response);
            }

            const sessionId = (await response.text()).trim();

            if (!sessionId) {
                throw new SessionException("Server returned empty session ID");
            }

            return sessionId;
        } catch (error) {
            if (error instanceof HttpClientException || error instanceof SessionException) {
                throw error;
            }
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new HttpClientException(`Failed to create session: ${errorMessage}`, undefined, error as Error);
        }
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
        const url = new URL(`${this._baseUrl}${path}`);
        if (params) {
            Object.entries(params).forEach(([key, value]) => {
                url.searchParams.append(key, value);
            });
        }

        const headers: Record<string, string> = {
            'Authorization': `Bearer ${this._token}`,
            'X-Session-Id': this._sessionId,
            'Content-Type': 'application/json'
        };

        try {
            const response = await fetch(url.toString(), {
                method,
                headers,
                body: data ? JSON.stringify(data) : undefined,
                signal: this._readTimeout > 0 ? AbortSignal.timeout(this._readTimeout) : undefined
            });

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
     */
    private async find(objectType?: ObjectType, position?: Position): Promise<ObjectRef[]> {
        const requestData = new FindRequest(objectType, position).toDict();
        const response = await this._makeRequest('POST', '/pdf/find', requestData);

        const objectsData = await response.json() as any[];
        return objectsData.map((objData: any) => this._parseObjectRef(objData));
    }

    /**
     * Searches for paragraph objects at the specified position.
     */
    private async findParagraphs(position?: Position): Promise<ObjectRef[]> {
        return this.find(ObjectType.PARAGRAPH, position);
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
    private async findTextLines(position?: Position): Promise<ObjectRef[]> {
        return this.find(ObjectType.TEXT_LINE, position);
    }

    /**
     * Searches for form fields at the specified position.
     * Returns FormFieldRef objects with name and value properties.
     */
    private async findFormFields(position?: Position): Promise<FormFieldRef[]> {
        const requestData = new FindRequest(ObjectType.FORM_FIELD, position).toDict();
        const response = await this._makeRequest('POST', '/pdf/find', requestData);

        const objectsData = await response.json() as any[];
        return objectsData.map((objData: any) => this._parseFormFieldRef(objData));
    }

    // Page Operations

    /**
     * Retrieves references to all pages in the PDF document.
     */
    private async getPages(): Promise<ObjectRef[]> {
        const response = await this._makeRequest('POST', '/pdf/page/find');
        const pagesData = await response.json() as any[];
        return pagesData.map((pageData: any) => this._parseObjectRef(pageData));
    }

    /**
     * Retrieves a reference to a specific page by its page index.
     */
    private async _getPage(pageIndex: number): Promise<ObjectRef | null> {
        if (pageIndex < 0) {
            throw new ValidationException(`Page index must be >= 0, got ${pageIndex}`);
        }

        const params = {pageIndex: pageIndex.toString()};
        const response = await this._makeRequest('POST', '/pdf/page/find', undefined, params);

        const pagesData = await response.json() as any[];
        if (!pagesData || pagesData.length === 0) {
            return null;
        }

        return this._parseObjectRef(pagesData[0]);
    }

    /**
     * Deletes a page from the PDF document.
     */
    private async deletePage(pageRef: ObjectRef): Promise<boolean> {
        if (!pageRef) {
            throw new ValidationException("Page reference cannot be null");
        }

        const requestData = pageRef.toDict();
        const response = await this._makeRequest('DELETE', '/pdf/page/delete', requestData);
        return await response.json() as boolean;
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
        return await response.json() as boolean;
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
        return await response.json() as boolean;
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
        return await response.json() as boolean;
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
            throw new ValidationException("Paragraph position is null");
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
     * Internal method to add any PDF object.
     */
    private async _addObject(pdfObject: Image | Paragraph): Promise<boolean> {
        const requestData = new AddRequest(pdfObject).toDict();
        const response = await this._makeRequest('POST', '/pdf/add', requestData);
        return await response.json() as boolean;
    }

    // Modify Operations

    /**
     * Modifies a paragraph object or its text content.
     */
    private async modifyParagraph(objectRef: ObjectRef, newParagraph: Paragraph | string): Promise<boolean> {
        if (!objectRef) {
            throw new ValidationException("Object reference cannot be null");
        }
        if (newParagraph === null || newParagraph === undefined) {
            throw new ValidationException("New paragraph cannot be null");
        }

        if (typeof newParagraph === 'string') {
            // Text modification
            const requestData = new ModifyTextRequest(objectRef, newParagraph).toDict();
            const response = await this._makeRequest('PUT', '/pdf/text/paragraph', requestData);
            return await response.json() as boolean;
        } else {
            // Object modification
            const requestData = new ModifyRequest(objectRef, newParagraph).toDict();
            const response = await this._makeRequest('PUT', '/pdf/modify', requestData);
            return await response.json() as boolean;
        }
    }

    /**
     * Modifies a text line object.
     */
    private async modifyTextLine(objectRef: ObjectRef, newText: string): Promise<boolean> {
        if (!objectRef) {
            throw new ValidationException("Object reference cannot be null");
        }
        if (newText === null || newText === undefined) {
            throw new ValidationException("New text cannot be null");
        }

        const requestData = new ModifyTextRequest(objectRef, newText).toDict();
        const response = await this._makeRequest('PUT', '/pdf/text/line', requestData);
        return await response.json() as boolean;
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
    async registerFont(ttfFile: Uint8Array | File): Promise<string> {
        if (!ttfFile) {
            throw new ValidationException("TTF file cannot be null");
        }

        try {
            let fontData: Uint8Array;
            let filename: string;

            if (ttfFile instanceof Uint8Array) {
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
            } else {
                throw new ValidationException(`Unsupported font file type: ${typeof ttfFile}`);
            }

            // Upload font file
            const formData = new FormData();
            const blob = new Blob([fontData.buffer as ArrayBuffer], {type: 'font/ttf'});
            formData.append('ttfFile', blob, filename);

            const response = await fetch(`${this._baseUrl}/font/register`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this._token}`,
                    'X-Session-Id': this._sessionId
                },
                body: formData,
                signal: AbortSignal.timeout(30000)
            });

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

        return new ObjectRef(
            objData.internalId,
            position,
            objectType
        );
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

    newImage() {
        return new ImageBuilder(this);
    }

    page(pageIndex: number) {
        if (pageIndex < 0) {
            throw new ValidationException(`Page index must be >= 0, got ${pageIndex}`);
        }
        return new PageClient(this, pageIndex);
    }

    async pages() {
        let pageRefs = await this.getPages();
        return pageRefs.map((_, pageIndex) => new PageClient(this, pageIndex));
    }

    private toFormFields(objectRefs: FormFieldRef[]) {
        return objectRefs.map(ref => FormFieldObject.fromRef(this, ref));
    }

    async selectParagraphs() {
        return this.toParagraphObjects(await this.findParagraphs());
    }

    private toParagraphObjects(objectRefs: ObjectRef[]) {
        return objectRefs.map(ref => ParagraphObject.fromRef(this, ref));
    }

    private toTextLineObjects(objectRefs: ObjectRef[]) {
        return objectRefs.map(ref => TextLineObject.fromRef(this, ref));
    }

    async selectLines() {
        return this.toTextLineObjects(await this.findTextLines());
    }
}
