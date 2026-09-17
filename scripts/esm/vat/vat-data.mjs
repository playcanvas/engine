import {
    ADDRESS_CLAMP_TO_EDGE,
    ADDRESS_REPEAT,
    BoundingBox,
    FILTER_LINEAR,
    FILTER_LINEAR_MIPMAP_LINEAR,
    FILTER_NEAREST,
    Mesh,
    PIXELFORMAT_RGBA16U,
    PIXELFORMAT_SRGBA8,
    PRIMITIVE_TRIANGLES,
    Texture,
    Vec3
} from 'playcanvas';

/**
 * @import { GraphicsDevice } from 'playcanvas'
 */

/**
 * The version of the VAT format this module reads and writes. It is stored as the second uint32 of
 * the container header, immediately after the magic number, and is also repeated in the json chunk
 * so the header is not needed to identify a document. Bump it whenever the layout of the texture, the
 * binary chunk or the json changes in a way an older reader would misinterpret, and widen the check
 * in `readContainer` if a newer reader should keep accepting older documents.
 *
 * @type {number}
 */
export const VAT_VERSION = 1;

/**
 * The largest texture dimension the format uses. Every WebGL 2 and WebGPU device supports textures
 * of at least this size, so the generated data loads anywhere without having to know the limits of
 * the machine it was authored on.
 *
 * @type {number}
 */
export const VAT_TEXTURE_LIMIT = 4096;

/**
 * Returns the texture size the given number of vertices and frames are laid out in. Frames of a
 * vertex are stored consecutively and the run simply wraps at the end of a row, so neither the
 * vertex count nor the frame count is limited by a texture dimension on its own - only their
 * product is, by the number of texels a {@link VAT_TEXTURE_LIMIT} sized texture holds.
 *
 * @param {number} vertexCount - The number of vertices.
 * @param {number} frameCount - The number of frames stored per vertex.
 * @returns {{ width: number, height: number }} The texture size, with a power of two width.
 */
export function vatTextureSize(vertexCount, frameCount) {
    const texels = vertexCount * frameCount;
    let width = 1;
    while (width < texels && width < VAT_TEXTURE_LIMIT) {
        width *= 2;
    }
    return { width, height: Math.ceil(texels / width) };
}

/**
 * The magic number at the start of a VAT container - 'PVAT' as a little endian uint32.
 *
 * @type {number}
 */
export const VAT_MAGIC = 0x54415650;

/** The type of the json chunk - 'JSON' as a little endian uint32. @ignore */
const CHUNK_JSON = 0x4e4f534a;

/** The type of the binary chunk - 'BIN\0' as a little endian uint32. @ignore */
const CHUNK_BIN = 0x004e4942;

/**
 * Pads a byte array to a multiple of four bytes, as required by the container chunks.
 *
 * @param {Uint8Array} bytes - The bytes to pad.
 * @param {number} fill - The byte value to pad with.
 * @returns {Uint8Array} The padded bytes, or the original array when already aligned.
 * @ignore
 */
function pad4(bytes, fill) {
    const padding = (4 - (bytes.byteLength & 3)) & 3;
    if (padding === 0) {
        return bytes;
    }
    const padded = new Uint8Array(bytes.byteLength + padding);
    padded.set(bytes);
    padded.fill(fill, bytes.byteLength);
    return padded;
}

/**
 * Decodes a unit vector from its octahedral representation, the inverse of the encoding used by the
 * converter. This matches the `vatOctDecode` function of the shader chunks.
 *
 * @param {number} x - The first component, in the -1..1 range.
 * @param {number} y - The second component, in the -1..1 range.
 * @param {Vec3} result - The vector to write the decoded normal to.
 * @returns {Vec3} The decoded normal.
 */
export function octDecode(x, y, result) {
    const z = 1 - Math.abs(x) - Math.abs(y);
    const t = Math.max(-z, 0);
    result.set(x + (x >= 0 ? -t : t), y + (y >= 0 ? -t : t), z);
    return result.normalize();
}

/**
 * @typedef {object} VatAnimation
 * @property {string} name - The name of the animation.
 * @property {number} frameStart - The index of the first frame of the animation inside the VAT
 * texture.
 * @property {number} frameCount - The number of unique frames of the animation. Note that
 * `frameCount + 1` frames are stored in the texture, as the first frame is duplicated after the
 * last one to allow the final frame to be interpolated towards the start of the loop.
 * @property {number} duration - The duration of the animation in seconds.
 */

/**
 * Parsed VAT (Vertex Animation Texture) data, created by {@link parseVat} from the container the
 * converter generates. See `vat-converter.mjs` for details of the format.
 */
export class VatData {
    /**
     * The rate at which the source animations were sampled, in frames per second.
     *
     * @type {number}
     */
    fps = 30;

    /**
     * The number of vertices of the character.
     *
     * @type {number}
     */
    vertexCount = 0;

    /**
     * The total number of frames stored per vertex, across all animations.
     *
     * @type {number}
     */
    frameCount = 0;

    /**
     * The width of the VAT texture, always a power of two. The frames of a vertex are stored
     * consecutively and wrap at the end of a row, so this is unrelated to the frame count.
     *
     * @type {number}
     */
    width = 0;

