import playcanvasConfig from '@playcanvas/eslint-config';
import globals from 'globals';

const configLine = /^[ \t]*\/\/ @config[ \t]*$/;
const commentLine = /^[ \t]*\/\/[^\r\n]*$/;
const emptyLine = /^[ \t]*$/;

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
                    'config-block-at-top': configBlockAtTop
                }
            }
        },
        rules: {
            'examples/config-block-at-top': 'error'
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
