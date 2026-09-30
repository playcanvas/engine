// The per mesh instance data in a storage buffer, see MeshInstanceStorage: 7 vec4 per slot, the
// model matrix followed by the normal matrix. A draw passes the slot of its mesh instance as the
// first instance, and so the instance index of a draw without instancing is the slot.
export default /* wgsl */`

var<storage, read> meshInstanceStorage: array<vec4f>;

fn getStoredModelMatrix() -> mat4x4f {
    let base = pcInstanceIndex * 7u;
    return mat4x4f(
        meshInstanceStorage[base],
        meshInstanceStorage[base + 1u],
        meshInstanceStorage[base + 2u],
        meshInstanceStorage[base + 3u]
    );
}

fn getStoredNormalMatrix() -> mat3x3f {
    let base = pcInstanceIndex * 7u;
    return mat3x3f(
        meshInstanceStorage[base + 4u].xyz,
        meshInstanceStorage[base + 5u].xyz,
        meshInstanceStorage[base + 6u].xyz
    );
}
`;