    /**
     * The height of the VAT texture.
     *
     * @type {number}
     */
    height = 0;

    /**
     * The animations stored in the VAT texture.
     *
     * @type {VatAnimation[]}
     */
    animations = [];

    /**
     * The local space bounds of the character, covering all frames of all animations. Positions are
     * quantized over this volume, so it doubles as the dequantization range.
     *
     * @type {BoundingBox}
     */
    bounds = new BoundingBox();

    /**
     * The texture data - four 16bit unsigned integers per texel, holding the quantized position in
     * xyz and the octahedral normal packed into w.
     *
     * @type {Uint16Array}
     */
    vat = null;

    /**
     * The triangle indices of the character mesh.
     *
     * @type {Uint16Array|Uint32Array}
     */
    indices = null;

    /**
     * The texture coordinates of the character mesh, two floats per vertex.
     *
     * @type {Float32Array}
     */
    uvs = null;

    /**
     * The optional embedded albedo (base color) image, or null.
     *
     * @type {{ mimeType: string, data: Uint8Array }|null}
     */
    albedo = null;

    /**
     * Returns the index of the animation of the given name, or -1 if not found.
     *
     * @param {string} name - The name of the animation.
     * @returns {number} The index of the animation.
     */
    getAnimationIndex(name) {
        return this.animations.findIndex(animation => animation.name === name);
    }
}

/**
 * Reads the chunks of a VAT container.
 *
 * @param {ArrayBuffer} buffer - The container.
 * @returns {{ json: object, bin: Uint8Array }} The json document and the raw binary chunk.
 * @ignore
 */
function readContainer(buffer) {

    const view = new DataView(buffer);
    if (buffer.byteLength < 20 || view.getUint32(0, true) !== VAT_MAGIC) {
        throw new Error('Not a VAT container - the magic number does not match.');
    }

    const version = view.getUint32(4, true);
    if (version !== VAT_VERSION) {
        throw new Error(`VAT container version ${version} is not supported, expected ${VAT_VERSION}.`);
    }

    const length = Math.min(view.getUint32(8, true), buffer.byteLength);
    let json = null;
    let bin = null;

    for (let offset = 12; offset + 8 <= length;) {
        const chunkLength = view.getUint32(offset, true);
        const chunkType = view.getUint32(offset + 4, true);
        const data = new Uint8Array(buffer, offset + 8, chunkLength);
        if (chunkType === CHUNK_JSON) {
            json = JSON.parse(new TextDecoder().decode(data));
        } else if (chunkType === CHUNK_BIN) {
            bin = data;
        }
        offset += 8 + chunkLength;
    }

    if (!json || !bin) {
        throw new Error('The VAT container is missing its json or binary chunk.');
    }

    return { json, bin };
}

/**
 * Writes a VAT container.
 *
 * @param {object} json - The json document.
 * @param {Uint8Array} bin - The binary chunk, already compressed if the json says so.
 * @returns {ArrayBuffer} The container.
 * @ignore
 */
export function writeContainer(json, bin) {

    const jsonChunk = pad4(new TextEncoder().encode(JSON.stringify(json)), 0x20);
    const binChunk = pad4(bin, 0);

    const byteLength = 12 + 8 + jsonChunk.byteLength + 8 + binChunk.byteLength;
    const buffer = new ArrayBuffer(byteLength);
    const bytes = new Uint8Array(buffer);
    const view = new DataView(buffer);

    view.setUint32(0, VAT_MAGIC, true);
    view.setUint32(4, VAT_VERSION, true);
    view.setUint32(8, byteLength, true);

    view.setUint32(12, jsonChunk.byteLength, true);
    view.setUint32(16, CHUNK_JSON, true);
    bytes.set(jsonChunk, 20);

    const binHeader = 20 + jsonChunk.byteLength;
    view.setUint32(binHeader, binChunk.byteLength, true);
    view.setUint32(binHeader + 4, CHUNK_BIN, true);
    bytes.set(binChunk, binHeader + 8);

    return buffer;
}

/**
 * Parses a VAT container generated by the converter.
 *
 * The container is stored uncompressed, as compressing it is the job of the transport - serve it
 * with `Content-Encoding: br` (or gzip) and the browser decompresses it while it downloads. That
 * is both simpler and smaller than compressing the payload here, which would leave the transport
 * nothing to work with: brotli over the raw data is around 40% smaller than gzip baked into the
 * file. Note that a server may need to be told to compress the type it serves `.vat` files as,
 * which is usually `application/octet-stream`.
 *
 * @param {ArrayBuffer} buffer - The container.
 * @returns {VatData} The parsed data.
 */
