#version 300 es
#define varying in
out highp vec4 pc_fragColor;
#define gl_FragColor pc_fragColor
#define texture2D texture
#define textureCube texture
#define texture2DProj textureProj
#define texture2DLodEXT textureLod
#define texture2DProjLodEXT textureProjLod
#define textureCubeLodEXT textureLod
#define texture2DGradEXT textureGrad
#define texture2DProjGradEXT textureProjGrad
#define textureCubeGradEXT textureGrad
#define GL2
precision highp float;
#ifdef GL2
precision highp sampler2DShadow;
#endif
varying vec3 vPositionW;
varying vec2 vUv0;

uniform vec3 view_position;
uniform vec3 light_globalAmbient;
float square(float x) {
    return x*x;
}
float saturate(float x) {
    return clamp(x, 0.0, 1.0);
}
vec3 saturate(vec3 x) {
    return clamp(x, vec3(0.0), vec3(1.0));
}
#define NINESLICED
varying vec2 vMask;
varying vec2 vTiledUv;
uniform vec4 innerOffset;
uniform vec2 outerScale;
uniform vec4 atlasRect;
vec2 nineSlicedUv;
vec4 dReflection;
vec3 dAlbedo;
vec3 dDiffuseLight;
vec3 dSpecularLight;
vec3 dSpecularity;
float dAlpha;

vec4 texture2DSRGB(sampler2D tex, vec2 uv) {
    return texture2D(tex, uv);
}
vec4 texture2DSRGB(sampler2D tex, vec2 uv, float bias) {
    return texture2D(tex, uv, bias);
}
vec4 textureCubeSRGB(samplerCube tex, vec3 uvw) {
    return textureCube(tex, uvw);
}
vec3 gammaCorrectOutput(vec3 color) {
    return color;
}
vec3 gammaCorrectInput(vec3 color) {
    return color;
}
float gammaCorrectInput(float color) {
    return color;
}
vec4 gammaCorrectInput(vec4 color) {
    return color;
}
vec3 toneMap(vec3 color) {
    return color;
}
vec3 addFog(vec3 color) {
    return color;
}

#undef MAPFLOAT

#undef MAPCOLOR
 #define MAPCOLOR

#undef MAPVERTEX

#undef MAPTEXTURE
#ifdef MAPCOLOR
uniform vec3 material_diffuse;
#endif
#ifdef MAPTEXTURE
uniform sampler2D texture_diffuseMap;
#endif
void getAlbedo() {
    dAlbedo = vec3(1.0);
    #ifdef MAPCOLOR
        dAlbedo *= material_diffuse.rgb;
    #endif
    #ifdef MAPTEXTURE
        dAlbedo *= texture2DSRGB(texture_diffuseMap, UV).CH;
    #endif
    #ifdef MAPVERTEX
        dAlbedo *= gammaCorrectInput(saturate(vVertexColor.VC));
    #endif
}

#undef MAPFLOAT
 #define MAPFLOAT

#undef MAPCOLOR

#undef MAPVERTEX

#undef MAPTEXTURE
 #define MAPTEXTURE
#ifdef MAPFLOAT
uniform float material_opacity;
#endif
#ifdef MAPTEXTURE
uniform sampler2D texture_opacityMap;
#endif
void getOpacity() {
    dAlpha = 1.0;
    #ifdef MAPFLOAT
        dAlpha *= material_opacity;
    #endif
    #ifdef MAPTEXTURE
        dAlpha *= texture2D(texture_opacityMap, nineSlicedUv).a;
    #endif
    #ifdef MAPVERTEX
        dAlpha *= saturate(vVertexColor.VC);
    #endif
}

#undef MAPFLOAT

#undef MAPCOLOR
 #define MAPCOLOR

#undef MAPVERTEX

#undef MAPTEXTURE
 #define MAPTEXTURE
#ifdef MAPCOLOR
uniform vec3 material_emissive;
#endif
#ifdef MAPFLOAT
uniform float material_emissiveIntensity;
#endif
#ifdef MAPTEXTURE
uniform sampler2D texture_emissiveMap;
#endif
vec3 getEmission() {
    vec3 emission = vec3(1.0);
    #ifdef MAPFLOAT
        emission *= material_emissiveIntensity;
    #endif
    #ifdef MAPCOLOR
        emission *= material_emissive;
    #endif
    #ifdef MAPTEXTURE
        emission *= texture2DSRGB(texture_emissiveMap, nineSlicedUv).rgb;
    #endif
    #ifdef MAPVERTEX
        emission *= gammaCorrectInput(saturate(vVertexColor.VC));
    #endif
    return emission;
}
vec3 combineColor() {
    return dAlbedo * dDiffuseLight;
}

void addAmbient() {
    dDiffuseLight += light_globalAmbient;
}

void main(void) {
    dDiffuseLight = vec3(0);
    dSpecularLight = vec3(0);
    dReflection = vec4(0);
    dSpecularity = vec3(0);
nineSlicedUv = vUv0;
   getOpacity();
   getAlbedo();
   addAmbient();

   gl_FragColor.rgb = combineColor();
   gl_FragColor.rgb += getEmission();
   gl_FragColor.rgb = addFog(gl_FragColor.rgb);
   #ifndef HDR
    gl_FragColor.rgb = toneMap(gl_FragColor.rgb);
    gl_FragColor.rgb = gammaCorrectOutput(gl_FragColor.rgb);
   #endif
gl_FragColor.rgb *= dAlpha;
gl_FragColor.a = dAlpha;

}
