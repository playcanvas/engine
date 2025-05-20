// Attributes per vertex: position and uv
attribute aPosition: vec4f;
attribute aUv0: vec2f;

// model matrix of the mesh
uniform matrix_model: mat4x4f;

// decal view-projection matrix (orthographic)
uniform matrix_decal_viewProj: mat4x4f;

// decal projected position to fragment program
varying decalPos: vec4f;

@vertex
fn vertexMain(input: VertexInput) -> VertexOutput {
    var output: VertexOutput;

    // handle upside-down uv coordinates on WebGPU
    let uv = getImageEffectUV(input.aUv0);

    // We render in texture space, so a position of this fragment is its uv-coordinates.
    // Change the range of uv coordinates from 0..1 to projection space -1 to 1.
    output.position = vec4f(uv.x * 2.0 - 1.0, uv.y * 2.0 - 1.0, 0.0, 1.0);

    // transform the vertex position to world space and then to decal space, and pass it
    // to the fragment shader to sample the decal texture
    let worldPos = uniform.matrix_model * input.aPosition;
    output.decalPos = uniform.matrix_decal_viewProj * worldPos;

    return output;
}