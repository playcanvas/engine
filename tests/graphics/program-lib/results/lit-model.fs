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
varying vec3 vNormalW;
varying vec3 vTangentW;
varying vec3 vBinormalW;
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
vec4 dReflection;
mat3 dTBN;
vec3 dAlbedo;
vec3 dNormalW;
vec3 dVertexNormalW;
vec3 dTangentW;
vec3 dBinormalW;
vec3 dViewDirW;
vec3 dReflDirW;
vec3 dDiffuseLight;
vec3 dSpecularLight;
vec3 dLightDirNormW;
vec3 dLightDirW;
vec3 dLightPosW;
vec3 dShadowCoord;
vec3 dNormalMap;
vec3 dSpecularity;
float dGlossiness;
float dAlpha;
float dAtten;
float getSpotEffect(vec3 lightSpotDirW, float lightInnerConeAngle, float lightOuterConeAngle) {
    float cosAngle = dot(dLightDirNormW, lightSpotDirW);
    return smoothstep(lightOuterConeAngle, lightInnerConeAngle, cosAngle);
}
float getFalloffLinear(float lightRadius) {
    float d = length(dLightDirW);
    return max(((lightRadius - d) / lightRadius), 0.0);
}
void getLightDirPoint(vec3 lightPosW) {
    dLightDirW = vPositionW - lightPosW;
    dLightDirNormW = normalize(dLightDirW);
    dLightPosW = lightPosW;
}
uniform vec3 light0_color;
uniform vec3 light0_position;
uniform float light0_radius;
uniform vec3 light1_color;
uniform vec3 light1_position;
uniform float light1_radius;
uniform vec3 light1_direction;
uniform float light1_innerConeAngle;
uniform float light1_outerConeAngle;
uniform mat4 light1_shadowMatrix;
uniform vec4 light1_shadowParams;
uniform sampler2DShadow light1_shadowMap;

vec3 unpackNormal(vec4 nmap) {
    return nmap.xyz * 2.0 - 1.0;
}
uniform sampler2D texture_normalMap;
uniform float material_bumpiness;
void getNormal() {
    vec3 normalMap = unpackNormal(texture2D(texture_normalMap, vUv0));
    dNormalMap = normalMap;
    normalMap = normalize(mix(vec3(0.0, 0.0, 1.0), normalMap, material_bumpiness));
    dNormalW = dTBN * normalMap;
}
void getTBN() {
    dTBN = mat3(normalize(dTangentW), normalize(dBinormalW), normalize(dVertexNormalW));
}
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
uniform float exposure;
vec3 toneMap(vec3 color) {
    return color * exposure;
}
vec3 addFog(vec3 color) {
    return color;
}
vec3 cubeMapProject(vec3 dir) {
    return dir;
}
vec3 processEnvironment(vec3 color) {
    return color;
}

#undef MAPFLOAT

#undef MAPCOLOR

#undef MAPVERTEX

#undef MAPTEXTURE
 #define MAPTEXTURE
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
        dAlbedo *= texture2DSRGB(texture_diffuseMap, vUv0).rgb;
    #endif
    #ifdef MAPVERTEX
        dAlbedo *= gammaCorrectInput(saturate(vVertexColor.VC));
    #endif
}

#undef MAPFLOAT

#undef MAPCOLOR
 #define MAPCOLOR

#undef MAPVERTEX

#undef MAPTEXTURE
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
        emission *= texture2DSAMPLE(texture_emissiveMap, UV).CH;
    #endif
    #ifdef MAPVERTEX
        emission *= gammaCorrectInput(saturate(vVertexColor.VC));
    #endif
    return emission;
}
float antiAliasGlossiness(float power) {
    return power;
}

#undef MAPFLOAT

#undef MAPCOLOR

#undef MAPVERTEX

#undef MAPTEXTURE
 #define MAPTEXTURE
#ifdef MAPCOLOR
uniform vec3 material_specular;
#endif
#ifdef MAPTEXTURE
uniform sampler2D texture_specularMap;
#endif
void getSpecularity() {
    dSpecularity = vec3(1.0);
    #ifdef MAPCOLOR
        dSpecularity *= material_specular;
    #endif
    #ifdef MAPTEXTURE
        dSpecularity *= texture2D(texture_specularMap, vUv0).rgb;
    #endif
    #ifdef MAPVERTEX
        dSpecularity *= saturate(vVertexColor.VC);
    #endif
}

