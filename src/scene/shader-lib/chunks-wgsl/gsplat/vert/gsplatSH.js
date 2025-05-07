export default /* wgsl */`

#if SH_BANDS > 0

// unpack signed 11 10 11 bits
fn unpack111011s(bits: u32) -> vec3f {
    return (vec3f((vec3<u32>(bits) >> vec3<u32>(21u, 11u, 0u)) & vec3<u32>(0x7ffu, 0x3ffu, 0x7ffu)) / vec3f(2047.0, 1023.0, 2047.0)) * 2.0 - 1.0;
}

// fetch quantized spherical harmonic coefficients
fn fetchScale(t_in: vec4<u32>, scale: ptr<function, f32>, a: ptr<function, vec3f>, b: ptr<function, vec3f>, c: ptr<function, vec3f>) {
    *scale = bitcast<f32>(t_in.x);
    *a = unpack111011s(t_in.y);
    *b = unpack111011s(t_in.z);
    *c = unpack111011s(t_in.w);
}

// fetch quantized spherical harmonic coefficients
fn fetch4(t_in: vec4<u32>, a: ptr<function, vec3f>, b: ptr<function, vec3f>, c: ptr<function, vec3f>, d: ptr<function, vec3f>) {
    *a = unpack111011s(t_in.x);
    *b = unpack111011s(t_in.y);
    *c = unpack111011s(t_in.z);
    *d = unpack111011s(t_in.w);
}

fn fetch1(t_in: u32, a: ptr<function, vec3f>) {
    *a = unpack111011s(t_in);
}

#if SH_BANDS == 1
    var splatSH_1to3: texture_2d<u32>;

    fn readSHData(source: ptr<function, SplatSource>, sh: ptr<function, array<vec3f, 3>>, scale: ptr<function, f32>) {
        fetchScale(textureLoad(splatSH_1to3, source.uv, 0), scale, &sh[0], &sh[1], &sh[2]);
    }
#elif SH_BANDS == 2
    var splatSH_1to3: texture_2d<u32>;
    var splatSH_4to7: texture_2d<u32>;
    var splatSH_8to11: texture_2d<u32>;

    fn readSHData(source: ptr<function, SplatSource>, sh: ptr<function, array<vec3f, 8>>, scale: ptr<function, f32>) {
        fetchScale(textureLoad(splatSH_1to3, source.uv, 0), scale, &sh[0], &sh[1], &sh[2]);
        fetch4(textureLoad(splatSH_4to7, source.uv, 0), &sh[3], &sh[4], &sh[5], &sh[6]);
        fetch1(textureLoad(splatSH_8to11, source.uv, 0).x, &sh[7]);
    }
#else
    var splatSH_1to3: texture_2d<u32>;
    var splatSH_4to7: texture_2d<u32>;
    var splatSH_8to11: texture_2d<u32>;
    var splatSH_12to15: texture_2d<u32>;

    fn readSHData(source: ptr<function, SplatSource>, sh: ptr<function, array<vec3f, 15>>, scale: ptr<function, f32>) {
        fetchScale(textureLoad(splatSH_1to3, source.uv, 0), scale, &sh[0], &sh[1], &sh[2]);
        fetch4(textureLoad(splatSH_4to7, source.uv, 0), &sh[3], &sh[4], &sh[5], &sh[6]);
        fetch4(textureLoad(splatSH_8to11, source.uv, 0), &sh[7], &sh[8], &sh[9], &sh[10]);
        fetch4(textureLoad(splatSH_12to15, source.uv, 0), &sh[11], &sh[12], &sh[13], &sh[14]);
    }
#endif

#endif
`;
