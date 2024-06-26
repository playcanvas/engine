uniform float uTime;
varying float height;

void animate() {
    // modify center
    float heightIntensity = center.y * 0.2;
    center.x += sin(uTime * 5.0 + center.y) * 0.3 * heightIntensity;

    // output y-coordinate
    height = center.y;
}

vec4 discardVec = vec4(0.0, 0.0, 2.0, 1.0);

void main(void)
{
    // calculate splat uv
    if (!calcSplatUV()) {
        gl_Position = discardVec;
        return;
    }

    // read data
    readData();

    // animate
    animate();

    vec4 pos;
    if (!evalSplat(pos)) {
        gl_Position = discardVec;
        return;
    }

    gl_Position = pos;

    texCoord = vertex_position.xy;
    color = getColor();

    #ifndef DITHER_NONE
        id = float(splatId);
    #endif

}
