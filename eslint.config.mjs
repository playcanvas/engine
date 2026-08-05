import javascriptConfig from '@playcanvas/eslint-config/javascript';
import { esmScriptTags } from '@playcanvas/eslint-config';
import eslintConfigPrettier from 'eslint-config-prettier/flat';
import globals from 'globals';

export default [
    ...javascriptConfig,
    {
        files: ['**/*.js', '**/*.mjs'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: {
                ...globals.browser,
                ...globals.mocha,
                ...globals.node,
                Ammo: 'readonly',
                earcut: 'readonly',
                opentype: 'readonly',
                pc: 'readonly',
                TWEEN: 'readonly',
                twgsl: 'readonly',
                webkitAudioContext: 'readonly'
            }
        },
        rules: {
            'import/order': 'off',
            'jsdoc/check-tag-names': [
                'error',
                {
                    // shared tags plus local tags this override would otherwise replace
                    definedTags: [...new Set([...esmScriptTags, 'alpha', 'beta', 'category', 'import'])]
                }
            ]
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
        ignores: ['examples/assets/wasm/*', 'scripts/textmesh/*.min.js', 'src/polyfill/*', 'scripts/spine/*']
    },
    eslintConfigPrettier
];
