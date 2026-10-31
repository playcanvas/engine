
// vertex shader used to render point sprite particles

// Attributes per vertex: position
attribute vec4 aPosition;

uniform mat4   matrix_viewProjection;

// Color to fragment program
varying vec4 outColor;

void main(void)
{
    // Transform the geometry (ignore life time which is stored in .w of position)
    vec4 worldPosition = vec4(aPosition.xyz, 1);
    gl_Position = matrix_viewProjection * worldPosition;

    // point sprite size
    gl_PointSize = 2.0;

    // color depends on position of particle
    outColor = vec4(worldPosition.y * 0.25, 0.1, worldPosition.z * 0.2, 1);
}