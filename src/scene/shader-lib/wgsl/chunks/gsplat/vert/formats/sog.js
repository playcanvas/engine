// SOG GSplat format - reads directly from source textures (no packed texture step)
export default /* wgsl */`
// means dequantization (both V1 and V2)
uniform means_mins: vec3f;
uniform means_maxs: vec3f;

#ifndef SOG_V2
    // V1: linear min/max dequantization (no codebooks)
    uniform scales_mins: vec3f;
    uniform scales_maxs: vec3f;
    uniform sh0_mins: vec4f;
    uniform sh0_maxs: vec4f;
#endif

// SH_C0 coefficient for 0th degree spherical harmonic
const SH_C0: f32 = 0.28209479177387814;
const norm: f32 = sqrt(2.0);

#ifdef SOG_V2
    // 256x1 RGBA32F LUT (V2 and V3):
    //   .r = scales codebook, .g = sh0 codebook, .b = shN codebook, .a = opacity codebook (V3)
    fn lutScales(b: i32) -> f32  { return textureLoad(sogCodebook, vec2i(b, 0), 0).r; }
    fn lutSh0(b: i32) -> f32     { return textureLoad(sogCodebook, vec2i(b, 0), 0).g; }
    fn lutShN(b: i32) -> f32     { return textureLoad(sogCodebook, vec2i(b, 0), 0).b; }
    fn lutOpacity(b: i32) -> f32 { return textureLoad(sogCodebook, vec2i(b, 0), 0).a; }
#endif

// geometry getters are provided by gsplatWorkBufferGeometryPS when sourcing from the work buffer
#ifndef GSPLAT_WORKBUFFER_GEOMETRY

// read the model-space center of the gaussian (16-bit per-axis, low + high byte)
fn getCenter() -> vec3f {
    let l = textureLoad(means_l, splat.uv, 0).xyz;
    let u = textureLoad(means_u, splat.uv, 0).xyz;
    let n = (l + u * 256.0) / 257.0;
    let v = mix(uniform.means_mins, uniform.means_maxs, n);
    return sign(v) * (exp(abs(v)) - 1.0);
}

#ifdef SOG_V3
// decode rotation quaternion from a 24-bit exponential map, one byte in each of the means_l,
// means_u and scales alpha channels: p = (b - 128) / 127, q = (cos t, sin t * p / |p|), t = |p| * pi / 2
fn getRotation() -> vec4f {
    let b = floor(vec3f(
        textureLoad(means_l, splat.uv, 0).w,
        textureLoad(means_u, splat.uv, 0).w,
        textureLoad(scales, splat.uv, 0).w
    ) * 255.0 + 0.5);
    let p = (b - 128.0) / 127.0;
    let len = length(p);
    let t = len * 1.5707963267948966;
    let v = select(p * 1.5707963267948966, p * (sin(t) / len), len > 1e-6);
    return vec4f(cos(t), v);
}
#else
// decode rotation quaternion (3 components + 2-bit mode selecting the omitted axis)
fn getRotation() -> vec4f {
    let q = textureLoad(quats, splat.uv, 0);
    let qmode = u32(q.w * 255.0 + 0.5) - 252u;
    let abc = (q.xyz - 0.5) * norm;
    let d = sqrt(max(0.0, 1.0 - dot(abc, abc)));

    var quat: vec4f;
    if (qmode == 0u) {
        quat = vec4f(d, abc);
    } else if (qmode == 1u) {
        quat = vec4f(abc.x, d, abc.y, abc.z);
    } else if (qmode == 2u) {
        quat = vec4f(abc.x, abc.y, d, abc.z);
    } else {
        quat = vec4f(abc.x, abc.y, abc.z, d);
    }
    return quat;
}
#endif

fn getScale() -> vec3f {
    let s = textureLoad(scales, splat.uv, 0).xyz;
    var logS: vec3f;
    #ifdef SOG_V2
        let i = vec3i(s * 255.0 + 0.5);
        logS = vec3f(lutScales(i.x), lutScales(i.y), lutScales(i.z));
    #else
        logS = mix(uniform.scales_mins, uniform.scales_maxs, s);
    #endif
    return exp(logS);
}

#endif

fn getColor() -> vec4f {
    let c = textureLoad(sh0, splat.uv, 0);
    var rgb: vec3f;
    var alpha: f32;
    #ifdef SOG_V2
        let i = vec3i(c.xyz * 255.0 + 0.5);
        rgb = vec3f(lutSh0(i.x), lutSh0(i.y), lutSh0(i.z));
        #ifdef SOG_V3
            // true opacity, may exceed 1 for merged (decimated) gaussians; carried
            // through only when the renderer draws over-unity opacity (GSPLAT_OVERUNITY)
            #ifdef GSPLAT_OVERUNITY
                alpha = lutOpacity(i32(c.w * 255.0 + 0.5));
            #else
                alpha = min(lutOpacity(i32(c.w * 255.0 + 0.5)), 1.0);
            #endif
        #else
            alpha = c.w;
        #endif
    #else
        rgb = mix(uniform.sh0_mins.xyz, uniform.sh0_maxs.xyz, c.xyz);
        let logitAlpha = mix(uniform.sh0_mins.w, uniform.sh0_maxs.w, c.w);
        alpha = 1.0 / (1.0 + exp(-logitAlpha));
    #endif
    return vec4f(vec3f(0.5) + rgb * SH_C0, alpha);
}

#ifdef SOG_BLIND
// per-gaussian user data: SOG_BLIND_BYTES little-endian bytes of the blind texture
fn getBlind() -> u32 {
    let b = vec4u(textureLoad(blind, splat.uv, 0) * 255.0 + 0.5);
    var v = b.x;
    #if SOG_BLIND_BYTES > 1
        v = v | (b.y << 8u);
    #endif
    #if SOG_BLIND_BYTES > 2
        v = v | (b.z << 16u);
    #endif
    #if SOG_BLIND_BYTES > 3
        v = v | (b.w << 24u);
    #endif
    return v;
}
#endif

#include "gsplatSogSHVS"
`;
