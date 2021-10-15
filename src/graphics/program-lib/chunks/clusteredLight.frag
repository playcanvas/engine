uniform sampler2D clusterWorldTexture;
uniform sampler2D lightsTexture8;
uniform highp sampler2D lightsTextureFloat;

#ifdef CLUSTER_SHADOWS
    #ifdef GL2
        // TODO: when VSM shadow is supported, it needs to use sampler2D in webgl2
        uniform sampler2DShadow shadowAtlasTexture;
    #else
        uniform sampler2D shadowAtlasTexture;
    #endif
#endif

#ifdef CLUSTER_COOKIES
    uniform sampler2D cookieAtlasTexture;
#endif

uniform float clusterPixelsPerCell;
uniform vec3 clusterCellsCountByBoundsSize;
uniform vec4 lightsTextureInvSize;
uniform vec3 clusterTextureSize;
uniform vec3 clusterBoundsMin;
uniform vec3 clusterBoundsDelta;
uniform vec3 clusterCellsDot;
uniform vec3 clusterCellsMax;
uniform vec2 clusterCompressionLimit0;
uniform vec2 shadowAtlasParams;

// structure storing light properties of a clustered light
struct ClusterLightData {

    // v coordinate to look up the light textures
    float lightV;

    // true if spot light, false for omni light
    bool isSpot;

    // area light shape
    float shape;

    // light follow mode
    float falloffMode;

    // true if the light is shadow casting
    bool castShadows;

    // shadow bias values
    float shadowBias;
    float shadowNormalBias;

    // shadow (spot light only) / cookie projection matrix
    mat4 lightProjectionMatrix;

    // world space position
    vec3 position;

    // world space direction (spot light only)
    vec3 direction;

    // range of the light
    float range;

    // spot light inner and outer angle cosine
    float innerConeAngleCos;
    float outerConeAngleCos;

    // color
    vec3 color;

    // atlas viewport for omni light shadow and cookie (.xy is offset to the viewport slot, .z is size of the face in the atlas)
    vec3 omniAtlasViewport;

    // true if the light has a cookie texture
    bool isCookie;

    // true if cookie texture is rgb, false is using a single channel selectable by cookieChannelMask
    bool isCookieRgb;

    // invensity of the cookie
    float cookieIntensity;

    // channel mask - one of the channels has 1, the others are 0
    vec4 cookieChannelMask;
};

vec4 decodeClusterLowRange4Vec4(vec4 d0, vec4 d1, vec4 d2, vec4 d3) {
    return vec4(
        bytes2floatRange4(d0, -2.0, 2.0),
        bytes2floatRange4(d1, -2.0, 2.0),
        bytes2floatRange4(d2, -2.0, 2.0),
        bytes2floatRange4(d3, -2.0, 2.0)
    );
}

vec4 sampleLightsTexture8(const ClusterLightData clusterLightData, float index) {
    return texture2D(lightsTexture8, vec2(index * lightsTextureInvSize.z, clusterLightData.lightV));
}

vec4 sampleLightTextureF(const ClusterLightData clusterLightData, float index) {
    return texture2D(lightsTextureFloat, vec2(index * lightsTextureInvSize.x, clusterLightData.lightV));
}