#undef MAPFLOAT
 #define MAPFLOAT

#undef MAPCOLOR

#undef MAPVERTEX

#undef MAPTEXTURE
#ifdef MAPFLOAT
uniform float material_shininess;
#endif
#ifdef MAPTEXTURE
uniform sampler2D texture_glossMap;
#endif
void getGlossiness() {
    dGlossiness = 1.0;
    #ifdef MAPFLOAT
        dGlossiness *= material_shininess;
    #endif
    #ifdef MAPTEXTURE
        dGlossiness *= texture2D(texture_glossMap, UV).CH;
    #endif
    #ifdef MAPVERTEX
        dGlossiness *= saturate(vVertexColor.VC);
    #endif
    dGlossiness += 0.0000001;
}
vec3 lessThan2(vec3 a, vec3 b) {
    return clamp((b - a)*1000.0, 0.0, 1.0); // softer version
}
#ifndef UNPACKFLOAT
#define UNPACKFLOAT
float unpackFloat(vec4 rgbaDepth) {
    const vec4 bitShift = vec4(1.0 / (256.0 * 256.0 * 256.0), 1.0 / (256.0 * 256.0), 1.0 / 256.0, 1.0);
    return dot(rgbaDepth, bitShift);
}
#endif
// ----- Direct/Spot Sampling -----
#ifdef GL2
    float _getShadowPCF3x3(sampler2DShadow shadowMap, vec3 shadowParams) {
        float z = dShadowCoord.z;
        vec2 uv = dShadowCoord.xy * shadowParams.x; // 1 unit - 1 texel
        float shadowMapSizeInv = 1.0 / shadowParams.x;
        vec2 base_uv = floor(uv + 0.5);
        float s = (uv.x + 0.5 - base_uv.x);
        float t = (uv.y + 0.5 - base_uv.y);
        base_uv -= vec2(0.5);
        base_uv *= shadowMapSizeInv;
        float sum = 0.0;
        float uw0 = (3.0 - 2.0 * s);
        float uw1 = (1.0 + 2.0 * s);
        float u0 = (2.0 - s) / uw0 - 1.0;
        float u1 = s / uw1 + 1.0;
        float vw0 = (3.0 - 2.0 * t);
        float vw1 = (1.0 + 2.0 * t);
        float v0 = (2.0 - t) / vw0 - 1.0;
        float v1 = t / vw1 + 1.0;
        u0 = u0 * shadowMapSizeInv + base_uv.x;
        v0 = v0 * shadowMapSizeInv + base_uv.y;
        u1 = u1 * shadowMapSizeInv + base_uv.x;
        v1 = v1 * shadowMapSizeInv + base_uv.y;
        sum += uw0 * vw0 * texture(shadowMap, vec3(u0, v0, z));
        sum += uw1 * vw0 * texture(shadowMap, vec3(u1, v0, z));
        sum += uw0 * vw1 * texture(shadowMap, vec3(u0, v1, z));
        sum += uw1 * vw1 * texture(shadowMap, vec3(u1, v1, z));
        sum *= 1.0f / 16.0;
        return sum;
    }
    float getShadowPCF3x3(sampler2DShadow shadowMap, vec3 shadowParams) {
        return _getShadowPCF3x3(shadowMap, shadowParams);
    }
    float getShadowSpotPCF3x3(sampler2DShadow shadowMap, vec4 shadowParams) {
        return _getShadowPCF3x3(shadowMap, shadowParams.xyz);
    }
