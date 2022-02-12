import { Debug } from '../core/debug.js';
import {
    FILTER_NEAREST,
    TEXTURETYPE_RGBM, TEXTURETYPE_RGBE,
    PIXELFORMAT_RGB16F, PIXELFORMAT_RGB32F, PIXELFORMAT_RGBA16F, PIXELFORMAT_RGBA32F,
    TEXTUREPROJECTION_OCTAHEDRAL, TEXTUREPROJECTION_EQUIRECT, TEXTUREPROJECTION_CUBE, TEXTUREPROJECTION_NONE
} from './constants.js';
import { Vec3 } from '../math/vec3.js';
import { random } from '../math/random.js';
import { createShaderFromCode } from './program-lib/utils.js';
import { drawQuadWithShader } from './simple-post-effect.js';
import { shaderChunks } from './program-lib/chunks/chunks.js';
import { RenderTarget } from './render-target.js';
import { GraphicsDevice } from './graphics-device.js';
import { Texture } from './texture.js';
import { DebugGraphics } from './debug-graphics.js';

/** @typedef {import('../math/vec4.js').Vec4} Vec4 */

// get a coding string for texture based on its type and pixel format.
const getCoding = (texture) => {
    switch (texture.type) {
        case TEXTURETYPE_RGBM:
            return "RGBM";
        case TEXTURETYPE_RGBE:
            return "RGBE";
        default:
            switch (texture.format) {
                case PIXELFORMAT_RGB16F:
                case PIXELFORMAT_RGB32F:
                case PIXELFORMAT_RGBA16F:
                case PIXELFORMAT_RGBA32F:
                    return "Linear";
                default:
                    return "Gamma";
            }
    }
};

const getProjectionName = (projection) => {
    // default to equirect if not specified
    if (projection === TEXTUREPROJECTION_NONE) {
        projection = TEXTUREPROJECTION_EQUIRECT;
    }
    switch (projection) {
        case TEXTUREPROJECTION_CUBE: return "Cubemap";
        case TEXTUREPROJECTION_EQUIRECT: return "Equirect";
        case TEXTUREPROJECTION_OCTAHEDRAL: return "Octahedral";
    }
};

// pack a 32bit floating point value into RGBA8
const packFloat32ToRGBA8 = (value, array, offset) => {
    if (value <= 0) {
        array[offset + 0] = 0;
        array[offset + 1] = 0;
        array[offset + 2] = 0;
        array[offset + 3] = 0;
    } else if (value >= 1.0) {
        array[offset + 0] = 255;
        array[offset + 1] = 0;
        array[offset + 2] = 0;
        array[offset + 3] = 0;
    } else {
        let encX = (1 * value) % 1;
        let encY = (255 * value) % 1;
        let encZ = (65025 * value) % 1;
        const encW = (16581375.0 * value) % 1;

        encX -= encY / 255;
        encY -= encZ / 255;
        encZ -= encW / 255;

        array[offset + 0] = Math.min(255, Math.floor(encX * 256));
        array[offset + 1] = Math.min(255, Math.floor(encY * 256));
        array[offset + 2] = Math.min(255, Math.floor(encZ * 256));
        array[offset + 3] = Math.min(255, Math.floor(encW * 256));
    }
};

// pack samples into texture-ready format
const packSamples = (samples) => {
    const numSamples = samples.length;

    const w = Math.min(numSamples, 512);
    const h = Math.ceil(numSamples / w);
    const data = new Uint8Array(w * h * 4);

    // normalize float data and pack into rgba8
    let off = 0;
    for (let i = 0; i < numSamples; ++i) {
        packFloat32ToRGBA8(samples[i * 4 + 0] * 0.5 + 0.5, data, off + 0);
        packFloat32ToRGBA8(samples[i * 4 + 1] * 0.5 + 0.5, data, off + 4);
        packFloat32ToRGBA8(samples[i * 4 + 2] * 0.5 + 0.5, data, off + 8);
        packFloat32ToRGBA8(samples[i * 4 + 3] / 8, data, off + 12);
        off += 16;
    }

    return {
        width: w,
        height: h,
        data: data
    };
};

