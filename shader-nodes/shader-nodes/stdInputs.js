import { simpleOp } from "./simpleOp";

var stdAlpha = simpleOp.genOp('float', 'stdAlpha', 'dAlpha', 'STD MAT ALPHA');
var stdNormalMap = simpleOp.genOp('vec3', 'stdNormalMap', 'dNormalMap', 'STD MAT NORMALMAP');
var stdGlossiness = simpleOp.genOp('float', 'stdGlossiness', 'dGlossiness', 'STD MAT GLOSSINESS');
var stdSpecularity = simpleOp.genOp('vec3', 'stdSpecularity', 'dSpecularity', 'STD MAT SPECULARITY');
var stdAlbedo = simpleOp.genOp('vec3', 'stdAlbedo', 'dAlbedo', 'STD MAT ALBEDO');
var stdEmission = simpleOp.genOp('vec3', 'stdEmission', 'dEmission', 'STD MAT EMISSION');

export { stdAlpha, stdNormalMap, stdGlossiness, stdSpecularity, stdAlbedo, stdEmission };
