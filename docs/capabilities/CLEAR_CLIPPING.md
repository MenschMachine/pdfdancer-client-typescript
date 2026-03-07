# Clear Clipping Capability

Most of the PDF model classes including container classes like PDFParagraph/PDFTextLine/PDFPathGroup now implement ClippingDetachable with the method clearClipping().
This removes any clipping path which was active for this element.

This is useful in case clients want to move an element but the new position is hidden by the clipping path. clearing it makes the element visible again.

The new backend is version 1.8.6-rc2, available in the local m2 repository

## Api Docs

Explain for all elements and under the clipping-section.

## Website and Marketing

Not to mention there.

## What's new Newsletter

include

## Changelog

include

## Implementation in pdfdancer-client-typescript

This capability was implemented by adding clear-clipping request models, client API calls, and object-level convenience methods.

- `src/models.ts`
  - Added `ClearClippingRequest` for object-level clipping removal (`objectRef` payload).
  - Added `ClearPathGroupClippingRequest` for path-group clipping removal (`pageIndex` + `groupId` payload).
- `src/pdfdancer_v1.ts`
  - Added `clearClipping(objectRef)` that validates input, sends `PUT /pdf/clipping/clear`, parses a boolean response, and invalidates the client cache.
  - Added `clearPathGroupClipping(pageIndex, groupId)` that validates `groupId`, sends `PUT /pdf/path-group/clipping/clear`, parses a boolean response, and invalidates the cache.
- `src/types.ts`
  - Extended `PDFDancerInternals` with `clearClipping(objectRef)`.
  - Added `BaseObject.clearClipping()` so text/images/other base objects can detach clipping via their reference.
  - Extended `PathGroupInternals` with `clearPathGroupClipping(...)`.
  - Added `PathGroupObject.clearClipping()` for path-group level clipping removal.

Repo-specific behavior:
- The TypeScript client maps object/path-group methods directly to the backend clipping-clear endpoints.
- Both clear-clipping flows invalidate cached state after successful requests so follow-up reads reflect unclipped geometry.