// generate a vector on the hemisphere with constant distribution.
// function kept because it's useful for debugging
// vec3 hemisphereSampleUniform(vec2 uv) {
//     float phi = uv.y * 2.0 * PI;
//     float cosTheta = 1.0 - uv.x;
//     float sinTheta = sqrt(1.0 - cosTheta * cosTheta);
//     return vec3(cos(phi) * sinTheta, sin(phi) * sinTheta, cosTheta);
// }

// generate a vector on the hemisphere with phong reflection distribution
const hemisphereSamplePhong = (dstVec, x, y, specularPower) => {
    const phi = y * 2 * Math.PI;
    const cosTheta = Math.pow(1 - x, 1 / (specularPower + 1));
    const sinTheta = Math.sqrt(1 - cosTheta * cosTheta);
    dstVec.set(Math.cos(phi) * sinTheta, Math.sin(phi) * sinTheta, cosTheta).normalize();
};

// generate a vector on the hemisphere with lambert distribution
const hemisphereSampleLambert = (dstVec, x, y) => {
    const phi = y * 2 * Math.PI;
    const cosTheta = Math.sqrt(1 - x);
    const sinTheta = Math.sqrt(x);
    dstVec.set(Math.cos(phi) * sinTheta, Math.sin(phi) * sinTheta, cosTheta).normalize();
};

// generate a vector on the hemisphere with GGX distribution.
// a is linear roughness^2
const hemisphereSampleGGX = (dstVec, x, y, a) => {
    const phi = y * 2 * Math.PI;
    const cosTheta = Math.sqrt((1 - x) / (1 + (a * a - 1) * x));
    const sinTheta = Math.sqrt(1 - cosTheta * cosTheta);
    dstVec.set(Math.cos(phi) * sinTheta, Math.sin(phi) * sinTheta, cosTheta).normalize();
};

const D_GGX = (NoH, linearRoughness) => {
    const a = NoH * linearRoughness;
    const k = linearRoughness / (1.0 - NoH * NoH + a * a);
    return k * k * (1 / Math.PI);
};

// generate precomputed samples for phong reflections of the given power
const generatePhongSamples = (numSamples, specularPower) => {
    const H = new Vec3();
    const result = [];

    for (let i = 0; i < numSamples; ++i) {
        hemisphereSamplePhong(H, i / numSamples, random.radicalInverse(i), specularPower);
        result.push(H.x, H.y, H.z, 0);
    }

    return result;
};

// generate precomputed samples for lambert convolution
const generateLambertSamples = (numSamples, sourceTotalPixels) => {
    const pixelsPerSample = sourceTotalPixels / numSamples;

    const H = new Vec3();
    const result = [];

    for (let i = 0; i < numSamples; ++i) {
        hemisphereSampleLambert(H, i / numSamples, random.radicalInverse(i));
        const pdf = H.z / Math.PI;
        const mipLevel = 0.5 * Math.log2(pixelsPerSample / pdf);
        result.push(H.x, H.y, H.z, mipLevel);
    }

    return result;
};

// generate a table storing the number of samples required to get 'numSamples'
// valid samples for the given specularPower.
/* eslint-disable no-unused-vars */
const calculateRequiredSamplesGGX = () => {
    const countValidSamplesGGX = (numSamples, specularPower) => {
        const roughness = 1 - Math.log2(specularPower) / 11.0;
        const a = roughness * roughness;
        const H = new Vec3();
        const L = new Vec3();
        const N = new Vec3(0, 0, 1);

        let validSamples = 0;
        for (let i = 0; i < numSamples; ++i) {
            hemisphereSampleGGX(H, i / numSamples, random.radicalInverse(i), a);

            const NoH = H.z;                                    // since N is (0, 0, 1)
            L.set(H.x, H.y, H.z).mulScalar(2 * NoH).sub(N);

            validSamples += L.z > 0 ? 1 : 0;
        }

        return validSamples;
    };

    const numSamples = [1024, 128, 32, 16];
    const specularPowers = [512, 128, 32, 8, 2];

    const requiredTable = {};
    numSamples.forEach((numSamples) => {
        const table = { };
        specularPowers.forEach((specularPower) => {
            let requiredSamples = numSamples;
            while (countValidSamplesGGX(requiredSamples, specularPower) < numSamples) {
                requiredSamples++;
            }
            table[specularPower] = requiredSamples;
        });
        requiredTable[numSamples] = table;
    });

    return requiredTable;
};

