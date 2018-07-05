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
uniform vec4 uColor;varying vec3 vPositionW;
varying vec2 vUv0;
float dAlpha;

#undef MAPFLOAT

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
        dAlpha *= texture2D(texture_opacityMap, vUv0).a;
    #endif
    #ifdef MAPVERTEX
        dAlpha *= saturate(vVertexColor.VC);
    #endif
}
uniform float alpha_ref;
void alphaTest(float a) {
    if (a < alpha_ref) discard;
}
void main(void)
{
   getOpacity();
   alphaTest(dAlpha);
    gl_FragColor = uColor;
}
