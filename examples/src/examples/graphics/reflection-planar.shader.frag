// engine built-in constant storing render target size in .xy and inverse size in .zw
uniform vec4 uScreenSize;

// reflection texture
uniform sampler2D uDiffuseMap;

void main(void)
{
    // sample reflection texture
    vec2 coord = gl_FragCoord.xy * uScreenSize.zw;
    coord.y = 1.0 - coord.y;
    vec4 reflection = texture2D(uDiffuseMap, coord);

    gl_FragColor = vec4(reflection.xyz * 0.7, 1);
}
