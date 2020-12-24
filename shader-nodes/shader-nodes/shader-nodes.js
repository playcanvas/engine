import { add } from './add.js';
import { mul } from './mul.js';
import { sub } from './sub.js';
import { cross } from './cross.js';
import { join } from './join.js';
import { uv0 } from './uv0.js';
import { worldPos } from './worldPos.js';
import { worldNorm } from './worldNorm.js';
import { texSample } from './texSample.js';
import { select } from './select.js';
import { stdAlpha, stdNormalMap, stdGlossiness, stdSpecularity, stdAlbedo, stdEmission } from './stdInputs.js';

// Object containing all default shader nodes used by shader graphs
var shaderNodes = {
    add: add,
    mul: mul,
    sub: sub,
    cross: cross,
    join: join,
    uv0: uv0,
    worldPos: worldPos,
    worldNorm: worldNorm,
    texSample: texSample,
    select: select,
    stdAlpha: stdAlpha,
    stdNormalMap: stdNormalMap,
    stdGlossiness: stdGlossiness,
    stdSpecularity: stdSpecularity,
    stdAlbedo: stdAlbedo,
    stdEmission: stdEmission
};

export { shaderNodes };
