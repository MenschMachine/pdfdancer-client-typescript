'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const childProcess = require('node:child_process');

const directory = process.env.PDFDANCER_DIAGNOSTICS_DIR || path.resolve('ci-diagnostics');
fs.mkdirSync(directory, {recursive: true});

function commandOutput(command, args) {
    try {
        return childProcess.execFileSync(command, args, {
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'pipe']
        });
    } catch (error) {
        return `command failed: ${error.message}\n${error.stderr || ''}`;
    }
}

const environment = {
    timestamp: new Date().toISOString(),
    node: process.version,
    npm: commandOutput('npm', ['--version']).trim(),
    platform: process.platform,
    arch: process.arch,
    release: os.release(),
    cpus: os.cpus().length,
    totalMemory: os.totalmem(),
    freeMemory: os.freemem(),
    pid: process.pid,
    ppid: process.ppid,
    cwd: process.cwd(),
    selectedEnvironment: Object.fromEntries(
        [
            'CI',
            'GITHUB_ACTIONS',
            'GITHUB_RUN_ID',
            'GITHUB_RUN_ATTEMPT',
            'GITHUB_JOB',
            'RUNNER_OS',
            'RUNNER_ARCH',
            'RUNNER_NAME',
            'JEST_WORKERS'
        ].filter(name => process.env[name] !== undefined)
            .map(name => [name, process.env[name]])
    )
};

fs.writeFileSync(
    path.join(directory, 'environment.json'),
    `${JSON.stringify(environment, null, 2)}\n`,
    'utf8'
);

const processList = process.platform === 'win32'
    ? commandOutput('tasklist', ['/FO', 'CSV', '/V'])
    : commandOutput('ps', ['-ef']);
fs.writeFileSync(path.join(directory, 'process-list.txt'), processList, 'utf8');

if (process.report?.getReport) {
    try {
        fs.writeFileSync(
            path.join(directory, `final-node-report-${process.pid}.json`),
            `${JSON.stringify(process.report.getReport(), null, 2)}\n`,
            'utf8'
        );
    } catch (error) {
        fs.writeFileSync(
            path.join(directory, 'final-node-report-error.txt'),
            `${error.stack || error}\n`,
            'utf8'
        );
    }
}
