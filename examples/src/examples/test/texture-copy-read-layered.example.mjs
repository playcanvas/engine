// @config
//
// Hidden test for Texture.read() and Texture.copy() on layered textures - cubemap faces, texture
// array layers and the depth slices of volume textures, including whole volume reads and copies,
// sub-regions and mip levels. Each texel holds a unique value, and every result is verified by
// reading it back. Runs on both WebGL2 and WebGPU.
//
// @flag HIDDEN

import {
    ADDRESS_CLAMP_TO_EDGE,
    AppBase,
    AppOptions,
    CameraComponentSystem,
    Color,
    Entity,
    FILLMODE_FILL_WINDOW,
    FILTER_NEAREST,
    PIXELFORMAT_RGBA8,
    RESOLUTION_AUTO,
    Texture,
    createGraphicsDevice
} from 'playcanvas';

import { deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const device = await createGraphicsDevice(canvas, { deviceTypes: [deviceType] });
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new AppOptions();
createOptions.graphicsDevice = device;
createOptions.componentSystems = [CameraComponentSystem];

const app = new AppBase(canvas);
app.init(createOptions);
app.setCanvasFillMode(FILLMODE_FILL_WINDOW);
app.setCanvasResolution(RESOLUTION_AUTO);

const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => {
    window.removeEventListener('resize', resize);
});

app.start();

const camera = new Entity();
camera.addComponent('camera', {
    clearColor: new Color(0.1, 0.1, 0.1)
});
app.root.addChild(camera);

// Result overlay
const resultOverlay = document.createElement('div');
resultOverlay.style.cssText = `
    position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
    font-family: monospace; font-size: 14px; color: white;
    background: rgba(0,0,0,0.7); padding: 12px 18px; border-radius: 4px;
    z-index: 1000; white-space: pre-wrap;`;
resultOverlay.textContent = 'Running...';
document.body.appendChild(resultOverlay);

/**
 * Creates the pixels of a single layer, where each texel holds a unique value derived from its
 * position, the layer and a seed, so a wrong layer, row order or offset is detected.
 *
 * @param {number} width - The width of the layer.
 * @param {number} height - The height of the layer.
 * @param {number} layer - The index of the layer.
 * @param {number} seed - A value distinguishing the textures.
 * @returns {Uint8Array} The RGBA8 pixels.
 */
const layerPixels = (width, height, layer, seed) => {
    const data = new Uint8Array(width * height * 4);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const o = (y * width + x) * 4;
            data[o] = x * 16 + seed;
            data[o + 1] = y * 16 + seed;
            data[o + 2] = layer * 24 + seed;
            data[o + 3] = 255 - seed;
        }
    }
    return data;
};

/**
 * Concatenates the pixels of several layers.
 *
 * @param {Uint8Array[]} layers - The pixels of the layers.
 * @returns {Uint8Array} The concatenated pixels.
 */
const concat = (layers) => {
    const result = new Uint8Array(layers.reduce((sum, layer) => sum + layer.length, 0));
    let offset = 0;
    layers.forEach((layer) => {
        result.set(layer, offset);
        offset += layer.length;
    });
    return result;
};

/**
 * Extracts a sub-rectangle of the pixels of a layer.
 *
 * @param {Uint8Array} data - The pixels of the layer.
 * @param {number} width - The width of the layer.
 * @param {number} x - The left edge of the rectangle.
 * @param {number} y - The top edge of the rectangle.
 * @param {number} w - The width of the rectangle.
 * @param {number} h - The height of the rectangle.
 * @returns {Uint8Array} The pixels of the rectangle.
 */
const rect = (data, width, x, y, w, h) => {
    const result = new Uint8Array(w * h * 4);
    for (let row = 0; row < h; row++) {
        result.set(data.subarray(((y + row) * width + x) * 4, ((y + row) * width + x + w) * 4), row * w * 4);
    }
    return result;
};

const textureOptions = {
    format: PIXELFORMAT_RGBA8,
    mipmaps: false,
    minFilter: FILTER_NEAREST,
    magFilter: FILTER_NEAREST,
    addressU: ADDRESS_CLAMP_TO_EDGE,
    addressV: ADDRESS_CLAMP_TO_EDGE,
    addressW: ADDRESS_CLAMP_TO_EDGE
};

