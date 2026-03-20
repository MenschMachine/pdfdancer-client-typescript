# Bug Report: `pr-64` API image leaks registered font state across sessions and applies the wrong paragraph font

## Summary

When running the authoritative upstream API docker image for PR `#64`:

- Image: `ghcr.io/menschmachine/pdfdancer-api:pr-64`
- Local URLs used for verification: `http://localhost:8081` and `http://localhost:18080`
- Token: `42`

after one session registers `Asimovian-Regular`, later paragraph creation in separate sessions can reopen with `fontName: "Asimovian-Regular"` even when the request asked for a different font such as `Roboto-Regular` or a `.fontFile(...)` TTF upload.

The failure is order-dependent and appears to come from server-global font state leaking across sessions. This breaks the downstream TypeScript client E2E suite in paragraph/font scenarios and appears to be a server-side regression, not a client serialization issue.

## Why this is a server bug

The TypeScript client sends the requested font name or font file through the existing paragraph creation flow. The new path-color contract from API PR `#64` works correctly against the same image. The wrong font name is already present in the object refs returned by the API after saving and reopening, which points to server-side paragraph/font handling rather than client request serialization.

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
const { PDFDancer, Color } = require('./dist');

(async () => {
  const baseUrl = 'http://localhost:8081';
  const token = '42';

  // Session 1: register Asimovian once
  const init = await PDFDancer.new({ initialPageCount: 1 }, token, baseUrl);
  await init.registerFont(new Uint8Array(
    fs.readFileSync(path.join(process.cwd(), 'fixtures', 'Asimovian-Regular.ttf'))
  ));
  console.log('registered Asimovian-Regular');

  // Session 2: explicitly request Roboto-Regular on a different PDF
  const emptyPdf = await PDFDancer.open(
    new Uint8Array(fs.readFileSync(path.join(process.cwd(), 'fixtures', 'Empty.pdf'))),
    token,
    baseUrl
  );
  await emptyPdf.page(1).newParagraph()
    .text('Awesome')
    .font('Roboto-Regular', 14)
    .at(50, 100)
    .apply();
  await emptyPdf.save('/tmp/repro-roboto.pdf');

  const reopenedRoboto = await PDFDancer.open(
    new Uint8Array(fs.readFileSync('/tmp/repro-roboto.pdf')),
    token,
    baseUrl
  );
  const robotoLines = await reopenedRoboto.page(1).selectTextLinesStartingWith('Awesome');
  console.log('Roboto request reopened as:', robotoLines[0].objectRef().fontName);

  // Session 3: request a completely different TTF via fontFile(...)
  const showcasePdf = await PDFDancer.open(
    new Uint8Array(fs.readFileSync(path.join(process.cwd(), 'fixtures', 'Showcase.pdf'))),
    token,
    baseUrl
  );
  await showcasePdf.newParagraph()
    .text('Awesomely\nObvious!')
    .fontFile(path.join(process.cwd(), 'fixtures', 'DancingScript-Regular.ttf'), 24)
    .lineSpacing(1.8)
    .color(new Color(0, 1, 255))
    .at(1, 300.1, 500)
    .add();
  await showcasePdf.save('/tmp/repro-dancing.pdf');

  const reopenedDancing = await PDFDancer.open(
    new Uint8Array(fs.readFileSync('/tmp/repro-dancing.pdf')),
    token,
    baseUrl
  );
  const dancingLines = await reopenedDancing.page(1).selectTextLinesStartingWith('Awesomely');
  console.log('fontFile request reopened as:', dancingLines[0].objectRef().fontName);
})();
NODE
```

### Actual output

```text
registered Asimovian-Regular
Roboto request reopened as: Asimovian-Regular
fontFile request reopened as: Asimovian-Regular
```

### Expected output

```text
registered Asimovian-Regular
Roboto request reopened as: Roboto-Regular
fontFile request reopened as: DancingScript-Regular
```

## Control case

If the same server has only `Asimovian-Regular` registered and the next session explicitly requests `Asimovian-Regular`, the reopened line is correct:

```bash
node - <<'NODE'
const fs = require('fs');
const path = require('path');
const { PDFDancer } = require('./dist');

(async () => {
  const baseUrl = 'http://localhost:8081';
  const token = '42';
  const pdf = await PDFDancer.open(
    new Uint8Array(fs.readFileSync(path.join(process.cwd(), 'fixtures', 'Showcase.pdf'))),
    token,
    baseUrl
  );

  const fonts = await pdf.findFonts('Asimovian', 14);
  const asimov = fonts[0];
  await pdf.newParagraph()
    .text('Awesomely\nObvious!')
    .font(asimov.name, asimov.size)
    .lineSpacing(0.7)
    .at(1, 300.1, 500)
    .add();
  await pdf.save('/tmp/repro-asimov.pdf');

  const reopened = await PDFDancer.open(
    new Uint8Array(fs.readFileSync('/tmp/repro-asimov.pdf')),
    token,
    baseUrl
  );
  const lines = await reopened.page(1).selectTextLinesStartingWith('Awesomely');
  console.log('Asimov request reopened as:', lines[0].objectRef().fontName);
})();
NODE
```

### Actual output

```text
Asimov request reopened as: Asimovian-Regular
```

## Downstream failures caused by this

These existing TypeScript E2E tests fail against the `pr-64` API image because they correctly assert the requested font:

- `src/__tests__/e2e/paragraph-showcase.test.ts`
  - `add paragraph with custom font Asimovian`
  - `add paragraph with font file`
- `src/__tests__/e2e/paragraph.test.ts`
  - `add paragraph to new page`

## What still works

- The new path-color functionality from API PR `#64` works correctly against the same docker image.
- Text-only paragraph replacement appears to work against the local `pr-64` image.
- The regression appears specific to font selection/preservation for newly added paragraphs after embedded fonts have been registered on the server.

## Suspected area

The API appears to keep a process-global embedded-font selection or registration cache and reuse the last registered font when later sessions add paragraphs. The behavior is deterministic in this environment:

- registering `Asimovian-Regular` once is enough to affect later sessions
- later requests for `Roboto-Regular` reopen as `Asimovian-Regular`
- later `.fontFile('DancingScript-Regular.ttf', 24)` requests also reopen as `Asimovian-Regular`

That points to a server-side font registration or font resolution leak rather than random corruption.

## Requested action

Please investigate paragraph creation and embedded-font resolution in the `pdfdancer-api` PR `#64` image, especially any cache or singleton state shared across sessions. The downstream TypeScript client should not relax these assertions because the requested font is part of the intended document contract.
