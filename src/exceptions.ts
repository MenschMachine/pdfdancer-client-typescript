/**
 * Exception classes for the PDFDancer TypeScript client.
 * Mirrors the Python client exception hierarchy.
 */

/**
 * Base exception for all PDFDancer client errors.
 * Equivalent to PdfDancerException in the Python client.
 */
export class PdfDancerException extends Error {
  public readonly cause?: Error;

  constructor(message: string, cause?: Error) {
    super(message);
    this.name = 'PdfDancerException';
    this.cause = cause;
  }
}

/**
 * Exception raised when a required font is not found or available.
 * Equivalent to FontNotFoundException in the Python client.
 */
export class FontNotFoundException extends PdfDancerException {
  constructor(message: string) {
    super(`Font not found: ${message}`);
    this.name = 'FontNotFoundException';
  }
}

/**
 * Exception raised for HTTP client errors during API communication.
 * Wraps fetch exceptions and HTTP errors from the API.
 */
export class HttpClientException extends PdfDancerException {
  public readonly response?: Response;
  public readonly statusCode?: number;

  constructor(message: string, response?: Response, cause?: Error) {
    super(message, cause);
    this.name = 'HttpClientException';
    this.response = response;
    this.statusCode = response?.status;
  }
}

/**
 * Exception raised for session-related errors.
 * Occurs when session creation fails or session is invalid.
 */
export class SessionException extends PdfDancerException {
  constructor(message: string, cause?: Error) {
    super(message, cause);
    this.name = 'SessionException';
  }
}

/**
 * Exception raised for input validation errors.
 * Equivalent to ValidationException in the Python client.
 */
export class ValidationException extends PdfDancerException {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationException';
  }
}