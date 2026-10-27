import { copyFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { expect } from 'chai';
import { restore, spy, stub } from 'sinon';

import { MeshoptDecoder } from '../../../examples/assets/wasm/meshopt/meshopt_decoder.mjs';
import { MeshoptEncoder } from '../../../examples/assets/wasm/meshopt/meshopt_encoder.js';
import { platform } from '../../../src/core/platform.js';
import { GlbParser } from '../../../src/framework/parsers/glb-parser.js';
import { meshoptInitialize } from '../../../src/framework/parsers/meshopt-decoder.js';
import { http } from '../../../src/platform/net/http.js';
import { createApp } from '../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

const DECODER_PATH = resolve('examples/assets/wasm/meshopt/meshopt_decoder.mjs');
const DECODER_URL = pathToFileURL(DECODER_PATH).href;

// the folder holding the decoder, as a url with a trailing slash
const DECODER_FOLDER_URL = new URL('./', DECODER_URL).href;

// glTF component types
const BYTE = 5120;
const SHORT = 5122;
const UNSIGNED_SHORT = 5123;
const FLOAT = 5126;

// a grid of vertices in the xy plane, with normals of varying direction so that the octahedral
// filter has some work to do, and two triangles per grid cell
const GRID = 8;
const vertexCount = GRID * GRID;
const positions = new Float32Array(vertexCount * 3);
const normals = new Float32Array(vertexCount * 4);
const indices = new Uint16Array((GRID - 1) * (GRID - 1) * 6);

for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
        const v = y * GRID + x;
        positions.set([x, y, 0], v * 3);

        const nx = (x / (GRID - 1)) - 0.5;
        const ny = (y / (GRID - 1)) - 0.5;
        const length = Math.hypot(nx, ny, 1);
        normals.set([nx / length, ny / length, 1 / length, 0], v * 4);
    }
}

for (let y = 0, i = 0; y < GRID - 1; y++) {
    for (let x = 0; x < GRID - 1; x++) {
        const v = y * GRID + x;
        indices.set([v, v + 1, v + GRID, v + 1, v + GRID + 1, v + GRID], i);
        i += 6;
    }
}

// rotation keyframes of an animation, as unit quaternions
const times = new Float32Array([0, 0.5, 1]);
const rotations = new Float32Array([
    0, 0, 0, 1,
    0, Math.SQRT1_2, 0, Math.SQRT1_2,
    0, 1, 0, 0
]);
const keyCount = times.length;

const bytesOf = array => new Uint8Array(array.buffer, array.byteOffset, array.byteLength);

/**
 * Concatenates byte arrays, padding each to a multiple of four bytes.
 *
 * @param {Uint8Array[]} parts - The byte arrays.
 * @returns {{ bytes: Uint8Array, offsets: number[], lengths: number[] }} The concatenated bytes,
 * and the offset and unpadded length of each part.
 */
const concat = (parts) => {
    const offsets = [];
    let length = 0;
    for (const part of parts) {
        offsets.push(length);
        length += Math.ceil(part.length / 4) * 4;
    }
    const bytes = new Uint8Array(length);
    parts.forEach((part, i) => bytes.set(part, offsets[i]));
    return { bytes, offsets, lengths: parts.map(part => part.length) };
};

/**
 * Builds a glb from a glTF json object and the binary chunk.
 *
 * @param {object} gltf - The glTF json.
 * @param {Uint8Array} bin - The binary chunk.
 * @returns {Uint8Array} The glb file.
 */
const createGlb = (gltf, bin) => {
    const json = new TextEncoder().encode(JSON.stringify(gltf));
    const jsonLength = Math.ceil(json.length / 4) * 4;
    const binLength = Math.ceil(bin.length / 4) * 4;
    const glb = new Uint8Array(12 + 8 + jsonLength + 8 + binLength);
    const view = new DataView(glb.buffer);

    view.setUint32(0, 0x46546C67, true);
    view.setUint32(4, 2, true);
    view.setUint32(8, glb.length, true);

    view.setUint32(12, jsonLength, true);
    view.setUint32(16, 0x4E4F534A, true);
    glb.fill(0x20, 20, 20 + jsonLength);
    glb.set(json, 20);

    view.setUint32(20 + jsonLength, binLength, true);
    view.setUint32(24 + jsonLength, 0x004E4942, true);
    glb.set(bin, 28 + jsonLength);

    return glb;
};

