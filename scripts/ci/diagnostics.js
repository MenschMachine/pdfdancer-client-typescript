'use strict';

// Loaded through NODE_OPTIONS only in CI test steps. Keep this file dependency-free
// so it can run before npm dependencies are installed in a diagnostic context.
const fs = require('node:fs');
const path = require('node:path');
const childProcess = require('node:child_process');

const diagnosticsDirectory = process.env.PDFDANCER_DIAGNOSTICS_DIR;

function diagnosticsPath(filename) {
    if (!diagnosticsDirectory) return null;
    try {
        fs.mkdirSync(diagnosticsDirectory, {recursive: true});
        return path.join(diagnosticsDirectory, filename);
    } catch {
        return null;
    }
}

function writeEvent(type, details = {}) {
    // One file per process avoids cross-process append contention on Windows.
    const file = diagnosticsPath(`process-events-${process.pid}.jsonl`);
    if (!file) return;

    const event = {
        timestamp: new Date().toISOString(),
        type,
        pid: process.pid,
        ppid: process.ppid,
        node: process.version,
        platform: process.platform,
        arch: process.arch,
        jestWorkerId: process.env.JEST_WORKER_ID ?? null,
        ...details
    };

    try {
        fs.appendFileSync(file, `${JSON.stringify(event)}\n`, 'utf8');
    } catch {
        // Diagnostics must never change test behavior.
    }
}

function writeProcessReport(reason) {
    const file = diagnosticsPath(`node-report-${process.pid}-${Date.now()}-${reason}.json`);
    if (!file || !process.report?.getReport) return;

    try {
        // getReport() is silent; writeReport() prints a status line to stdout.
        fs.writeFileSync(file, `${JSON.stringify(process.report.getReport(), null, 2)}\n`, 'utf8');
    } catch (error) {
        writeEvent('node-report-write-failed', {reason, error: String(error)});
    }
}

writeEvent('process-start', {argv: process.argv.slice(1)});

process.on('warning', warning => {
    writeEvent('warning', {
        name: warning.name,
        message: warning.message,
        stack: warning.stack
    });
});

process.on('uncaughtExceptionMonitor', (error, origin) => {
    writeEvent('uncaught-exception', {
        origin,
        name: error?.name,
        message: error?.message,
        stack: error?.stack
    });
    writeProcessReport('uncaught-exception');
});

process.on('unhandledRejection', reason => {
    writeEvent('unhandled-rejection', {reason: String(reason)});
});

process.on('exit', code => {
    writeEvent('process-exit', {code});
});

const originalFork = childProcess.fork;
childProcess.fork = function instrumentedFork(modulePath, args, options) {
    // Preserve child_process.fork's overloaded (modulePath, options) signature.
    const child = originalFork.apply(this, arguments);
    const childDetails = {
        childPid: child.pid,
        childPath: typeof modulePath === 'string' ? modulePath : String(modulePath),
        childArgCount: Array.isArray(args) ? args.length : 0
    };

    writeEvent('child-process-fork', childDetails);
    child.once('spawn', () => writeEvent('child-process-spawn', childDetails));
    child.once('error', error => writeEvent('child-process-error', {
        ...childDetails,
        name: error.name,
        message: error.message,
        stack: error.stack
    }));
    child.once('exit', (code, signal) => writeEvent('child-process-exit', {
        ...childDetails,
        code,
        signal
    }));
    child.once('disconnect', () => writeEvent('child-process-disconnect', childDetails));

    return child;
};
