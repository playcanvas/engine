import playcanvasConfig from '@playcanvas/eslint-config';
import globals from 'globals';

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
