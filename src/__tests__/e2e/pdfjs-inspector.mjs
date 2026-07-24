import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parentPort, workerData} from 'node:worker_threads';
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';

function collapseArtificialCharacterSpacing(text) {
    return text.replace(
        /(?:\b[\p{L}\p{N}]\s+){2,}[\p{L}\p{N}]\b/gu,
        match => match.replace(/\s+/g, '')
    );
}

async function inspectPdf(pdfPath) {
    const pdfJsDirectory = path.dirname(fileURLToPath(import.meta.resolve('pdfjs-dist/package.json')));
    const document = await getDocument({
        data: new Uint8Array(fs.readFileSync(pdfPath)),
        isEvalSupported: false,
        standardFontDataUrl: `${path.join(pdfJsDirectory, 'standard_fonts')}${path.sep}`,
        verbosity: 0
    }).promise;

    const pages = [];
    const fonts = new Set();
    try {
        for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
            const page = await document.getPage(pageNumber);
            await page.getOperatorList();
            const content = await page.getTextContent();
            const text = [];
            for (let index = 0; index < content.items.length; index++) {
                const item = content.items[index];
                if (!('str' in item)) continue;
                const next = content.items[index + 1];
                const continuesAtSameOrigin = item.str.length > 0 && item.width === 0 && next && 'str' in next &&
                    item.transform[4] === next.transform[4] && item.transform[5] === next.transform[5];
                text.push(
                    collapseArtificialCharacterSpacing(item.str),
                    item.hasEOL && !continuesAtSameOrigin ? '\n' : ''
                );
                const font = page.commonObjs.get(item.fontName);
                if (font?.name) fonts.add(font.name);
            }
            pages.push(text.join(''));
        }
    } finally {
        await document.destroy();
    }

    return {pages, fonts: [...fonts]};
}

inspectPdf(workerData.pdfPath)
    .then(result => parentPort.postMessage({result}))
    .catch(error => parentPort.postMessage({
        error: error instanceof Error ? `${error.name}: ${error.message}` : String(error)
    }));
