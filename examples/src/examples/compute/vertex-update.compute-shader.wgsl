struct ub_compute {
    count: u32,             // number of vertices
    positionOffset: u32,    // offset of the vertex positions in the vertex buffer
    normalOffset: u32,      // offset of the vertex normals in the vertex buffer
    time: f32               // time
}

// uniform buffer
@group(0) @binding(0) var<uniform> ubCompute : ub_compute;

// vertex buffer
@group(0) @binding(1) var<storage, read_write> vertices: array<f32>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_invocation_id: vec3u) {

    // vertex index - ignore if out of bounds (as they get batched into groups of 64)
    let index = global_invocation_id.x;
    if (index >= ubCompute.count) { return; }

    // read the position from the vertex buffer
    let positionOffset = ubCompute.positionOffset + index * 3;
    var position = vec3f(vertices[positionOffset], vertices[positionOffset + 1], vertices[positionOffset + 2]);

    // read normal
    let normalOffset = ubCompute.normalOffset + index * 3;
    let normal = vec3f(vertices[normalOffset], vertices[normalOffset + 1], vertices[normalOffset + 2]);

    // generate position from the normal by offsetting (0,0,0) by normal * strength
    let strength = vec3f(
        1.0 + sin(ubCompute.time + 10 * position.y) * 0.1,
        1.0 + cos(ubCompute.time + 5 * position.x) * 0.1,
        1.0 + sin(ubCompute.time + 2 * position.z) * 0.2
    );
    position = normal * strength;

    // write the position back to the vertex buffer
    vertices[positionOffset + 0] = position.x;
    vertices[positionOffset + 1] = position.y;
    vertices[positionOffset + 2] = position.z;
}
