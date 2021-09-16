uniform sampler2D clusterWorldTexture;
uniform sampler2D lightsTexture8;
uniform highp sampler2D lightsTextureFloat;

#ifdef GL2
    // TODO: when VSM shadow is supported, it needs to use sampler2D even in webgl2
    uniform sampler2DShadow shadowAtlasTexture;
#else
    uniform sampler2D shadowAtlasTexture;
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
uniform float shadowAtlasParams;

struct ClusterLightData {

    // v coordinate to look up the light textures
    float lightV;

    float type;
    float shape;
    float falloffMode;
    float castShadows;

    vec3 position;
    vec3 direction;
    float range;
    float innerConeAngleCos;
    float outerConeAngleCos;
    vec3 color;

    mat4 shadowMatrix;
};

vec4 decodeClusterLowRange4Vec4(vec4 d0, vec4 d1, vec4 d2, vec4 d3) {
    return vec4(
        bytes2floatRange4(d0, -2.0, 2.0),
        bytes2floatRange4(d1, -2.0, 2.0),
        bytes2floatRange4(d2, -2.0, 2.0),
        bytes2floatRange4(d3, -2.0, 2.0)
    );
}

void decodeClusterLightCore(inout ClusterLightData clusterLightData, float lightIndex) {

    // read omni light properties
    clusterLightData.lightV = (lightIndex + 0.5) * lightsTextureInvSize.w;

    // shared data from 8bit texture
    vec4 lightInfo = texture2D(lightsTexture8, vec2(0.5 * lightsTextureInvSize.z, clusterLightData.lightV));
    clusterLightData.type = lightInfo.x;
    clusterLightData.shape = lightInfo.y;
    clusterLightData.falloffMode = lightInfo.z;
    clusterLightData.castShadows = lightInfo.w;

    // color
    vec4 colorA = texture2D(lightsTexture8, vec2(1.5 * lightsTextureInvSize.z, clusterLightData.lightV));
    vec4 colorB = texture2D(lightsTexture8, vec2(2.5 * lightsTextureInvSize.z, clusterLightData.lightV));
    clusterLightData.color = vec3(bytes2float2(colorA.xy), bytes2float2(colorA.zw), bytes2float2(colorB.xy)) * clusterCompressionLimit0.y;

    #ifdef CLUSTER_TEXTURE_FLOAT

        vec4 lightPosRange = texture2D(lightsTextureFloat, vec2(0.5 * lightsTextureInvSize.x, clusterLightData.lightV));
        clusterLightData.position = lightPosRange.xyz;
        clusterLightData.range = lightPosRange.w;

        // spot light direction
        vec4 lightDir_Unused = texture2D(lightsTextureFloat, vec2(1.5 * lightsTextureInvSize.x, clusterLightData.lightV));
        clusterLightData.direction = lightDir_Unused.xyz;

    #else   // 8bit

        vec4 encPosX = texture2D(lightsTexture8, vec2(4.5 * lightsTextureInvSize.z, clusterLightData.lightV));
        vec4 encPosY = texture2D(lightsTexture8, vec2(5.5 * lightsTextureInvSize.z, clusterLightData.lightV));
        vec4 encPosZ = texture2D(lightsTexture8, vec2(6.5 * lightsTextureInvSize.z, clusterLightData.lightV));
        clusterLightData.position = vec3(bytes2float4(encPosX), bytes2float4(encPosY), bytes2float4(encPosZ)) * clusterBoundsDelta + clusterBoundsMin;

        vec4 encRange = texture2D(lightsTexture8, vec2(7.5 * lightsTextureInvSize.z, clusterLightData.lightV));
        clusterLightData.range = bytes2float4(encRange) * clusterCompressionLimit0.x;

        // spot light direction
        vec4 encDirX = texture2D(lightsTexture8, vec2(8.5 * lightsTextureInvSize.z, clusterLightData.lightV));
        vec4 encDirY = texture2D(lightsTexture8, vec2(9.5 * lightsTextureInvSize.z, clusterLightData.lightV));
        vec4 encDirZ = texture2D(lightsTexture8, vec2(10.5 * lightsTextureInvSize.z, clusterLightData.lightV));
        clusterLightData.direction = vec3(bytes2float4(encDirX), bytes2float4(encDirY), bytes2float4(encDirZ)) * 2.0 - 1.0;

    #endif
}

void decodeClusterLightSpot(inout ClusterLightData clusterLightData) {

    // spot light cos angles
    vec4 coneAngle = texture2D(lightsTexture8, vec2(3.5 * lightsTextureInvSize.z, clusterLightData.lightV));
    clusterLightData.innerConeAngleCos = bytes2float2(coneAngle.xy) * 2.0 - 1.0;
    clusterLightData.outerConeAngleCos = bytes2float2(coneAngle.zw) * 2.0 - 1.0;
}

