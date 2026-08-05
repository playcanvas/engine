import { GSplatFormat, GSplatResourceBase, Http, PIXELFORMAT_RGBA8, PIXELFORMAT_RGBA32U, Vec3, WasmModule } from 'playcanvas';

/**
 * @import { AppBase, BoundingBox, GraphicsDevice } from 'playcanvas'
 */

/**
 * A parser for the SPZ gaussian splat format (https://github.com/nianticlabs/spz), version 4.
 *
 * The splat data stays in its quantized form on the GPU (roughly 20 bytes per splat plus
 * spherical harmonics), and is dequantized in the shader, similar to how the compressed PLY and
 * SOG formats are handled by the engine.
 *
 * SPZ v4 attribute streams are ZSTD compressed. The parser uses a ZSTD wasm module which the
 * application needs to register before loading spz assets, in the same way the Draco module is
 * registered:
 *
 * ```javascript
 * import { WasmModule } from 'playcanvas';
 *
 * WasmModule.setConfig('ZstdDecoderModule', {
 *     glueUrl: 'zstd.wasm.js',
 *     wasmUrl: 'zstd.wasm.wasm'
 * });
 * ```
 *
 * To use, register the parser with the gsplat resource handler:
 *
 * ```javascript
 * app.loader.getHandler('gsplat').addParser(new SpzParser(app));
 * ```
 *
 * and then load spz files as gsplat assets:
 *
 * ```javascript
 * import { Asset } from 'playcanvas';
 *
 * const asset = new Asset('gsplat', 'gsplat', { url: 'scene.spz' });
 * app.assets.add(asset);
 * app.assets.load(asset);
 * ```
 */

// SPZ v4 file header constants
const NGSP_MAGIC = 0x5053474e;
const FLAG_ANTIALIASED = 0x1;
const FLAG_HAS_EXTENSIONS = 0x2;

// number of SH coefficients per channel for each SH degree
const SH_DIM_FOR_DEGREE = [0, 3, 8, 15, 24];

// GLSL shader code for reading the quantized splat data. Texture declarations and load
// functions are auto-generated from the GSplatFormat streams.
const readGLSL = /* glsl */`
uniform float spzPositionScale;

// work values
uvec4 packedData;   // xyz: 24-bit position + 8-bit scale per component, w: rotation bits

vec3 getCenter() {
    packedData = loadPackedTexture();

    // sign-extend the 24-bit fixed point position
    ivec3 p = ivec3(packedData.xyz << 8u) >> 8;
    return vec3(p) * spzPositionScale;
}

vec4 getColor() {
    vec4 c = loadColorTexture();

    // rgb stores SH DC coefficients as c * 0.15 + 0.5, convert to color as 0.5 + SH_C0 * dc,
    // alpha is stored with sigmoid already applied
    const float scale = 0.28209479177387814 / 0.15;
    return vec4((c.rgb - 0.5) * scale + 0.5, c.a);
}

vec4 getRotation() {
    // smallest-three encoding: bits 30-31 store the index of the largest component, the
    // remaining three components are stored as 9-bit magnitude + sign bit, 10 bits each,
    // starting from the lowest bits for the highest component index
    uint comp = packedData.w;
    uint largest = comp >> 30u;
    float q[4];
    float sumSquares = 0.0;
    for (int i = 3; i >= 0; i--) {
        if (uint(i) != largest) {
            float v = float(comp & 0x1ffu) * (0.7071067811865476 / 511.0);
            if ((comp & 0x200u) != 0u) v = -v;
            comp = comp >> 10u;
            q[i] = v;
            sumSquares += v * v;
        }
    }
    q[largest] = sqrt(max(0.0, 1.0 - sumSquares));

    // spz stores the quaternion as (x, y, z, w), the engine expects (w, x, y, z)
    return vec4(q[3], q[0], q[1], q[2]);
}

vec3 getScale() {
    // 8-bit log encoded scale in the top byte of each position word
    vec3 s = vec3(packedData.xyz >> 24u);
    return exp(s / 16.0 - 10.0);
}

#if SH_BANDS > 0

// quantized SH bytes of the current splat, packed 4 to a word
uint shWords[12];

float unpackSH(int i) {
    uint b = (shWords[i >> 2] >> uint(8 * (i & 3))) & 0xffu;
    return (float(b) - 128.0) / 128.0;
}

void readSHData(out vec3 sh[SH_COEFFS], out float scale) {
    uvec4 d0 = loadShTexture0();
    shWords[0] = d0.x; shWords[1] = d0.y; shWords[2] = d0.z; shWords[3] = d0.w;
    #if SH_BANDS > 1
        uvec4 d1 = loadShTexture1();
        shWords[4] = d1.x; shWords[5] = d1.y; shWords[6] = d1.z; shWords[7] = d1.w;
    #endif
    #if SH_BANDS > 2
        uvec4 d2 = loadShTexture2();
        shWords[8] = d2.x; shWords[9] = d2.y; shWords[10] = d2.z; shWords[11] = d2.w;
    #endif

    for (int i = 0; i < SH_COEFFS; i++) {
        sh[i] = vec3(unpackSH(i * 3), unpackSH(i * 3 + 1), unpackSH(i * 3 + 2));
    }

    scale = 1.0;
}

#endif
`;

