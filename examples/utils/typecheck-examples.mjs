import path from 'node:path';

import ts from 'typescript';

const CONFIG = 'tsconfig.examples.json';

// compiler file names use forward slashes on every platform
const ROOT = `${path.resolve('.').split(path.sep).join('/')}/`;
const EXAMPLES_DIR = `${path.resolve('src/examples').split(path.sep).join('/')}/`;
const SIBLING_MODULE = /^\.\/[^/]+\.mjs$/;

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
const host = ts.createCompilerHost(parsed.options);
const cache = ts.createModuleResolutionCache(host.getCurrentDirectory(), host.getCanonicalFileName, parsed.options);

// mirror the example runtime, which serves the files of an example by their suffix, so
// `./selector.mjs` imported from `editor.example.mjs` is the sibling `editor.selector.mjs`
host.resolveModuleNameLiterals = (literals, file, ref, options, source) => literals.map((literal) => {
    if (file.startsWith(EXAMPLES_DIR) && SIBLING_MODULE.test(literal.text)) {
        const sibling = path.posix.join(path.posix.dirname(file), `${path.posix.basename(file).split('.')[0]}.${literal.text.slice(2)}`);
        return {
            resolvedModule: host.fileExists(sibling) ? {
                resolvedFileName: sibling,
                extension: ts.Extension.Mjs,
                isExternalLibraryImport: false
            } : undefined
        };
    }
    return ts.resolveModuleName(literal.text, file, options, host, cache, ref, ts.getModeForUsageLocation(source, literal, options));
});

const program = ts.createProgram({
    rootNames: parsed.fileNames,
    options: parsed.options,
    host,
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
