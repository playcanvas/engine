// the color of the scene behind the glass, grabbed by the Depth layer, with mipmaps
uniform sampler2D uSceneColorMap;

// the bumps of the glass, and its roughness, frosted around a clear logo
uniform sampler2D uOffsetMap;
uniform sampler2D uRoughnessMap;

// the size of the render target in .xy, and its inverse in .zw
uniform vec4 screen_size;

varying vec2 texCoord;
varying vec3 viewNormal;

void main(void)
{
    float roughness = 1.0 - texture2D(uRoughnessMap, texCoord).r;

    // the view through the glass bends at its rounded edges, and on its bumps
    vec3 normal = normalize(viewNormal);
    vec2 bumps = texture2D(uOffsetMap, texCoord).rg * 2.0 - 1.0;
    vec2 offset = -normal.xy * 0.08 + bumps * (0.2 + roughness) * 0.015;

    // the rougher the glass, the smaller and more blurred the mip level the scene is sampled from
    vec2 grabUv = gl_FragCoord.xy * screen_size.zw;
    vec3 color = texture2DLod(uSceneColorMap, grabUv + offset, roughness * 7.0).rgb;

    // the frosted glass and its edges are a little brighter
    float edge = 1.0 - abs(normal.z);
    gl_FragColor = vec4(color + roughness * 0.06 + edge * edge * 0.3, 1.0);
}