#else
    float _xgetShadowPCF3x3(mat3 depthKernel, sampler2D shadowMap, vec3 shadowParams) {
        mat3 shadowKernel;
        vec3 shadowCoord = dShadowCoord;
        vec3 shadowZ = vec3(shadowCoord.z);
        shadowKernel[0] = vec3(greaterThan(depthKernel[0], shadowZ));
        shadowKernel[1] = vec3(greaterThan(depthKernel[1], shadowZ));
        shadowKernel[2] = vec3(greaterThan(depthKernel[2], shadowZ));
        vec2 fractionalCoord = fract( shadowCoord.xy * shadowParams.x );
        shadowKernel[0] = mix(shadowKernel[0], shadowKernel[1], fractionalCoord.x);
        shadowKernel[1] = mix(shadowKernel[1], shadowKernel[2], fractionalCoord.x);
        vec4 shadowValues;
        shadowValues.x = mix(shadowKernel[0][0], shadowKernel[0][1], fractionalCoord.y);
        shadowValues.y = mix(shadowKernel[0][1], shadowKernel[0][2], fractionalCoord.y);
        shadowValues.z = mix(shadowKernel[1][0], shadowKernel[1][1], fractionalCoord.y);
        shadowValues.w = mix(shadowKernel[1][1], shadowKernel[1][2], fractionalCoord.y);
        return dot( shadowValues, vec4( 1.0 ) ) * 0.25;
    }
    float _getShadowPCF3x3(sampler2D shadowMap, vec3 shadowParams) {
        vec3 shadowCoord = dShadowCoord;
        float xoffset = 1.0 / shadowParams.x; // 1/shadow map width
        float dx0 = -xoffset;
        float dx1 = xoffset;
        mat3 depthKernel;
        depthKernel[0][0] = unpackFloat(texture2D(shadowMap, shadowCoord.xy + vec2(dx0, dx0)));
        depthKernel[0][1] = unpackFloat(texture2D(shadowMap, shadowCoord.xy + vec2(dx0, 0.0)));
        depthKernel[0][2] = unpackFloat(texture2D(shadowMap, shadowCoord.xy + vec2(dx0, dx1)));
        depthKernel[1][0] = unpackFloat(texture2D(shadowMap, shadowCoord.xy + vec2(0.0, dx0)));
        depthKernel[1][1] = unpackFloat(texture2D(shadowMap, shadowCoord.xy));
        depthKernel[1][2] = unpackFloat(texture2D(shadowMap, shadowCoord.xy + vec2(0.0, dx1)));
        depthKernel[2][0] = unpackFloat(texture2D(shadowMap, shadowCoord.xy + vec2(dx1, dx0)));
        depthKernel[2][1] = unpackFloat(texture2D(shadowMap, shadowCoord.xy + vec2(dx1, 0.0)));
        depthKernel[2][2] = unpackFloat(texture2D(shadowMap, shadowCoord.xy + vec2(dx1, dx1)));
        return _xgetShadowPCF3x3(depthKernel, shadowMap, shadowParams);
    }
    float getShadowPCF3x3(sampler2D shadowMap, vec3 shadowParams) {
        return _getShadowPCF3x3(shadowMap, shadowParams);
    }
    float getShadowSpotPCF3x3(sampler2D shadowMap, vec4 shadowParams) {
        return _getShadowPCF3x3(shadowMap, shadowParams.xyz);
    }
