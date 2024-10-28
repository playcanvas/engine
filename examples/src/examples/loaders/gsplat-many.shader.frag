uniform float uTime;
varying float height;

void animate(inout vec4 clr) {
    float sineValue = abs(sin(uTime * 5.0 + height));

    #ifdef CUTOUT

        // in cutout mode, remove pixels along the wave
        if (sineValue < 0.5) {
            clr.a = 0.0;
        }

    #else

        // in non-cutout mode, add a golden tint to the wave
        vec3 gold = vec3(1.0, 0.85, 0.0);
        float blend = smoothstep(0.9, 1.0, sineValue);
        clr.xyz = mix(clr.xyz, gold, blend);

    #endif
}

varying mediump vec2 texCoord;
varying mediump vec4 color;

void main(void)
{
    vec4 clr = evalSplat(texCoord, color);

    animate(clr);

    gl_FragColor = clr;
}