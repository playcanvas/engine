uniform float uTime;
varying float height;

void main(void)
{
    // get splat color and alpha
    gl_FragColor = evalSplat();

    float sineValue = abs(sin(uTime * 5.0 + height));

    #ifdef CUTOUT

        // in cutout mode, remove pixels along the wave
        if (sineValue < 0.5) {
            gl_FragColor.a = 0.0;
        }

    #else

        // in non-cutout mode, add a golden tint to the wave
        vec3 gold = vec3(1.0, 0.85, 0.0);
        float blend = smoothstep(0.9, 1.0, sineValue);
        gl_FragColor.xyz = mix(gl_FragColor.xyz, gold, blend);

    #endif
}