#endif
// ----- Point Sampling -----
float _getShadowPoint(samplerCube shadowMap, vec4 shadowParams, vec3 dir) {
    vec3 tc = normalize(dir);
    vec3 tcAbs = abs(tc);
    vec4 dirX = vec4(1,0,0, tc.x);
    vec4 dirY = vec4(0,1,0, tc.y);
    float majorAxisLength = tc.z;
    if ((tcAbs.x > tcAbs.y) && (tcAbs.x > tcAbs.z)) {
        dirX = vec4(0,0,1, tc.z);
        dirY = vec4(0,1,0, tc.y);
        majorAxisLength = tc.x;
    } else if ((tcAbs.y > tcAbs.x) && (tcAbs.y > tcAbs.z)) {
        dirX = vec4(1,0,0, tc.x);
        dirY = vec4(0,0,1, tc.z);
        majorAxisLength = tc.y;
    }
    float shadowParamsInFaceSpace = ((1.0/shadowParams.x) * 2.0) * abs(majorAxisLength);
    vec3 xoffset = (dirX.xyz * shadowParamsInFaceSpace);
    vec3 yoffset = (dirY.xyz * shadowParamsInFaceSpace);
    vec3 dx0 = -xoffset;
    vec3 dy0 = -yoffset;
    vec3 dx1 = xoffset;
    vec3 dy1 = yoffset;
    mat3 shadowKernel;
    mat3 depthKernel;
    depthKernel[0][0] = unpackFloat(textureCube(shadowMap, tc + dx0 + dy0));
    depthKernel[0][1] = unpackFloat(textureCube(shadowMap, tc + dx0));
    depthKernel[0][2] = unpackFloat(textureCube(shadowMap, tc + dx0 + dy1));
    depthKernel[1][0] = unpackFloat(textureCube(shadowMap, tc + dy0));
    depthKernel[1][1] = unpackFloat(textureCube(shadowMap, tc));
    depthKernel[1][2] = unpackFloat(textureCube(shadowMap, tc + dy1));
    depthKernel[2][0] = unpackFloat(textureCube(shadowMap, tc + dx1 + dy0));
    depthKernel[2][1] = unpackFloat(textureCube(shadowMap, tc + dx1));
    depthKernel[2][2] = unpackFloat(textureCube(shadowMap, tc + dx1 + dy1));
    vec3 shadowZ = vec3(length(dir) * shadowParams.w + shadowParams.z);
    shadowKernel[0] = vec3(lessThan2(depthKernel[0], shadowZ));
    shadowKernel[1] = vec3(lessThan2(depthKernel[1], shadowZ));
    shadowKernel[2] = vec3(lessThan2(depthKernel[2], shadowZ));
    vec2 uv = (vec2(dirX.w, dirY.w) / abs(majorAxisLength)) * 0.5;
    vec2 fractionalCoord = fract( uv * shadowParams.x );
    shadowKernel[0] = mix(shadowKernel[0], shadowKernel[1], fractionalCoord.x);
    shadowKernel[1] = mix(shadowKernel[1], shadowKernel[2], fractionalCoord.x);
    vec4 shadowValues;
    shadowValues.x = mix(shadowKernel[0][0], shadowKernel[0][1], fractionalCoord.y);
    shadowValues.y = mix(shadowKernel[0][1], shadowKernel[0][2], fractionalCoord.y);
    shadowValues.z = mix(shadowKernel[1][0], shadowKernel[1][1], fractionalCoord.y);
    shadowValues.w = mix(shadowKernel[1][1], shadowKernel[1][2], fractionalCoord.y);
    return 1.0 - dot( shadowValues, vec4( 1.0 ) ) * 0.25;
}
float getShadowPointPCF3x3(samplerCube shadowMap, vec4 shadowParams) {
    return _getShadowPoint(shadowMap, shadowParams, dLightDirW);
}
void _getShadowCoordOrtho(mat4 shadowMatrix, vec3 shadowParams, vec3 wPos) {
    dShadowCoord = (shadowMatrix * vec4(wPos, 1.0)).xyz;
    dShadowCoord.z = saturate(dShadowCoord.z) - 0.0001;
    #ifdef SHADOWBIAS
        dShadowCoord.z += getShadowBias(shadowParams.x, shadowParams.z);
    #endif
}
void _getShadowCoordPersp(mat4 shadowMatrix, vec4 shadowParams, vec3 wPos) {
    vec4 projPos = shadowMatrix * vec4(wPos, 1.0);
    projPos.xy /= projPos.w;
    dShadowCoord.xy = projPos.xy;
    dShadowCoord.z = length(dLightDirW) * shadowParams.w;
    #ifdef SHADOWBIAS
        dShadowCoord.z += getShadowBias(shadowParams.x, shadowParams.z);
    #endif
}
void getShadowCoordOrtho(mat4 shadowMatrix, vec3 shadowParams) {
    _getShadowCoordOrtho(shadowMatrix, shadowParams, vPositionW);
}
void getShadowCoordPersp(mat4 shadowMatrix, vec4 shadowParams) {
    _getShadowCoordPersp(shadowMatrix, shadowParams, vPositionW);
}
void getShadowCoordPerspNormalOffset(mat4 shadowMatrix, vec4 shadowParams) {
    float distScale = abs(dot(vPositionW - dLightPosW, dLightDirNormW)); // fov?
    vec3 wPos = vPositionW + dVertexNormalW * shadowParams.y * clamp(1.0 - dot(dVertexNormalW, -dLightDirNormW), 0.0, 1.0) * distScale;
    _getShadowCoordPersp(shadowMatrix, shadowParams, wPos);
}
void getShadowCoordOrthoNormalOffset(mat4 shadowMatrix, vec3 shadowParams) {
    vec3 wPos = vPositionW + dVertexNormalW * shadowParams.y * clamp(1.0 - dot(dVertexNormalW, -dLightDirNormW), 0.0, 1.0); //0.08
    _getShadowCoordOrtho(shadowMatrix, shadowParams, wPos);
}
void normalOffsetPointShadow(vec4 shadowParams) {
    float distScale = length(dLightDirW);
    vec3 wPos = vPositionW + dVertexNormalW * shadowParams.y * clamp(1.0 - dot(dVertexNormalW, -dLightDirNormW), 0.0, 1.0) * distScale; //0.02
    vec3 dir = wPos - dLightPosW;
    dLightDirW = dir;
}
void _getShadowCoordPerspZbuffer(mat4 shadowMatrix, vec4 shadowParams, vec3 wPos) {
    vec4 projPos = shadowMatrix * vec4(wPos, 1.0);
    projPos.xyz /= projPos.w;
    dShadowCoord = projPos.xyz;
    // depth bias is already applied on render
}
void getShadowCoordPerspZbufferNormalOffset(mat4 shadowMatrix, vec4 shadowParams) {
    float distScale = abs(dot(vPositionW - dLightPosW, dLightDirNormW)); // fov?
    vec3 wPos = vPositionW + dVertexNormalW * shadowParams.y * clamp(1.0 - dot(dVertexNormalW, -dLightDirNormW), 0.0, 1.0) * distScale;
    _getShadowCoordPerspZbuffer(shadowMatrix, shadowParams, wPos);
}
void getShadowCoordPerspZbuffer(mat4 shadowMatrix, vec4 shadowParams) {
    _getShadowCoordPerspZbuffer(shadowMatrix, shadowParams, vPositionW);
}
float getLightDiffuse() {
    return max(dot(dNormalW, -dLightDirNormW), 0.0);
}
float getLightSpecular() {
    float specPow = dGlossiness;
    specPow = antiAliasGlossiness(specPow);
    // Hack: On Mac OS X, calling pow with zero for the exponent generates hideous artifacts so bias up a little
    return pow(max(dot(dReflDirW, -dLightDirNormW), 0.0), specPow + 0.0001);
}
vec3 combineColor() {
    return dAlbedo * dDiffuseLight + dSpecularLight * dSpecularity;
}