/**
 * The buffer views to compress. The `data` is the uncompressed buffer view contents.
 *
 * @param {object} options - The data options.
 * @param {boolean} options.filters - True to store normals with the octahedral filter and
 * rotations with the quaternion filter, quantizing them as gltfpack does.
 * @returns {object[]} The buffer views.
 */
const createViews = ({ filters }) => {
    const view = (data, count, byteStride, mode, filter) => {
        return { data, count, byteStride, mode, filter };
    };

    const views = [
        view(bytesOf(positions), vertexCount, 12, 'ATTRIBUTES'),
        view(bytesOf(indices), indices.length, 2, 'TRIANGLES'),
        view(bytesOf(times), keyCount, 4, 'ATTRIBUTES')
    ];

    if (filters) {
        const oct = MeshoptEncoder.encodeFilterOct(normals, vertexCount, 4, 8);
        const quat = MeshoptEncoder.encodeFilterQuat(rotations, keyCount, 8, 12);
        views.push(
            view(oct, vertexCount, 4, 'ATTRIBUTES', 'OCTAHEDRAL'),
            view(quat, keyCount, 8, 'ATTRIBUTES', 'QUATERNION')
        );
    } else {
        views.push(
            view(bytesOf(normals), vertexCount, 16, 'ATTRIBUTES'),
            view(bytesOf(rotations), keyCount, 16, 'ATTRIBUTES')
        );
    }

    return views;
};

/**
 * Creates a glTF file, gltfpack style: the compressed data is in buffer 0, and the buffer views
 * reference buffer 1, a fallback that holds no data unless `fallbackUri` is given.
 *
 * @param {object} [options] - The file options.
 * @param {string} [options.extension] - The extension name. Defaults to EXT_meshopt_compression.
 * @param {number} [options.version] - The vertex bitstream version, 0 or 1. Defaults to 0.
 * @param {boolean} [options.filters] - True to use filters. Defaults to false.
 * @param {boolean} [options.required] - True to list the extension as required. Defaults to true.
 * @param {string} [options.fallbackUri] - The uri of the uncompressed fallback buffer. Use
 * 'embed' to embed it as a data uri.
 * @returns {Uint8Array} The glb file.
 */