// print to the console the required samples table for GGX reflection convolution
// console.log(calculateRequiredSamplesGGX());

// this is a table with pre-calculated number of samples required for GGX.
// the table is generated by calculateRequiredSamplesGGX()
// the table is organized by [numSamples][specularPower]
//
// we use a repeatable pseudo-random sequence of numbers when generating samples
// for use in prefiltering GGX reflections. however not all the random samples
// will be valid. this is because some resulting reflection vectors will be below
// the hemisphere. this is especially apparent when calculating vectors for the
// higher roughnesses. (since vectors are more wild, more of them are invalid).
// for example, specularPower 2 results in half the generated vectors being
// invalid. (meaning the GPU would spend half the time on vectors that don't
// contribute to the final result).
//
// calculating how many samples are required to generate 'n' valid samples is a
// slow operation, so this table stores the pre-calculated numbers of samples
// required for the sets of (numSamples, specularPowers) pairs we expect to
// encounter at runtime.
const requiredSamplesGGX = {
    "16": {
        "2": 26,
        "8": 20,
        "32": 17,
        "128": 16,
        "512": 16
    },
    "32": {
        "2": 53,
        "8": 40,
        "32": 34,
        "128": 32,
        "512": 32
    },
    "128": {
        "2": 214,
        "8": 163,
        "32": 139,
        "128": 130,
        "512": 128
    },
    "1024": {
        "2": 1722,
        "8": 1310,
        "32": 1114,
        "128": 1041,
        "512": 1025
    }
};

// get the number of random samples required to generate numSamples valid samples.
const getRequiredSamplesGGX = (numSamples, specularPower) => {
    const table = requiredSamplesGGX[numSamples];
    return (table && table[specularPower]) || numSamples;
};

// generate precomputed GGX samples
const generateGGXSamples = (numSamples, specularPower, sourceTotalPixels) => {
    const pixelsPerSample = sourceTotalPixels / numSamples;
    const roughness = 1 - Math.log2(specularPower) / 11.0;
    const a = roughness * roughness;
    const H = new Vec3();
    const L = new Vec3();
    const N = new Vec3(0, 0, 1);
    const result = [];

    const requiredSamples = getRequiredSamplesGGX(numSamples, specularPower);

    for (let i = 0; i < requiredSamples; ++i) {
        hemisphereSampleGGX(H, i / requiredSamples, random.radicalInverse(i), a);

        const NoH = H.z;                                    // since N is (0, 0, 1)
        L.set(H.x, H.y, H.z).mulScalar(2 * NoH).sub(N);

        if (L.z > 0) {
            const pdf = D_GGX(Math.min(1, NoH), a) / 4 + 0.001;
            const mipLevel = 0.5 * Math.log2(pixelsPerSample / pdf);
            result.push(L.x, L.y, L.z, mipLevel);
        }
    }

    while (result.length < numSamples * 4) {
        result.push(0, 0, 0, 0);
    }

    return result;
};

// pack float samples data into an rgba8 texture
const createSamplesTex = (device, name, samples) => {
    const packedSamples = packSamples(samples);
    return new Texture(device, {
        name: name,
        width: packedSamples.width,
        height: packedSamples.height,
        mipmaps: false,
        minFilter: FILTER_NEAREST,
        magFilter: FILTER_NEAREST,
        levels: [packedSamples.data]
    });
};

// simple cache storing key->value
// missFunc is called if the key is not present
class SimpleCache {
    map = new Map();

    get(key, missFunc) {
        if (!this.map.has(key)) {
            const result = missFunc();
            this.map.set(key, result);
            return result;
        }
        return this.map.get(key);
    }

    clear() {
        this.map.clear();
    }
}

// per-device cache
class DeviceCache {
    constructor() {
        this.cache = new SimpleCache();
    }

    // get the cache entry for the given device and key
    // if entry doesn't exist, missFunc will be invoked to create it
    get(device, key, missFunc) {
        return this.cache.get(device, () => {
            const cache = new SimpleCache();
            device.on('destroy', () => {
                cache.map.forEach((value, key) => {
                    value.destroy();
                });
                this.cache.map.delete(device);
            });
            return cache;
        }).get(key, missFunc);
    }

