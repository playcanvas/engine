// Converts unnormalized direction vector to a cubemap face index [0..5] and uv coordinates within the face in [0..1] range.
// Additionally offset to a tile in atlas within 3x3 subdivision is provided
vec2 getCubemapFaceCoordinates(const vec3 dir, out float faceIndex, out vec2 tileOffset)
{
    vec3 vAbs = abs(dir);
    float ma;
    vec2 uv;
    if (vAbs.z >= vAbs.x && vAbs.z >= vAbs.y) {   // front / back

        faceIndex = dir.z < 0.0 ? 5.0 : 4.0;
        ma = 0.5 / vAbs.z;
        uv = vec2(dir.z < 0.0 ? -dir.x : dir.x, -dir.y);

        tileOffset.x = 2.0;
        tileOffset.y = dir.z < 0.0 ? 1.0 : 0.0;

    } else if(vAbs.y >= vAbs.x) {  // top index 2, bottom index 3

        faceIndex = dir.y < 0.0 ? 3.0 : 2.0;
        ma = 0.5 / vAbs.y;
        uv = vec2(dir.x, dir.y < 0.0 ? -dir.z : dir.z);

        tileOffset.x = 1.0;
        tileOffset.y = dir.y < 0.0 ? 1.0 : 0.0;

    } else {    // left / right

        faceIndex = dir.x < 0.0 ? 1.0 : 0.0;
        ma = 0.5 / vAbs.x;
        uv = vec2(dir.x < 0.0 ? dir.z : -dir.z, -dir.y);

        tileOffset.x = 0.0;
        tileOffset.y = dir.x < 0.0 ? 1.0 : 0.0;

    }
    return uv * ma + 0.5;
}

// converts unnormalized direction vector to a texture coordinate for a cubemap face stored within texture atlas described by the viewport
vec2 getCubemapAtlasCoordinates(const vec3 omniAtlasViewport, float shadowEdgePixels, float shadowTextureResolution, const vec3 dir) {

    float faceIndex;
    vec2 tileOffset;
    vec2 uv = getCubemapFaceCoordinates(dir, faceIndex, tileOffset);

    // move uv coordinates inwards inside to compensate for larger fov when rendering shadow into atlas
    float atlasFaceSize = omniAtlasViewport.z;
    float tileSize = shadowTextureResolution * atlasFaceSize;
    float offset = shadowEdgePixels / tileSize;
    uv = uv * vec2(1.0 - offset * 2.0) + vec2(offset * 1.0);

    // scale uv coordinates to cube face area within the viewport
    uv *= atlasFaceSize;

    // offset into face of the atlas (3x3 grid)
    uv += tileOffset * atlasFaceSize;

    // offset into the atlas viewport
    uv += omniAtlasViewport.xy;

    return uv;
}
