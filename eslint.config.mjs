import playcanvasConfig from '@playcanvas/eslint-config';
import babelParser from '@babel/eslint-parser';
import globals from 'globals';

export default [
    ...playcanvasConfig,
    {
        files: ['**/*.js', '**/*.mjs'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            parser: babelParser,
            parserOptions: {
                requireConfigFile: false
            },
            globals: {
                ...globals.browser,
                ...globals.mocha,
                ...globals.node,
                'Ammo': false,
                'earcut': false,
                'glslang': false,
                'GPUBufferUsage': false,
                'GPUColorWrite': false,
                'GPUMapMode': false,
                'GPUShaderStage': false,
                'GPUTextureUsage': false,
                'opentype': false,
                'pc': false,
                'TWEEN': false,
                'twgsl': false,
                'webkitAudioContext': false,
                'XRRay': false,
                'XRRigidTransform': false,
                'XRWebGLBinding': false,
                'XRWebGLLayer': false
            }
        },
        rules: {
            'no-unused-vars': ['error', { 'args': 'none', 'caughtErrors': 'none' }],
            'import/order': 'off'
        }
    },
    {
        files: ['test/**/*.mjs'],
        rules: {
            'no-unused-expressions': 'off',
            'no-var': 'error'
        }
    },
    {
        ignores: [
            'tests/**/*',
            'examples/lib/*',
            'scripts/textmesh/*.min.js',
            'src/polyfill/*',
            'scripts/spine/*'
        ]
    }
];
