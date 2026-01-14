// Spherical Harmonics for uncompressed GSplat format
export default /* glsl */`

#if SH_BANDS > 0

// unpack signed 11 10 11 bits
vec3 unpack111011s(uint bits) {
    return vec3((uvec3(bits) >> uvec3(21u, 11u, 0u)) & uvec3(0x7ffu, 0x3ffu, 0x7ffu)) / vec3(2047.0, 1023.0, 2047.0) * 2.0 - 1.0;
}

// fetch quantized spherical harmonic coefficients
void fetchScale(in uvec4 t, out float scale, out vec3 a, out vec3 b, out vec3 c) {
    scale = uintBitsToFloat(t.x);
    a = unpack111011s(t.y);
    b = unpack111011s(t.z);
    c = unpack111011s(t.w);
}

// fetch quantized spherical harmonic coefficients
void fetch(in uvec4 t, out vec3 a, out vec3 b, out vec3 c, out vec3 d) {
    a = unpack111011s(t.x);
    b = unpack111011s(t.y);
    c = unpack111011s(t.z);
    d = unpack111011s(t.w);
}

void fetch(in uint t, out vec3 a) {
    a = unpack111011s(t);
}

#if SH_BANDS == 1
    void readSHData(in SplatSource source, out vec3 sh[3], out float scale) {
        fetchScale(loadSplatSH_1to3(), scale, sh[0], sh[1], sh[2]);
    }
#elif SH_BANDS == 2
    void readSHData(in SplatSource source, out vec3 sh[8], out float scale) {
        fetchScale(loadSplatSH_1to3(), scale, sh[0], sh[1], sh[2]);
        fetch(loadSplatSH_4to7(), sh[3], sh[4], sh[5], sh[6]);
        fetch(loadSplatSH_8to11().x, sh[7]);
    }
#else
    void readSHData(in SplatSource source, out vec3 sh[15], out float scale) {
        fetchScale(loadSplatSH_1to3(), scale, sh[0], sh[1], sh[2]);
        fetch(loadSplatSH_4to7(), sh[3], sh[4], sh[5], sh[6]);
        fetch(loadSplatSH_8to11(), sh[7], sh[8], sh[9], sh[10]);
        fetch(loadSplatSH_12to15(), sh[11], sh[12], sh[13], sh[14]);
    }
#endif

#endif
`;