/**
 * Creates a texture with the specified pixels, uploaded right away.
 *
 * @param {object} options - The texture options.
 * @returns {Texture} The texture.
 */
const createTexture = (options) => {
    const texture = new Texture(device, { ...textureOptions, ...options });
    texture.upload();
    return texture;
};

const results = [];

/**
 * Compares a result against the expected pixels and records it.
 *
 * @param {string} label - The name of the check.
 * @param {ArrayLike<number>} actual - The pixels read back.
 * @param {Uint8Array} expected - The expected pixels.
 */
const check = (label, actual, expected) => {
    let passed = actual.length === expected.length;
    for (let i = 0; passed && i < expected.length; i++) {
        passed = actual[i] === expected[i];
    }
    results.push({ label, passed });
    console.log(`${passed ? 'PASS' : 'FAIL'}: ${label}`);
};

const read = (texture, w, h, options) => texture.read(0, 0, w, h, { immediate: true, ...options });

// ----- cubemap faces -----
{
    const size = 8;
    const faces = [0, 1, 2, 3, 4, 5].map((face) => layerPixels(size, size, face, 1));
    const cube = createTexture({ name: 'cube-src', width: size, height: size, cubemap: true, levels: [faces] });
    const faceReads = await Promise.all(faces.map((pixels, face) => read(cube, size, size, { face })));
    faceReads.forEach((pixels, face) => check(`cubemap: read face ${face}`, pixels, faces[face]));

    const dstFaces = [0, 1, 2, 3, 4, 5].map((face) => layerPixels(size, size, face, 7));
    const dst = createTexture({ name: 'cube-dst', width: size, height: size, cubemap: true, levels: [dstFaces] });
    dst.copy(cube, { face: 3 });
    check('cubemap: copy face 3', await read(dst, size, size, { face: 3 }), faces[3]);
    check('cubemap: copy face 3 leaves face 2 untouched', await read(dst, size, size, { face: 2 }), dstFaces[2]);

    // copy the top-left quarter of face 5 into the bottom-right quarter
    const half = size / 2;
    dst.copy(cube, { face: 5, sourceX: 0, sourceY: 0, width: half, height: half, destX: half, destY: half });
    const face5 = await read(dst, size, size, { face: 5 });
    check(
        'cubemap: copy face 5 sub-region',
        rect(face5, size, half, half, half, half),
        rect(faces[5], size, 0, 0, half, half)
    );
}

// ----- texture array layers -----
{
    const size = 8;
    const layers = [0, 1, 2].map((layer) => layerPixels(size, size, layer, 2));
    const array = createTexture({ name: 'array-src', width: size, height: size, arrayLength: 3, levels: [layers] });
    check('array: read layer 2', await read(array, size, size, { layer: 2 }), layers[2]);

    const dstLayers = [0, 1, 2].map((layer) => layerPixels(size, size, layer, 8));
    const dst = createTexture({ name: 'array-dst', width: size, height: size, arrayLength: 3, levels: [dstLayers] });
    dst.copy(array, { layer: 1 });
    check('array: copy layer 1', await read(dst, size, size, { layer: 1 }), layers[1]);
    check('array: copy layer 1 leaves layer 0 untouched', await read(dst, size, size, { layer: 0 }), dstLayers[0]);
}

