struct ub_mesh {
    matrix_model : mat4x4f,
    amount : f32,
}

struct ub_view {
    matrix_viewProjection : mat4x4f,
}

struct VertexOutput {
    @builtin(position) position : vec4f,
    @location(0) fragPosition: vec4f,
}

@group(2) @binding(0) var<uniform> uvMesh : ub_mesh;
@group(0) @binding(0) var<uniform> ubView : ub_view;

struct VertexInput {
    @location(0) position : vec4f,
}

@vertex
fn vertexMain(input : VertexInput) -> VertexOutput {
    var output : VertexOutput;
    output.position = ubView.matrix_viewProjection * (uvMesh.matrix_model * input.position);
    output.fragPosition = 0.5 * (input.position + vec4(1.0));
    return output;
}
