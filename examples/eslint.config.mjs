import playcanvasConfig from '@playcanvas/eslint-config';
import globals from 'globals';

export default [
    ...playcanvasConfig,
    {
        files: ['**/*.js', '**/*.mjs'],
        languageOptions: {
            globals: {
                ...globals.browser,
                ...globals.node,
                ...globals.mocha,
                'ObjModelParser': 'readonly',
                'OutlineEffect': 'readonly'
            }
        },
        rules: {
            'import/no-unresolved': 'off'
        }
    },
    {
        files: ['test/**/*.mjs'],
        rules: {
            'no-unused-expressions': 'off',
            'prefer-arrow-callback': 'off' // Mocha uses function callbacks
        }
    },
    {
        ignores: [
            'assets/scripts/utils/area-light-lut-bin-gen.js',
            'cache',
            'dist',
            'src/lib',
            'src/app/monaco/languages',
            'src/app/monaco/tokenizer-rules.mjs'
        ]
    }
];