void decodeClusterLightCore(inout ClusterLightData clusterLightData, float lightIndex) {

    // read omni light properties
    clusterLightData.lightV = (lightIndex + 0.5) * lightsTextureInvSize.w;

    // shared data from 8bit texture
    vec4 lightInfo = sampleLightsTexture8(clusterLightData, CLUSTER_TEXTURE_8_FLAGS);
    clusterLightData.isSpot = lightInfo.x > 0.5;
    clusterLightData.shape = lightInfo.y;
    clusterLightData.falloffMode = lightInfo.z;
    clusterLightData.castShadows = lightInfo.w > 0.5;

    // color
    vec4 colorA = sampleLightsTexture8(clusterLightData, CLUSTER_TEXTURE_8_COLOR_A);
    vec4 colorB = sampleLightsTexture8(clusterLightData, CLUSTER_TEXTURE_8_COLOR_B);
    clusterLightData.color = vec3(bytes2float2(colorA.xy), bytes2float2(colorA.zw), bytes2float2(colorB.xy)) * clusterCompressionLimit0.y;

    // isCookie
    clusterLightData.isCookie = colorB.z > 0.5;

    #ifdef CLUSTER_TEXTURE_FLOAT

        vec4 lightPosRange = sampleLightTextureF(clusterLightData, CLUSTER_TEXTURE_F_POSITION_RANGE);
        clusterLightData.position = lightPosRange.xyz;
        clusterLightData.range = lightPosRange.w;

        // spot light direction
        vec4 lightDir_Unused = sampleLightTextureF(clusterLightData, CLUSTER_TEXTURE_F_SPOT_DIRECTION);
        clusterLightData.direction = lightDir_Unused.xyz;

    #else   // 8bit

        vec4 encPosX = sampleLightsTexture8(clusterLightData, CLUSTER_TEXTURE_8_POSITION_X);
        vec4 encPosY = sampleLightsTexture8(clusterLightData, CLUSTER_TEXTURE_8_POSITION_Y);
        vec4 encPosZ = sampleLightsTexture8(clusterLightData, CLUSTER_TEXTURE_8_POSITION_Z);
        clusterLightData.position = vec3(bytes2float4(encPosX), bytes2float4(encPosY), bytes2float4(encPosZ)) * clusterBoundsDelta + clusterBoundsMin;

        vec4 encRange = sampleLightsTexture8(clusterLightData, CLUSTER_TEXTURE_8_RANGE);
        clusterLightData.range = bytes2float4(encRange) * clusterCompressionLimit0.x;

        // spot light direction
        vec4 encDirX = sampleLightsTexture8(clusterLightData, CLUSTER_TEXTURE_8_SPOT_DIRECTION_X);
        vec4 encDirY = sampleLightsTexture8(clusterLightData, CLUSTER_TEXTURE_8_SPOT_DIRECTION_Y);
        vec4 encDirZ = sampleLightsTexture8(clusterLightData, CLUSTER_TEXTURE_8_SPOT_DIRECTION_Z);
        clusterLightData.direction = vec3(bytes2float4(encDirX), bytes2float4(encDirY), bytes2float4(encDirZ)) * 2.0 - 1.0;

    #endif
}

void decodeClusterLightSpot(inout ClusterLightData clusterLightData) {

    // spot light cos angles
    vec4 coneAngle = sampleLightsTexture8(clusterLightData, CLUSTER_TEXTURE_8_SPOT_ANGLES);
    clusterLightData.innerConeAngleCos = bytes2float2(coneAngle.xy) * 2.0 - 1.0;
    clusterLightData.outerConeAngleCos = bytes2float2(coneAngle.zw) * 2.0 - 1.0;
}

void decodeClusterLightOmniAtlasViewport(inout ClusterLightData clusterLightData) {
    #ifdef CLUSTER_TEXTURE_FLOAT
        clusterLightData.omniAtlasViewport = sampleLightTextureF(clusterLightData, CLUSTER_TEXTURE_F_PROJ_MAT_0).xyz;
    #else
        vec4 viewportA = sampleLightsTexture8(clusterLightData, CLUSTER_TEXTURE_8_ATLAS_VIEWPORT_A);
        vec4 viewportB = sampleLightsTexture8(clusterLightData, CLUSTER_TEXTURE_8_ATLAS_VIEWPORT_B);
        clusterLightData.omniAtlasViewport = vec3(bytes2float2(viewportA.xy), bytes2float2(viewportA.zw), bytes2float2(viewportB.xy));
    #endif
}

