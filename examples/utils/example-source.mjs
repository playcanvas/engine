/* eslint-disable regexp/no-super-linear-backtracking */
const regexPatterns = [
    /^\s*export\s*\*\s*from\s*(?:\S.*|[\t\v\f \xa0\u1680\u2000-\u200a\u202f\u205f\u3000\ufeff])\s*;\s*$/gm,
    /^\s*export\s*\{.*\}\s*from\s*(?:\S.*|[\t\v\f \xa0\u1680\u2000-\u200a\u202f\u205f\u3000\ufeff])\s*;\s*$/gm,
    /^\s*import\s*(?:\S.*|[\t\v\f \xa0\u1680\u2000-\u200a\u202f\u205f\u3000\ufeff])\s*;\s*$/gm
];
const configRegex = /^[ \t]*\/\/ @config[ \t]*(?:\r?\n[ \t]*\/\/[^\r\n]*)*(?:\r?\n|$)/gm;
const ATTRIBUTION_FIELDS = ['title', 'author', 'source', 'license'];
const ATTRIBUTION_FIELD_SET = new Set(ATTRIBUTION_FIELDS);

const parseValue = (val) => {
    return val === undefined || val === 'true' ? true : val === 'false' ? false : val;
};

const splitFlag = (line) => {
    const eq = line.indexOf('=');
    return eq === -1 ? [line, undefined] : [line.slice(0, eq), line.slice(eq + 1).trim()];
};

const parseExampleConfig = (block, config) => {
    const description = [];
    let attribution = null;

    const completeAttribution = () => {
        const missing = ATTRIBUTION_FIELDS.filter(field => !attribution[field]);
        if (missing.length) {
            throw new Error(`Incomplete @attribution: missing ${missing.join(', ')}`);
        }

        config.ATTRIBUTIONS ??= [];
        config.ATTRIBUTIONS.push(attribution);
        attribution = null;
    };

    const lines = block.split(/\r?\n/).slice(1);
    for (let i = 0; i < lines.length; i++) {
        const match = /^[ \t]*\/\/ ?(.*)$/.exec(lines[i]);
        if (!match) {
            continue;
        }
        const text = match[1];
        const line = text.trim();
        if (line === '@attribution') {
            if (attribution) {
                completeAttribution();
            }
            attribution = {};
        } else if (attribution) {
            if (!line) {
                continue;
            }

            const idx = line.indexOf(':');
            if (idx === -1) {
                throw new Error(`Invalid @attribution line: ${line}`);
            }

            const name = line.slice(0, idx).trim();
            if (!ATTRIBUTION_FIELD_SET.has(name)) {
                throw new Error(`Invalid @attribution field: ${name}`);
            }
            if (attribution[name] !== undefined) {
                throw new Error(`Duplicate @attribution field: ${name}`);
            }

            attribution[name] = line.slice(idx + 1).trim();
            let complete = true;
            for (let j = 0; j < ATTRIBUTION_FIELDS.length; j++) {
                if (!attribution[ATTRIBUTION_FIELDS[j]]) {
                    complete = false;
                    break;
                }
            }
            if (complete) {
                completeAttribution();
            }
        } else if (line.startsWith('@flag ')) {
            const [name, val] = splitFlag(line.slice(6).trim());
            config[name.trim()] = parseValue(val);
        } else {
            description.push(text);
        }
    }
    if (attribution) {
        completeAttribution();
    }

    const html = description.join('\n').trim();
    if (html) {
        config.DESCRIPTION = html;
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
 * @property {{ title: string, author: string, source: string, license: string }[]} [ATTRIBUTIONS] - Scene attributions.
 * @property {boolean} [HIDDEN] - The example is hidden from the sidebar list in production builds (`npm run build`). It is still built and reachable via its URL. In development (`npm run develop`) it is still shown in the sidebar.
 * @property {'development' | 'performance' | 'debug'} [ENGINE] - The engine type.
 * @property {boolean} [NO_DEVICE_SELECTOR] - No device selector.
 * @property {boolean} [NO_MINISTATS] - No ministats.
 * @property {boolean} [WEBGPU_DISABLED] - If webgpu is disabled.
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