// WGSL variant of the read code
const readWGSL = /* wgsl */`
uniform spzPositionScale: f32;

// work values
var<private> packedData: vec4u;    // xyz: 24-bit position + 8-bit scale per component, w: rotation bits

fn getCenter() -> vec3f {
    packedData = loadPackedTexture();

    // sign-extend the 24-bit fixed point position
    let p = bitcast<vec3i>(packedData.xyz << vec3u(8u)) >> vec3u(8u);
    return vec3f(p) * uniform.spzPositionScale;
}

fn getColor() -> vec4f {
    let c = loadColorTexture();

    // rgb stores SH DC coefficients as c * 0.15 + 0.5, convert to color as 0.5 + SH_C0 * dc,
    // alpha is stored with sigmoid already applied
    const scale: f32 = 0.28209479177387814 / 0.15;
    return vec4f((c.rgb - 0.5) * scale + 0.5, c.a);
}

fn getRotation() -> vec4f {
    // smallest-three encoding: bits 30-31 store the index of the largest component, the
    // remaining three components are stored as 9-bit magnitude + sign bit, 10 bits each,
    // starting from the lowest bits for the highest component index
    var comp: u32 = packedData.w;
    let largest: u32 = comp >> 30u;
    var q = array<f32, 4>(0.0, 0.0, 0.0, 0.0);
    var sumSquares: f32 = 0.0;
    for (var i: i32 = 3; i >= 0; i--) {
        if (u32(i) != largest) {
            var v: f32 = f32(comp & 0x1ffu) * (0.7071067811865476 / 511.0);
            if ((comp & 0x200u) != 0u) { v = -v; }
            comp = comp >> 10u;
            q[i] = v;
            sumSquares += v * v;
        }
    }
    q[largest] = sqrt(max(0.0, 1.0 - sumSquares));

    // spz stores the quaternion as (x, y, z, w), the engine expects (w, x, y, z)
    return vec4f(q[3], q[0], q[1], q[2]);
}

fn getScale() -> vec3f {
    // 8-bit log encoded scale in the top byte of each position word
    let s = vec3f(packedData.xyz >> vec3u(24u));
    return exp(s / 16.0 - 10.0);
}

#if SH_BANDS > 0

// quantized SH bytes of the current splat, packed 4 to a word
var<private> shWords: array<u32, 12>;

fn unpackSH(i: i32) -> f32 {
    let b = (shWords[i >> 2] >> u32(8 * (i & 3))) & 0xffu;
    return (f32(b) - 128.0) / 128.0;
}

fn readSHData(sh: ptr<function, array<half3, SH_COEFFS>>, scale: ptr<function, f32>) {
    let d0 = loadShTexture0();
    shWords[0] = d0.x; shWords[1] = d0.y; shWords[2] = d0.z; shWords[3] = d0.w;
    #if SH_BANDS > 1
        let d1 = loadShTexture1();
        shWords[4] = d1.x; shWords[5] = d1.y; shWords[6] = d1.z; shWords[7] = d1.w;
    #endif
    #if SH_BANDS > 2
        let d2 = loadShTexture2();
        shWords[8] = d2.x; shWords[9] = d2.y; shWords[10] = d2.z; shWords[11] = d2.w;
    #endif

    for (var i: i32 = 0; i < SH_COEFFS; i++) {
        sh[i] = half3(vec3f(unpackSH(i * 3), unpackSH(i * 3 + 1), unpackSH(i * 3 + 2)));
    }

    *scale = 1.0;
}

#endif
`;

