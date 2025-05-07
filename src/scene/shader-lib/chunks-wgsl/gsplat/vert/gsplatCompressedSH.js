export default /* wgsl */`
#if SH_BANDS > 0

var shTexture0: texture_2d<u32>;
var shTexture1: texture_2d<u32>;
var shTexture2: texture_2d<u32>;

fn unpack8888s(bits: u32) -> vec4f {
    let unpacked_u = (vec4<u32>(bits) >> vec4<u32>(0u, 8u, 16u, 24u)) & vec4<u32>(0xffu);
    return vec4f(unpacked_u) * (8.0 / 255.0) - 4.0;
}

fn readSHData(source: ptr<function, SplatSource>, sh: ptr<function, array<vec3f, 15>>, scale: ptr<function, f32>) {
    // read the sh coefficients
    let shData0: vec4<u32> = textureLoad(shTexture0, source.uv, 0);
    let shData1: vec4<u32> = textureLoad(shTexture1, source.uv, 0);
    let shData2: vec4<u32> = textureLoad(shTexture2, source.uv, 0);

    let r0 = unpack8888s(shData0.x);
    let r1 = unpack8888s(shData0.y);
    let r2 = unpack8888s(shData0.z);
    let r3 = unpack8888s(shData0.w);

    let g0 = unpack8888s(shData1.x);
    let g1 = unpack8888s(shData1.y);
    let g2 = unpack8888s(shData1.z);
    let g3 = unpack8888s(shData1.w);

    let b0 = unpack8888s(shData2.x);
    let b1 = unpack8888s(shData2.y);
    let b2 = unpack8888s(shData2.z);
    let b3 = unpack8888s(shData2.w);

    sh[0] =  vec3f(r0.x, g0.x, b0.x);
    sh[1] =  vec3f(r0.y, g0.y, b0.y);
    sh[2] =  vec3f(r0.z, g0.z, b0.z);
    sh[3] =  vec3f(r0.w, g0.w, b0.w);
    sh[4] =  vec3f(r1.x, g1.x, b1.x);
    sh[5] =  vec3f(r1.y, g1.y, b1.y);
    sh[6] =  vec3f(r1.z, g1.z, b1.z);
    sh[7] =  vec3f(r1.w, g1.w, b1.w);
    sh[8] =  vec3f(r2.x, g2.x, b2.x);
    sh[9] =  vec3f(r2.y, g2.y, b2.y);
    sh[10] = vec3f(r2.z, g2.z, b2.z);
    sh[11] = vec3f(r2.w, g2.w, b2.w);
    sh[12] = vec3f(r3.x, g3.x, b3.x);
    sh[13] = vec3f(r3.y, g3.y, b3.y);
    sh[14] = vec3f(r3.z, g3.z, b3.z);

    *scale = 1.0;
}

#endif
`;