// ----- volume depth slices -----
{
    const size = 8;
    const depth = 6;
    const slices = [...Array(depth).keys()].map((slice) => layerPixels(size, size, slice, 3));
    const volume = createTexture({
        name: 'volume-src',
        width: size,
        height: size,
        depth,
        volume: true,
        levels: [concat(slices)]
    });
    const sliceReads = await Promise.all(slices.map((pixels, slice) => read(volume, size, size, { slice })));
    sliceReads.forEach((pixels, slice) => check(`volume: read slice ${slice}`, pixels, slices[slice]));
    check('volume: read all slices', await read(volume, size, size, {}), concat(slices));

    // a reused output buffer larger than the read receives the slices packed at its start
    const allSlices = concat(slices);
    const oversized = new Uint8Array(allSlices.length * 2);
    const oversizedRead = await read(volume, size, size, { data: oversized });
    check('volume: read all slices into an oversized buffer', oversizedRead.subarray(0, allSlices.length), allSlices);

    // a single slice
    const dstSlices = [...Array(depth).keys()].map((slice) => layerPixels(size, size, slice, 9));
    const dst = createTexture({
        name: 'volume-dst',
        width: size,
        height: size,
        depth,
        volume: true,
        levels: [concat(dstSlices)]
    });
    dst.copy(volume, { slice: 4 });
    check('volume: copy slice 4', await read(dst, size, size, { slice: 4 }), slices[4]);
    check('volume: copy slice 4 leaves slice 3 untouched', await read(dst, size, size, { slice: 3 }), dstSlices[3]);

    // all slices
    const dstAll = createTexture({
        name: 'volume-dst-all',
        width: size,
        height: size,
        depth,
        volume: true,
        levels: [concat(dstSlices)]
    });
    dstAll.copy(volume);
    check('volume: copy all slices', await read(dstAll, size, size, {}), concat(slices));

    // a sub-region of all slices
    const half = size / 2;
    const dstRegion = createTexture({
        name: 'volume-dst-region',
        width: size,
        height: size,
        depth,
        volume: true,
        levels: [concat(dstSlices)]
    });
    dstRegion.copy(volume, { sourceX: 0, sourceY: 0, width: half, height: half, destX: half, destY: half });
    const region = await read(dstRegion, size, size, {});
    const regionPassed = slices.every((slice, i) => {
        const actual = rect(
            region.subarray(i * size * size * 4, (i + 1) * size * size * 4),
            size,
            half,
            half,
            half,
            half
        );
        const expected = rect(slice, size, 0, 0, half, half);
        return actual.every((v, j) => v === expected[j]);
    });
    check('volume: copy a sub-region of all slices', [regionPassed ? 1 : 0], new Uint8Array([1]));
}

// ----- volume mip levels -----
{
    // an 8x8x6 volume has 4 mip levels: 8x8x6, 4x4x3, 2x2x1 and 1x1x1
    const sizes = [
        [8, 6],
        [4, 3],
        [2, 1],
        [1, 1]
    ];
    const levels = sizes.map(([size, depth], level) =>
        concat([...Array(depth).keys()].map((slice) => layerPixels(size, size, slice, 4 + level)))
    );
    const volume = createTexture({
        name: 'volume-mips',
        width: 8,
        height: 8,
        depth: 6,
        volume: true,
        mipmaps: true,
        levels
    });
    check('volume mips: 4 mip levels', [volume.numLevels], new Uint8Array([4]));
    check('volume mips: read all slices of mip 1', await read(volume, 4, 4, { mipLevel: 1 }), levels[1]);

    // a buffer sized for the whole mip 0 reused for the smaller mip 1
    const mip0Buffer = new Uint8Array(levels[0].length);
    const mip1Read = await read(volume, 4, 4, { mipLevel: 1, data: mip0Buffer });
    check(
        'volume mips: read all slices of mip 1 into a mip 0 sized buffer',
        mip1Read.subarray(0, levels[1].length),
        levels[1]
    );
    check(
        'volume mips: read slice 2 of mip 1',
        await read(volume, 4, 4, { mipLevel: 1, slice: 2 }),
        layerPixels(4, 4, 2, 5)
    );

    // all slices of the source mip 1 into the destination mip 0
    const dst = createTexture({ name: 'volume-mips-dst', width: 4, height: 4, depth: 3, volume: true });
    dst.copy(volume, { sourceMipLevel: 1 });
    check('volume mips: copy all slices of mip 1 to mip 0', await read(dst, 4, 4, {}), levels[1]);
}

// Summary
const passedCount = results.filter((r) => r.passed).length;
const allPassed = passedCount === results.length;
const lines = results.map((r) => `${r.passed ? '✓' : '✗'} ${r.label}`);
resultOverlay.textContent = `${device.deviceType.toUpperCase()}: ${allPassed ? 'ALL TESTS PASSED' : 'TESTS FAILED'} (${passedCount}/${results.length})\n\n${lines.join('\n')}`;
resultOverlay.style.color = allPassed ? '#7CFC7C' : '#FF6B6B';
console.log(
    `Texture layered read / copy: ${passedCount}/${results.length} passed on ${device.deviceType.toUpperCase()}`
);

export { app };
