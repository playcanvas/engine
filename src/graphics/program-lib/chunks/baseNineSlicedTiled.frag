#define NINESLICED
#define NINESLICETILED

varying vec2 vMask;
varying vec2 vTiledUv;

uniform mediump vec4 innerOffset;
uniform mediump vec2 outerScale;
uniform mediump vec4 atlasRect;

vec2 nineSlicedUv;
