import playcanvasConfig from '@playcanvas/eslint-config';
import globals from 'globals';

const importOrder = ['error', {
    groups: ['builtin', 'external', 'internal', ['parent', 'sibling'], 'index', 'unknown'],
    pathGroups: [
        {
            pattern: '{examples/assets,engine/scripts}/**/*[?]url',
            group: 'external',
            position: 'after'
        },
        {
            pattern: '{./,../}**/*[?]raw',
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
