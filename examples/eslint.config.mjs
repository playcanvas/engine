import playcanvasConfig from '@playcanvas/eslint-config';
import globals from 'globals';

import { COLOR_NAMES, INLINE_MD_PATTERN, SAFE_URL_PATTERN } from './utils/inline-markdown.mjs';

const configLine = /^[ \t]*\/\/ @config[ \t]*$/;
const commentLine = /^[ \t]*\/\/[^\r\n]*$/;
const commentText = /^[ \t]*\/\/ ?(.*)$/;
const emptyLine = /^[ \t]*$/;
// only flag delimiters that almost never appear in prose — `**` and backticks.
// brackets/parens/braces appear too often in legitimate text to lint reliably.
const STRAY_DELIM_PATTERN = /\*\*|`/;
const booleanFlags = new Set([
    'HIDDEN',
    'NO_DEVICE_SELECTOR',
    'NO_MINISTATS',
    'WEBGPU_DISABLED',
    'WEBGPU_BARE_DISABLED',
    'WEBGL_DISABLED'
]);
const engineTypes = new Set(['development', 'performance', 'debug']);
const creditFields = ['title', 'author', 'source', 'license'];
const requiredCreditFields = ['title', 'author'];
const creditFieldSet = new Set(creditFields);

const splitFlag = (line) => {
    const eq = line.indexOf('=');
    return eq === -1 ? [line, undefined] : [line.slice(0, eq), line.slice(eq + 1).trim()];
};

const configBlockAtTop = {
    meta: {
        type: 'problem',
        docs: {
            description: 'require example config blocks to start at the top of the file'
        },
        messages: {
            duplicate: 'Only one example config block is allowed per file.',
            missingBlankLine: 'Example config blocks must be followed by an empty line.',
            misplaced: 'Example config blocks must start at the top of the file.'
        }
    },

    create(context) {
        return {
            Program(node) {
                const lines = context.sourceCode.lines;
                const blocks = [];

                for (let i = 0; i < lines.length; i++) {
                    if (configLine.test(lines[i])) {
                        blocks.push(i);
                    }
                }

                if (!blocks.length) {
                    return;
                }

                const report = (line, messageId) => {
                    context.report({
                        node,
                        loc: {
                            line: line + 1,
                            column: 0
                        },
                        messageId
                    });
                };

                if (blocks[0] !== 0) {
                    report(blocks[0], 'misplaced');
                }

                for (let i = 1; i < blocks.length; i++) {
                    report(blocks[i], 'duplicate');
                }

                let end = blocks[0] + 1;
                while (end < lines.length && commentLine.test(lines[end])) {
                    end++;
                }

                if (end >= lines.length || !emptyLine.test(lines[end])) {
                    report(Math.min(end, lines.length - 1), 'missingBlankLine');
                }
            }
        };
    }
};

const configBlockShape = {
    meta: {
        type: 'problem',
        docs: {
            description: 'validate example config block contents'
        },
        messages: {
            duplicateCreditField: 'Duplicate @credit field "{{name}}".',
            duplicateFlag: 'Duplicate @flag "{{name}}".',
            emptyCreditField: '@credit field "{{name}}" must not be empty.',
            invalidCreditLine: 'Invalid @credit line: expected "name: value".',
            invalidFlagValue: 'Invalid value "{{value}}" for @flag "{{name}}".',
            malformedFlag: 'Malformed @flag line.',
            missingCreditFields: 'Incomplete @credit: missing {{fields}}.',
            missingFlagValue: '@flag "{{name}}" requires a value.',
            unclosedMarkdown: 'Unclosed markdown delimiter in description (`**` or backtick).',
            unknownColor: 'Unknown color "{{name}}" in description. Use one of: accent, warn, success, info, muted.',
            unknownCreditField: 'Invalid @credit field "{{name}}".',
            unknownFlag: 'Unknown @flag "{{name}}".',
            unsafeLink: 'Unsafe link URL "{{url}}" in description. Only http(s): and mailto: are allowed.'
        }
    },

    create(context) {
        return {
            Program(node) {
                const lines = context.sourceCode.lines;
                const flags = new Set();

                const report = (line, messageId, data) => {
                    context.report({
                        node,
                        loc: {
                            line: line + 1,
                            column: 0
                        },
                        messageId,
                        data
                    });
                };

                const reportMissing = (credit, line) => {
                    if (!credit) {
                        return null;
                    }

                    const missing = requiredCreditFields.filter(field => !credit.fields[field]);
                    if (missing.length) {
                        report(line, 'missingCreditFields', { fields: missing.join(', ') });
                    }
                    return null;
                };

                const validateFlag = (line, text) => {
                    const body = text.slice(6).trim();
                    if (!body) {
                        report(line, 'malformedFlag');
                        return;
                    }

                    const [raw, value] = splitFlag(body);
                    const name = raw.trim();
                    if (!name || /\s/.test(name)) {
                        report(line, 'malformedFlag');
                        return;
                    }

                    if (name === 'ENGINE') {
                        if (flags.has(name)) {
                            report(line, 'duplicateFlag', { name });
                        } else {
                            flags.add(name);
                        }

                        if (!value) {
                            report(line, 'missingFlagValue', { name });
                        } else if (!engineTypes.has(value)) {
                            report(line, 'invalidFlagValue', { name, value });
                        }
                        return;
                    }

                    if (!booleanFlags.has(name)) {
                        report(line, 'unknownFlag', { name });
                        return;
                    }

                    if (flags.has(name)) {
                        report(line, 'duplicateFlag', { name });
                    } else {
                        flags.add(name);
                    }

                    if (value !== undefined && value !== 'true' && value !== 'false') {
                        report(line, 'invalidFlagValue', { name, value });
                    }
                };

                const validateCredit = (line, credit, text) => {
                    if (!text) {
                        return credit;
                    }

                    const idx = text.indexOf(':');
                    if (idx === -1) {
                        report(line, 'invalidCreditLine');
                        return credit;
                    }

                    const name = text.slice(0, idx).trim();
                    const value = text.slice(idx + 1).trim();
                    if (!creditFieldSet.has(name)) {
                        report(line, 'unknownCreditField', { name });
                        return credit;
                    }
                    if (credit.fields[name] !== undefined) {
                        report(line, 'duplicateCreditField', { name });
                        return credit;
                    }
                    if (!value) {
                        report(line, 'emptyCreditField', { name });
                    }

                    credit.fields[name] = value;
                    return creditFields.every(field => credit.fields[field]) ? null : credit;
                };

                const validateDescription = (line, text) => {
                    if (!text) {
                        return;
                    }
                    INLINE_MD_PATTERN.lastIndex = 0;
                    let residue = '';
                    let lastIndex = 0;
                    let match;
                    while ((match = INLINE_MD_PATTERN.exec(text)) !== null) {
                        residue += text.slice(lastIndex, match.index);
                        if (match[4] !== undefined && !SAFE_URL_PATTERN.test(match[5])) {
                            report(line, 'unsafeLink', { url: match[5] });
                        }
                        if (match[6] !== undefined && !COLOR_NAMES.has(match[6])) {
                            report(line, 'unknownColor', { name: match[6] });
                        }
                        lastIndex = INLINE_MD_PATTERN.lastIndex;
                    }
                    residue += text.slice(lastIndex);
                    if (STRAY_DELIM_PATTERN.test(residue)) {
                        report(line, 'unclosedMarkdown');
                    }
                };

                for (let i = 0; i < lines.length; i++) {
                    if (!configLine.test(lines[i])) {
                        continue;
                    }

                    let credit = null;
                    let end = i;
                    for (let j = i + 1; j < lines.length && commentLine.test(lines[j]); j++) {
                        end = j;
                        const text = commentText.exec(lines[j])[1].trim();
                        if (text === '@credit') {
                            credit = reportMissing(credit, j);
                            credit = { fields: {} };
                        } else if (text === '@flag' || text.startsWith('@flag ')) {
                            credit = reportMissing(credit, j);
                            validateFlag(j, text);
                        } else if (credit) {
                            credit = validateCredit(j, credit, text);
                        } else {
                            validateDescription(j, text);
                        }
                    }
                    reportMissing(credit, end);
                }
            }
        };
    }
};

const importOrder = ['error', {
    groups: ['builtin', 'external', 'internal', ['parent', 'sibling'], 'index', 'unknown'],
    pathGroups: [
        {
            pattern: 'playcanvas{,/scripts/**/!(*[?]url)}',
            group: 'external',
            position: 'after'
        },
        {
            pattern: 'examples/**/!(*[?]url)',
            group: 'external',
            position: 'after'
        },
        {
            pattern: '{examples/assets,playcanvas/scripts}/**/*[?]url',
            group: 'external',
            position: 'after'
        },
        {
            pattern: '{./,../}**/*.{frag,vert,wgsl,glsl,html,css,txt}',
            group: 'sibling',
            position: 'after'
        }
    ],
    pathGroupsExcludedImportTypes: ['builtin', 'object'],
    'newlines-between': 'always',
    alphabetize: { order: 'asc', caseInsensitive: true }
}];

export default [
    ...playcanvasConfig,
    {
        files: ['**/*.js', '**/*.mjs'],
        languageOptions: {
            globals: {
                ...globals.browser,
                ...globals.node,
                'ObjModelParser': 'readonly',
                'OutlineEffect': 'readonly'
            }
        },
        rules: {
            'import/order': importOrder,
            'import/no-unresolved': 'off'
        }
    },
    {
        files: ['src/examples/**/*.example.mjs'],
        plugins: {
            examples: {
                rules: {
                    'config-block-at-top': configBlockAtTop,
                    'config-block-shape': configBlockShape
                }
            }
        },
        rules: {
            'examples/config-block-at-top': 'error',
            'examples/config-block-shape': 'error'
        }
    },
    {
        ignores: [
            'assets/scripts/utils/area-light-lut-bin-gen.js',
            'assets/wasm',
            'cache',
            'dist',
            'src/app/monaco/languages',
            'src/app/monaco/tokenizer-rules.mjs'
        ]
    }
];