void decodeClusterLightProjectionMatrixData(inout ClusterLightData clusterLightData) {
    
    // shadow matrix
    #ifdef CLUSTER_TEXTURE_FLOAT
        vec4 m0 = sampleLightTextureF(clusterLightData, CLUSTER_TEXTURE_F_PROJ_MAT_0);
        vec4 m1 = sampleLightTextureF(clusterLightData, CLUSTER_TEXTURE_F_PROJ_MAT_1);
        vec4 m2 = sampleLightTextureF(clusterLightData, CLUSTER_TEXTURE_F_PROJ_MAT_2);
        vec4 m3 = sampleLightTextureF(clusterLightData, CLUSTER_TEXTURE_F_PROJ_MAT_3);
    #else
        vec4 m00 = sampleLightsTexture8(clusterLightData, CLUSTER_TEXTURE_8_PROJ_MAT_00);
        vec4 m01 = sampleLightsTexture8(clusterLightData, CLUSTER_TEXTURE_8_PROJ_MAT_01);
        vec4 m02 = sampleLightsTexture8(clusterLightData, CLUSTER_TEXTURE_8_PROJ_MAT_02);
        vec4 m03 = sampleLightsTexture8(clusterLightData, CLUSTER_TEXTURE_8_PROJ_MAT_03);
        vec4 m0 = decodeClusterLowRange4Vec4(m00, m01, m02, m03);

        vec4 m10 = sampleLightsTexture8(clusterLightData, CLUSTER_TEXTURE_8_PROJ_MAT_10);
        vec4 m11 = sampleLightsTexture8(clusterLightData, CLUSTER_TEXTURE_8_PROJ_MAT_11);
        vec4 m12 = sampleLightsTexture8(clusterLightData, CLUSTER_TEXTURE_8_PROJ_MAT_12);
        vec4 m13 = sampleLightsTexture8(clusterLightData, CLUSTER_TEXTURE_8_PROJ_MAT_13);
        vec4 m1 = decodeClusterLowRange4Vec4(m10, m11, m12, m13);

        vec4 m20 = sampleLightsTexture8(clusterLightData, CLUSTER_TEXTURE_8_PROJ_MAT_20);
        vec4 m21 = sampleLightsTexture8(clusterLightData, CLUSTER_TEXTURE_8_PROJ_MAT_21);
        vec4 m22 = sampleLightsTexture8(clusterLightData, CLUSTER_TEXTURE_8_PROJ_MAT_22);
        vec4 m23 = sampleLightsTexture8(clusterLightData, CLUSTER_TEXTURE_8_PROJ_MAT_23);
        vec4 m2 = decodeClusterLowRange4Vec4(m20, m21, m22, m23);

        vec4 m30 = sampleLightsTexture8(clusterLightData, CLUSTER_TEXTURE_8_PROJ_MAT_30);
        vec4 m31 = sampleLightsTexture8(clusterLightData, CLUSTER_TEXTURE_8_PROJ_MAT_31);
        vec4 m32 = sampleLightsTexture8(clusterLightData, CLUSTER_TEXTURE_8_PROJ_MAT_32);
        vec4 m33 = sampleLightsTexture8(clusterLightData, CLUSTER_TEXTURE_8_PROJ_MAT_33);
        vec4 m3 = vec4(mantisaExponent2Float(m30), mantisaExponent2Float(m31), mantisaExponent2Float(m32), mantisaExponent2Float(m33));
    #endif
    
    clusterLightData.lightProjectionMatrix = mat4(m0, m1, m2, m3);
}

void decodeClusterLightShadowData(inout ClusterLightData clusterLightData) {
    
    // shadow biases
    vec4 biases = sampleLightsTexture8(clusterLightData, CLUSTER_TEXTURE_8_SHADOW_BIAS);
    clusterLightData.shadowBias = bytes2floatRange2(biases.xy, -1.0, 20.0),
    clusterLightData.shadowNormalBias = bytes2float2(biases.zw);
}

void decodeClusterLightCookieData(inout ClusterLightData clusterLightData) {

    vec4 cookieA = sampleLightsTexture8(clusterLightData, CLUSTER_TEXTURE_8_COOKIE_A);
    clusterLightData.cookieIntensity = cookieA.x;
    clusterLightData.isCookieRgb = cookieA.y > 0.5;

    clusterLightData.cookieChannelMask = sampleLightsTexture8(clusterLightData, CLUSTER_TEXTURE_8_COOKIE_B);
}

