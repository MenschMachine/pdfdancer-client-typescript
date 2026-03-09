# Clear Clipping Capability

Most of the PDF model classes including container classes like PDFParagraph/PDFTextLine/PDFPathGroup now implement ClippingDetachable with the method clearClipping().
This removes any clipping path which was active for this element.

This is useful in case clients want to move an element but the new position is hidden by the clipping path. clearing it makes the element visible again.

The new backend is version 1.8.6-rc2, available in the local m2 repository

## Test PDFs to use

examples/clipping/invisible-content-clipping-test.pdf

- A PDF where content is present but not visible due to clipping paths that exclude the content areas. Contains an image clipped away by one clipping path and vector paths clipped away by another clipping path.


## Api Docs

Explain for all elements and under the clipping-section.

## Website and Marketing

Not to mention there.

## What's new Newsletter

include

## Changelog

include

## Implementation in pdfdancer-api

- Updated backend dependency to `com.tfc.pdf:pdfdancer-backend:1.8.6-rc2` in `build.gradle.kts` to use the clipping-detach support.
- Added client-facing helpers:
  - `BaseReference.clearClipping()` for any object reference implementing clipping detach semantics via the API.
  - `PathGroupReference.clearClipping()` for grouped vector paths.
  - `PDFDancer.clearClipping(ObjectRef)` calling `PUT /pdf/clipping/clear`.
  - `PDFDancer.clearPathGroupClipping(pageIndex, groupId)` calling `PUT /pdf/path-group/clipping/clear`.
  - Both client calls invalidate local snapshot caches after mutation.
- Added server endpoints in both controllers:
  - `PDFController` and `PDFControllerV1` expose `PUT /pdf/clipping/clear` and `PUT /pdf/path-group/clipping/clear`.
  - V1 uses `ClearClippingRequestV1` and `ClearPathGroupClippingRequestV1`, converting both to internal requests via `toInternal()`.
- Added controller orchestration in `ControllerOps`:
  - `clearClipping(...)` validates `objectRef`, executes `ClearObjectClippingCommand`, and publishes `PDF_OBJECT_MODIFIED` metric with operation `clear_clipping`.
  - `clearPathGroupClipping(...)` validates `groupId` and `pageIndex`, executes `ClearPathGroupClippingCommand`, and publishes `VECTOR_MANIPULATION` metric with operation `clear_path_group_clipping`.
- Wired session and replay support:
  - `Session.clearClipping(...)` and `Session.clearPathGroupClipping(...)` execute commands inside `SessionContext` and record commands for session history.
  - `CommandDeserializer` now reconstructs `ClearObjectClippingCommand` and `ClearPathGroupClippingCommand` for debug archive replay.
- Added tests and assertions:
  - `ClippingTest` verifies clearing clipping on `PathReference`, `PathGroupReference`, and `TextLineReference`.
  - `DirectPDFAssertions`/`PDFAssertions` gained helpers to detect clipped paths and assert clipping present/removed.

## Implementation in pdfdancer-client-typescript

- Updated public docs in `README.md` so typed selector objects explicitly include `clearClipping()` alongside other object helpers.
- Extended client internals in `src/types.ts`:
  - Added `clearClipping(objectRef: ObjectRef): Promise<boolean>` to `PDFDancerInternals`.
  - Added `clearPathGroupClipping(pageNumber: number, groupId: string): Promise<boolean>` to path-group internals.
  - Added `BaseObject.clearClipping()` to clear clipping on any selected object and `BaseObject.objectRef()` as an explicit alias for `ref()`.
  - Added `PathGroupObject.groupId` getter and `PathGroupObject.clearClipping()` for path-group clipping removal.
- Implemented API wiring in `src/pdfdancer_v1.ts`:
  - Added `PDFDancer.clearClipping(objectRef)` with validation and `PUT /pdf/clipping/clear` using `{ objectRef: objectRef.toDict() }`.
  - Added `PDFDancer.clearPathGroupClipping(pageNumber, groupId)` with validation and `PUT /pdf/path-group/clipping/clear` using `{ pageNumber, groupId }`.
  - Both operations call `_invalidateCache()` after successful mutations so subsequent reads reflect unclipped content.
- Added clipping-aware e2e verification in `src/__tests__/e2e/pdf-assertions.ts`:
  - Added raw content stream parsing (including `FlateDecode` inflation), CTM math, clip-state tracking (`W`, `W*`, `n`, `q`, `Q`, `cm`), and draw-event matching for paths/images.
  - Added `assertPathHasClipping`, `assertPathHasNoClipping`, `assertImageHasClipping`, and `assertImageHasNoClipping` helpers to verify clipping removal behavior in saved PDFs.
