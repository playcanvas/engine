export default /* wgsl */`

attribute vertex_boneWeights: vec4f;
attribute vertex_boneIndices: vec4f;

var texture_poseMap: texture_2d<uff>;

struct BoneMatrix {
    v1: vec4f,
    v2: vec4f,
    v3: vec4f,
}

fn getBoneMatrix(width: i32, index: i32) -> BoneMatrix {

    let v = index / width;
    let u = index % width;

    var result: BoneMatrix;
    result.v1 = textureLoad(texture_poseMap, vec2i(u + 0, v), 0);
    result.v2 = textureLoad(texture_poseMap, vec2i(u + 1, v), 0);
    result.v3 = textureLoad(texture_poseMap, vec2i(u + 2, v), 0);
    return result;
}

fn getSkinMatrix(indicesFloat: vec4f, weights: vec4f) -> mat4x4f {

    let width = i32(textureDimensions(texture_poseMap).x);
    var indices = vec4i(indicesFloat + 0.5) * 3;

    let boneA = getBoneMatrix(width, indices.x);
    let boneB = getBoneMatrix(width, indices.y);
    let boneC = getBoneMatrix(width, indices.z);
    let boneD = getBoneMatrix(width, indices.w);

    // ... rest of getSkinMatrix remains the same ...
    let v1 = boneA.v1 * weights.x + boneB.v1 * weights.y + boneC.v1 * weights.z + boneD.v1 * weights.w;
    let v2 = boneA.v2 * weights.x + boneB.v2 * weights.y + boneC.v2 * weights.z + boneD.v2 * weights.w;
    let v3 = boneA.v3 * weights.x + boneB.v3 * weights.y + boneC.v3 * weights.z + boneD.v3 * weights.w;

    let one = dot(weights, vec4f(1.0, 1.0, 1.0, 1.0));

    // transpose to 4x4 matrix
    return mat4x4f(
        v1.x, v2.x, v3.x, 0,
        v1.y, v2.y, v3.y, 0,
        v1.z, v2.z, v3.z, 0,
        v1.w, v2.w, v3.w, one
    );
}
`;
