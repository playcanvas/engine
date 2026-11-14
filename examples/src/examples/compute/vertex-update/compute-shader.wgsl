struct ub_compute {
    count: u32,             // number of vertices
    positionOffset: u32,    // offset of the vertex positions in the vertex buffer, in floats
    normalOffset: u32,      // offset of the vertex normals in the vertex buffer, in floats
    time: f32,              // time in seconds
    amplitude: f32          // how far the waves move the surface
}

// uniform buffer
@group(0) @binding(0) var<uniform> ubCompute : ub_compute;

// vertex buffer
@group(0) @binding(1) var<storage, read_write> vertices: array<f32>;

// The point of the blob surface in the given direction from its center: a unit sphere, pushed in
// and out by a few waves traveling over it
fn surface(dir: vec3f) -> vec3f {
    let t = ubCompute.time;
    let swell = sin(dir.x * 3.0 + t * 1.1) * sin(dir.y * 2.5 + t * 1.3) * sin(dir.z * 3.0 + t * 0.9);
    let ripple = sin(dir.y * 9.0 + dir.x * 3.0 - t * 2.0) * sin(dir.z * 7.0 + t * 1.5);
    return dir * (1.0 + ubCompute.amplitude * (swell + ripple * 0.15));
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_invocation_id: vec3u) {

    // vertex index - ignore if out of bounds (as they get batched into groups of 64)
    let index = global_invocation_id.x;
    if (index >= ubCompute.count) { return; }

    // read the position from the vertex buffer. The surface only moves along the direction from
    // the center, so the direction of the position is the same every frame.
    let positionOffset = ubCompute.positionOffset + index * 3;
    let dir = normalize(vec3f(vertices[positionOffset], vertices[positionOffset + 1], vertices[positionOffset + 2]));
    let position = surface(dir);

    // the normal: the surface is sampled a small step away in two directions perpendicular to dir,
    // and the cross product of the two steps is perpendicular to the surface
    let up = select(vec3f(0.0, 1.0, 0.0), vec3f(1.0, 0.0, 0.0), abs(dir.y) > 0.9);
    let tangent = normalize(cross(up, dir));
    let bitangent = cross(dir, tangent);
    let stepT = surface(normalize(dir + tangent * 0.01)) - position;
    let stepB = surface(normalize(dir + bitangent * 0.01)) - position;
    let normal = normalize(cross(stepT, stepB));

    // write the position and the normal back to the vertex buffer
    let normalOffset = ubCompute.normalOffset + index * 3;
    for (var i = 0u; i < 3u; i++) {
        vertices[positionOffset + i] = position[i];
        vertices[normalOffset + i] = normal[i];
    }
}
