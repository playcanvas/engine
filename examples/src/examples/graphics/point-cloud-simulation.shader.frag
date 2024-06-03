
precision mediump float;
varying vec4 outColor;

void main(void)
{
    // color supplied by vertex shader
    gl_FragColor = outColor;

    // Using gl_PointCoord in WebGPU fails to compile with: "unknown SPIR-V builtin: 16"
    #ifndef WEBGPU
        // make point round instead of square - make pixels outside of the circle black, using provided gl_PointCoord
        vec2 dist = gl_PointCoord.xy - vec2(0.5, 0.5);
        gl_FragColor.a = 1.0 - smoothstep(0.4, 0.5, sqrt(dot(dist, dist)));
    #endif
}