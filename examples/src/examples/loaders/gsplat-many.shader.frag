uniform float uTime;
varying float height;

void main(void)
{
    // get splat color and alpha
    gl_FragColor = evalSplat();

    // modify it
    vec3 gold = vec3(1.0, 0.85, 0.0);
    float sineValue = abs(sin(uTime * 5.0 + height));
    float blend = smoothstep(0.9, 1.0, sineValue);
    gl_FragColor.xyz = mix(gl_FragColor.xyz, gold, blend);
}
