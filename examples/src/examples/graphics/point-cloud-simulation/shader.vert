
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
}