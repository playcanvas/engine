import path from 'node:path';

import ts from 'typescript';

const CONFIG = 'tsconfig.examples.json';

// compiler file names use forward slashes on every platform
const ROOT = `${path.resolve('.').split(path.sep).join('/')}/`;

/**
 * @type {ts.FormatDiagnosticsHost}
 */
const formatHost = {
    getCanonicalFileName: file => file,
    getCurrentDirectory: ts.sys.getCurrentDirectory,
    getNewLine: () => ts.sys.newLine
};

const { config, error } = ts.readConfigFile(CONFIG, ts.sys.readFile);
const parsed = ts.parseJsonConfigFileContent(config, ts.sys, path.dirname(ts.sys.resolvePath(CONFIG)));

const program = ts.createProgram({
    rootNames: parsed.fileNames,
    options: parsed.options,
    projectReferences: parsed.projectReferences
});
const diagnostics = [
    ...(error ? [error] : []),
    ...parsed.errors,
    // the engine scripts the examples import are type checked by the engine project
    ...ts.getPreEmitDiagnostics(program).filter(({ file }) => !file || file.fileName.startsWith(ROOT))
];

if (diagnostics.length) {
    process.stdout.write(ts.formatDiagnostics(diagnostics, formatHost));
    process.exitCode = 1;
}
