import javascriptConfig from '@playcanvas/eslint-config/javascript';
import { esmScriptTags } from '@playcanvas/eslint-config';
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
                    // esmScriptTags (range/step/precision included) plus the shared config's own
                    // extra tags, which this override would otherwise drop by replacing the rule
                    definedTags: [...new Set([...esmScriptTags, 'alpha', 'beta', 'category', 'import'])]
                }
            ],
            // JSDoc is the type source here, so adding @param/@returns to a member that had no
            // block overwrites the signature tsc inferred for it: `scale(scalar: any)` in
            // playcanvas.d.ts becomes `scale(scalar: number)`. A @deprecated block on a legacy
            // member exists only to carry the marker into the declarations and must leave the
            // published signature alone, so it is exempt from both rules. `inheritdoc` is the
            // plugin's own default, preserved here.
            'jsdoc/require-param': ['error', { exemptedBy: ['deprecated', 'inheritdoc'] }],
            'jsdoc/require-returns': ['error', { exemptedBy: ['deprecated', 'inheritdoc'] }]
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
            'examples/assets/wasm/*',
            'scripts/textmesh/*.min.js',
            'src/polyfill/*',
            'scripts/spine/*'
        ]
    }
];
