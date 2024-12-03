export default /* glsl */`

#if SH_BANDS > 0

vec3 unpack111011(uint bits) {
    return vec3(
        float(bits >> 21u) / 2047.0,
        float((bits >> 11u) & 0x3ffu) / 1023.0,
        float(bits & 0x7ffu) / 2047.0
    );
}

// fetch quantized spherical harmonic coefficients
void fetchScale(in uvec4 t, out float scale, out vec3 a, out vec3 b, out vec3 c) {
    scale = uintBitsToFloat(t.x);
    a = unpack111011(t.y) * 2.0 - 1.0;
    b = unpack111011(t.z) * 2.0 - 1.0;
    c = unpack111011(t.w) * 2.0 - 1.0;
}

// fetch quantized spherical harmonic coefficients
void fetch(in uvec4 t, out vec3 a, out vec3 b, out vec3 c, out vec3 d) {
    a = unpack111011(t.x) * 2.0 - 1.0;
    b = unpack111011(t.y) * 2.0 - 1.0;
    c = unpack111011(t.z) * 2.0 - 1.0;
    d = unpack111011(t.w) * 2.0 - 1.0;
}

void fetch(in uint t, out vec3 a) {
    a = unpack111011(t) * 2.0 - 1.0;
}

#if SH_BANDS == 1
    uniform highp usampler2D splatSH_1to3;
    void readSHData(in SplatState state, out vec3 sh[3]) {
        float scale;
        fetchScale(texelFetch(splatSH_1to3, state.uv, 0), scale, sh[0], sh[1], sh[2]);
        for (int i = 0; i < 3; i++) {
            sh[i] *= scale;
        }
    }
#elif SH_BANDS == 2
    uniform highp usampler2D splatSH_1to3;
    uniform highp usampler2D splatSH_4to7;
    uniform highp usampler2D splatSH_8to11;
    void readSHData(in SplatState state, out vec3 sh[8]) {
        float scale;
        fetchScale(texelFetch(splatSH_1to3, state.uv, 0), scale, sh[0], sh[1], sh[2]);
        fetch(texelFetch(splatSH_4to7, state.uv, 0), sh[3], sh[4], sh[5], sh[6]);
        fetch(texelFetch(splatSH_8to11, state.uv, 0).x, sh[7]);
        for (int i = 0; i < 8; i++) {
            sh[i] *= scale;
        }
    }
#else
    uniform highp usampler2D splatSH_1to3;
    uniform highp usampler2D splatSH_4to7;
    uniform highp usampler2D splatSH_8to11;
    uniform highp usampler2D splatSH_12to15;
    void readSHData(in SplatState state, out vec3 sh[15]) {
        float scale;
        fetchScale(texelFetch(splatSH_1to3, state.uv, 0), scale, sh[0], sh[1], sh[2]);
        fetch(texelFetch(splatSH_4to7, state.uv, 0), sh[3], sh[4], sh[5], sh[6]);
        fetch(texelFetch(splatSH_8to11, state.uv, 0), sh[7], sh[8], sh[9], sh[10]);
        fetch(texelFetch(splatSH_12to15, state.uv, 0), sh[11], sh[12], sh[13], sh[14]);
        for (int i = 0; i < 15; i++) {
            sh[i] *= scale;
        }
    }
#endif

#endif
`;