/**
 * Parsed SPZ file data - the quantized attribute streams as stored in the file, together with
 * the header information needed to interpret them.
 */
class SpzGSplatData {
    /** @type {number} */
    numSplats;

    /** @type {number} */
    fractionalBits;

    /** @type {0|1|2|3} */
    shBands;

    /** @type {number} */
    shDim;

    /** @type {boolean} */
    antialiased;

    /** @type {Uint8Array} positions, 3x 24-bit little-endian fixed point per splat */
    positions;

    /** @type {Uint8Array} alphas, 1 byte per splat, sigmoid applied */
    alphas;

    /** @type {Uint8Array} colors, 3 bytes per splat */
    colors;

    /** @type {Uint8Array} scales, 3 bytes per splat, log encoded */
    scales;

    /** @type {Uint8Array} rotations, 4 bytes per splat, smallest-three encoded */
    rotations;

    /** @type {Uint8Array|null} spherical harmonics, shDim * 3 bytes per splat */
    sh;

    constructor(header, streams) {
        this.numSplats = header.numPoints;
        this.fractionalBits = header.fractionalBits;
        this.antialiased = header.antialiased;
        this.shDim = SH_DIM_FOR_DEGREE[header.shDegree];

        // the engine supports at most 3 SH bands, additional bands are ignored
        this.shBands = /** @type {0|1|2|3} */ (Math.min(header.shDegree, 3));

        this.positions = streams.positions;
        this.alphas = streams.alphas;
        this.colors = streams.colors;
        this.scales = streams.scales;
        this.rotations = streams.rotations;
        this.sh = streams.sh ?? null;
    }

    /**
     * Decodes the fixed point positions to a float array, used by the sorter.
     *
     * @returns {Float32Array} The centers, 3 floats per splat.
     */
    getCenters() {
        const { numSplats, positions } = this;
        const scale = 1 / (1 << this.fractionalBits);
        const centers = new Float32Array(numSplats * 3);
        for (let i = 0; i < numSplats * 3; i++) {
            const o = i * 3;
            let v = positions[o] | (positions[o + 1] << 8) | (positions[o + 2] << 16);
            v = (v << 8) >> 8;  // sign-extend 24-bit
            centers[i] = v * scale;
        }
        return centers;
    }

    /**
     * @param {BoundingBox} aabb - The bounding box to update.
     */
    calcAabb(aabb) {
        const { numSplats, positions } = this;
        const scale = 1 / (1 << this.fractionalBits);
        const min = new Vec3(Infinity, Infinity, Infinity);
        const max = new Vec3(-Infinity, -Infinity, -Infinity);
        for (let i = 0; i < numSplats; i++) {
            for (let c = 0; c < 3; c++) {
                const o = (i * 3 + c) * 3;
                let v = positions[o] | (positions[o + 1] << 8) | (positions[o + 2] << 16);
                v = (v << 8) >> 8;
                const p = v * scale;
                const mc = c === 0 ? 'x' : (c === 1 ? 'y' : 'z');
                min[mc] = Math.min(min[mc], p);
                max[mc] = Math.max(max[mc], p);
            }
        }
        aabb.setMinMax(min, max);
    }
}

/**
 * A gsplat resource which keeps the SPZ data in its quantized form in GPU textures, and
 * dequantizes it in the shader.
 */
