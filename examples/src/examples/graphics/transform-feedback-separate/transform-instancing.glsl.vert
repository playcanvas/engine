// Custom instancing chunk. It reads the instancing buffer written by the transform feedback pass -
// the simulation state buffer is not bound here at all.

attribute vec4 aInstPosition;   // xyz = world position, w = heading (yaw)

uniform float uConeSize;

// passed to the fragment shader, which has no other knowledge of the simulation
varying vec3 vInstColor;

// all an instancing chunk has to do is implement getModelMatrix, returning the instance world matrix
mat4 getModelMatrix() {

    float yaw = aInstPosition.w;
    float s = sin(yaw);
    float c = cos(yaw);

    // colour the cone by the direction it is travelling, so the heading stored in .w is visible
    vInstColor = 0.55 + 0.45 * cos(6.28318 * (yaw / 6.28318 + vec3(0.0, 0.33, 0.67)));

    // The cone geometry points along its local +Y, so map local +Y onto the heading and pick any
    // two perpendicular axes for the rest - the cone is symmetric about its axis, so roll is free.
    // Stretch along the heading to give the cones a darting look.
    vec3 forward = vec3(s, 0.0, c) * uConeSize * 2.6;
    vec3 right = vec3(c, 0.0, -s) * uConeSize;
    vec3 up = vec3(0.0, -uConeSize, 0.0);

    return mat4(
        vec4(right, 0.0),
        vec4(forward, 0.0),
        vec4(up, 0.0),
        vec4(aInstPosition.xyz, 1.0)
    );
}
