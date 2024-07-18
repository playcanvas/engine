import playcanvasConfig from '@playcanvas/eslint-config';
import babelParser from '@babel/eslint-parser';

export default [
  ...playcanvasConfig,
  {
    files: ['**/*.js', '**/*.mjs'],
    globals: {
      Ammo: 'readonly',
      earcut: 'readonly',
      glslang: 'readonly',
      GPUBufferUsage: 'readonly',
      GPUColorWrite: 'readonly',
      GPUMapMode: 'readonly',
      GPUShaderStage: 'readonly',
      GPUTextureUsage: 'readonly',
      opentype: 'readonly',
      pc: 'readonly',
      TWEEN: 'readonly',
      twgsl: 'readonly',
      webkitAudioContext: 'readonly',
      XRRay: 'readonly',
      XRRigidTransform: 'readonly',
      XRWebGLLayer: 'readonly'
    },
    parser: babelParser,
    parserOptions: {
      requireConfigFile: false
    },
    rules: {
      'jsdoc/check-tag-names': [
        'error',
        {
          definedTags: ['attribute', 'category', 'import']
        }
      ]
    }
  }
];
