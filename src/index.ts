/**
 * PDFDancer TypeScript Client
 *
 * A TypeScript client library for the PDFDancer PDF manipulation API.
 */

export { PDFDancer } from './pdfdancer_v1';
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
  PositionMode,
  ShapeType,
  Point,
  StandardFonts,
  Orientation,
  CommandResult,
  TextStatus,
  FontRecommendation,
  FontType
} from './models';

export const VERSION = "1.0.0";
