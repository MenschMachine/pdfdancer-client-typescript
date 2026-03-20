# Bug Report: `pr-64` API image ignores requested paragraph font and writes `DancingScript-Regular`

## Summary

When running the authoritative upstream API docker image for PR `#64`:

- Image: `ghcr.io/menschmachine/pdfdancer-api:pr-64`
- Local URL used for verification: `http://localhost:18080`
- Token: `42`

paragraph creation requests that specify embedded fonts such as `Roboto-Regular` or `Asimovian-Regular` do not preserve the requested font. After saving and reopening, the created text lines report `fontName: "DancingScript-Regular"` instead.

This breaks the downstream TypeScript client E2E suite in paragraph/font scenarios and appears to be a server-side regression, not a client serialization issue.

## Why this is a server bug

The TypeScript client sends the requested font name through the existing paragraph creation flow. The same client code works for standard fonts and for non-font path-color changes added in PR `#64`. The wrong font name is already present in the object refs returned by the API after reopening the saved PDF, which points to server-side paragraph/font handling.

## Reproduction

### Environment

```bash
docker pull ghcr.io/menschmachine/pdfdancer-api:pr-64
docker run \
  -e PDFDANCER_API_KEY_ENCRYPTION_SECRET="$(openssl rand -hex 16)" \
  -e FONTS_DIR=/tmp/fonts \
  -e METRICS_ENABLED=false \
  -e SWAGGER_ENABLED=true \
  -v /tmp/fonts:/home/app/fonts \
  --rm \
  -p 18080:8080 \
  ghcr.io/menschmachine/pdfdancer-api:pr-64
```

### Client-side repro script

Run from `pdfdancer-client-typescript` after `npm run build`:

```bash
node - <<'NODE'
const fs = require('fs');
const path = require('path');
const { PDFDancer } = require('./dist');

(async () => {
  const baseUrl = 'http://localhost:18080';
  const token = '42';
  const pdfData = fs.readFileSync(path.join(process.cwd(), 'fixtures', 'Empty.pdf'));

  const pdf = await PDFDancer.open(new Uint8Array(pdfData), token, baseUrl);
  await pdf.page(1).newParagraph()
    .text('Awesome')
    .font('Roboto-Regular', 14)
    .at(50, 100)
    .apply();

  const lines = await pdf.page(1).selectTextLinesMatching('Awesome');
  for (const line of lines) {
    const ref = line.objectRef();
    console.log(JSON.stringify({
      text: ref.text,
      fontName: ref.fontName,
      fontSize: ref.fontSize,
      color: ref.color,
      pos: { x: ref.position.getX(), y: ref.position.getY() }
    }, null, 2));
  }
})();
NODE
```

### Actual output

```json
{
  "text": "Awesome",
  "fontName": "DancingScript-Regular",
  "fontSize": 14,
  "color": { "r": 0, "g": 0, "b": 0, "a": 255 },
  "pos": { "x": 50, "y": 96.08 }
}
```

### Expected output

The returned line should preserve the requested font, for example:

```json
{
  "text": "Awesome",
  "fontName": "Roboto-Regular",
  "fontSize": 14
}
```

## Second repro

Using `findFonts('Asimovian', 14)` also reproduces the issue.

### Script

```bash
node - <<'NODE'
const fs = require('fs');
const path = require('path');
const { PDFDancer } = require('./dist');

(async () => {
  const baseUrl = 'http://localhost:18080';
  const token = '42';
  const pdfData = fs.readFileSync(path.join(process.cwd(), 'fixtures', 'Showcase.pdf'));

  const pdf = await PDFDancer.open(new Uint8Array(pdfData), token, baseUrl);
  const fonts = await pdf.findFonts('Asimovian', 14);
  console.log(JSON.stringify(fonts, null, 2));

  const asimov = fonts[0];
  await pdf.newParagraph()
    .text('Awesomely\nObvious!')
    .font(asimov.name, asimov.size)
    .lineSpacing(0.7)
    .at(1, 300.1, 500)
    .add();

  const lines = await pdf.page(1).selectTextLinesMatching('Awesomely');
  for (const line of lines) {
    const ref = line.objectRef();
    console.log(JSON.stringify({
      text: ref.text,
      fontName: ref.fontName,
      fontSize: ref.fontSize
    }, null, 2));
  }
})();
NODE
```

### Actual output

`findFonts` returns:

```json
[
  {
    "name": "Asimovian-Regular",
    "size": 14
  }
]
```

But the created text line still comes back as:

```json
{
  "text": "Awesomely",
  "fontName": "DancingScript-Regular",
  "fontSize": 14
}
```

## Downstream failures caused by this

These existing TypeScript E2E tests fail against the `pr-64` API image because they correctly assert the requested font:

- `src/__tests__/e2e/paragraph-showcase.test.ts`
  - `add paragraph with custom font via name`
  - `add paragraph with custom font via page builder`
  - `add paragraph using findFonts result`
  - `add paragraph with custom font Asimovian`
  - `add paragraph with font file`
- `src/__tests__/e2e/paragraph.test.ts`
  - `add paragraph to new page`

## What still works

- The new path-color functionality from API PR `#64` works correctly against the same docker image.
- Text-only paragraph replacement appears to work against the local `pr-64` image.
- The regression appears specific to font selection/preservation for newly added paragraphs.

## Suspected area

The API may be resolving newly added paragraph fonts to the wrong embedded font entry or leaking a previously registered font choice into subsequent paragraph creation. The repeated fallback to `DancingScript-Regular` suggests a server-side font registration or font selection bug rather than random corruption.

## Requested action

Please investigate paragraph creation/font resolution in `pdfdancer-api` PR `#64` image and provide a fixed image or follow-up API change. The downstream TypeScript client should not relax these assertions because the requested font is part of the intended document contract.