const createFile = ({
    extension = 'EXT_meshopt_compression', version = 0, filters = false, required = true,
    fallbackUri
} = {}) => {
    const views = createViews({ filters });
    const compressed = concat(views.map(view => MeshoptEncoder.encodeGltfBuffer(
        view.data, view.count, view.byteStride, view.mode, version
    )));
    const fallback = concat(views.map(view => view.data));

    const bufferViews = views.map((view, i) => {
        const compression = {
            buffer: 0,
            byteOffset: compressed.offsets[i],
            byteLength: compressed.lengths[i],
            byteStride: view.byteStride,
            count: view.count,
            mode: view.mode
        };
        if (view.filter) {
            compression.filter = view.filter;
        }

        return {
            buffer: 1,
            byteOffset: fallback.offsets[i],
            byteLength: view.data.length,
            extensions: { [extension]: compression }
        };
    });

    // vertex attribute views need a stride, the index and animation views must not have one
    bufferViews[0].byteStride = views[0].byteStride;
    bufferViews[3].byteStride = views[3].byteStride;

    const fallbackBuffer = {
        byteLength: fallback.bytes.length,
        extensions: { [extension]: { fallback: true } }
    };
    if (fallbackUri === 'embed') {
        const base64 = Buffer.from(fallback.bytes).toString('base64');
        fallbackBuffer.uri = `data:application/octet-stream;base64,${base64}`;
    } else if (fallbackUri) {
        fallbackBuffer.uri = fallbackUri;
    }

    const accessor = (bufferView, componentType, count, type, extra) => {
        return { bufferView, componentType, count, type, ...extra };
    };

    const bounds = { min: [0, 0, 0], max: [GRID - 1, GRID - 1, 0] };

    const gltf = {
        asset: { version: '2.0' },
        extensionsUsed: [extension],
        ...(required ? { extensionsRequired: [extension] } : {}),
        scene: 0,
        scenes: [{ nodes: [0] }],
        nodes: [{ mesh: 0 }],
        meshes: [{ primitives: [{ attributes: { POSITION: 0, NORMAL: 3 }, indices: 1 }] }],
        accessors: [
            accessor(0, FLOAT, vertexCount, 'VEC3', bounds),
            accessor(1, UNSIGNED_SHORT, indices.length, 'SCALAR'),
            accessor(2, FLOAT, keyCount, 'SCALAR', { min: [0], max: [1] }),
            accessor(3, filters ? BYTE : FLOAT, vertexCount, 'VEC3', { normalized: filters }),
            accessor(4, filters ? SHORT : FLOAT, keyCount, 'VEC4', { normalized: filters })
        ],
        animations: [{
            channels: [{ sampler: 0, target: { node: 0, path: 'rotation' } }],
            samplers: [{ input: 2, output: 4 }]
        }],
        bufferViews,
        buffers: [{ byteLength: compressed.bytes.length }, fallbackBuffer]
    };

    return createGlb(gltf, compressed.bytes);
};

