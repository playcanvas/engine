import { select } from './select.js';
import { texSample } from './texSample.js';

import { flexOp } from "./flexOp";
import { simpleOp } from "./simpleOp";

// Object containing all default shader nodes used by shader graphs
var shaderNodes = {
    select: select,
    texSample: texSample,
    add: flexOp.genOp('add', '+', 'ADD'),
    mul: flexOp.genOp('mul', '*', 'MUL'),
    sub: flexOp.genOp('sub', '-', 'SUB'),
    uv0: simpleOp.genOp('vec2', 'uv0', 'vUv0', 'UV0'),
    worldNorm: simpleOp.genOp('vec3', 'worldNorm', 'vNormalW', 'WORLD NORMAL'),
    worldPos: simpleOp.genOp('vec3', 'worldPos', 'vPositionW', 'WORLD POSITION'),
    stdAlpha: simpleOp.genOp('float', 'stdAlpha', 'dAlpha', 'STD MAT ALPHA'),
    stdNormalMap: simpleOp.genOp('vec3', 'stdNormalMap', 'dNormalMap', 'STD MAT NORMALMAP'),
    stdGlossiness: simpleOp.genOp('float', 'stdGlossiness', 'dGlossiness', 'STD MAT GLOSSINESS'),
    stdSpecularity: simpleOp.genOp('vec3', 'stdSpecularity', 'dSpecularity', 'STD MAT SPECULARITY'),
    stdAlbedo: simpleOp.genOp('vec3', 'stdAlbedo', 'dAlbedo', 'STD MAT ALBEDO'),
    stdEmission: simpleOp.genOp('vec3', 'stdEmission', 'dEmission', 'STD MAT EMISSION')
};

export { shaderNodes };