void evaluateLight(ClusterLightData light) {

    dAtten3 = vec3(1.0);

    // evaluate omni part of the light
    getLightDirPoint(light.position);
    dAtten = getFalloffLinear(light.range);
    if (dAtten > 0.00001) {

        dAtten *= getLightDiffuse();

        // spot light falloff
        if (light.isSpot == true) {
            decodeClusterLightSpot(light);
            dAtten *= getSpotEffect(light.direction, light.innerConeAngleCos, light.outerConeAngleCos);
        }

        #if defined(CLUSTER_COOKIES) || defined(CLUSTER_SHADOWS)

        if (dAtten > 0.00001) {

            // shadow / cookie
            if (light.castShadows == true || light.isCookie == true) {

                // shared shadow / cookie data depends on light type
                if (light.isSpot == true) {
                    decodeClusterLightProjectionMatrixData(light);
                } else {
                    decodeClusterLightOmniAtlasViewport(light);
                }

                float shadowTextureResolution = shadowAtlasParams.x;
                float shadowEdgePixels = shadowAtlasParams.y;

                #ifdef CLUSTER_COOKIES

                // cookie
                if (light.isCookie == true) {
                    decodeClusterLightCookieData(light);

                    if (light.isSpot == true) {
                        dAtten3 = getCookie2DClustered(cookieAtlasTexture, light.lightProjectionMatrix, vPositionW, light.cookieIntensity, light.isCookieRgb, light.cookieChannelMask);
                    } else {
                        dAtten3 = getCookieCubeClustered(cookieAtlasTexture, dLightDirW, light.cookieIntensity, light.isCookieRgb, light.cookieChannelMask, shadowTextureResolution, shadowEdgePixels, light.omniAtlasViewport);
                    }
                }

                #endif
                #ifdef CLUSTER_SHADOWS

                // shadow
                if (light.castShadows== true) {
                    decodeClusterLightShadowData(light);

                    vec4 shadowParams = vec4(shadowTextureResolution, light.shadowNormalBias, light.shadowBias, 1.0 / light.range);

                    if (light.isSpot == true) {

                        // spot shadow
                        getShadowCoordPerspZbufferNormalOffset(light.lightProjectionMatrix, shadowParams);
                        dAtten *= getShadowSpotPCF3x3(shadowAtlasTexture, shadowParams);

                    } else {

                        // omni shadow
                        normalOffsetPointShadow(shadowParams);  // normalBias adjusted for distance
                        dAtten *= getShadowOmniClusteredPCF3x3(shadowAtlasTexture, shadowParams, light.omniAtlasViewport, shadowEdgePixels, dLightDirW);
                    }
                }

                #endif
            }
        }

        #endif

        dDiffuseLight += dAtten * light.color * dAtten3;
    }
}

void evaluateClusterLight(float lightIndex) {

    // decode core light data from textures
    ClusterLightData clusterLightData;
    decodeClusterLightCore(clusterLightData, lightIndex);

    // evaluate light
    evaluateLight(clusterLightData);
}

const vec4 channelSelector[4] = vec4[4] (
    vec4(1., 0., 0., 0.),
    vec4(0., 1., 0., 0.),
    vec4(0., 0., 1., 0.),
    vec4(0., 0., 0., 1.)
);

void addClusteredLights() {
    // world space position to 3d integer cell cordinates in the cluster structure
    vec3 cellCoords = floor((vPositionW - clusterBoundsMin) * clusterCellsCountByBoundsSize);

    // no lighting when cell coordinate is out of range
    if (!(any(lessThan(cellCoords, vec3(0.0))) || any(greaterThanEqual(cellCoords, clusterCellsMax)))) {

        // cell index (mapping from 3d cell coordinates to linear memory)
        float cellIndex = dot(clusterCellsDot, cellCoords);

        // convert cell index to uv coordinates
        float clusterV = floor(cellIndex * clusterTextureSize.y);
        float clusterU = cellIndex - (clusterV * clusterTextureSize.x);
        clusterV = (clusterV + 0.5) * clusterTextureSize.z;

        // loop over maximum possible number of supported light cells
        const float maxLightCells = 256.0 / 4.0;  // 8 bit index, each stores 4 lights
        for (float lightCellIndex = 0.5; lightCellIndex < maxLightCells; lightCellIndex++) {

            vec4 lightIndices = texture2D(clusterWorldTexture, vec2(clusterTextureSize.y * (clusterU + lightCellIndex), clusterV));
            vec4 indices = lightIndices * 255.0;

            // evaluate up to 4 lights. This is written using a loop instead of manually unrolling to keep shader compile time smaller
            for (int i = 0; i < 4; i++) {
                float index = dot(channelSelector[i], indices);
                if (index <= 0.0)
                    return;

                evaluateClusterLight(index); 
            }

            // end of the cell array
            if (lightCellIndex > clusterPixelsPerCell) {
                break;
            }
        }
    }
}
