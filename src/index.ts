/**
 * PDFDancer TypeScript Client
 *
 * A TypeScript client library for the PDFDancer PDF manipulation API.
 */

export { PDFDancer, PageClient } from './pdfdancer_v1';
export type { RetryConfig } from './pdfdancer_v1';
export { PageBuilder } from './page-builder';
export { PathBuilder, LineBuilder, BezierBuilder, RectangleBuilder } from './path-builder';

export {
  PdfDancerException,
  FontNotFoundException,
  ValidationException,
  HttpClientException,
  RateLimitException,
  SessionException,
  SessionNotFoundException
} from './exceptions';

export {
  BaseObject,
  PathObject,
  PathGroupObject,
  ImageObject,
  FormXObject,
  FormFieldObject,
  PathEditSession
} from './types';

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
  pageSizeFromDimensions,
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
  TextStyleRunFilterRequest,
  TextStyleSelectorRequest,
  TextStylePatchBuilder,
  TextStylePatchRequest,
  TextStyleRequest,
  TextStyleRequestBuilder,
  TextStyleSetBuilder,
  TextStyleSetRequest
} from './text-editing';
