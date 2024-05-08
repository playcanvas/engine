// Attributes per vertex: position and uv
attribute vec4 aPosition;
attribute vec2 aUv0;

// model matrix of the mesh
uniform mat4 matrix_model;

// decal view-projection matrix (orthographic)
uniform mat4 matrix_decal_viewProj;

// decal projected position to fragment program
varying vec4 decalPos;

void main(void)
{
    // handle upside-down uv coordinates on WebGPU
    vec2 uv = getImageEffectUV(aUv0);

    // We render in texture space, so a position of this fragment is its uv-coordinates.
    // Change the range of uv coordinates from 0..1 to projection space -1 to 1.
    gl_Position = vec4(uv.x * 2.0 - 1.0, uv.y * 2.0 - 1.0, 0, 1.0);

    // transform the vertex position to world space and then to decal space, and pass it
    // to the fragment shader to sample the decal texture
    vec4 worldPos = matrix_model * aPosition;
    decalPos = matrix_decal_viewProj * worldPos;
}
