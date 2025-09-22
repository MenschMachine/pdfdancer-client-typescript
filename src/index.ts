/**
 * PDFDancer TypeScript Client
 *
 * A TypeScript client library for the PDFDancer PDF manipulation API.
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
  FormFieldRef,
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