    clear() {
        this.cache.clear();
    }
}

// cache of samples. we store these separately from textures since multiple devices can use the same
// set of samples.
const samplesCache = new SimpleCache();

// cache of float sample data packed into rgba8 textures. stored per device.
const samplesTexCache = new DeviceCache();

const generateLambertSamplesTex = (device, numSamples, sourceTotalPixels) => {
    const key = `lambert-samples-${numSamples}-${sourceTotalPixels}`;

    return samplesTexCache.get(device, key, () => {
        return createSamplesTex(device, key, samplesCache.get(key, () => {
            return generateLambertSamples(numSamples, sourceTotalPixels);
        }));
    });
};

const generatePhongSamplesTex = (device, numSamples, specularPower) => {
    const key = `phong-samples-${numSamples}-${specularPower}`;

    return samplesTexCache.get(device, key, () => {
        return createSamplesTex(device, key, samplesCache.get(key, () => {
            return generatePhongSamples(numSamples, specularPower);
        }));
    });
};

const generateGGXSamplesTex = (device, numSamples, specularPower, sourceTotalPixels) => {
    const key = `ggx-samples-${numSamples}-${specularPower}-${sourceTotalPixels}`;

    return samplesTexCache.get(device, key, () => {
        return createSamplesTex(device, key, samplesCache.get(key, () => {
            return generateGGXSamples(numSamples, specularPower, sourceTotalPixels);
        }));
    });
};

const vsCode = `
attribute vec2 vertex_position;

uniform vec4 uvMod;

varying vec2 vUv0;

void main(void) {
    gl_Position = vec4(vertex_position, 0.5, 1.0);
    vUv0 = (vertex_position.xy * 0.5 + 0.5) * uvMod.xy + uvMod.zw;
}
`;

/**
 * This function reprojects textures between cubemap, equirectangular and octahedral formats. The
 * function can read and write textures with pixel data in RGBE, RGBM, linear and sRGB formats.
 * When specularPower is specified it will perform a phong-weighted convolution of the source (for
 * generating a gloss maps).
 *
 * @param {Texture} source - The source texture.
 * @param {Texture} target - The target texture.
 * @param {object} [options] - The options object.
 * @param {number} [options.specularPower] - Optional specular power. When specular power is
 * specified, the source is convolved by a phong-weighted kernel raised to the specified power.
 * Otherwise the function performs a standard resample.
 * @param {number} [options.numSamples] - Optional number of samples (default is 1024).
 * @param {number} [options.face] - Optional cubemap face to update (default is update all faces).
 * @param {string} [options.distribution] - Specify convolution distribution - 'none', 'lambert',
 * 'phong', 'ggx'. Default depends on specularPower.
 * @param {Vec4} [options.rect] - Optional viewport rectangle.
 * @param {number} [options.seamPixels] - Optional number of seam pixels to render
 */
