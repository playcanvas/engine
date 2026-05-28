import files from './files.mjs';

const MODULE_EXTENSION = /\.mjs$/;
const TEXT_EXTENSION = /\.(?:frag|vert|wgsl|glsl|html|css|txt)$/;
const JSON_EXTENSION = /\.json$/;
const MODULE_TYPE = 'text/javascript';
const RELATIVE_SPECIFIER = /^\.{1,2}\//;
const IMPORT_EXPORT_SPECIFIER = /(\b(?:from|import)[ \t\r\n]*)(['"])([^'"\r\n]+)\2/g;

/**
 * @param {string} url - The URL specified.
 * @returns {Record<string, string>} - The object of query parameters
 */
export function getQueryParams(url) {
    const parsed = new URL(url, document.baseURI);
    const hash = parsed.hash.indexOf('?');
    return Object.fromEntries(hash === -1 ?
        parsed.searchParams :
        new URLSearchParams(parsed.hash.slice(hash + 1)));
}

/**
 * @param {string} url - The URL of the file.
 * @returns {Promise<string>} - The contents of the file.
 */
export async function fetchFile(url) {
    const res = await fetch(url);
    return res.text();
}

/**
 * @type {string[]}
 */
const blobUrls = [];
const moduleUrls = new Map();
const moduleUrlTasks = new Map();
const configRegex = /^[ \t]*\/\/ @config[ \t]*(?:\r?\n[ \t]*\/\/[^\r\n]*)*(?:\r?\n|$)/gm;
const CREDIT_FIELDS = ['title', 'author', 'source', 'license'];
const REQUIRED_CREDIT_FIELDS = ['title', 'author'];
const CREDIT_FIELD_SET = new Set(CREDIT_FIELDS);

const parseValue = (val) => {
    return val === undefined || val === 'true' ? true : val === 'false' ? false : val;
};

const splitFlag = (line) => {
    const eq = line.indexOf('=');
    return eq === -1 ? [line, undefined] : [line.slice(0, eq), line.slice(eq + 1).trim()];
};

const parseExampleConfig = (block, config) => {
    const description = [];
    let credit = null;

    const completeCredit = () => {
        const missing = REQUIRED_CREDIT_FIELDS.filter(field => !credit[field]);
        if (missing.length) {
            throw new Error(`Incomplete @credit: missing ${missing.join(', ')}`);
        }

        config.CREDITS ??= [];
        config.CREDITS.push(credit);
        credit = null;
    };

    const lines = block.split(/\r?\n/).slice(1);
    for (let i = 0; i < lines.length; i++) {
        const match = /^[ \t]*\/\/ ?(.*)$/.exec(lines[i]);
        if (!match) {
            continue;
        }
        const text = match[1];
        const line = text.trim();
        if (line === '@credit') {
            if (credit) {
                completeCredit();
            }
            credit = {};
        } else if (line.startsWith('@flag ')) {
            if (credit) {
                completeCredit();
            }
            const [name, val] = splitFlag(line.slice(6).trim());
            config[name.trim()] = parseValue(val);
        } else if (credit) {
            if (!line) {
                continue;
            }

            const idx = line.indexOf(':');
            if (idx === -1) {
                throw new Error(`Invalid @credit line: ${line}`);
            }

            const name = line.slice(0, idx).trim();
            if (!CREDIT_FIELD_SET.has(name)) {
                throw new Error(`Invalid @credit field: ${name}`);
            }
            if (credit[name] !== undefined) {
                throw new Error(`Duplicate @credit field: ${name}`);
            }

            credit[name] = line.slice(idx + 1).trim();
            let complete = true;
            for (let j = 0; j < CREDIT_FIELDS.length; j++) {
                if (!credit[CREDIT_FIELDS[j]]) {
                    complete = false;
                    break;
                }
            }
            if (complete) {
                completeCredit();
            }
        } else {
            description.push(text);
        }
    }
    if (credit) {
        completeCredit();
    }

    const paragraphs = [];
    let current = [];
    for (const line of description) {
        const trimmed = line.trim();
        if (trimmed) {
            current.push(trimmed);
        } else if (current.length) {
            paragraphs.push(current.join(' '));
            current = [];
        }
    }
    if (current.length) {
        paragraphs.push(current.join(' '));
    }
    const text = paragraphs.join('\n').trim();
    if (text) {
        config.DESCRIPTION = text;
    }
};

/**
 * @param {string} name - The module name.
 * @returns {{ path: string, query: string }} The parsed request.
 */
const parseModuleRequest = (name) => {
    const idx = name.indexOf('?');
    return idx === -1 ? {
        path: name,
        query: ''
    } : {
        path: name.slice(0, idx),
        query: name.slice(idx + 1)
    };
};

/**
 * @param {string} name - The name of the current file.
 * @param {string} specifier - The relative module specifier.
 * @returns {string} The resolved file name.
 */
const resolveModuleName = (name, specifier) => {
    const url = new URL(specifier, `https://example.local/${parseModuleRequest(name).path}`);
    return `${url.pathname.slice(1)}${url.search}`;
};

/**
 * @param {string} name - The name of the current file.
 * @param {string} specifier - The module specifier.
 * @returns {string | null} The resolved module name.
 */
const resolveImport = (name, specifier) => {
    if (RELATIVE_SPECIFIER.test(specifier)) {
        return resolveModuleName(name, specifier);
    }
    return null;
};

/**
 * @param {string} name - The name of the local file.
 * @param {string} source - The module source.
 * @returns {string} The module URL.
 */
const createBlobModule = (name, source) => {
    const blob = new Blob([source], { type: MODULE_TYPE });
    const url = URL.createObjectURL(blob);
    moduleUrls.set(name, url);
    blobUrls.push(url);
    return url;
};

/**
 * @param {string} name - The name of the local file.
 * @param {string[]} [stack] - The module stack.
 * @returns {Promise<string>} The module URL.
 */
function createModuleUrl(name, stack = []) {
    if (moduleUrls.has(name)) {
        return Promise.resolve(moduleUrls.get(name));
    }
    const { path } = parseModuleRequest(name);
    if (files[path] === undefined) {
        throw new Error(`Module not found: ${path}`);
    }
    if (MODULE_EXTENSION.test(path)) {
        const idx = stack.indexOf(path);
        if (idx !== -1) {
            throw new Error(`Circular module import: ${stack.slice(idx).concat(path).join(' -> ')}`);
        }
    }
    if (moduleUrlTasks.has(name)) {
        return moduleUrlTasks.get(name);
    }

    const task = createModuleUrlTask(name, stack).then((result) => {
        moduleUrlTasks.delete(name);
        return result;
    }, (err) => {
        moduleUrlTasks.delete(name);
        throw err;
    });
    moduleUrlTasks.set(name, task);
    return task;
}

/**
 * @param {string} name - The name of the local file.
 * @param {string[]} stack - The module stack.
 * @returns {Promise<string>} The module URL.
 */
async function createModuleUrlTask(name, stack) {
    const { path, query } = parseModuleRequest(name);

    if (query) {
        throw new Error(`Invalid module query: ${name}`);
    }

    if (TEXT_EXTENSION.test(path)) {
        const source = `export default ${JSON.stringify(files[path])};`;
        return createBlobModule(name, source);
    }

    if (JSON_EXTENSION.test(path)) {
        const json = await Promise.resolve()
        .then(() => JSON.parse(files[path]))
        .then(value => value, (err) => {
            throw new Error(`Invalid JSON module: ${path}`, { cause: err });
        });
        const source = `export default ${JSON.stringify(json)};`;
        return createBlobModule(name, source);
    }

    if (!MODULE_EXTENSION.test(path)) {
        throw new Error(`Invalid module: ${name}`);
    }

    const next = stack.concat(path);
    const imports = [];
    for (const match of files[path].matchAll(IMPORT_EXPORT_SPECIFIER)) {
        const [text, prefix, quote, specifier] = match;
        const request = resolveImport(name, specifier);
        if (!request) {
            continue;
        }
        imports.push({
            text,
            prefix,
            quote,
            specifier,
            request,
            index: match.index
        });
    }

    const urls = await Promise.all(imports.map(item => createModuleUrl(item.request, next)));
    const parts = [];
    let offset = 0;
    for (let i = 0; i < imports.length; i++) {
        const item = imports[i];
        parts.push(files[path].slice(offset, item.index));
        parts.push(`${item.prefix}${item.quote}${urls[i]}${item.quote}`);
        offset = item.index + item.text.length;
    }
    parts.push(files[path].slice(offset));

    return createBlobModule(name, parts.join(''));
}

/**
 * Imports a local file as a module.
 *
 * @param {string} name - The name of the local file.
 * @returns {Promise<any>} - The module exports.
 */
export function importModule(name) {
    return createModuleUrl(name).then(url => import(url));
}

/**
 * Clears all the blob URLs.
 */
export function clearImports() {
    blobUrls.forEach(URL.revokeObjectURL);
    blobUrls.length = 0;
    moduleUrls.clear();
    moduleUrlTasks.clear();
}

/**
 * @param {string} script - The script to parse.
 * @returns {Record<string, any>} - The parsed config.
 */
export function parseConfig(script) {
    let match;
    /** @type {Record<string, any>} */
    const config = {};
    while ((match = configRegex.exec(script)) !== null) {
        parseExampleConfig(match[0], config);
    }
    return config;
}

/**
 * @type {Window | null} - The same-origin top window, if available.
 */
const host = (() => {
    try {
        return window.top && window.top.location.origin === window.location.origin ? window.top : null;
    } catch {
        return null;
    }
})();

/**
 * @type {Window} - The example-facing window.
 */
export const win = host ?? window;

/**
 * @param {string} eventName - The name of the fired event.
 * @param {object} detail - The detail object.
 */
export function fire(eventName, detail = {}) {
    host?.dispatchEvent(new CustomEvent(eventName, { detail }));
}
