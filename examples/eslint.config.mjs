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
                'ObjModelParser': 'readonly',
                'OutlineEffect': 'readonly'
            }
        },
        rules: {
            'import/no-unresolved': 'off'
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