void addAmbient() {
    dDiffuseLight += light_globalAmbient;
}
void getViewDir() {
    dViewDirW = normalize(view_position - vPositionW);
}
void getReflDir() {
    dReflDirW = normalize(-reflect(dViewDirW, dNormalW));
}

void main(void) {
    dDiffuseLight = vec3(0);
    dSpecularLight = vec3(0);
    dReflection = vec4(0);
    dSpecularity = vec3(0);
   dVertexNormalW = vNormalW;
   dTangentW = vTangentW;
   dBinormalW = vBinormalW;
   dAlpha = 1.0;
   getViewDir();
   getTBN();
   getNormal();
   getReflDir();
   getAlbedo();
   getSpecularity();
   getGlossiness();
   addAmbient();
   getLightDirPoint(light0_position);
   dAtten = getFalloffLinear(light0_radius);
   if (dAtten > 0.00001) {
       dAtten *= getLightDiffuse();
       dDiffuseLight += dAtten * light0_color;
       dAtten *= getLightSpecular();
       dSpecularLight += dAtten * light0_color;
   }

   getLightDirPoint(light1_position);
   dAtten = getFalloffLinear(light1_radius);
   if (dAtten > 0.00001) {
       dAtten *= getSpotEffect(light1_direction, light1_innerConeAngle, light1_outerConeAngle);
       dAtten *= getLightDiffuse();
       getShadowCoordPerspZbufferNormalOffset(light1_shadowMatrix, light1_shadowParams);
       dAtten *= getShadowSpotPCF3x3(light1_shadowMap, light1_shadowParams);
       dDiffuseLight += dAtten * light1_color;
       dAtten *= getLightSpecular();
       dSpecularLight += dAtten * light1_color;
   }


   gl_FragColor.rgb = combineColor();
   gl_FragColor.rgb += getEmission();
   gl_FragColor.rgb = addFog(gl_FragColor.rgb);
   #ifndef HDR
    gl_FragColor.rgb = toneMap(gl_FragColor.rgb);
    gl_FragColor.rgb = gammaCorrectOutput(gl_FragColor.rgb);
   #endif
gl_FragColor.a = 1.0;

}
