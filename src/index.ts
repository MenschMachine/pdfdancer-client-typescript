/**
 * PDFDancer TypeScript Client
 *
 * A TypeScript client library for the PDFDancer PDF manipulation API.
 */

export { PDFDancer } from './pdfdancer_v1';
export { ParagraphBuilder } from './paragraph-builder';
export { PageBuilder } from './page-builder';

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
  PageRef,
  PageSize,
  TextObjectRef,
  Position,
  ObjectType,
  Font,
  Color,
  Image,
  BoundingRect,
  Paragraph,
  TextLine,
  PositionMode,
  ShapeType,
  Point,
  StandardFonts,
  STANDARD_PAGE_SIZES,
  Orientation,
  CommandResult,
  TextStatus,
  DocumentFontInfo,
  FontType,
  DocumentSnapshot,
  PageSnapshot
} from './models';

export { DocumentFontInfo as FontRecommendation } from './models';

export const VERSION = "1.0.0";
