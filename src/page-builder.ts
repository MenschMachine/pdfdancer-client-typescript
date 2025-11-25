import {PDFDancer} from './pdfdancer_v1';
import {AddPageRequest, Orientation, PageRef, PageSize, STANDARD_PAGE_SIZES} from './models';
import {ValidationException} from './exceptions';

interface PDFDancerInternals {
    addPage(request?: AddPageRequest | null): Promise<PageRef>;
}

const normalizeOrientation = (value: Orientation | string): Orientation => {
    if (typeof value === 'string') {
        const normalized = value.trim().toUpperCase();
        if (!(normalized in Orientation)) {
            throw new ValidationException(`Invalid orientation: ${value}`);
        }
        return Orientation[normalized as keyof typeof Orientation];
    }
    return value;
};

const normalizePageSize = (value: PageSize | string): PageSize => {
    if (typeof value === 'string') {
        const normalized = value.trim().toUpperCase();
        const standard = STANDARD_PAGE_SIZES[normalized];
        if (!standard) {
            throw new ValidationException(`Unknown page size: ${value}`);
        }
        return {name: normalized, width: standard.width, height: standard.height};
    }

    const width = value.width;
    const height = value.height;
    if (width === undefined || height === undefined) {
        throw new ValidationException('Custom page size must include width and height');
    }
    if (width <= 0 || height <= 0) {
        throw new ValidationException('Page size width and height must be positive numbers');
    }
    return {
        name: value.name?.toUpperCase(),
        width,
        height
    };
};

export class PageBuilder {
    private readonly _client: PDFDancer;
    private readonly _internals: PDFDancerInternals;
    private _pageNumber?: number;
    private _orientation?: Orientation;
    private _pageSize?: PageSize;

    constructor(client: PDFDancer) {
        if (!client) {
            throw new ValidationException('Client cannot be null');
        }
        this._client = client;
        this._internals = this._client as unknown as PDFDancerInternals;
    }

    /**
     * Sets the page number where the new page should be inserted (1-based).
     * Page 1 is the first page.
     *
     * @param pageNumber - The 1-based page number (must be >= 1)
     * @returns this builder for method chaining
     * @throws ValidationException if pageNumber is less than 1
     */
    atPage(pageNumber: number): this {
        if (pageNumber === null || pageNumber === undefined) {
            throw new ValidationException('Page number cannot be null');
        }
        if (!Number.isInteger(pageNumber) || pageNumber < 1) {
            throw new ValidationException('Page number must be >= 1 (1-based indexing)');
        }
        this._pageNumber = pageNumber;
        return this;
    }

    /**
     * @deprecated Use atPage() instead. This method will be removed in a future release.
     */
    atIndex(pageNumber: number): this {
        console.warn('atIndex() is deprecated, use atPage() instead');
        return this.atPage(pageNumber + 1);
    }

    orientation(orientation: Orientation | string): this {
        this._orientation = normalizeOrientation(orientation);
        return this;
    }

    portrait(): this {
        this._orientation = Orientation.PORTRAIT;
        return this;
    }

    landscape(): this {
        this._orientation = Orientation.LANDSCAPE;
        return this;
    }

    pageSize(pageSize: PageSize | string): this {
        this._pageSize = normalizePageSize(pageSize);
        return this;
    }

    a4(): this {
        return this.pageSize('A4');
    }

    letter(): this {
        return this.pageSize('LETTER');
    }

    a3(): this {
        return this.pageSize('A3');
    }

    a5(): this {
        return this.pageSize('A5');
    }

    legal(): this {
        return this.pageSize('LEGAL');
    }

    customSize(width: number, height: number): this {
        if (width <= 0 || height <= 0) {
            throw new ValidationException('Custom page size dimensions must be positive');
        }
        this._pageSize = {width, height};
        return this;
    }

    async add(): Promise<PageRef> {
        const request = this._buildRequest();
        return this._internals.addPage(request);
    }

    private _buildRequest(): AddPageRequest | null {
        if (this._pageNumber === undefined && this._orientation === undefined && this._pageSize === undefined) {
            return null;
        }
        return new AddPageRequest(this._pageNumber, this._pageSize, this._orientation);
    }
}
