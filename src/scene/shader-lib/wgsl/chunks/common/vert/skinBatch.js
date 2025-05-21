export default /* wgsl */`
attribute vertex_boneIndices: f32;

var texture_poseMap: texture_2d<f32>;

fn getBoneMatrix(indexFloat: f32) -> mat4x4f {

    let width = i32(textureDimensions(texture_poseMap).x);
    let index: i32 = i32(indexFloat + 0.5) * 3;
    let iy: i32 = index / width;
    let ix: i32 = index % width;

    // read elements of 4x3 matrix
    let v1: vec4f = textureLoad(texture_poseMap, vec2i(ix + 0, iy), 0);
    let v2: vec4f = textureLoad(texture_poseMap, vec2i(ix + 1, iy), 0);
    let v3: vec4f = textureLoad(texture_poseMap, vec2i(ix + 2, iy), 0);

    // transpose to 4x4 matrix
    return mat4x4f(
        v1.x, v2.x, v3.x, 0,
        v1.y, v2.y, v3.y, 0,
        v1.z, v2.z, v3.z, 0,
        v1.w, v2.w, v3.w, 1.0
    );
}
`;
