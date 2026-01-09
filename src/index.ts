/**
 * PDFDancer TypeScript Client
 *
 * A TypeScript client library for the PDFDancer PDF manipulation API.
 */

export { PDFDancer } from './pdfdancer_v1';
export { ParagraphBuilder } from './paragraph-builder';
export { ReplacementBuilder } from './replacement-builder';
export { PageBuilder } from './page-builder';
export { PathBuilder } from './path-builder';

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
  Path,
  PathSegment,
  Line,
  Bezier,
  PathPoint,
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
  PageSnapshot,
  RedactTarget,
  RedactOptions,
  RedactResponse,
  ImageTransformType,
  FlipDirection,
  Size,
  Word,
  ReflowPreset,
  TemplateReplacement,
  TemplateReplaceRequest
} from './models';

export { DocumentFontInfo as FontRecommendation } from './models';

export { VERSION } from './version';
