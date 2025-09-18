/**
 * PDFDancer TypeScript Client
 *
 * A TypeScript client library for the PDFDancer PDF manipulation API.
 * Provides a clean, TypeScript interface for PDF operations that closely
 * mirrors the Python client structure and functionality.
 */

export { ClientV1 } from './client-v1';
export { ParagraphBuilder } from './paragraph-builder';

export {
  PdfDancerException,
  FontNotFoundException,
  ValidationException,
  HttpClientException,
  SessionException
} from './exceptions';

export {
  ObjectRef,
  Position,
  ObjectType,
  Font,
  Color,
  Image,
  BoundingRect,
  Paragraph,
  PositionMode,
  ShapeType,
  Point
} from './models';

export const VERSION = "1.0.0";