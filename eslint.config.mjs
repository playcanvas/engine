import playcanvasConfig from '@playcanvas/eslint-config';
import globals from 'globals';
import typescriptParser from '@typescript-eslint/parser';

// Extract or preserve existing JSDoc tags
const jsdocRule = playcanvasConfig.find(
    config => config.rules && config.rules['jsdoc/check-tag-names']
);
const existingTags = jsdocRule?.rules['jsdoc/check-tag-names'][1]?.definedTags || [];

export default [
    ...playcanvasConfig,
    {
        files: ['**/*.js', '**/*.mjs', '**/*.ts'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: {
                ...globals.browser,
                ...globals.mocha,
                ...globals.node,
                'Ammo': 'readonly',
                'earcut': 'readonly',
                'opentype': 'readonly',
                'pc': 'readonly',
                'TWEEN': 'readonly',
                'twgsl': 'readonly',
                'webkitAudioContext': 'readonly'
            }
        },
        rules: {
            'import/order': 'off',
            'jsdoc/check-tag-names': [
                'error',
                {
                    // custom mjs script tags to not error on, add them to those from parent config
                    definedTags: [...new Set([...existingTags, 'range', 'step', 'precision'])]
                }
            ]
        },
        settings: {
            'import/resolver': {
                typescript: {
                    // This allows .js imports to resolve to .ts files
                    project: './tsconfig.json'
                }
            }
        }
    },
    {
        files: ['**/*.ts'],
        languageOptions: {
            parser: typescriptParser,
            parserOptions: {
                project: './tsconfig.json'
            }
        },
        rules: {
            // TypeScript provides its own type information, so we don't need JSDoc types
            'jsdoc/require-param-type': 'off',
            'jsdoc/require-returns-type': 'off',
            'jsdoc/require-property-type': 'off'
        }
    },
    {
        files: ['scripts/**/*.js'],
        rules: {
            'no-var': 'off'
        }
    },
    {
        files: ['scripts/**/*.mjs'],
        rules: {
            'jsdoc/no-defaults': 'off', // Attributes use default values
            'import/no-unresolved': 'off' // PlayCanvas is not installed for scripts
        }
    },
    {
        files: ['test/**/*.mjs'],
        rules: {
            'import/order': 'error',
            'no-unused-expressions': 'off',
            'prefer-arrow-callback': 'off' // Mocha uses function callbacks
        }
    },
    {
        ignores: [
            'examples/lib/*',
            'scripts/textmesh/*.min.js',
            'src/polyfill/*',
            'scripts/spine/*'
        ]
    }
];
