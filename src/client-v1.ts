/**
 * PDFDancer TypeScript Client V1
 *
 * A TypeScript client that closely mirrors the Python Client class structure and functionality.
 * Provides session-based PDF manipulation operations with strict validation.
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

/**
 * REST API client for interacting with the PDFDancer PDF manipulation service.
 * This client provides a convenient TypeScript interface for performing PDF operations
 * including session management, object searching, manipulation, and retrieval.
 * Handles authentication, session lifecycle, and HTTP communication transparently.
 *
 * Mirrors the Python Client class functionality exactly.
 */
export class ClientV1 {
    private _token: string;
    private _baseUrl: string;
    private _readTimeout: number;
    private _pdfBytes: Uint8Array;
    private _sessionId!: string;

    /**
     * Creates a new client with PDF data.
     * This constructor initializes the client, uploads the PDF data to create
     * a new session, and prepares the client for PDF manipulation operations.
     */
    constructor(
        token: string,
        pdfData: Uint8Array | File | ArrayBuffer,
        baseUrl: string = "http://localhost:8080",
        readTimeout: number = 30000
    ) {
        // Strict validation like Python client
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

    static async create(token: string, pdfData: Uint8Array, baseUrl: string, timeout: number = 0): Promise<ClientV1> {
        const client = new ClientV1(token, pdfData, baseUrl, timeout);
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

            // Handle FontNotFoundException specifically like Python client
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

    // Search Operations - matching Python client exactly

    /**
     * Searches for PDF objects matching the specified criteria.
     * This method provides flexible search capabilities across all PDF content,
     * allowing filtering by object type and position constraints.
     */
    async find(objectType?: ObjectType, position?: Position): Promise<ObjectRef[]> {
        const requestData = new FindRequest(objectType, position).toDict();
        const response = await this._makeRequest('POST', '/pdf/find', requestData);

        const objectsData = await response.json() as any[];
        return objectsData.map((objData: any) => this._parseObjectRef(objData));
    }

    /**
     * Searches for paragraph objects at the specified position.
     */
    async findParagraphs(position?: Position): Promise<ObjectRef[]> {
        return this.find(ObjectType.PARAGRAPH, position);
    }

    /**
     * Searches for image objects at the specified position.
     */
    async findImages(position?: Position): Promise<ObjectRef[]> {
        return this.find(ObjectType.IMAGE, position);
    }

    /**
     * Searches for form X objects at the specified position.
     */
    async findFormXObjects(position?: Position): Promise<ObjectRef[]> {
        return this.find(ObjectType.FORM_X_OBJECT, position);
    }

    /**
     * Searches for vector path objects at the specified position.
     */
    async findPaths(position?: Position): Promise<ObjectRef[]> {
        return this.find(ObjectType.PATH, position);
    }

    /**
     * Searches for text line objects at the specified position.
     */
    async findTextLines(position?: Position): Promise<ObjectRef[]> {
        return this.find(ObjectType.TEXT_LINE, position);
    }

    /**
     * Searches for form fields at the specified position.
     * Returns FormFieldRef objects with name and value properties.
     */
    async findFormFields(position?: Position): Promise<FormFieldRef[]> {
        const requestData = new FindRequest(ObjectType.FORM_FIELD, position).toDict();
        const response = await this._makeRequest('POST', '/pdf/find', requestData);

        const objectsData = await response.json() as any[];
        return objectsData.map((objData: any) => this._parseFormFieldRef(objData));
    }

    // Page Operations

    /**
     * Retrieves references to all pages in the PDF document.
     */
    async getPages(): Promise<ObjectRef[]> {
        const response = await this._makeRequest('POST', '/pdf/page/find');
        const pagesData = await response.json() as any[];
        return pagesData.map((pageData: any) => this._parseObjectRef(pageData));
    }

    /**
     * Retrieves a reference to a specific page by its page index.
     */
    async getPage(pageIndex: number): Promise<ObjectRef | null> {
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
    async deletePage(pageRef: ObjectRef): Promise<boolean> {
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
    async delete(objectRef: ObjectRef): Promise<boolean> {
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
    async move(objectRef: ObjectRef, position: Position): Promise<boolean> {
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
    async changeFormField(formFieldRef: FormFieldRef, newValue: string): Promise<boolean> {
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
    async addImage(image: Image, position?: Position): Promise<boolean> {
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
    async addParagraph(paragraph: Paragraph): Promise<boolean> {
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
    async modifyParagraph(objectRef: ObjectRef, newParagraph: Paragraph | string): Promise<boolean> {
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
    async modifyTextLine(objectRef: ObjectRef, newText: string): Promise<boolean> {
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
    async getPdfFile(): Promise<Uint8Array> {
        const response = await this._makeRequest('GET', `/session/${this._sessionId}/pdf`);
        return new Uint8Array(await response.arrayBuffer());
    }

    async getXmlFile(): Promise<Uint8Array> {
        const response = await fetch(`${this._baseUrl}/xml`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this._token}`,
                'X-Session-Id': this._sessionId
            },
            signal: AbortSignal.timeout(30000)
        });
        return response.text()
    }

    /**
     * Saves the current PDF to a file (browser environment).
     * Downloads the PDF in the browser.
     */
    async savePdf(filename: string = 'document.pdf'): Promise<void> {
        if (!filename) {
            throw new ValidationException("Filename cannot be null or empty");
        }

        try {
            const pdfData = await this.getPdfFile();

            // Create blob and download link
            const blob = new Blob([pdfData.buffer as ArrayBuffer], {type: 'application/pdf'});
            const url = URL.createObjectURL(blob);

            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            URL.revokeObjectURL(url);
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

    /**
     * Creates a new ParagraphBuilder for fluent paragraph construction.
     */
    paragraphBuilder(): ParagraphBuilder {
        return new ParagraphBuilder(this);
    }
}