class GSplatSpzResource extends GSplatResourceBase {
    /**
     * @param {GraphicsDevice} device - The graphics device.
     * @param {SpzGSplatData} gsplatData - The parsed spz data.
     * @param {object} [options] - Passed to {@link GSplatResourceBase} constructor.
     */
    constructor(device, gsplatData, options = {}) {
        super(device, gsplatData, options);

        const { numSplats, shBands } = gsplatData;

        // splat data streams:
        // - packedTexture: xyz words store 24-bit fixed point position + 8-bit log scale,
        //   w word stores the smallest-three rotation
        // - colorTexture: rgb color + alpha bytes
        const formatStreams = [
            { name: 'packedTexture', format: PIXELFORMAT_RGBA32U },
            { name: 'colorTexture', format: PIXELFORMAT_RGBA8 }
        ];

        // quantized SH coefficient bytes, packed 16 to a texture
        const numShTextures = shBands > 0 ? Math.ceil((SH_DIM_FOR_DEGREE[shBands] * 3) / 16) : 0;
        for (let i = 0; i < numShTextures; i++) {
            formatStreams.push({ name: `shTexture${i}`, format: PIXELFORMAT_RGBA32U });
        }

        this._format = new GSplatFormat(device, formatStreams, {
            readGLSL: readGLSL,
            readWGSL: readWGSL
        });

        // let streams create textures from format
        this.streams.init(this.format, numSplats);

        // dequantization uniform
        this.parameters.set('spzPositionScale', 1 / (1 << gsplatData.fractionalBits));

        // pack position + scale + rotation
        const { positions, scales, rotations, colors, alphas } = gsplatData;
        const packedTexture = this.streams.getTexture('packedTexture');
        const packedData = packedTexture.lock();
        for (let i = 0; i < numSplats; i++) {
            const p = i * 9;
            const s = i * 3;
            const r = i * 4;
            packedData[i * 4 + 0] = positions[p + 0] | (positions[p + 1] << 8) | (positions[p + 2] << 16) | (scales[s + 0] << 24);
            packedData[i * 4 + 1] = positions[p + 3] | (positions[p + 4] << 8) | (positions[p + 5] << 16) | (scales[s + 1] << 24);
            packedData[i * 4 + 2] = positions[p + 6] | (positions[p + 7] << 8) | (positions[p + 8] << 16) | (scales[s + 2] << 24);
            packedData[i * 4 + 3] = rotations[r + 0] | (rotations[r + 1] << 8) | (rotations[r + 2] << 16) | (rotations[r + 3] << 24);
        }
        packedTexture.unlock();

        // color + alpha
        const colorTexture = this.streams.getTexture('colorTexture');
        const colorData = colorTexture.lock();
        for (let i = 0; i < numSplats; i++) {
            colorData[i * 4 + 0] = colors[i * 3 + 0];
            colorData[i * 4 + 1] = colors[i * 3 + 1];
            colorData[i * 4 + 2] = colors[i * 3 + 2];
            colorData[i * 4 + 3] = alphas[i];
        }
        colorTexture.unlock();

        // spherical harmonics - pack the quantized bytes 4 to a word, 16 to a texture. Note that
        // the source data can store more coefficients than the engine supports (SH degree 4), in
        // which case only the first 15 coefficients are used.
        if (shBands > 0) {
            const sh = gsplatData.sh;
            const srcStride = gsplatData.shDim * 3;
            const usedBytes = SH_DIM_FOR_DEGREE[shBands] * 3;
            for (let t = 0; t < numShTextures; t++) {
                const shTexture = this.streams.getTexture(`shTexture${t}`);
                const shData = shTexture.lock();
                for (let i = 0; i < numSplats; i++) {
                    const src = i * srcStride + t * 16;
                    for (let w = 0; w < 4; w++) {
                        let word = 0;
                        for (let k = 0; k < 4; k++) {
                            const b = t * 16 + w * 4 + k;
                            word |= (b < usedBytes ? sh[src + w * 4 + k] : 128) << (k * 8);
                        }
                        shData[i * 4 + w] = word;
                    }
                }
                shTexture.unlock();
            }
        }
    }

    configureMaterialDefines(defines) {
        defines.set('SH_BANDS', this.gsplatData.shBands);
    }
}

/**
 * Parses the SPZ v4 (NGSP) container and decompresses the attribute streams.
 *
 * @param {ArrayBuffer} arrayBuffer - The file data.
 * @param {{ decompress: (src: Uint8Array, size: number) => Uint8Array }} decoder - The ZSTD decoder.
 * @returns {SpzGSplatData} The parsed data.
 */
