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

        EvaluateClusterLight(indices.x);

        if (indices.y <= 0.0)
            break;

        EvaluateClusterLight(indices.y);

        if (indices.z <= 0.0)
            break;

        EvaluateClusterLight(indices.z);

        if (indices.w <= 0.0)
            break;

        EvaluateClusterLight(indices.w);

        // end of the cell array
        if (lightCellIndex > clusterPixelsPerCell) {
            break;
        }
    }
}
