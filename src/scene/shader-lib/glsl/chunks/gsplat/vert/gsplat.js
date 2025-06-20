export default /* glsl */`
#include "gsplatCommonVS"

varying mediump vec2 gaussianUV;
varying mediump vec4 gaussianColor;

uniform sampler2D workTexture0;
uniform sampler2D workTexture1;
uniform sampler2D workTexture2;
uniform sampler2D workTexture3;

#ifndef DITHER_NONE
    varying float id;
#endif

mediump vec4 discardVec = vec4(0.0, 0.0, 2.0, 1.0);

#ifdef PREPASS_PASS
    varying float vLinearDepth;
#endif

vec2 unpack16n(vec4 packed) {
    uint aBits = uint(packed.x * 255.0) << 8u | uint(packed.y * 255.0);
    uint bBits = uint(packed.z * 255.0) << 8u | uint(packed.w * 255.0);
    return vec2(float(aBits) / 65535.0, float(bBits) / 65535.0);
}

void main(void) {
    // read gaussian details
    SplatSource source;
    if (!initSource(source)) {
        gl_Position = discardVec;
        return;
    }

    vec4 work3 = texelFetch(workTexture3, source.uv, 0);
    if (work3.w == 0.0) {
        gl_Position = discardVec;
        return;
    }

    vec2 work0 = unpack16n(texelFetch(workTexture0, source.uv, 0));
    vec2 work1 = unpack16n(texelFetch(workTexture1, source.uv, 0));
    vec2 work2 = unpack16n(texelFetch(workTexture2, source.uv, 0));

    vec3 position = vec3(work0, work1.x) * 2.0 - 1.0;
    vec2 cov0 = (vec2(work1.y, work2.x) - 0.5) * 2048.0;
    vec2 cov1 = normalize(vec2(work2.x, -work1.y)) * work2.y * 1024.0;
    vec4 clr = work3;

    // vec2 c = center.proj.ww / viewport;

    // write output
    gl_Position = vec4(position, 1.0) + vec4(vec2(cov0 * source.cornerUV.x + cov1 * source.cornerUV.y) / viewport, 0.0, 0.0);
    gaussianUV = source.cornerUV;
    gaussianColor = clr;

    #ifndef DITHER_NONE
        id = float(source.id);
    #endif

    #ifdef PREPASS_PASS
        vLinearDepth = -center.view.z;
    #endif
}
`;
