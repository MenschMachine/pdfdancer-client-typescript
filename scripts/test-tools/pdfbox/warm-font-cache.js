'use strict';

const path = require('node:path');
const {spawn} = require('node:child_process');

const directory = __dirname;
const javaArguments = [];
if (process.env.PDFBOX_FONT_CACHE_DIR) {
    javaArguments.push(`-Dpdfbox.fontcache=${process.env.PDFBOX_FONT_CACHE_DIR}`);
}
javaArguments.push(
    '-cp',
    path.join(directory, 'pdfbox-app-3.0.8.jar'),
    path.join(directory, 'PdfInspector.java'),
    '--warm-font-cache'
);

const child = spawn('java', javaArguments, {
    stdio: 'ignore',
    windowsHide: true
});
let timedOut = false;

const timeout = setTimeout(() => {
    timedOut = true;
    child.kill();
}, 300_000);

child.once('error', () => {
    clearTimeout(timeout);
    process.exitCode = 1;
});

child.once('close', (code, signal) => {
    clearTimeout(timeout);
    if (timedOut || code !== 0 || signal !== null) {
        process.exitCode = 1;
    }
});