describe('GlbParser meshopt compression', function () {

    let app;

    before(async function () {
        await MeshoptEncoder.ready;
    });

    beforeEach(function () {
        jsdomSetup();
        app = createApp();
    });

    afterEach(function () {
        meshoptInitialize(null);
        restore();
        app?.destroy();
        app = null;
        jsdomTeardown();
    });

    const parse = (data) => {
        return new Promise((resolve, reject) => {
            const { graphicsDevice, assets } = app;
            GlbParser.parse('meshopt.glb', '', data, graphicsDevice, assets, {}, [], (err, res) => {
                if (err) reject(err);
                else resolve(res);
            });
        });
    };

    const parseError = async (data) => {
        try {
            await parse(data);
        } catch (err) {
            return err;
        }
        throw new Error('expected the parse to fail');
    };

    const getMesh = result => result.renders[0].meshes[0];

    // the xyz of each normal, as WebGPU pads three component byte normals to four components
    const getNormals = (mesh) => {
        const data = [];
        const count = mesh.getNormals(data);
        const components = data.length / count;
        return data.filter((v, i) => i % components < 3);
    };

    // rotates each triangle to start at its lowest index
    const normalizeTriangles = (array) => {
        const result = [];
        for (let i = 0; i < array.length; i += 3) {
            const tri = [array[i], array[i + 1], array[i + 2]];
            const first = tri.indexOf(Math.min(...tri));
            result.push(tri[first], tri[(first + 1) % 3], tri[(first + 2) % 3]);
        }
        return result;
    };

    const expectGeometry = (mesh) => {
        const decodedPositions = [];
        expect(mesh.getPositions(decodedPositions)).to.equal(vertexCount);
        expect(decodedPositions).to.deep.equal(Array.from(positions));

        // the triangle codec may rotate the vertices of a triangle, keeping its winding
        const decodedIndices = [];
        mesh.getIndices(decodedIndices);
        expect(normalizeTriangles(decodedIndices)).to.deep.equal(normalizeTriangles(indices));
    };

    const expectCloseTo = (actual, expected, tolerance) => {
        expect(actual.length).to.equal(expected.length);
        actual.forEach((value, i) => expect(value).to.be.closeTo(expected[i], tolerance));
    };

    it('decodes EXT_meshopt_compression vertex, index and animation data', async function () {
        meshoptInitialize({ decoder: MeshoptDecoder });
        const result = await parse(createFile());

        expectGeometry(getMesh(result));

        const decodedNormals = getNormals(getMesh(result));
        const expectedNormals = Array.from(normals).filter((v, i) => i % 4 !== 3);
        expect(decodedNormals).to.deep.equal(expectedNormals);

        const curveData = result.animations[0].outputs[0].data;
        expect(Array.from(curveData)).to.deep.equal(Array.from(rotations));
    });

    it('decodes KHR_meshopt_compression v1 data with filters', async function () {
        meshoptInitialize({ decoder: MeshoptDecoder });
        const extension = 'KHR_meshopt_compression';
        const result = await parse(createFile({ extension, version: 1, filters: true }));

        expectGeometry(getMesh(result));

        // normals are quantized to normalized bytes by the octahedral filter
        const decodedNormals = getNormals(getMesh(result));
        const expectedNormals = Array.from(normals).filter((v, i) => i % 4 !== 3);
        expectCloseTo(decodedNormals.map(v => v / 127), expectedNormals, 0.03);

        // rotations are quantized to normalized shorts by the quaternion filter, and dequantized
        // to floats by the animation parser
        const curveData = result.animations[0].outputs[0].data;
        expectCloseTo(Array.from(curveData), Array.from(rotations), 0.001);
    });

    it('imports the decoder module from a url on first use', async function () {
        meshoptInitialize({ url: DECODER_URL });
        const result = await parse(createFile());

        expectGeometry(getMesh(result));
    });

    it('fails clearly when the decoder module cannot be loaded', async function () {
        meshoptInitialize({ url: pathToFileURL('missing/meshopt_decoder.mjs').href });
        const err = await parseError(createFile());

        expect(err.message).to.contain('Failed to load the meshopt decoder');
    });

    it('imports the decoder module again after a failed import', async function () {
        // the module is missing for the first load, and in place for the second
        const folder = mkdtempSync(join(tmpdir(), 'meshopt-'));
        const path = join(folder, 'meshopt_decoder.mjs');

        try {
            meshoptInitialize({ url: pathToFileURL(path).href });
            const err = await parseError(createFile());
            expect(err.message).to.contain('Failed to load the meshopt decoder');

            copyFileSync(DECODER_PATH, path);
            expectGeometry(getMesh(await parse(createFile())));
        } finally {
            rmSync(folder, { recursive: true, force: true });
        }
    });

    it('resolves a relative decoder url against the document base', async function () {
        stub(platform, 'environment').value('browser');
        const base = document.createElement('base');
        base.href = DECODER_FOLDER_URL;
        document.head.appendChild(base);

        meshoptInitialize({ url: 'meshopt_decoder.mjs' });
        expectGeometry(getMesh(await parse(createFile())));
    });

    it('resolves a relative decoder url against the worker location', async function () {
        stub(platform, 'environment').value('worker');
        stub(globalThis, 'document').value(undefined);
        globalThis.location = { href: `${DECODER_FOLDER_URL}worker.js` };

        try {
            meshoptInitialize({ url: 'meshopt_decoder.mjs' });
            expectGeometry(getMesh(await parse(createFile())));
        } finally {
            delete globalThis.location;
        }
    });

    it('fails clearly without a decoder or a fallback', async function () {
        const err = await parseError(createFile());

        expect(err.message).to.contain('call meshoptInitialize');
    });

    it('loads the uncompressed fallback when there is no decoder', async function () {
        const result = await parse(createFile({ required: false, fallbackUri: 'embed' }));

        expectGeometry(getMesh(result));
    });

    it('does not download the fallback when there is a decoder', async function () {
        const get = spy(http, 'get');
        meshoptInitialize({ decoder: MeshoptDecoder });
        const result = await parse(createFile({ required: false, fallbackUri: 'fallback.bin' }));

        expectGeometry(getMesh(result));
        expect(get.called).to.equal(false);
    });
});
