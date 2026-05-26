import playcanvasConfig from '@playcanvas/eslint-config';
import globals from 'globals';

const configLine = /^[ \t]*\/\/ @config[ \t]*$/;
const commentLine = /^[ \t]*\/\/[^\r\n]*$/;
const commentText = /^[ \t]*\/\/ ?(.*)$/;
const emptyLine = /^[ \t]*$/;
const booleanFlags = new Set([
    'HIDDEN',
    'NO_DEVICE_SELECTOR',
    'NO_MINISTATS',
    'WEBGPU_DISABLED',
    'WEBGPU_BARE_DISABLED',
    'WEBGL_DISABLED'
]);
const engineTypes = new Set(['development', 'performance', 'debug']);
const attributionFields = ['title', 'author', 'source', 'license'];
const attributionFieldSet = new Set(attributionFields);

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
            duplicateAttributionField: 'Duplicate @attribution field "{{name}}".',
            duplicateFlag: 'Duplicate @flag "{{name}}".',
            emptyAttributionField: '@attribution field "{{name}}" must not be empty.',
            invalidAttributionLine: 'Invalid @attribution line: expected "name: value".',
            invalidFlagValue: 'Invalid value "{{value}}" for @flag "{{name}}".',
            malformedFlag: 'Malformed @flag line.',
            missingAttributionFields: 'Incomplete @attribution: missing {{fields}}.',
            missingFlagValue: '@flag "{{name}}" requires a value.',
            unknownAttributionField: 'Invalid @attribution field "{{name}}".',
            unknownFlag: 'Unknown @flag "{{name}}".'
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

                const reportMissing = (attribution, line) => {
                    if (!attribution) {
                        return;
                    }

                    const missing = attributionFields.filter(field => !attribution.fields[field]);
                    if (missing.length) {
                        report(line, 'missingAttributionFields', { fields: missing.join(', ') });
                    }
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

                const validateAttribution = (line, attribution, text) => {
                    if (!text) {
                        return attribution;
                    }

                    const idx = text.indexOf(':');
                    if (idx === -1) {
                        report(line, 'invalidAttributionLine');
                        return attribution;
                    }

                    const name = text.slice(0, idx).trim();
                    const value = text.slice(idx + 1).trim();
                    if (!attributionFieldSet.has(name)) {
                        report(line, 'unknownAttributionField', { name });
                        return attribution;
                    }
                    if (attribution.fields[name] !== undefined) {
                        report(line, 'duplicateAttributionField', { name });
                        return attribution;
                    }
                    if (!value) {
                        report(line, 'emptyAttributionField', { name });
                    }

                    attribution.fields[name] = value;
                    return attributionFields.every(field => attribution.fields[field]) ? null : attribution;
                };

                for (let i = 0; i < lines.length; i++) {
                    if (!configLine.test(lines[i])) {
                        continue;
                    }

                    let attribution = null;
                    let end = i;
                    for (let j = i + 1; j < lines.length && commentLine.test(lines[j]); j++) {
                        end = j;
                        const text = commentText.exec(lines[j])[1].trim();
                        if (text === '@attribution') {
                            reportMissing(attribution, j);
                            attribution = { fields: {} };
                        } else if (attribution) {
                            attribution = validateAttribution(j, attribution, text);
                        } else if (text === '@flag' || text.startsWith('@flag ')) {
                            validateFlag(j, text);
                        }
                    }
                    reportMissing(attribution, end);
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
