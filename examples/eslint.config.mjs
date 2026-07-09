import playcanvasConfig from '@playcanvas/eslint-config/legacy';
import eslintConfigPrettier from 'eslint-config-prettier/flat';
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
const preferredDeviceTypes = new Set(['webgpu', 'webgl2']);
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

                    if (name === 'PREFERRED_DEVICE') {
                        if (flags.has(name)) {
                            report(line, 'duplicateFlag', { name });
                        } else {
                            flags.add(name);
                        }

                        if (!value) {
                            report(line, 'missingFlagValue', { name });
                        } else if (!preferredDeviceTypes.has(value)) {
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

const assetLoaderTopLevelAwait = {
    meta: {
        type: 'suggestion',
        fixable: 'code',
        docs: {
            description: 'prefer top-level await for example asset loading'
        },
        messages: {
            topLevelAwait: 'Use top-level await instead of wrapping example setup in an asset loader callback.'
        }
    },

    create(context) {
        const sourceCode = context.sourceCode;

        const isAssetLoader = (node) => {
            return (node?.type === 'NewExpression' &&
                node.callee.type === 'Identifier' &&
                node.callee.name === 'AssetListLoader') ||
                (node?.type === 'NewExpression' &&
                node.callee.type === 'MemberExpression' &&
                node.callee.object.name === 'pc' &&
                node.callee.property.name === 'AssetListLoader');
        };

        const hasReturn = (node) => {
            if (!node || typeof node !== 'object') {
                return false;
            }
            if (node.type === 'ReturnStatement') {
                return true;
            }
            if (node.type === 'FunctionDeclaration' ||
                node.type === 'FunctionExpression' ||
                node.type === 'ArrowFunctionExpression') {
                return false;
            }
            return Object.entries(node).some(([key, value]) => {
                if (key === 'parent' || key === 'loc' || key === 'range') {
                    return false;
                }
                if (Array.isArray(value)) {
                    return value.some(child => child?.type && hasReturn(child));
                }
                return value?.type && hasReturn(value);
            });
        };

        return {
            Program(node) {
                const body = node.body;

                for (let i = 1; i < body.length; i++) {
                    const prev = body[i - 1];
                    const stmt = body[i];
                    const decl = prev.type === 'VariableDeclaration' && prev.declarations.length === 1 ?
                        prev.declarations[0] :
                        null;
                    const call = stmt.type === 'ExpressionStatement' ? stmt.expression : null;
                    const callback = call?.type === 'CallExpression' ? call.arguments[0] : null;

                    if (decl?.id.type !== 'Identifier' ||
                        !isAssetLoader(decl.init) ||
                        call?.type !== 'CallExpression' ||
                        call.callee.type !== 'MemberExpression' ||
                        call.callee.object.name !== decl.id.name ||
                        call.callee.property.name !== 'load' ||
                        callback?.type !== 'ArrowFunctionExpression' ||
                        callback.params.length ||
                        callback.body.type !== 'BlockStatement') {
                        continue;
                    }

                    const canFix = !hasReturn(callback.body) &&
                        body.slice(i + 1).every(node => node.type.startsWith('Export'));

                    context.report({
                        node: stmt,
                        messageId: 'topLevelAwait',
                        fix: canFix ? (fixer) => {
                            const gap = sourceCode.text.slice(prev.range[1], stmt.range[0]);
                            if (gap.trim()) {
                                return null;
                            }

                            const loader = sourceCode.getText(decl.init);
                            const block = sourceCode.text
                            .slice(callback.body.range[0] + 1, callback.body.range[1] - 1)
                            .trim();

                            return fixer.replaceTextRange(
                                [prev.range[0], stmt.range[1]],
                                `await new Promise((resolve) => {\n    ${loader}.load(resolve);\n});\n\n${block}`
                            );
                        } : null
                    });
                }
            }
        };
    }
};

const noPlaycanvasNamespace = {
    meta: {
        type: 'problem',
        docs: {
            description: 'require direct PlayCanvas imports in examples'
        },
        messages: {
            namespaceImport: 'Import PlayCanvas exports directly instead of using the pc namespace.',
            namespaceReference: 'Use the direct PlayCanvas import instead of pc.{{name}}.'
        }
    },

    create(context) {
        const sourceCode = context.sourceCode;

        return {
            ImportDeclaration(node) {
                if (node.source.value !== 'playcanvas') {
                    return;
                }

                for (const specifier of node.specifiers) {
                    if (specifier.type === 'ImportNamespaceSpecifier') {
                        context.report({
                            node: specifier,
                            messageId: 'namespaceImport'
                        });
                    }
                }
            },

            MemberExpression(node) {
                if (node.computed ||
                    node.object.type !== 'Identifier' ||
                    node.object.name !== 'pc' ||
                    node.property.type !== 'Identifier') {
                    return;
                }

                context.report({
                    node,
                    messageId: 'namespaceReference',
                    data: { name: node.property.name }
                });
            },

            Program(node) {
                for (const comment of sourceCode.getAllComments()) {
                    const match = /\bpc\.([A-Za-z_$][\w$]*)/.exec(comment.value);
                    if (!match) {
                        continue;
                    }

                    context.report({
                        node,
                        loc: {
                            line: comment.loc.start.line,
                            column: comment.loc.start.column + match.index
                        },
                        messageId: 'namespaceReference',
                        data: { name: match[1] }
                    });
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
    'newlines-between': 'always'
}];

// minimal jsx-uses-vars: mark JSX-referenced identifiers as used so no-unused-vars sees imported
// components (e.g. <Panel/>) as used. Avoids pulling in eslint-plugin-react just for this.
const jsxUsesVars = {
    meta: { type: 'problem' },
    create(context) {
        return {
            JSXOpeningElement(node) {
                let name = node.name;
                while (name.type === 'JSXMemberExpression') {
                    name = name.object;
                }
                if (name.type === 'JSXIdentifier') {
                    context.sourceCode.markVariableAsUsed(name.name, name);
                }
            }
        };
    }
};

const examplesPlugin = {
    rules: {
        'config-block-at-top': configBlockAtTop,
        'config-block-shape': configBlockShape,
        'asset-loader-top-level-await': assetLoaderTopLevelAwait,
        'no-playcanvas-namespace': noPlaycanvasNamespace
    }
};

export default [
    ...playcanvasConfig,
    {
        files: ['**/*.js', '**/*.mjs', '**/*.jsx'],
        languageOptions: {
            parserOptions: {
                ecmaFeatures: { jsx: true }
            },
            globals: {
                ...globals.browser,
                ...globals.node,
                'ObjModelParser': 'readonly',
                'OutlineEffect': 'readonly'
            }
        },
        rules: {
            'import/order': importOrder,
            'import/no-unresolved': 'off',
            'import/extensions': 'off' // examples import via the 'examples/context' alias, not real paths
        }
    },
    {
        ...eslintConfigPrettier,
        files: ['src/examples/**/*.{mjs,jsx}']
    },
    {
        files: ['src/examples/**/*.{mjs,jsx}'],
        plugins: {
            examples: examplesPlugin
        },
        rules: {
            'arrow-parens': 'off',
            curly: 'error',
            'examples/no-playcanvas-namespace': 'error',
            'implicit-arrow-linebreak': 'off',
            'indent': 'off',
            'no-confusing-arrow': 'off',
            'no-unused-vars': ['error', {
                argsIgnorePattern: '^_',
                varsIgnorePattern: '^_',
                caughtErrorsIgnorePattern: '^_'
            }],
            'object-curly-spacing': ['error', 'always'],
            'operator-linebreak': 'off',
            'quotes': 'off'
        }
    },
    {
        files: ['**/*.jsx'],
        plugins: {
            jsx: {
                rules: {
                    'uses-vars': jsxUsesVars
                }
            }
        },
        rules: {
            'jsx/uses-vars': 'error',
            'max-len': ['error', {
                code: 100,
                ignoreUrls: true,
                ignoreStrings: true,
                ignoreTemplateLiterals: true,
                ignoreRegExpLiterals: true
            }]
        }
    },
    {
        files: ['src/examples/**/*.example.mjs'],
        rules: {
            'examples/asset-loader-top-level-await': 'error',
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
