/* eslint-disable regexp/no-super-linear-backtracking */
const regexPatterns = [
    /^\s*export\s*\*\s*from\s*(?:\S.*|[\t\v\f \xa0\u1680\u2000-\u200a\u202f\u205f\u3000\ufeff])\s*;\s*$/gm,
    /^\s*export\s*\{.*\}\s*from\s*(?:\S.*|[\t\v\f \xa0\u1680\u2000-\u200a\u202f\u205f\u3000\ufeff])\s*;\s*$/gm,
    /^\s*import\s*(?:\S.*|[\t\v\f \xa0\u1680\u2000-\u200a\u202f\u205f\u3000\ufeff])\s*;\s*$/gm
];
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
 * Checks if the provided content matches any of a set of patterns indicative of an ES Module with external dependencies.
 * Patterns checked include certain export and import statement formats.
 *
 * @param {string} content - The file content to test.
 * @returns {boolean} Whether the content is likely an ES Module with external dependencies.
 * @example
 * isModuleWithExternalDependencies(`
 *     // Testing variants:
 *     export * from './index.mjs';
 *     export { Ray } from './core/shape/ray.js';
 *     import './polyfill/OESVertexArrayObject.js';
 * `);
 */
export const isModuleWithExternalDependencies = (content) => {
    return regexPatterns.some(pattern => pattern.test(content));
};

/**
 * Removes example config comments from source.
 *
 * @param {string} source - The source to transform.
 * @returns {string} The source without config comments.
 */
export const stripConfig = (source) => {
    return source.replace(configRegex, '');
};

/**
 * @typedef {object} ExampleConfig
 * @property {string} [DESCRIPTION] - The example description.
 * @property {{ title: string, author: string, source?: string, license?: string }[]} [CREDITS] - Scene credits.
 * @property {boolean} [HIDDEN] - The example is hidden from the sidebar list in production builds (`npm run build`). It is still built and reachable via its URL. In development (`npm run develop`) it is still shown in the sidebar.
 * @property {'development' | 'performance' | 'debug'} [ENGINE] - The engine type.
 * @property {boolean} [NO_DEVICE_SELECTOR] - No device selector.
 * @property {boolean} [NO_MINISTATS] - No ministats.
 * @property {boolean} [WEBGPU_DISABLED] - If webgpu is disabled.
 * @property {boolean} [WEBGPU_BARE_DISABLED] - If webgpu bare is disabled.
 * @property {boolean} [WEBGL_DISABLED] - If webgl is disabled.
 */

/**
 * Parser for the example config.
 *
 * @param {string} script - The script to parse.
 * @returns {ExampleConfig} - The parsed config.
 */
export const parseConfig = (script) => {
    let match;
    /** @type {Record<string, any>} */
    const config = {};
    while ((match = configRegex.exec(script)) !== null) {
        parseExampleConfig(match[0], config);
    }
    return config;
};
