attribute aPosition: vec3f;

// the inverse of the camera view-projection matrix
uniform uInvViewProjection: mat4x4f;

// world space position of the far plane under the pixel
varying vFarPosition: vec3f;

@vertex
fn vertexMain(input: VertexInput) -> VertexOutput {
    var output: VertexOutput;

    // a fullscreen quad, its corners at -1..1 in clip space
    let ndc = aPosition.xy * 2.0;
    let far = uniform.uInvViewProjection * vec4f(ndc, 1.0, 1.0);
    output.vFarPosition = far.xyz / far.w;

    output.position = vec4f(ndc, 0.5, 1.0);
    return output;
}
