// This shader requires the following #DEFINEs:
//
// PROCESS_FUNC - must be one of reproject, prefilter
// DECODE_FUNC - must be one of decodeRGBM, decodeRGBE, decodeGamma or decodeLinear
// ENCODE_FUNC - must be one of encodeRGBM, encodeRGBE, encideGamma or encodeLinear
// SOURCE_FUNC - must be one of sampleCubemap, sampleEquirect, sampleOctahedral
// TARGET_FUNC - must be one of getDirectionCubemap, getDirectionEquirect, getDirectionOctahedral
//
// When filtering:
// NUM_SAMPLES - number of samples
// NUM_SAMPLES_SQRT - sqrt of number of samples
export default /* wgsl */`

varying vUv0: vec2f;

#ifdef CUBEMAP_SOURCE
    var sourceCube: texture_cube<f32>;
    var sourceCubeSampler : sampler;
#else
    var sourceTex: texture_2d<f32>;
    var sourceTexSampler : sampler;
#endif

#ifdef USE_SAMPLES_TEX
    // samples
    var samplesTex: texture_2d<f32>;
    var samplesTexSampler : sampler;
    uniform samplesTexInverseSize: vec2f;
#endif

// params:
// x - target cubemap face 0..6
// y - target image total pixels
// z - source cubemap size
uniform params: vec3f;

fn targetFace() -> f32 { return uniform.params.x; }
fn targetTotalPixels() -> f32 { return uniform.params.y; }
fn sourceTotalPixels() -> f32 { return uniform.params.z; }

const PI: f32 = 3.141592653589793;

fn saturate(x: f32) -> f32 {
    return clamp(x, 0.0, 1.0);
}

#include "decodePS"
#include "encodePS"

//-- supported projections

fn modifySeams(dir: vec3f, scale: f32) -> vec3f {
    let adir = abs(dir);
    let M = max(max(adir.x, adir.y), adir.z);
    return dir / M * vec3f(
        select(scale, 1.0, adir.x == M),
        select(scale, 1.0, adir.y == M),
        select(scale, 1.0, adir.z == M)
    );
}

fn toSpherical(dir: vec3f) -> vec2f {
    let nonZeroXZ = any(dir.xz != vec2f(0.0, 0.0));
    return vec2f(select(0.0, atan2(dir.x, dir.z), nonZeroXZ), asin(dir.y));
}

fn fromSpherical(uv: vec2f) -> vec3f {
    return vec3f(cos(uv.y) * sin(uv.x),
                sin(uv.y),
                cos(uv.y) * cos(uv.x));
}

fn getDirectionEquirect(uv: vec2f) -> vec3f {
    return fromSpherical((vec2f(uv.x, 1.0 - uv.y) * 2.0 - 1.0) * vec2f(PI, PI * 0.5));
}

// octahedral code, based on https://jcgt.org/published/0003/02/01/
// "Survey of Efficient Representations for Independent Unit Vectors" by Cigolle, Donow, Evangelakos, Mara, McGuire, Meyer

fn signNotZero(k: f32) -> f32 {
    return select(-1.0, 1.0, k >= 0.0);
}

fn signNotZeroVec2(v: vec2f) -> vec2f {
    return vec2f(signNotZero(v.x), signNotZero(v.y));
}

// Returns a unit vector. Argument o is an octahedral vector packed via octEncode, on the [-1, +1] square
fn octDecode(o: vec2f) -> vec3f {
    var v = vec3f(o.x, 1.0 - abs(o.x) - abs(o.y), o.y);
    if (v.y < 0.0) {
        var temp: vec2f = (1.0 - abs(v.zx)) * signNotZeroVec2(v.xz);
        v = vec3f(temp.x, v.y, temp.y);
    }
    return normalize(v);
}

fn getDirectionOctahedral(uv: vec2f) -> vec3f {
    return octDecode(vec2f(uv.x, 1.0 - uv.y) * 2.0 - 1.0);
}

// Assumes that v is a unit vector. The result is an octahedral vector on the [-1, +1] square
fn octEncode(v: vec3f) -> vec2f {
    let l1norm = abs(v.x) + abs(v.y) + abs(v.z);
    var result = v.xz * (1.0 / l1norm);
    if (v.y < 0.0) {
        result = (1.0 - abs(result.yx)) * signNotZeroVec2(result.xy);
    }
    return result;
}

/////////////////////////////////////////////////////////////////////

#ifdef CUBEMAP_SOURCE
    fn sampleCubemapDir(dir: vec3f) -> vec4f {
        return textureSample(sourceCube, sourceCubeSampler, modifySeams(dir, 1.0));
    }

    fn sampleCubemapSph(sph: vec2f) -> vec4f {
        return sampleCubemapDir(fromSpherical(sph));
    }

    fn sampleCubemapDirLod(dir: vec3f, mipLevel: f32) -> vec4f {
        return textureSampleLevel(sourceCube, sourceCubeSampler, modifySeams(dir, 1.0), mipLevel);
    }

    fn sampleCubemapSphLod(sph: vec2f, mipLevel: f32) -> vec4f {
        return sampleCubemapDirLod(fromSpherical(sph), mipLevel);
    }
#else

    fn sampleEquirectSph(sph: vec2f) -> vec4f {
        let uv = sph / vec2f(PI * 2.0, PI) + 0.5;
        return textureSample(sourceTex, sourceTexSampler, vec2f(uv.x, 1.0 - uv.y));
    }

    fn sampleEquirectDir(dir: vec3f) -> vec4f {
        return sampleEquirectSph(toSpherical(dir));
    }

    fn sampleEquirectSphLod(sph: vec2f, mipLevel: f32) -> vec4f {
        let uv = sph / vec2f(PI * 2.0, PI) + 0.5;
        return textureSampleLevel(sourceTex, sourceTexSampler, vec2f(uv.x, 1.0 - uv.y), mipLevel);
    }

    fn sampleEquirectDirLod(dir: vec3f, mipLevel: f32) -> vec4f {
        return sampleEquirectSphLod(toSpherical(dir), mipLevel);
    }

    fn sampleOctahedralDir(dir: vec3f) -> vec4f {
        let uv = octEncode(dir) * 0.5 + 0.5;
        return textureSample(sourceTex, sourceTexSampler, vec2f(uv.x, 1.0 - uv.y));
    }

    fn sampleOctahedralSph(sph: vec2f) -> vec4f {
        return sampleOctahedralDir(fromSpherical(sph));
    }

    fn sampleOctahedralDirLod(dir: vec3f, mipLevel: f32) -> vec4f {
        let uv = octEncode(dir) * 0.5 + 0.5;
        return textureSampleLevel(sourceTex, sourceTexSampler, vec2f(uv.x, 1.0 - uv.y), mipLevel);
    }

    fn sampleOctahedralSphLod(sph: vec2f, mipLevel: f32) -> vec4f {
        return sampleOctahedralDirLod(fromSpherical(sph), mipLevel);
    }

#endif

fn getDirectionCubemap(uv: vec2f) -> vec3f {
    let st = uv * 2.0 - 1.0;
    let face = targetFace();

    var vec: vec3f;
    if (face == 0.0) {
        vec = vec3f(1, -st.y, -st.x);
    } else if (face == 1.0) {
        vec = vec3f(-1, -st.y, st.x);
    } else if (face == 2.0) {
        vec = vec3f(st.x, 1, st.y);
    } else if (face == 3.0) {
        vec = vec3f(st.x, -1, -st.y);
    } else if (face == 4.0) {
        vec = vec3f(st.x, -st.y, 1);
    } else {
        vec = vec3f(-st.x, -st.y, -1);
    }

    return normalize(modifySeams(vec, 1.0));
}

fn matrixFromVector(n: vec3f) -> mat3x3f {
    let a = 1.0 / (1.0 + n.z);
    let b = -n.x * n.y * a;
    let b1 = vec3f(1.0 - n.x * n.x * a, b, -n.x);
    let b2 = vec3f(b, 1.0 - n.y * n.y * a, -n.y);
    return mat3x3f(b1, b2, n);
}

fn matrixFromVectorSlow(n: vec3f) -> mat3x3f {
    let up = select(vec3f(0.0, 0.0, select(-1.0, 1.0, n.y > 0.0)), vec3f(0.0, 1.0, 0.0), abs(n.y) > 0.0000001);
    let x = normalize(cross(up, n));
    let y = cross(n, x);
    return mat3x3f(x, y, n);
}

fn reproject(uv: vec2f) -> vec4f {
    if ({NUM_SAMPLES} <= 1) {
        // single sample
        return {ENCODE_FUNC}({DECODE_FUNC}({SOURCE_FUNC}Dir({TARGET_FUNC}(uv))));
    } else {
        // multi sample
        let t = {TARGET_FUNC}(uv);
        let tu = dpdx(t);
        let tv = dpdy(t);

        var result = vec3f(0.0);
        for (var u = 0.0; u < {NUM_SAMPLES_SQRT}; u += 1.0) {
            for (var v = 0.0; v < {NUM_SAMPLES_SQRT}; v += 1.0) {
                result += {DECODE_FUNC}({SOURCE_FUNC}Dir(normalize(t +
                                                            tu * (u / {NUM_SAMPLES_SQRT} - 0.5) +
                                                            tv * (v / {NUM_SAMPLES_SQRT} - 0.5))));
            }
        }
        return {ENCODE_FUNC}(result / ({NUM_SAMPLES_SQRT} * {NUM_SAMPLES_SQRT}));
    }
}

const unpackFloat: vec4f = vec4f(1.0, 1.0 / 255.0, 1.0 / 65025.0, 1.0 / 16581375.0);

#ifdef USE_SAMPLES_TEX
    fn unpackSample(i: i32, L: ptr<function, vec3f>, mipLevel: ptr<function, f32>) {
        var u = (f32(i * 4) + 0.5) * uniform.samplesTexInverseSize.x;
        var v = (floor(u) + 0.5) * uniform.samplesTexInverseSize.y;

        var raw: vec4f;
        raw.x = dot(textureSample(samplesTex, samplesTexSampler, vec2f(u, v)), unpackFloat); u += uniform.samplesTexInverseSize.x;
        raw.y = dot(textureSample(samplesTex, samplesTexSampler, vec2f(u, v)), unpackFloat); u += uniform.samplesTexInverseSize.x;
        raw.z = dot(textureSample(samplesTex, samplesTexSampler, vec2f(u, v)), unpackFloat); u += uniform.samplesTexInverseSize.x;
        raw.w = dot(textureSample(samplesTex, samplesTexSampler, vec2f(u, v)), unpackFloat);

        *L = raw.xyz * 2.0 - 1.0;
        *mipLevel = raw.w * 8.0;
    }

    // convolve an environment given pre-generated samples
    fn prefilterSamples(uv: vec2f) -> vec4f {
        // construct vector space given target direction
        let vecSpace = matrixFromVectorSlow({TARGET_FUNC}(uv));

        var L: vec3f;
        var mipLevel: f32;

        var result = vec3f(0.0);
        var totalWeight = 0.0;
        for (var i = 0; i < {NUM_SAMPLES}; i += 1) {
            unpackSample(i, &L, &mipLevel);
            result += {DECODE_FUNC}({SOURCE_FUNC}DirLod(vecSpace * L, mipLevel)) * L.z;
            totalWeight += L.z;
        }

        return {ENCODE_FUNC}(result / totalWeight);
    }

    // unweighted version of prefilterSamples
    fn prefilterSamplesUnweighted(uv: vec2f) -> vec4f {
        // construct vector space given target direction
        let vecSpace = matrixFromVectorSlow({TARGET_FUNC}(uv));

        var L: vec3f;
        var mipLevel: f32;

        var result = vec3f(0.0);
        for (var i = 0; i < {NUM_SAMPLES}; i += 1) {
            unpackSample(i, &L, &mipLevel);
            result += {DECODE_FUNC}({SOURCE_FUNC}DirLod(vecSpace * L, mipLevel));
        }

        return {ENCODE_FUNC}(result / f32({NUM_SAMPLES}));
    }
#endif

@fragment
fn fragmentMain(input : FragmentInput) -> FragmentOutput {
    var output: FragmentOutput;
    output.color = {PROCESS_FUNC}(input.vUv0);
    return output;
}
`;
