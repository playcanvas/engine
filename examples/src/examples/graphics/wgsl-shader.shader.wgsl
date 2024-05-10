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

@vertex
fn vertexMain(@location(0) position : vec4f) -> VertexOutput {
    var output : VertexOutput;
    output.position = ubView.matrix_viewProjection * (uvMesh.matrix_model * position);
    output.fragPosition = 0.5 * (position + vec4(1.0));
    return output;
}

@fragment
fn fragmentMain(input : VertexOutput) -> @location(0) vec4f {
    var color : vec3f = input.fragPosition.rgb;
    var roloc : vec3f = vec3f(1.0) - color;
    return vec4f(mix(color, roloc, uvMesh.amount), 1.0);
}
