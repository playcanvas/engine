export default /* glsl */`
    uniform sampler2D means_l;
    uniform sampler2D means_u;
    uniform sampler2D quats;
    uniform sampler2D scales;
    uniform sampler2D sh_labels;

    uniform highp uint numSplats;

    uint packU32(vec4 v) {
        return uint(v.x * 255.0) << 24u |
               uint(v.y * 255.0) << 16u |
               uint(v.z * 255.0) << 8u |
               uint(v.w * 255.0);
    }

    uvec4 packU32(vec4 a, vec4 b, vec4 c, vec4 d) {
        return uvec4(packU32(a), packU32(b), packU32(c), packU32(d));
    }

    void main(void) {
        int w = int(textureSize(means_l, 0).x);
        ivec2 uv = ivec2(gl_FragCoord.xy);
        if (uint(uv.x + uv.y * w) >= numSplats) {
            discard;
        }

        vec3 meansLSample = texelFetch(means_l, uv, 0).xyz;
        vec3 meansUSample = texelFetch(means_u, uv, 0).xyz;
        vec4 quatsSample = texelFetch(quats, uv, 0);
        vec3 scalesSample = texelFetch(scales, uv, 0).xyz;
        vec2 shLabelsSample = texelFetch(sh_labels, uv, 0).xy;

        pcFragColor0 = packU32(
            vec4(meansLSample, shLabelsSample.x),
            vec4(meansUSample, shLabelsSample.y),
            vec4(quatsSample),
            vec4(scalesSample, 0.0)
        );
    }
`;
