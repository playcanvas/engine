import decode from './decode.js';
import encode from './encode.js';

export default /* glsl */`
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

varying vec2 vUv0;

// source
#ifdef CUBEMAP_SOURCE
    uniform samplerCube sourceCube;
#else
    uniform sampler2D sourceTex;
#endif

#ifdef USE_SAMPLES_TEX
    // samples
    uniform sampler2D samplesTex;
    uniform vec2 samplesTexInverseSize;
#endif

// params:
// x - target cubemap face 0..6
// y - specular power (when prefiltering)
// z - target image total pixels
// w - source cubemap size
uniform vec4 params;

float targetFace() { return params.x; }
float specularPower() { return params.y; }
float targetTotalPixels() { return params.z; }
float sourceTotalPixels() { return params.w; }

float PI = 3.141592653589793;

float saturate(float x) {
    return clamp(x, 0.0, 1.0);
}

${decode}
${encode}

//-- supported projections

vec3 modifySeams(vec3 dir, float scale) {
    vec3 adir = abs(dir);
    float M = max(max(adir.x, adir.y), adir.z);
    return dir / M * vec3(
        adir.x == M ? 1.0 : scale,
        adir.y == M ? 1.0 : scale,
        adir.z == M ? 1.0 : scale
    );
}

vec2 toSpherical(vec3 dir) {
    return vec2(dir.xz == vec2(0.0) ? 0.0 : atan(dir.x, dir.z), asin(dir.y));
}

vec3 fromSpherical(vec2 uv) {
    return vec3(cos(uv.y) * sin(uv.x),
                sin(uv.y),
                cos(uv.y) * cos(uv.x));
}

vec3 getDirectionEquirect() {
    return fromSpherical((vec2(vUv0.x, 1.0 - vUv0.y) * 2.0 - 1.0) * vec2(PI, PI * 0.5));
}

// octahedral code, based on https://jcgt.org/published/0003/02/01/
// "Survey of Efficient Representations for Independent Unit Vectors" by Cigolle, Donow, Evangelakos, Mara, McGuire, Meyer

float signNotZero(float k){
    return(k >= 0.0) ? 1.0 : -1.0;
}

vec2 signNotZero(vec2 v) {
    return vec2(signNotZero(v.x), signNotZero(v.y));
}

// Returns a unit vector. Argument o is an octahedral vector packed via octEncode, on the [-1, +1] square
vec3 octDecode(vec2 o) {
    vec3 v = vec3(o.x, 1.0 - abs(o.x) - abs(o.y), o.y);
    if (v.y < 0.0) {
        v.xz = (1.0 - abs(v.zx)) * signNotZero(v.xz);
    }
    return normalize(v);
}

vec3 getDirectionOctahedral() {
    return octDecode(vec2(vUv0.x, 1.0 - vUv0.y) * 2.0 - 1.0);
}

// Assumes that v is a unit vector. The result is an octahedral vector on the [-1, +1] square
vec2 octEncode(in vec3 v) {
    float l1norm = abs(v.x) + abs(v.y) + abs(v.z);
    vec2 result = v.xz * (1.0 / l1norm);
    if (v.y < 0.0) {
        result = (1.0 - abs(result.yx)) * signNotZero(result.xy);
    }
    return result;
}

/////////////////////////////////////////////////////////////////////

#ifdef CUBEMAP_SOURCE
    vec4 sampleCubemap(vec3 dir) {
        return textureCube(sourceCube, modifySeams(dir, 1.0));
    }

    vec4 sampleCubemap(vec2 sph) {
    return sampleCubemap(fromSpherical(sph));
}

    vec4 sampleCubemap(vec3 dir, float mipLevel) {
        return textureCubeLodEXT(sourceCube, modifySeams(dir, 1.0), mipLevel);
    }

    vec4 sampleCubemap(vec2 sph, float mipLevel) {
        return sampleCubemap(fromSpherical(sph), mipLevel);
    }
#else

    vec4 sampleEquirect(vec2 sph) {
        vec2 uv = sph / vec2(PI * 2.0, PI) + 0.5;
        return texture2D(sourceTex, vec2(uv.x, 1.0 - uv.y));
    }

    vec4 sampleEquirect(vec3 dir) {
        return sampleEquirect(toSpherical(dir));
    }

    vec4 sampleEquirect(vec2 sph, float mipLevel) {
        vec2 uv = sph / vec2(PI * 2.0, PI) + 0.5;
        return texture2DLodEXT(sourceTex, vec2(uv.x, 1.0 - uv.y), mipLevel);
    }

    vec4 sampleEquirect(vec3 dir, float mipLevel) {
        return sampleEquirect(toSpherical(dir), mipLevel);
    }

    vec4 sampleOctahedral(vec3 dir) {
        vec2 uv = octEncode(dir) * 0.5 + 0.5;
        return texture2D(sourceTex, vec2(uv.x, 1.0 - uv.y));
    }

    vec4 sampleOctahedral(vec2 sph) {
        return sampleOctahedral(fromSpherical(sph));
    }

    vec4 sampleOctahedral(vec3 dir, float mipLevel) {
        vec2 uv = octEncode(dir) * 0.5 + 0.5;
        return texture2DLodEXT(sourceTex, vec2(uv.x, 1.0 - uv.y), mipLevel);
    }

    vec4 sampleOctahedral(vec2 sph, float mipLevel) {
        return sampleOctahedral(fromSpherical(sph), mipLevel);
    }

#endif

vec3 getDirectionCubemap() {
    vec2 st = vUv0 * 2.0 - 1.0;
    float face = targetFace();

    vec3 vec;
    if (face == 0.0) {
        vec = vec3(1, -st.y, -st.x);
    } else if (face == 1.0) {
        vec = vec3(-1, -st.y, st.x);
    } else if (face == 2.0) {
        vec = vec3(st.x, 1, st.y);
    } else if (face == 3.0) {
        vec = vec3(st.x, -1, -st.y);
    } else if (face == 4.0) {
        vec = vec3(st.x, -st.y, 1);
    } else {
        vec = vec3(-st.x, -st.y, -1);
    }

    return normalize(modifySeams(vec, 1.0));
}

mat3 matrixFromVector(vec3 n) { // frisvad
    float a = 1.0 / (1.0 + n.z);
    float b = -n.x * n.y * a;
    vec3 b1 = vec3(1.0 - n.x * n.x * a, b, -n.x);
    vec3 b2 = vec3(b, 1.0 - n.y * n.y * a, -n.y);
    return mat3(b1, b2, n);
}

mat3 matrixFromVectorSlow(vec3 n) {
    vec3 up = (1.0 - abs(n.y) <= 0.0000001) ? vec3(0.0, 0.0, n.y > 0.0 ? 1.0 : -1.0) : vec3(0.0, 1.0, 0.0);
    vec3 x = normalize(cross(up, n));
    vec3 y = cross(n, x);
    return mat3(x, y, n);
}

vec4 reproject() {
    if (NUM_SAMPLES <= 1) {
        // single sample
        return ENCODE_FUNC(DECODE_FUNC(SOURCE_FUNC(TARGET_FUNC())));
    } else {
        // multi sample
        vec3 t = TARGET_FUNC();
        vec3 tu = dFdx(t);
        vec3 tv = dFdy(t);

        vec3 result = vec3(0.0);
        for (float u = 0.0; u < NUM_SAMPLES_SQRT; ++u) {
            for (float v = 0.0; v < NUM_SAMPLES_SQRT; ++v) {
                result += DECODE_FUNC(SOURCE_FUNC(normalize(t +
                                                            tu * (u / NUM_SAMPLES_SQRT - 0.5) +
                                                            tv * (v / NUM_SAMPLES_SQRT - 0.5))));
            }
        }
        return ENCODE_FUNC(result / (NUM_SAMPLES_SQRT * NUM_SAMPLES_SQRT));
    }
}

vec4 unpackFloat = vec4(1.0, 1.0 / 255.0, 1.0 / 65025.0, 1.0 / 16581375.0);

#ifdef USE_SAMPLES_TEX
    void unpackSample(int i, out vec3 L, out float mipLevel) {
        float u = (float(i * 4) + 0.5) * samplesTexInverseSize.x;
        float v = (floor(u) + 0.5) * samplesTexInverseSize.y;

        vec4 raw;
        raw.x = dot(texture2D(samplesTex, vec2(u, v)), unpackFloat); u += samplesTexInverseSize.x;
        raw.y = dot(texture2D(samplesTex, vec2(u, v)), unpackFloat); u += samplesTexInverseSize.x;
        raw.z = dot(texture2D(samplesTex, vec2(u, v)), unpackFloat); u += samplesTexInverseSize.x;
        raw.w = dot(texture2D(samplesTex, vec2(u, v)), unpackFloat);

        L.xyz = raw.xyz * 2.0 - 1.0;
        mipLevel = raw.w * 8.0;
    }

    // convolve an environment given pre-generated samples
    vec4 prefilterSamples() {
        // construct vector space given target direction
        mat3 vecSpace = matrixFromVectorSlow(TARGET_FUNC());

        vec3 L;
        float mipLevel;

        vec3 result = vec3(0.0);
        float totalWeight = 0.0;
        for (int i = 0; i < NUM_SAMPLES; ++i) {
            unpackSample(i, L, mipLevel);
            result += DECODE_FUNC(SOURCE_FUNC(vecSpace * L, mipLevel)) * L.z;
            totalWeight += L.z;
        }

        return ENCODE_FUNC(result / totalWeight);
    }

    // unweighted version of prefilterSamples
    vec4 prefilterSamplesUnweighted() {
        // construct vector space given target direction
        mat3 vecSpace = matrixFromVectorSlow(TARGET_FUNC());

        vec3 L;
        float mipLevel;

        vec3 result = vec3(0.0);
        float totalWeight = 0.0;
        for (int i = 0; i < NUM_SAMPLES; ++i) {
            unpackSample(i, L, mipLevel);
            result += DECODE_FUNC(SOURCE_FUNC(vecSpace * L, mipLevel));
        }

        return ENCODE_FUNC(result / float(NUM_SAMPLES));
    }
#endif

void main(void) {
    gl_FragColor = PROCESS_FUNC();
}
`;
