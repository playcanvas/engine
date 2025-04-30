export default /* wgsl */`
#define NINESLICED

varying vMask: vec2f;
varying vTiledUv: vec2f;

uniform innerOffset: vec4f;
uniform outerScale: vec2f;
uniform atlasRect: vec4f;

var<private> nineSlicedUv: vec2f;
`;
