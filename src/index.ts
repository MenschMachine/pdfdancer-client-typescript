/**
 * PDFDancer TypeScript Client
 *
 * A TypeScript client library for the PDFDancer PDF manipulation API.
 */

export { PDFDancer } from './pdfdancer_v1';
export { PageBuilder } from './page-builder';
export { PathBuilder } from './path-builder';

export {
  PdfDancerException,
  FontNotFoundException,
  ValidationException,
  HttpClientException,
  SessionException,
  SessionNotFoundException
} from './exceptions';

export {
  ObjectRef,
  FormFieldRef,
  PageRef,
  PageSize,
  PathObjectRef,
  Position,
  ObjectType,
  Font,
  Color,
  Image,
  BoundingRect,
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
  DocumentFontInfo,
  FontType,
  DocumentSnapshot,
  PageSnapshot,
  ImageTransformType,
  FlipDirection,
  Size,
  ModifyPathRequest
} from './models';

export { DocumentFontInfo as FontRecommendation } from './models';

export { VERSION } from './version';

export {
  PdfAffineTransform,
  PdfAffineTransformBuilder,
  PdfColorRequest,
  PdfColorSpace,
  TextClient,
  TextDeleteRequest,
  TextDeleteRequestBuilder,
  TextEditChangeDiagnostic,
  TextEditResponse,
  TextInsertCaret,
  TextInsertRequest,
  TextInsertRequestBuilder,
  TextLayoutMode,
  TextLayoutProfile,
  TextLayoutRequest,
  TextOperationDiagnostic,
  TextReplaceRequest,
  TextReplaceRequestBuilder,
  TextReplacementImageRequest,
  TextSelectorRequest,
  TextStyleNumericFilterRequest,
  TextStylePatchBuilder,
  TextStylePatchRequest,
  TextStyleRequest,
  TextStyleRequestBuilder,
  TextStyleSetBuilder,
  TextStyleSetRequest
} from './text-editing';