const parseSpz = (arrayBuffer, decoder) => {
    const dv = new DataView(arrayBuffer);
    if (dv.byteLength < 32) {
        throw new Error('Invalid spz file: too small');
    }

    const magic = dv.getUint32(0, true);
    const version = dv.getUint32(4, true);

    if (magic !== NGSP_MAGIC) {
        // legacy versions (1-3) store the gzipped header + streams, so the file starts with the
        // gzip magic instead
        if (dv.getUint8(0) === 0x1f && dv.getUint8(1) === 0x8b) {
            throw new Error('Unsupported spz file: legacy gzip based version, only version 4 is supported');
        }
        throw new Error(`Invalid spz file: unexpected magic number 0x${magic.toString(16)}`);
    }

    if (version !== 4) {
        throw new Error(`Unsupported spz version ${version}, only version 4 is supported`);
    }

    const header = {
        numPoints: dv.getUint32(8, true),
        shDegree: dv.getUint8(12),
        fractionalBits: dv.getUint8(13),
        flags: dv.getUint8(14),
        numStreams: dv.getUint8(15),
        tocByteOffset: dv.getUint32(16, true),
        antialiased: false
    };
    header.antialiased = (header.flags & FLAG_ANTIALIASED) !== 0;

    if (header.shDegree >= SH_DIM_FOR_DEGREE.length) {
        throw new Error(`Invalid spz file: unsupported SH degree ${header.shDegree}`);
    }

    if ((header.flags & FLAG_HAS_EXTENSIONS) !== 0) {
        // extensions are stored between the header and the TOC and are skipped here
        console.warn('SpzParser: file contains extensions which are not supported and will be ignored');
    }

    // expected uncompressed stream sizes, in file order, zero-size streams are not stored
    const numPoints = header.numPoints;
    const shDim = SH_DIM_FOR_DEGREE[header.shDegree];
    const streamNames = ['positions', 'alphas', 'colors', 'scales', 'rotations', 'sh'];
    const streamSizes = [numPoints * 9, numPoints, numPoints * 3, numPoints * 3, numPoints * 4, numPoints * shDim * 3]
    .filter(size => size > 0);

    if (header.numStreams !== streamSizes.length) {
        throw new Error(`Invalid spz file: expected ${streamSizes.length} streams, found ${header.numStreams}`);
    }

    // read the TOC and decompress the streams
    const tocSize = header.numStreams * 16;
    if (header.tocByteOffset < 32 || header.tocByteOffset + tocSize > dv.byteLength) {
        throw new Error('Invalid spz file: table of contents out of bounds');
    }

    const streams = {};
    let dataOffset = header.tocByteOffset + tocSize;
    for (let i = 0; i < header.numStreams; i++) {
        const compressedSize = Number(dv.getBigUint64(header.tocByteOffset + i * 16, true));
        const uncompressedSize = Number(dv.getBigUint64(header.tocByteOffset + i * 16 + 8, true));

        if (uncompressedSize !== streamSizes[i]) {
            throw new Error(`Invalid spz file: unexpected size of the ${streamNames[i]} stream`);
        }
        if (dataOffset + compressedSize > dv.byteLength) {
            throw new Error('Invalid spz file: stream extends past the end of the file');
        }

        const compressed = new Uint8Array(arrayBuffer, dataOffset, compressedSize);
        streams[streamNames[i]] = decoder.decompress(compressed, uncompressedSize);
        dataOffset += compressedSize;
    }

    return new SpzGSplatData(header, streams);
};

class SpzParser {
    /** @type {AppBase} */
    app;

    /**
     * @param {AppBase} app - The app instance.
     */
    constructor(app) {
        this.app = app;
    }

    canParse(context) {
        return context.ext === 'spz';
    }

    /**
     * @param {object} url - The URL of the resource to load.
     * @param {string} url.load - The URL to use for loading the resource.
     * @param {string} url.original - The original URL useful for identifying the resource type.
     * @param {Function} callback - The callback used when the resource is loaded or an error
     * occurs.
     * @param {import('playcanvas').Asset} asset - Container asset.
     */
    load(url, callback, asset) {
        if (!WasmModule.getConfig('ZstdDecoderModule')) {
            callback('SpzParser: ZSTD decoder module is not registered. Use WasmModule.setConfig(\'ZstdDecoderModule\', { glueUrl, wasmUrl }) before loading spz files.');
            return;
        }

        this.handler.fetch(url, Http.ResponseType.ARRAY_BUFFER, (err, data) => {
            if (err) {
                callback(err);
                return;
            }

            WasmModule.getInstance('ZstdDecoderModule', (decoder) => {
                try {
                    const gsplatData = parseSpz(data, decoder);
                    const prepareCenters = this.app.scene?.gsplatCentersEnabled !== false;
                    const resource = new GSplatSpzResource(this.app.graphicsDevice, gsplatData, { prepareCenters });
                    callback(null, resource);
                } catch (e) {
                    callback(e);
                }
            });
        }, asset);
    }

    open(url, data) {
        return data;
    }
}

export { SpzParser, GSplatSpzResource };