export function parseVat(buffer) {

    const { json, bin: blob } = readContainer(buffer);

    if (blob.byteLength < json.binary.byteLength) {
        throw new Error(`The VAT binary chunk is ${blob.byteLength} bytes, expected ${json.binary.byteLength}.`);
    }

    const view = (accessor, Type) => {
        return new Type(blob.buffer, blob.byteOffset + accessor.byteOffset, accessor.byteLength / Type.BYTES_PER_ELEMENT);
    };

    const data = new VatData();
    data.fps = json.fps;
    data.vertexCount = json.vertexCount;
    data.frameCount = json.frameCount;
    data.width = json.texture.width;
    data.height = json.texture.height;
    data.animations = json.animations.map(animation => ({ ...animation }));
    data.bounds.setMinMax(new Vec3(json.bounds.min), new Vec3(json.bounds.max));
    data.vat = view(json.vat, Uint16Array);
    data.indices = view(json.indices, json.indices.type === 'uint32' ? Uint32Array : Uint16Array);
    data.uvs = view(json.uvs, Float32Array);

    if (json.albedo) {
        data.albedo = {
            mimeType: json.albedo.mimeType,
            data: view(json.albedo, Uint8Array)
        };
    }

    return data;
}

/**
 * Creates the VAT texture the vertex shader samples the animated positions and normals from. One
 * texel holds a whole vertex for one frame, so a single fetch supplies both the position and the
 * normal.
 *
 * @param {GraphicsDevice} device - The graphics device.
 * @param {VatData} data - The VAT data.
 * @returns {Texture} The created texture.
 */
export function createVatTexture(device, data) {
    return new Texture(device, {
        name: 'vatMap',
        width: data.width,
        height: data.height,
        format: PIXELFORMAT_RGBA16U,
        mipmaps: false,
        minFilter: FILTER_NEAREST,
        magFilter: FILTER_NEAREST,
        addressU: ADDRESS_CLAMP_TO_EDGE,
        addressV: ADDRESS_CLAMP_TO_EDGE,
        levels: [data.vat]
    });
}

/**
 * Creates the character mesh. Positions and normals of the mesh are only used as a rest pose - the
 * animated values are read from the VAT texture by the vertex shader, using the vertex index to
 * address the texture row.
 *
 * @param {GraphicsDevice} device - The graphics device.
 * @param {VatData} data - The VAT data.
 * @returns {Mesh} The created mesh.
 */
export function createVatMesh(device, data) {

    // decode the first frame of the texture to use as a rest pose
    const vertexCount = data.vertexCount;
    const positions = new Float32Array(vertexCount * 3);
    const normals = new Float32Array(vertexCount * 3);
    const vat = data.vat;

    const min = data.bounds.getMin();
    const size = data.bounds.halfExtents;
    const normal = new Vec3();

    for (let i = 0; i < vertexCount; i++) {

        // the first frame of this vertex, as a flat texel index into the wrapped layout
        const texel = i * data.frameCount * 4;

        positions[i * 3] = min.x + (vat[texel] / 65535) * size.x * 2;
        positions[i * 3 + 1] = min.y + (vat[texel + 1] / 65535) * size.y * 2;
        positions[i * 3 + 2] = min.z + (vat[texel + 2] / 65535) * size.z * 2;

        const packed = vat[texel + 3];
        octDecode(
            ((packed & 0xff) / 255) * 2 - 1,
            ((packed >> 8) / 255) * 2 - 1,
            normal
        );
        normals[i * 3] = normal.x;
        normals[i * 3 + 1] = normal.y;
        normals[i * 3 + 2] = normal.z;
    }

    const mesh = new Mesh(device);
    mesh.setPositions(positions);
    mesh.setNormals(normals);
    mesh.setUvs(0, data.uvs);
    mesh.setIndices(data.indices);
    mesh.update(PRIMITIVE_TRIANGLES, false);

    // the mesh deforms over the animation, so use the bounds of all frames
    mesh.aabb = data.bounds.clone();

    return mesh;
}

/**
 * Creates a 1x1 white texture, used in place of the base color texture when the VAT data does not
 * embed one.
 *
 * @param {GraphicsDevice} device - The graphics device.
 * @returns {Texture} The created texture.
 */
export function createWhiteTexture(device) {
    return new Texture(device, {
        name: 'vatWhite',
        width: 1,
        height: 1,
        format: PIXELFORMAT_SRGBA8,
        mipmaps: false,
        levels: [new Uint8Array([255, 255, 255, 255])]
    });
}

/**
 * Creates a texture from the albedo image embedded in the VAT data, or returns null when the data
 * does not contain one.
 *
 * @param {GraphicsDevice} device - The graphics device.
 * @param {VatData} data - The VAT data.
 * @returns {Promise<Texture|null>} The created texture.
 */
export async function createVatAlbedoTexture(device, data) {

    if (!data.albedo) {
        return null;
    }

    const blob = new Blob([data.albedo.data], { type: data.albedo.mimeType });
    const bitmap = await createImageBitmap(blob);

    return new Texture(device, {
        name: 'vatAlbedo',
        width: bitmap.width,
        height: bitmap.height,
        format: PIXELFORMAT_SRGBA8,
        mipmaps: true,
        minFilter: FILTER_LINEAR_MIPMAP_LINEAR,
        magFilter: FILTER_LINEAR,
        addressU: ADDRESS_REPEAT,
        addressV: ADDRESS_REPEAT,
        anisotropy: 8,
        levels: [bitmap]
    });
}
