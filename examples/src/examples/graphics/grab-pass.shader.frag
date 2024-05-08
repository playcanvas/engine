// use the special uSceneColorMap texture, which is a built-in texture containing
// a copy of the color buffer at the point of capture, inside the Depth layer.
uniform sampler2D uSceneColorMap;

// normal map providing offsets
uniform sampler2D uOffsetMap;

// roughness map
uniform sampler2D uRoughnessMap;

// tint colors
uniform vec3 tints[4];

// engine built-in constant storing render target size in .xy and inverse size in .zw
uniform vec4 uScreenSize;

varying vec2 texCoord;

void main(void)
{
    float roughness = 1.0 - texture2D(uRoughnessMap, texCoord).r;

    // sample offset texture - used to add distortion to the sampled background
    vec2 offset = texture2D(uOffsetMap, texCoord).rg;
    offset = 2.0 * offset - 1.0;

    // offset strength
    offset *= (0.2 + roughness) * 0.015;

    // get normalized uv coordinates for canvas
    vec2 grabUv = gl_FragCoord.xy * uScreenSize.zw;

    // roughness dictates which mipmap level gets used, in 0..4 range
    float mipmap = roughness * 5.0;

    // get background pixel color with distorted offset
    vec3 grabColor = texture2DLodEXT(uSceneColorMap, grabUv + offset, mipmap).rgb;

    // tint the material based on mipmap
    float tintIndex = clamp(mipmap, 0.0, 3.0);
    grabColor *= tints[int(tintIndex)];

    // brighten the refracted texture a little bit
    // brighten even more the rough parts of the glass
    gl_FragColor = vec4(grabColor * 1.1, 1.0) + roughness * 0.09;
}
