export default /* wgsl */`

#include "lightBufferDefinesPS"

// include this before shadow / cookie code
#include "clusteredLightUtilsPS"

#ifdef CLUSTER_COOKIES
    #include "clusteredLightCookiesPS"
#endif

#ifdef CLUSTER_SHADOWS
    #include "clusteredLightShadowsPS"
#endif

var clusterWorldTexture: texture_2d<u32>;
var lightsTexture: texture_2d<uff>;

#ifdef CLUSTER_SHADOWS
    // TODO: when VSM shadow is supported, it needs to use sampler2D in webgl2
    var shadowAtlasTexture: texture_depth_2d;
    var shadowAtlasTextureSampler: sampler_comparison;
#endif

#ifdef CLUSTER_COOKIES
    var cookieAtlasTexture: texture_2d<f32>;
    var cookieAtlasTextureSampler: sampler;
#endif

uniform clusterMaxCells: i32;

// number of lights in the cluster structure
uniform numClusteredLights: i32;

// width of the cluster texture
uniform clusterTextureWidth: i32;

uniform clusterCellsCountByBoundsSize: vec3f;
uniform clusterBoundsMin: vec3f;
uniform clusterBoundsDelta: vec3f;
uniform clusterCellsDot: vec3i;
uniform clusterCellsMax: vec3i;
uniform shadowAtlasParams: vec2f;

// structure storing light properties of a clustered light. Vectors and scalars are interleaved
// so each vec3 packs with an adjacent 4-byte field into a 16-byte slot, minimising padding for
// compilers that don't reorder struct members.
struct ClusterLightData {

    // world space position
    position: vec3f,

    // light index in the lights texture
    lightIndex: i32,

    // world space direction (spot light only)
    direction: vec3f,

    // area light shape
    shape: u32,

    // color
    color: vec3f,

    // 0.0 if the light doesn't cast shadows
    shadowIntensity: f32,

    // range of the light
    range: f32,

    // compressed biases, two half-floats stored in a float
    biasesData: f32,

    // intensity of the cookie
    cookieIntensity: f32,

    // true for spot lights
    isSpot: bool,

    // light follow mode
    falloffModeLinear: bool,

    // light mask (mutually exclusive)
    isDynamic: bool,
    isLightmapped: bool
}

// Spot light cone angles, decoded on demand only when the light is a spot light.
struct ClusterLightSpotData {
    innerConeAngleCos: f32,
    outerConeAngleCos: f32
}

// Area light dimensions and orientation, decoded on demand only for non-punctual lights.
struct ClusterLightAreaData {
    halfWidth: vec3f,
    halfHeight: vec3f
}

// Shadow bias parameters, decoded on demand only when the light casts shadows.
struct ClusterLightShadowData {
    shadowBias: f32,
    shadowNormalBias: f32
}

// Note: on some devices (tested on Pixel 3A XL), this matrix when stored inside the light struct has lower precision compared to
// when stored outside, so we store it outside to avoid spot shadow flickering. This might need to be done to other / all members
// of the structure if further similar issues are observed.

// shadow (spot light only) / cookie projection matrix
var<private> lightProjectionMatrix: mat4x4f;

// NOTE: On some Samsung devices, these values can suffer precision / corruption issues when stored
// as members of ClusterLightData. Keep them as module-scope temporaries instead. See issue #7800.
var<private> clusterLightData_flags: u32;             // 32bit of flags
var<private> clusterLightData_anglesData: f32;        // compressed angles, two half-floats stored in a float
var<private> clusterLightData_colorBFlagsData: u32;   // blue color component and angle flags (as uint for efficient bit operations)

fn sampleLightTextureF(lightIndex: i32, index: i32) -> vec4f {
    return textureLoad(lightsTexture, vec2<i32>(index, lightIndex), 0);
}

fn decodeClusterLightCore(lightIndex: i32) -> ClusterLightData {
    var clusterLightData: ClusterLightData;

    // light index
    clusterLightData.lightIndex = lightIndex;

    // sample data encoding half-float values into 32bit uints
    let halfData: vec4f = sampleLightTextureF(lightIndex, {CLUSTER_TEXTURE_COLOR_ANGLES_BIAS});

    // store values needed by later decode steps (anglesData / colorBFlagsData live outside the
    // struct due to Samsung precision issues - see #7800)
    clusterLightData_anglesData = halfData.z;
    clusterLightData.biasesData = halfData.w;
    clusterLightData_colorBFlagsData = bitcast<u32>(halfData.y);

    // decompress color half-floats
    let colorRG: vec2f = unpack2x16float(bitcast<u32>(halfData.x));
    let colorB_flags: vec2f = unpack2x16float(clusterLightData_colorBFlagsData);
    clusterLightData.color = vec3f(colorRG, colorB_flags.x) * {LIGHT_COLOR_DIVIDER};

    // position and range, full floats
    let lightPosRange: vec4f = sampleLightTextureF(lightIndex, {CLUSTER_TEXTURE_POSITION_RANGE});
    clusterLightData.position = lightPosRange.xyz;
    clusterLightData.range = lightPosRange.w;

    // spot direction & flags data
    let lightDir_Flags: vec4f = sampleLightTextureF(lightIndex, {CLUSTER_TEXTURE_DIRECTION_FLAGS});

    // spot light direction
    clusterLightData.direction = lightDir_Flags.xyz;

    // 32bit flags (kept outside the struct, see #7800)
    clusterLightData_flags = bitcast<u32>(lightDir_Flags.w);
    clusterLightData.isSpot = (clusterLightData_flags & (1u << 30u)) != 0u;
    clusterLightData.shape = (clusterLightData_flags >> 28u) & 0x3u;
    clusterLightData.falloffModeLinear = (clusterLightData_flags & (1u << 27u)) == 0u;
    clusterLightData.shadowIntensity = f32((clusterLightData_flags >> 0u) & 0xFFu) / 255.0;
    clusterLightData.cookieIntensity = f32((clusterLightData_flags >> 8u) & 0xFFu) / 255.0;
    clusterLightData.isDynamic = (clusterLightData_flags & (1u << 22u)) != 0u;
    clusterLightData.isLightmapped = (clusterLightData_flags & (1u << 21u)) != 0u;

    return clusterLightData;
}

fn decodeClusterLightSpot() -> ClusterLightSpotData {
    // decompress spot light angles
    let angleFlags: u32 = (clusterLightData_colorBFlagsData >> 16u) & 0xFFFFu;  // Extract upper 16 bits as integer

    let angleValues: vec2f = unpack2x16float(bitcast<u32>(clusterLightData_anglesData));
    let innerVal: f32 = angleValues.x;
    let outerVal: f32 = angleValues.y;

    // decode based on flags (branch-free)
    let innerIsVersine: bool = (angleFlags & 1u) != 0u;      // bit 0: inner angle format
    let outerIsVersine: bool = ((angleFlags >> 1u) & 1u) != 0u;  // bit 1: outer angle format

    return ClusterLightSpotData(
        select(innerVal, 1.0 - innerVal, innerIsVersine),
        select(outerVal, 1.0 - outerVal, outerIsVersine)
    );
}

fn decodeClusterLightOmniAtlasViewport(lightIndex: i32) -> vec3f {
    return sampleLightTextureF(lightIndex, {CLUSTER_TEXTURE_PROJ_MAT_0}).xyz;
}

fn decodeClusterLightAreaData(lightIndex: i32) -> ClusterLightAreaData {
    return ClusterLightAreaData(
        sampleLightTextureF(lightIndex, {CLUSTER_TEXTURE_AREA_DATA_WIDTH}).xyz,
        sampleLightTextureF(lightIndex, {CLUSTER_TEXTURE_AREA_DATA_HEIGHT}).xyz
    );
}

fn decodeClusterLightProjectionMatrixData(lightIndex: i32) -> mat4x4f {
    // shadow matrix
    let m0: vec4f = sampleLightTextureF(lightIndex, {CLUSTER_TEXTURE_PROJ_MAT_0});
    let m1: vec4f = sampleLightTextureF(lightIndex, {CLUSTER_TEXTURE_PROJ_MAT_1});
    let m2: vec4f = sampleLightTextureF(lightIndex, {CLUSTER_TEXTURE_PROJ_MAT_2});
    let m3: vec4f = sampleLightTextureF(lightIndex, {CLUSTER_TEXTURE_PROJ_MAT_3});
    return mat4x4f(m0, m1, m2, m3);
}

fn decodeClusterLightShadowData(biasesData: f32) -> ClusterLightShadowData {
    // shadow biases
    let biases: vec2f = unpack2x16float(bitcast<u32>(biasesData));
    return ClusterLightShadowData(biases.x, biases.y);
}

fn decodeClusterLightCookieData() -> vec4f {

    // extract channel mask from flags
    let cookieFlags: u32 = (clusterLightData_flags >> 23u) & 0x0Fu;  // 4bits, each bit enables a channel
    let mask_uvec: vec4<u32> = vec4<u32>(cookieFlags) & vec4<u32>(1u, 2u, 4u, 8u);
    return step(vec4f(1.0), vec4f(mask_uvec)); // Normalize to 0.0 or 1.0
}

fn evaluateLight(
    light: ClusterLightData,
    worldNormal: vec3f,
    viewDir: vec3f,
    reflectionDir: vec3f,
#if defined(LIT_CLEARCOAT)
    clearcoatReflectionDir: vec3f,
#endif
    gloss: f32,
    specularity: vec3f,
    geometricNormal: vec3f,
    tbn: mat3x3f,
#if defined(LIT_IRIDESCENCE)
    iridescenceFresnel: vec3f,
#endif
    clearcoat_worldNormal: vec3f,
    clearcoat_gloss: f32,
    sheen_gloss: f32,
    iridescence_intensity: f32
) {

    var cookieAttenuation: vec3f = vec3f(1.0);
    var diffuseAttenuation: f32 = 1.0;
    var falloffAttenuation: f32 = 1.0;

    // evaluate omni part of the light
    let lightDirW: vec3f = evalOmniLight(light.position);
    let lightDirNormW: vec3f = normalize(lightDirW);

    #ifdef CLUSTER_AREALIGHTS

    // distance attenuation
    if (light.shape != {LIGHTSHAPE_PUNCTUAL}) { // area light

        // area lights
        let areaData: ClusterLightAreaData = decodeClusterLightAreaData(light.lightIndex);

        // handle light shape
        if (light.shape == {LIGHTSHAPE_RECT}) {
            calcRectLightValues(light.position, areaData.halfWidth, areaData.halfHeight);
        } else if (light.shape == {LIGHTSHAPE_DISK}) {
            calcDiskLightValues(light.position, areaData.halfWidth, areaData.halfHeight);
        } else { // sphere
            calcSphereLightValues(light.position, areaData.halfWidth, areaData.halfHeight);
        }

        falloffAttenuation = getFalloffWindow(light.range, lightDirW);

    } else

    #endif

    {   // punctual light

        if (light.falloffModeLinear) {
            falloffAttenuation = getFalloffLinear(light.range, lightDirW);
        } else {
            falloffAttenuation = getFalloffInvSquared(light.range, lightDirW);
        }
    }

    if (falloffAttenuation > 0.00001) {

        #ifdef CLUSTER_AREALIGHTS

        if (light.shape != {LIGHTSHAPE_PUNCTUAL}) { // area light

            // handle light shape
            if (light.shape == {LIGHTSHAPE_RECT}) {
                diffuseAttenuation = getRectLightDiffuse(worldNormal, viewDir, lightDirW, lightDirNormW) * 16.0;
            } else if (light.shape == {LIGHTSHAPE_DISK}) {
                diffuseAttenuation = getDiskLightDiffuse(worldNormal, viewDir, lightDirW, lightDirNormW) * 16.0;
            } else { // sphere
                diffuseAttenuation = getSphereLightDiffuse(worldNormal, viewDir, lightDirW, lightDirNormW) * 16.0;
            }

        } else

        #endif

        {
            falloffAttenuation = falloffAttenuation * getLightDiffuse(worldNormal, viewDir, lightDirNormW);
        }

        // spot light falloff
        if (light.isSpot) {
            let spotData: ClusterLightSpotData = decodeClusterLightSpot();
            falloffAttenuation = falloffAttenuation * getSpotEffect(light.direction, spotData.innerConeAngleCos, spotData.outerConeAngleCos, lightDirNormW);
        }

        #if defined(CLUSTER_COOKIES) || defined(CLUSTER_SHADOWS)

        if (falloffAttenuation > 0.00001) {

            // shadow / cookie
            if (light.shadowIntensity > 0.0 || light.cookieIntensity > 0.0) {

                var omniAtlasViewport: vec3f = vec3f(0.0);

                // shared shadow / cookie data depends on light type
                if (light.isSpot) {
                    lightProjectionMatrix = decodeClusterLightProjectionMatrixData(light.lightIndex);
                } else {
                    omniAtlasViewport = decodeClusterLightOmniAtlasViewport(light.lightIndex);
                }

                let shadowTextureResolution: f32 = uniform.shadowAtlasParams.x;
                let shadowEdgePixels: f32 = uniform.shadowAtlasParams.y;

                #ifdef CLUSTER_COOKIES

                // cookie
                if (light.cookieIntensity > 0.0) {
                    let cookieChannelMask: vec4f = decodeClusterLightCookieData();

                    if (light.isSpot) {
                        cookieAttenuation = getCookie2DClustered(cookieAtlasTexture, cookieAtlasTextureSampler, lightProjectionMatrix, vPositionW, light.cookieIntensity, cookieChannelMask);
                    } else {
                        cookieAttenuation = getCookieCubeClustered(cookieAtlasTexture, cookieAtlasTextureSampler, lightDirW, light.cookieIntensity, cookieChannelMask, shadowTextureResolution, shadowEdgePixels, omniAtlasViewport);
                    }
                }

                #endif

                #ifdef CLUSTER_SHADOWS

                // shadow
                if (light.shadowIntensity > 0.0) {
                    let shadowData: ClusterLightShadowData = decodeClusterLightShadowData(light.biasesData);

                    let shadowParams: vec4f = vec4f(shadowTextureResolution, shadowData.shadowNormalBias, shadowData.shadowBias, 1.0 / light.range);

                    if (light.isSpot) {

                        // spot shadow
                        let shadowCoord: vec3f = getShadowCoordPerspZbufferNormalOffset(lightProjectionMatrix, shadowParams, geometricNormal);

                        #if defined(CLUSTER_SHADOW_TYPE_PCF1)
                            let shadow: f32 = getShadowSpotClusteredPCF1(shadowAtlasTexture, shadowAtlasTextureSampler, shadowCoord, shadowParams);
                        #elif defined(CLUSTER_SHADOW_TYPE_PCF3)
                            let shadow: f32 = getShadowSpotClusteredPCF3(shadowAtlasTexture, shadowAtlasTextureSampler, shadowCoord, shadowParams);
                        #elif defined(CLUSTER_SHADOW_TYPE_PCF5)
                            let shadow: f32 = getShadowSpotClusteredPCF5(shadowAtlasTexture, shadowAtlasTextureSampler, shadowCoord, shadowParams);
                        #elif defined(CLUSTER_SHADOW_TYPE_PCSS)
                            let shadow: f32 = getShadowSpotClusteredPCSS(shadowAtlasTexture, shadowAtlasTextureSampler, shadowCoord, shadowParams);
                        #endif
                        falloffAttenuation = falloffAttenuation * mix(1.0, shadow, light.shadowIntensity);

                    } else {

                        // omni shadow
                        let dir: vec3f = normalOffsetPointShadow(shadowParams, light.position, lightDirW, lightDirNormW, geometricNormal);  // normalBias adjusted for distance

                        #if defined(CLUSTER_SHADOW_TYPE_PCF1)
                            let shadow: f32 = getShadowOmniClusteredPCF1(shadowAtlasTexture, shadowAtlasTextureSampler, shadowParams, omniAtlasViewport, shadowEdgePixels, dir);
                        #elif defined(CLUSTER_SHADOW_TYPE_PCF3)
                            let shadow: f32 = getShadowOmniClusteredPCF3(shadowAtlasTexture, shadowAtlasTextureSampler, shadowParams, omniAtlasViewport, shadowEdgePixels, dir);
                        #elif defined(CLUSTER_SHADOW_TYPE_PCF5)
                            let shadow: f32 = getShadowOmniClusteredPCF5(shadowAtlasTexture, shadowAtlasTextureSampler, shadowParams, omniAtlasViewport, shadowEdgePixels, dir);
                        #endif
                        falloffAttenuation = falloffAttenuation * mix(1.0, shadow, light.shadowIntensity);
                    }
                }

                #endif
            }
        }

        #endif

        // diffuse / specular / clearcoat
        #ifdef CLUSTER_AREALIGHTS

        if (light.shape != {LIGHTSHAPE_PUNCTUAL}) { // area light

            // area light diffuse
            {
                var areaDiffuse: vec3f = (diffuseAttenuation * falloffAttenuation) * light.color * cookieAttenuation;

                #if defined(LIT_SPECULAR)
                    areaDiffuse = mix(areaDiffuse, vec3f(0.0), dLTCSpecFres);
                #endif

                // area light diffuse - it does not mix diffuse lighting into specular attenuation
                dDiffuseLight = dDiffuseLight + areaDiffuse;
            }

            // specular and clear coat are material settings and get included by a define based on the material
            #ifdef LIT_SPECULAR

                // area light specular
                var areaLightSpecular: f32; // Use var because assigned in if/else

                if (light.shape == {LIGHTSHAPE_RECT}) {
                    areaLightSpecular = getRectLightSpecular(worldNormal, viewDir);
                } else if (light.shape == {LIGHTSHAPE_DISK}) {
                    areaLightSpecular = getDiskLightSpecular(worldNormal, viewDir);
                } else { // sphere
                    areaLightSpecular = getSphereLightSpecular(worldNormal, viewDir);
                }

                dSpecularLight = dSpecularLight + dLTCSpecFres * areaLightSpecular * falloffAttenuation * light.color * cookieAttenuation;

                #ifdef LIT_CLEARCOAT

                    // area light specular clear coat
                    var areaLightSpecularCC: f32; // Use var because assigned in if/else

                    if (light.shape == {LIGHTSHAPE_RECT}) {
                        areaLightSpecularCC = getRectLightSpecular(clearcoat_worldNormal, viewDir);
                    } else if (light.shape == {LIGHTSHAPE_DISK}) {
                        areaLightSpecularCC = getDiskLightSpecular(clearcoat_worldNormal, viewDir);
                    } else { // sphere
                        areaLightSpecularCC = getSphereLightSpecular(clearcoat_worldNormal, viewDir);
                    }

                    ccSpecularLight = ccSpecularLight + ccLTCSpecFres * areaLightSpecularCC * falloffAttenuation * light.color  * cookieAttenuation;

                #endif

            #endif

        } else

        #endif

        {    // punctual light

            // punctual light diffuse
            {
                var punctualDiffuse: vec3f = falloffAttenuation * light.color * cookieAttenuation;

                #if defined(CLUSTER_AREALIGHTS)
                #if defined(LIT_SPECULAR)
                    punctualDiffuse = mix(punctualDiffuse, vec3f(0.0), specularity);
                #endif
                #endif

                dDiffuseLight = dDiffuseLight + punctualDiffuse;
            }

            // specular and clear coat are material settings and get included by a define based on the material
            #ifdef LIT_SPECULAR

                let halfDir: vec3f = normalize(-lightDirNormW + viewDir);

                // specular
                #ifdef LIT_SPECULAR_FRESNEL
                    dSpecularLight = dSpecularLight +
                        getLightSpecular(halfDir, reflectionDir, worldNormal, viewDir, lightDirNormW, gloss, tbn) * falloffAttenuation * light.color * cookieAttenuation *
                        getFresnel(
                            dot(viewDir, halfDir),
                            gloss,
                            specularity
                        #if defined(LIT_IRIDESCENCE)
                            , iridescenceFresnel,
                            iridescence_intensity
                        #endif
                            );
                #else
                    dSpecularLight = dSpecularLight + getLightSpecular(halfDir, reflectionDir, worldNormal, viewDir, lightDirNormW, gloss, tbn) * falloffAttenuation * light.color * cookieAttenuation * specularity;
                #endif

                #ifdef LIT_CLEARCOAT
                    #ifdef LIT_SPECULAR_FRESNEL
                        ccSpecularLight = ccSpecularLight + getLightSpecular(halfDir, clearcoatReflectionDir, clearcoat_worldNormal, viewDir, lightDirNormW, clearcoat_gloss, tbn) * falloffAttenuation * light.color * cookieAttenuation * getFresnelCC(dot(viewDir, halfDir));
                    #else
                        ccSpecularLight = ccSpecularLight + getLightSpecular(halfDir, clearcoatReflectionDir, clearcoat_worldNormal, viewDir, lightDirNormW, clearcoat_gloss, tbn) * falloffAttenuation * light.color * cookieAttenuation;
                    #endif
                #endif

                #ifdef LIT_SHEEN
                    sSpecularLight = sSpecularLight + getLightSpecularSheen(halfDir, worldNormal, viewDir, lightDirNormW, sheen_gloss) * falloffAttenuation * light.color * cookieAttenuation;
                #endif

            #endif
        }
    }

    // Write to global attenuation values (for lightmapper)
    dAtten = falloffAttenuation;
    dLightDirNormW = lightDirNormW;
}


fn evaluateClusterLight(
    lightIndex: i32,
    worldNormal: vec3f,
    viewDir: vec3f,
    reflectionDir: vec3f,
#if defined(LIT_CLEARCOAT)
    clearcoatReflectionDir: vec3f,
#endif
    gloss: f32,
    specularity: vec3f,
    geometricNormal: vec3f,
    tbn: mat3x3f,
#if defined(LIT_IRIDESCENCE)
    iridescenceFresnel: vec3f,
#endif
    clearcoat_worldNormal: vec3f,
    clearcoat_gloss: f32,
    sheen_gloss: f32,
    iridescence_intensity: f32
) {

    // decode core light data from textures
    let clusterLightData: ClusterLightData = decodeClusterLightCore(lightIndex);

    // evaluate light if it uses accepted light mask
    #ifdef CLUSTER_MESH_DYNAMIC_LIGHTS
        let acceptLightMask: bool = clusterLightData.isDynamic;
    #else
        let acceptLightMask: bool = clusterLightData.isLightmapped;
    #endif

    if (acceptLightMask) {
        evaluateLight(
            clusterLightData,
            worldNormal,
            viewDir,
            reflectionDir,
#if defined(LIT_CLEARCOAT)
            clearcoatReflectionDir,
#endif
            gloss,
            specularity,
            geometricNormal,
            tbn,
#if defined(LIT_IRIDESCENCE)
            iridescenceFresnel,
#endif
            clearcoat_worldNormal,
            clearcoat_gloss,
            sheen_gloss,
            iridescence_intensity
        );
    }
}


fn addClusteredLights(
    worldNormal: vec3f,
    viewDir: vec3f,
    reflectionDir: vec3f,
#if defined(LIT_CLEARCOAT)
    clearcoatReflectionDir: vec3f,
#endif
    gloss: f32,
    specularity: vec3f,
    geometricNormal: vec3f,
    tbn: mat3x3f,
#if defined(LIT_IRIDESCENCE)
    iridescenceFresnel: vec3f,
#endif
    clearcoat_worldNormal: vec3f,
    clearcoat_gloss: f32,
    sheen_gloss: f32,
    iridescence_intensity: f32
) {

    // skip if no lights (index 0 is reserved for 'no light')
    if (uniform.numClusteredLights <= 1) {
        return;
    }

    // world space position to 3d integer cell cordinates in the cluster structure
    let cellCoords: vec3i = vec3i(floor((vPositionW - uniform.clusterBoundsMin) * uniform.clusterCellsCountByBoundsSize));

    // no lighting when cell coordinate is out of range
    if (!(any(cellCoords < vec3i(0)) || any(cellCoords >= uniform.clusterCellsMax))) {

        // cell index (mapping from 3d cell coordinates to linear memory)
        let cellIndex: i32 = cellCoords.x * uniform.clusterCellsDot.x + cellCoords.y * uniform.clusterCellsDot.y + cellCoords.z * uniform.clusterCellsDot.z;

        // convert cell index to uv coordinates
        let clusterV: i32 = cellIndex / uniform.clusterTextureWidth;
        let clusterU: i32 = cellIndex - clusterV * uniform.clusterTextureWidth;

        // loop over maximum number of light cells
        for (var lightCellIndex: i32 = 0; lightCellIndex < uniform.clusterMaxCells; lightCellIndex = lightCellIndex + 1) {

            // using a single channel texture with data in red channel
            let lightIndex: u32 = textureLoad(clusterWorldTexture, vec2<i32>(clusterU + lightCellIndex, clusterV), 0).r;

            if (lightIndex == 0u) {
                break;
            }

            evaluateClusterLight(
                i32(lightIndex),
                worldNormal,
                viewDir,
                reflectionDir,
#if defined(LIT_CLEARCOAT)
                clearcoatReflectionDir,
#endif
                gloss,
                specularity,
                geometricNormal,
                tbn,
#if defined(LIT_IRIDESCENCE)
                iridescenceFresnel,
#endif
                clearcoat_worldNormal,
                clearcoat_gloss,
                sheen_gloss,
                iridescence_intensity
            );
        }
    }
}`;
