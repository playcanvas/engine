uniform sampler2D clusterWorldTexture;
uniform sampler2D lightsTexture8;
uniform highp sampler2D lightsTextureFloat;

uniform float clusterPixelsPerCell;
uniform vec3 clusterCellsCountByBoundsSize;
uniform vec4 lightsTextureInvSize;
uniform vec3 clusterTextureSize;
uniform vec3 clusterBoundsMin;
uniform vec3 clusterBoundsDelta;
uniform vec3 clusterCellsDot;
uniform vec3 clusterCellsMax;
uniform vec2 clusterCompressionLimit0;

float decodeClusterFloat4(vec4 data) {
    return dot(data, vec4(1.0, 1.0 / 255.0, 1.0 / 65025.0, 1.0 / 16581375.0));
}

float decodeClusterFloat2(vec2 data) {
    return dot(data, vec2(1.0, 1.0 / 255.0));
}

void evaluateClusterLight(float lightIndex) {

    // read omni light properties
    float lightV = (lightIndex + 0.5) * lightsTextureInvSize.w;

    // shared data from 8bit texture
    vec4 lightInfo = texture2D(lightsTexture8, vec2(0.5 * lightsTextureInvSize.z, lightV));
    float lightType = lightInfo.x;
    float lightShape = lightInfo.y;
    float falloffMode = lightInfo.z;

    // colors
    vec4 colorA = texture2D(lightsTexture8, vec2(1.5 * lightsTextureInvSize.z, lightV));
    vec4 colorB = texture2D(lightsTexture8, vec2(2.5 * lightsTextureInvSize.z, lightV));
    vec3 lightColor = vec3(
        decodeClusterFloat2(colorA.xy),
        decodeClusterFloat2(colorA.zw),
        decodeClusterFloat2(colorB.xy)
    ) * clusterCompressionLimit0.y;

    // spot light cos angles
    vec4 coneAngle = texture2D(lightsTexture8, vec2(3.5 * lightsTextureInvSize.z, lightV));
    float innerConeAngleCos = decodeClusterFloat2(coneAngle.xy) * 2.0 - 1.0;
    float outerConeAngleCos = decodeClusterFloat2(coneAngle.zw) * 2.0 - 1.0;


    #ifdef CLUSTER_TEXTURE_FLOAT

        vec4 lightPosRange = texture2D(lightsTextureFloat, vec2(0.5 * lightsTextureInvSize.x, lightV));
        vec3 lightPos = lightPosRange.xyz;
        float range = lightPosRange.w;

        // spot light direction
        vec4 lightDir_Unused = texture2D(lightsTextureFloat, vec2(1.5 * lightsTextureInvSize.x, lightV));
        vec3 lightDir = lightDir_Unused.xyz;

    #else   // 8bit

        vec4 encPosX = texture2D(lightsTexture8, vec2(4.5 * lightsTextureInvSize.z, lightV));
        vec4 encPosY = texture2D(lightsTexture8, vec2(5.5 * lightsTextureInvSize.z, lightV));
        vec4 encPosZ = texture2D(lightsTexture8, vec2(6.5 * lightsTextureInvSize.z, lightV));

        vec3 lightPos = vec3(
            decodeClusterFloat4(encPosX),
            decodeClusterFloat4(encPosY),
            decodeClusterFloat4(encPosZ)
        ) * clusterBoundsDelta + clusterBoundsMin;

        vec4 encRange = texture2D(lightsTexture8, vec2(7.5 * lightsTextureInvSize.z, lightV));
        float range = decodeClusterFloat4(encRange) * clusterCompressionLimit0.x;

        // spot light direction
        vec4 encDirX = texture2D(lightsTexture8, vec2(8.5 * lightsTextureInvSize.z, lightV));
        vec4 encDirY = texture2D(lightsTexture8, vec2(9.5 * lightsTextureInvSize.z, lightV));
        vec4 encDirZ = texture2D(lightsTexture8, vec2(10.5 * lightsTextureInvSize.z, lightV));

        vec3 lightDir = vec3(
            decodeClusterFloat4(encDirX),
            decodeClusterFloat4(encDirY),
            decodeClusterFloat4(encDirZ)
        ) * 2.0 - 1.0;

    #endif

    // evaluate omni light
    getLightDirPoint(lightPos);
    dAtten = getFalloffLinear(range);
    if (dAtten > 0.00001) {

        // spot light
        if (lightType > 0.5) {
            dAtten *= getSpotEffect(lightDir, innerConeAngleCos, outerConeAngleCos);
        }

        dAtten *= getLightDiffuse();
        dDiffuseLight += dAtten * lightColor;
    }
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
