# Bug Report: Path Color Modification Fails on Newly Created Paths

## Summary

Modifying stroke/fill colors on **newly created paths** does not persist after save and reload, while the same operation on **existing paths** works correctly.

## Severity

**Medium** - Feature works for existing paths but fails for newly created paths.

## Test Evidence

The TypeScript SDK e2e test `src/__tests__/e2e/path-color.test.ts` exposes this bug:

```
Path Color E2E Tests
  ✓ read path colors from existing paths
  ✓ modify path stroke color (on existing path)
  ✓ modify path fill color (on existing path)
  ✓ modify both stroke and fill color (on existing path)
  ✓ path edit without changes returns success
  ✕ modify path color on newly created path  ← FAILS
  ✓ path colors persist after save and reload (on existing path)
```

## Reproduction Steps

1. Open an empty PDF or any PDF
2. Create a new path using `pdf.newPath().moveTo(x1,y1).lineTo(x2,y2).strokeColor(c1).at(page, x, y).add()`
3. Select the newly created path
4. Modify its color using `path.edit().strokeColor(c2).apply()`
5. Save and reload the PDF
6. Query paths at the same location - the stroke color is `null` instead of `c2`

## Expected Behavior

Modifying colors on newly created paths should persist after save and reload, just like existing paths.

## Test Code

```typescript
test('modify path color on newly created path', async () => {
    const [baseUrl, token, pdfData] = await requireEnvAndFixture('Empty.pdf');
    const pdf = await PDFDancer.open(pdfData, token, baseUrl);

    // Create a new path with initial color
    const blackColor = new Color(0, 0, 0);
    await pdf.newPath()
        .moveTo(100, 100)
        .lineTo(200, 200)
        .strokeColor(blackColor)
        .strokeWidth(2)
        .at(1, 100, 100)
        .add();

    // Find the newly created path
    const paths = await pdf.selectPaths();
    expect(paths.length).toBeGreaterThan(0);
    const newPath = paths[paths.length - 1];

    // Modify its color
    const redColor = new Color(255, 0, 0);
    const result = await newPath.edit()
        .strokeColor(redColor)
        .apply();

    expect(result).toBeDefined();
    expect(result.success).toBe(true);  // Server returns success=true

    // Verify persistence by save and reload
    const assertions = await PDFAssertions.create(pdf);
    const reloadedPdf = assertions.getPdf();
    const reloadedPaths = await reloadedPdf.page(1).selectPathsAt(100, 100, 10);
    expect(reloadedPaths.length).toBeGreaterThan(0);

    // BUG: strokeColor is null instead of red
    const modifiedPath = reloadedPaths[reloadedPaths.length - 1];
    expect(modifiedPath.strokeColor).toEqual(redColor);  // FAILS: received null
});
```

## Server-Side Analysis

The issue appears to be in the backend's handling of path color modifications when the path was created in the same session. The `modifyPath` command succeeds (returns `CommandResult.success = true`) but the color is not actually persisted.

Likely location: `ModifyPathCommand.java` or the path color application logic in the backend.

## Related API Endpoints

- `PUT /pdf/modify/path` - modifies path colors
- `POST /pdf/find` - returns path objects with color data

## Impact

Users cannot reliably modify colors on paths they create programmatically. They must use pre-existing paths to test color modification functionality.