void decodeClusterLightShadowMatrix(inout ClusterLightData clusterLightData) {
    #ifdef CLUSTER_TEXTURE_FLOAT
        vec4 m0 = texture2D(lightsTextureFloat, vec2(2.5 * lightsTextureInvSize.x, clusterLightData.lightV));
        vec4 m1 = texture2D(lightsTextureFloat, vec2(3.5 * lightsTextureInvSize.x, clusterLightData.lightV));
        vec4 m2 = texture2D(lightsTextureFloat, vec2(4.5 * lightsTextureInvSize.x, clusterLightData.lightV));
        vec4 m3 = texture2D(lightsTextureFloat, vec2(5.5 * lightsTextureInvSize.x, clusterLightData.lightV));
    #else
        vec4 m00 = texture2D(lightsTexture8, vec2(11.5 * lightsTextureInvSize.z, clusterLightData.lightV));
        vec4 m01 = texture2D(lightsTexture8, vec2(12.5 * lightsTextureInvSize.z, clusterLightData.lightV));
        vec4 m02 = texture2D(lightsTexture8, vec2(13.5 * lightsTextureInvSize.z, clusterLightData.lightV));
        vec4 m03 = texture2D(lightsTexture8, vec2(14.5 * lightsTextureInvSize.z, clusterLightData.lightV));
        vec4 m0 = decodeClusterLowRange4Vec4(m00, m01, m02, m03);

        vec4 m10 = texture2D(lightsTexture8, vec2(15.5 * lightsTextureInvSize.z, clusterLightData.lightV));
        vec4 m11 = texture2D(lightsTexture8, vec2(16.5 * lightsTextureInvSize.z, clusterLightData.lightV));
        vec4 m12 = texture2D(lightsTexture8, vec2(17.5 * lightsTextureInvSize.z, clusterLightData.lightV));
        vec4 m13 = texture2D(lightsTexture8, vec2(18.5 * lightsTextureInvSize.z, clusterLightData.lightV));
        vec4 m1 = decodeClusterLowRange4Vec4(m10, m11, m12, m13);

        vec4 m20 = texture2D(lightsTexture8, vec2(19.5 * lightsTextureInvSize.z, clusterLightData.lightV));
        vec4 m21 = texture2D(lightsTexture8, vec2(20.5 * lightsTextureInvSize.z, clusterLightData.lightV));
        vec4 m22 = texture2D(lightsTexture8, vec2(21.5 * lightsTextureInvSize.z, clusterLightData.lightV));
        vec4 m23 = texture2D(lightsTexture8, vec2(22.5 * lightsTextureInvSize.z, clusterLightData.lightV));
        vec4 m2 = decodeClusterLowRange4Vec4(m20, m21, m22, m23);

        vec4 m30 = texture2D(lightsTexture8, vec2(23.5 * lightsTextureInvSize.z, clusterLightData.lightV));
        vec4 m31 = texture2D(lightsTexture8, vec2(24.5 * lightsTextureInvSize.z, clusterLightData.lightV));
        vec4 m32 = texture2D(lightsTexture8, vec2(25.5 * lightsTextureInvSize.z, clusterLightData.lightV));
        vec4 m33 = texture2D(lightsTexture8, vec2(26.5 * lightsTextureInvSize.z, clusterLightData.lightV));
        vec4 m3 = vec4(mantisaExponent2Float(m30), mantisaExponent2Float(m31), mantisaExponent2Float(m32), mantisaExponent2Float(m33));
    #endif
    
    clusterLightData.shadowMatrix = mat4(m0, m1, m2, m3);
}

void evaluateLight(ClusterLightData light) {

    // evaluate omni part of the light
    getLightDirPoint(light.position);
    dAtten = getFalloffLinear(light.range);
    if (dAtten > 0.00001) {

        // spot light
        if (light.type > 0.5) {
            decodeClusterLightSpot(light);
            dAtten *= getSpotEffect(light.direction, light.innerConeAngleCos, light.outerConeAngleCos);
        }

        // shadow
        if (light.castShadows > 0.5) {
            decodeClusterLightShadowMatrix(light);

            float shadowTextureResolution = shadowAtlasParams;
            float bias1 = 0.3;
            float bias2 = 0.07;
            vec4 shadowParams = vec4(shadowTextureResolution, bias1, bias2, 1.0 / light.range);
            getShadowCoordPerspZbufferNormalOffset(light.shadowMatrix, shadowParams);
            dAtten *= getShadowSpotPCF3x3(shadowAtlasTexture, shadowParams);
        }

        dAtten *= getLightDiffuse();
        dDiffuseLight += dAtten * light.color;
    }
}

void evaluateClusterLight(float lightIndex) {

    // decode core light data from textures
    ClusterLightData clusterLightData;
    decodeClusterLightCore(clusterLightData, lightIndex);

    // evaluate light
    evaluateLight(clusterLightData);
}

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

            if (indices.x <= 0.0)
                break;

            evaluateClusterLight(indices.x);

            if (indices.y <= 0.0)
                break;

            evaluateClusterLight(indices.y);

            if (indices.z <= 0.0)
                break;

            evaluateClusterLight(indices.z);

            if (indices.w <= 0.0)
                break;

            evaluateClusterLight(indices.w);

            // end of the cell array
            if (lightCellIndex > clusterPixelsPerCell) {
                break;
            }
        }
    }
}