function reprojectTexture(source, target, options = {}) {
    // maintain backwards compatibility with previous function signature
    // reprojectTexture(device, source, target, specularPower = 1, numSamples = 1024)
    if (source instanceof GraphicsDevice) {
        source = arguments[1];
        target = arguments[2];
        options = { };
        if (arguments[3] !== undefined) {
            options.specularPower = arguments[3];
        }
        if (arguments[4] !== undefined) {
            options.numSamples = arguments[4];
        }

        Debug.deprecated('please use the updated pc.reprojectTexture API.');
    }

    // table of distribution -> function name
    const funcNames = {
        'none': 'reproject',
        'lambert': 'prefilterSamplesUnweighted',
        'phong': 'prefilterSamplesUnweighted',
        'ggx': 'prefilterSamples'
    };

    // extract options
    const specularPower = options.hasOwnProperty('specularPower') ? options.specularPower : 1;
    const face = options.hasOwnProperty('face') ? options.face : null;
    const distribution = options.hasOwnProperty('distribution') ? options.distribution : (specularPower === 1) ? 'none' : 'phong';

    const processFunc = funcNames[distribution] || 'reproject';
    const decodeFunc = `decode${getCoding(source)}`;
    const encodeFunc = `encode${getCoding(target)}`;
    const sourceFunc = `sample${getProjectionName(source.projection)}`;
    const targetFunc = `getDirection${getProjectionName(target.projection)}`;
    const numSamples = options.hasOwnProperty('numSamples') ? options.numSamples : 1024;

    // generate unique shader key
    const shaderKey = `${processFunc}_${decodeFunc}_${encodeFunc}_${sourceFunc}_${targetFunc}_${numSamples}`;

    const device = source.device;

    let shader = device.programLib._cache[shaderKey];
    if (!shader) {
        const defines =
            `#define PROCESS_FUNC ${processFunc}\n` +
            `#define DECODE_FUNC ${decodeFunc}\n` +
            `#define ENCODE_FUNC ${encodeFunc}\n` +
            `#define SOURCE_FUNC ${sourceFunc}\n` +
            `#define TARGET_FUNC ${targetFunc}\n` +
            `#define NUM_SAMPLES ${numSamples}\n` +
            (device.extTextureLod ? `#define SUPPORTS_TEXLOD\n` : '');

        let extensions = '';
        if (!device.webgl2) {
            extensions = '#extension GL_OES_standard_derivatives: enable\n';
            if (device.extTextureLod) {
                extensions += '#extension GL_EXT_shader_texture_lod: enable\n\n';
            }
        }

        shader = createShaderFromCode(
            device,
            vsCode,
            `${defines}\n${shaderChunks.reprojectPS}`,
            shaderKey,
            false,
            extensions
        );
    }

    DebugGraphics.pushGpuMarker(device, "ReprojectTexture");

    const constantSource = device.scope.resolve(source.cubemap ? "sourceCube" : "sourceTex");
    constantSource.setValue(source);

    const constantParams = device.scope.resolve("params");
    const constantParams2 = device.scope.resolve("params2");

    const uvModParam = device.scope.resolve("uvMod");
    if (options?.seamPixels) {
        const p = options.seamPixels;
        const w = options.rect ? options.rect.z : target.width;
        const h = options.rect ? options.rect.w : target.height;

        const innerWidth = w - p * 2;
        const innerHeight = h - p * 2;

        uvModParam.setValue([
            (innerWidth + p * 2) / innerWidth,
            (innerHeight + p * 2) / innerHeight,
            -p / innerWidth,
            -p / innerHeight
        ]);
    } else {
        uvModParam.setValue([1, 1, 0, 0]);
    }

    const params = [
        0,
        specularPower,
        source.fixCubemapSeams ? 1.0 / source.width : 0.0,          // source seam scale
        target.fixCubemapSeams ? 1.0 / target.width : 0.0           // target seam scale
    ];

    const params2 = [
        target.width * target.height * (target.cubemap ? 6 : 1),
        source.width * source.height * (source.cubemap ? 6 : 1)
    ];

    if (processFunc.startsWith('prefilterSamples')) {
        // set or generate the pre-calculated samples data
        const sourceTotalPixels = source.width * source.height * (source.cubemap ? 6 : 1);
        const samplesTex =
            (distribution === 'ggx') ? generateGGXSamplesTex(device, numSamples, specularPower, sourceTotalPixels) :
                ((distribution === 'lambert') ? generateLambertSamplesTex(device, numSamples, sourceTotalPixels) :
                    generatePhongSamplesTex(device, numSamples, specularPower));
        device.scope.resolve("samplesTex").setValue(samplesTex);
        device.scope.resolve("samplesTexInverseSize").setValue([1.0 / samplesTex.width, 1.0 / samplesTex.height]);
    }

    for (let f = 0; f < (target.cubemap ? 6 : 1); f++) {
        if (face === null || f === face) {
            const renderTarget = new RenderTarget({
                colorBuffer: target,
                face: f,
                depth: false
            });
            params[0] = f;
            constantParams.setValue(params);
            constantParams2.setValue(params2);

            drawQuadWithShader(device, renderTarget, shader, options?.rect);

            renderTarget.destroy();
        }
    }

    DebugGraphics.popGpuMarker(device);
}

export { reprojectTexture };
