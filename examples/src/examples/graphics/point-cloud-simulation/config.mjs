/**
 * @type {import('../../../../types.mjs').ExampleConfig}
 */
export default {
    WEBGPU_ENABLED: true,
    FILES: {
        "shader.vert": /* glsl */`
// Attributes per vertex: position
attribute vec4 aPosition;

uniform mat4   matrix_viewProjection;
uniform mat4   matrix_model;

// position of the camera
uniform vec3 view_position;

// Color to fragment program
varying vec4 outColor;

void main(void)
{
    // Transform the geometry
    mat4 modelViewProj = matrix_viewProjection * matrix_model;
    gl_Position = modelViewProj * aPosition;

    // vertex in world space
    vec4 vertexWorld = matrix_model * aPosition;

    // point sprite size depends on its distance to camera
    // WebGPU doesn't support setting gl_PointSize to anything besides a constant 1.0
    #ifndef WEBGPU
        float dist = 25.0 - length(vertexWorld.xyz - view_position);
        gl_PointSize = clamp(dist * 2.0 - 1.0, 1.0, 15.0);
    #endif

    // color depends on position of particle
    outColor = vec4(vertexWorld.y * 0.1, 0.1, vertexWorld.z * 0.1, 1.0);
}`,
        "shader.frag": /* glsl */`
precision mediump float;
varying vec4 outColor;

void main(void)
{
    // color supplied by vertex shader
    gl_FragColor = outColor;

    // Using gl_PointCoord in WebGPU fails to compile with: \"unknown SPIR-V builtin: 16\"
    #ifndef WEBGPU
        // make point round instead of square - make pixels outside of the circle black, using provided gl_PointCoord
        vec2 dist = gl_PointCoord.xy - vec2(0.5, 0.5);
        gl_FragColor.a = 1.0 - smoothstep(0.4, 0.5, sqrt(dot(dist, dist)));
    #endif
}`
    }
};
