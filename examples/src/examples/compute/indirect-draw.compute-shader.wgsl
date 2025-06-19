// Indexed draw call parameters
struct DrawIndexedIndirectArgs {
    indexCount: u32,
    instanceCount: u32,
    firstIndex: u32,
    baseVertex: i32,
    firstInstance: u32
};

// Binding 0: uniform buffer holding draw call metadata and runtime config
struct Uniforms {
    indirectMetaData: vec4i,      // .x = indexCount, .y = firstIndex, .z = baseVertex
    time: f32,                    // current time in seconds
    maxInstanceCount: u32,        // max number of instances
    indirectSlot: u32             // index into indirectDrawBuffer
};
@group(0) @binding(0) var<uniform> uniforms: Uniforms;

// Binding 1: storage buffer to write draw args
@group(0) @binding(1) var<storage, read_write> indirectDrawBuffer: array<DrawIndexedIndirectArgs>;

@compute @workgroup_size(1)
fn main(@builtin(global_invocation_id) gid: vec3u) {
    let metaData = uniforms.indirectMetaData;

    // Generate oscillating instance count using a sine wave
    let wave = abs(sin(uniforms.time));
    let visibleCount = u32(wave * f32(uniforms.maxInstanceCount));

    // generate draw call parameters based on metadata. Supply computed number of instances.
    let index = uniforms.indirectSlot;
    indirectDrawBuffer[index].indexCount = u32(metaData.x);
    indirectDrawBuffer[index].instanceCount = visibleCount;
    indirectDrawBuffer[index].firstIndex = u32(metaData.y);
    indirectDrawBuffer[index].baseVertex = metaData.z;
    indirectDrawBuffer[index].firstInstance = 0u;
}
