import add from './add.js';
import cross from './cross.js';
import mul from './mul.js';
import join from './join.js';
import uv0 from './uv0.js';
import texSample from './texSample.js';

// Object containing all default shader nodes used by shader graphs
var shaderNodes = {
    add: add,
    cross: cross,
    mul: mul,
    join: join,
    uv0: uv0,
    texSample: texSample
};

export { shaderNodes };
