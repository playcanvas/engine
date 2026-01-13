// Spherical Harmonics for uncompressed GSplat format
export default /* wgsl */`

#if SH_BANDS > 0

// unpack signed 11 10 11 bits
fn unpack111011s(bits: u32) -> vec3f {
    return (vec3f((vec3<u32>(bits) >> vec3<u32>(21u, 11u, 0u)) & vec3<u32>(0x7ffu, 0x3ffu, 0x7ffu)) / vec3f(2047.0, 1023.0, 2047.0)) * 2.0 - 1.0;
}

struct ScaleAndSH {
    scale: f32,
    a: vec3f,
    b: vec3f,
    c: vec3f
};

// fetch quantized spherical harmonic coefficients
fn fetchScale(t_in: vec4<u32>) -> ScaleAndSH {
    var result: ScaleAndSH;
    result.scale = bitcast<f32>(t_in.x);
    result.a = unpack111011s(t_in.y);
    result.b = unpack111011s(t_in.z);
    result.c = unpack111011s(t_in.w);
    return result;
}

struct SH {
    a: vec3f,
    b: vec3f,
    c: vec3f,
    d: vec3f
};

// fetch quantized spherical harmonic coefficients
fn fetch4(t_in: vec4<u32>) -> SH {
    var result: SH;
    result.a = unpack111011s(t_in.x);
    result.b = unpack111011s(t_in.y);
    result.c = unpack111011s(t_in.z);
    result.d = unpack111011s(t_in.w);
    return result;
}

fn fetch1(t_in: u32) -> vec3f {
    return unpack111011s(t_in);
}

#if SH_BANDS == 1
    var splatSH_1to3: texture_2d<u32>;

    fn readSHData(source: ptr<function, SplatSource>, sh: ptr<function, array<vec3f, 3>>, scale: ptr<function, f32>) {
        let result = fetchScale(textureLoad(splatSH_1to3, source.uv, 0));
        *scale = result.scale;
        sh[0] = result.a;
        sh[1] = result.b;
        sh[2] = result.c;
    }
#elif SH_BANDS == 2
    var splatSH_1to3: texture_2d<u32>;
    var splatSH_4to7: texture_2d<u32>;
    var splatSH_8to11: texture_2d<u32>;

    fn readSHData(source: ptr<function, SplatSource>, sh: ptr<function, array<vec3f, 8>>, scale: ptr<function, f32>) {
        let first: ScaleAndSH = fetchScale(textureLoad(splatSH_1to3, source.uv, 0));
        *scale = first.scale;
        sh[0] = first.a;
        sh[1] = first.b;
        sh[2] = first.c;

        let second: SH = fetch4(textureLoad(splatSH_4to7, source.uv, 0));
        sh[3] = second.a;
        sh[4] = second.b;
        sh[5] = second.c;
        sh[6] = second.d;

        sh[7] = fetch1(textureLoad(splatSH_8to11, source.uv, 0).x);
    }
#else
    var splatSH_1to3: texture_2d<u32>;
    var splatSH_4to7: texture_2d<u32>;
    var splatSH_8to11: texture_2d<u32>;
    var splatSH_12to15: texture_2d<u32>;

    fn readSHData(source: ptr<function, SplatSource>, sh: ptr<function, array<vec3f, 15>>, scale: ptr<function, f32>) {
        let first: ScaleAndSH = fetchScale(textureLoad(splatSH_1to3, source.uv, 0));
        *scale = first.scale;
        sh[0] = first.a;
        sh[1] = first.b;
        sh[2] = first.c;

        let second: SH = fetch4(textureLoad(splatSH_4to7, source.uv, 0));
        sh[3] = second.a;
        sh[4] = second.b;
        sh[5] = second.c;
        sh[6] = second.d;

        let third: SH = fetch4(textureLoad(splatSH_8to11, source.uv, 0));
        sh[7] = third.a;
        sh[8] = third.b;
        sh[9] = third.c;
        sh[10] = third.d;

        let fourth: SH = fetch4(textureLoad(splatSH_12to15, source.uv, 0));
        sh[11] = fourth.a;
        sh[12] = fourth.b;
        sh[13] = fourth.c;
        sh[14] = fourth.d;
    }
#endif

#endif
`;
