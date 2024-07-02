// engine built-in constant storing render target size in .xy and inverse size in .zw
uniform vec4 uScreenSize;

// reflection texture
uniform sampler2D uDiffuseMap;

vec3 gammaCorrectOutput(vec3 color) {
    return pow(color + 0.0000001, vec3(1.0 / 2.2));
}

void main(void)
{
    // sample reflection texture
    vec2 coord = gl_FragCoord.xy * uScreenSize.zw;
    coord.y = 1.0 - coord.y;
    vec4 reflection = texture2D(uDiffuseMap, coord);

    vec3 linearColor = reflection.xyz * 0.4;
    gl_FragColor.rgb = gammaCorrectOutput(linearColor);
    gl_FragColor.a = 1.0;
}
