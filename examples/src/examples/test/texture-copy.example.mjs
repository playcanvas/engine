// @config
//
// Hidden test for Texture.copy() - copies regions / mip levels between textures and verifies the
// result by reading it back. The left column shows each source texture, the right column shows the
// copied result. Runs on both WebGL2 and WebGPU.
//
// @flag HIDDEN

import {
    ADDRESS_CLAMP_TO_EDGE,
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    CameraComponentSystem,
    Color,
    ELEMENTTYPE_IMAGE,
    ElementComponentSystem,
    Entity,
    FILLMODE_FILL_WINDOW,
    FILTER_NEAREST,
    PIXELFORMAT_RGBA8,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    SCALEMODE_BLEND,
    ScreenComponentSystem,
    Texture,
    TextureHandler,
    Vec2,
    createGraphicsDevice
} from 'playcanvas';

import { deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    playcanvas: new Asset('playcanvas', 'texture', { url: './assets/textures/playcanvas.png' })
};

const gfxOptions = {
    deviceTypes: [deviceType],
    glslangUrl: './assets/wasm/glslang/glslang.js',
    twgslUrl: './assets/wasm/twgsl/twgsl.js'
};

const device = await createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new AppOptions();
createOptions.graphicsDevice = device;
createOptions.componentSystems = [
    RenderComponentSystem,
    CameraComponentSystem,
    ScreenComponentSystem,
    ElementComponentSystem
];
createOptions.resourceHandlers = [TextureHandler];

const app = new AppBase(canvas);
app.init(createOptions);
app.setCanvasFillMode(FILLMODE_FILL_WINDOW);
app.setCanvasResolution(RESOLUTION_AUTO);

const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => {
    window.removeEventListener('resize', resize);
});

// Device info overlay
const deviceInfo = document.createElement('div');
deviceInfo.style.cssText = `
    position: absolute; top: 12px; left: 50%; transform: translateX(-50%);
    font-family: Arial, sans-serif; font-size: 16px; color: white;
    background: rgba(0,0,0,0.7); padding: 6px 14px; border-radius: 4px; z-index: 1000;`;
deviceInfo.textContent = `Device: ${device.deviceType.toUpperCase()} - left: source, right: Texture.copy() result`;
document.body.appendChild(deviceInfo);

// Result overlay
const resultOverlay = document.createElement('div');
resultOverlay.style.cssText = `
    position: absolute; bottom: 12px; left: 50%; transform: translateX(-50%);
    font-family: monospace; font-size: 14px; color: white;
    background: rgba(0,0,0,0.7); padding: 8px 16px; border-radius: 4px;
    z-index: 1000; white-space: pre-wrap; text-align: center;`;
document.body.appendChild(resultOverlay);

const RGBA8 = PIXELFORMAT_RGBA8;

/**
 * Create an RGBA8 texture, optionally with custom per-mip-level data.
 *
 * @param {string} name - Texture name.
 * @param {number} size - Width and height.
 * @param {boolean} mipmaps - Whether to allocate a full mip chain.
 * @returns {Texture} The created texture.
 */
function createTexture(name, size, mipmaps) {
    return new Texture(device, {
        name,
        width: size,
        height: size,
        format: RGBA8,
        mipmaps,
        minFilter: FILTER_NEAREST,
        magFilter: FILTER_NEAREST,
        addressU: ADDRESS_CLAMP_TO_EDGE,
        addressV: ADDRESS_CLAMP_TO_EDGE
    });
}

/**
 * Fill a mip level of a texture with a flat RGBA color.
 *
 * @param {Texture} texture - The texture.
 * @param {number} level - The mip level.
 * @param {number[]} rgba - The color, 4 values 0-255.
 */
function fillLevel(texture, level, rgba) {
    const data = texture.lock({ level });
    for (let i = 0; i < data.length; i += 4) {
        data[i] = rgba[0];
        data[i + 1] = rgba[1];
        data[i + 2] = rgba[2];
        data[i + 3] = rgba[3];
    }
    texture.unlock();
}

/**
 * Fill a mip level with a 2x2 quadrant pattern (4 distinct colors), to make region copies visible.
 *
 * @param {Texture} texture - The texture.
 * @param {number} size - The level dimension.
 * @param {number[][]} colors - Four RGBA colors for TL, TR, BL, BR quadrants.
 */
function fillQuadrants(texture, size, colors) {
    const data = texture.lock({ level: 0 });
    const half = size / 2;
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const q = (y < half ? 0 : 2) + (x < half ? 0 : 1);
            const o = (y * size + x) * 4;
            data[o] = colors[q][0];
            data[o + 1] = colors[q][1];
            data[o + 2] = colors[q][2];
            data[o + 3] = colors[q][3];
        }
    }
    texture.unlock();
}

// Create a 2D screen for displaying the textures
const screen = new Entity();
screen.addComponent('screen', {
    referenceResolution: new Vec2(960, 720),
    scaleMode: SCALEMODE_BLEND,
    scaleBlend: 0.5,
    screenSpace: true
});
app.root.addChild(screen);

const DISPLAY = 96; // on-screen size of each texture
const GAP = 24;
let rowY = 70;

/**
 * Add an image element showing a texture at a grid cell.
 *
 * @param {Texture} texture - The texture to show.
 * @param {number} col - Column index (0 = source, 1 = copy).
 * @param {number} y - Top y position in reference pixels.
 */
function addImage(texture, col, y) {
    const e = new Entity();
    e.addComponent('element', {
        type: ELEMENTTYPE_IMAGE,
        anchor: [0, 1, 0, 1],
        pivot: [0, 1],
        width: DISPLAY,
        height: DISPLAY,
        texture
    });
    e.setLocalPosition(120 + col * (DISPLAY + GAP), -y, 0);
    screen.addChild(e);
}

/**
 * Compare two RGBA byte arrays.
 *
 * @param {ArrayLike<number>} a - First array.
 * @param {ArrayLike<number>} b - Second array.
 * @returns {boolean} True if equal.
 */
function equalPixels(a, b) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return false;
    }
    return true;
}

await new Promise((resolve) => {
    new AssetListLoader(Object.values(assets), app.assets).load(resolve);
});

app.start();

// Orthographic camera so the screen renders
const camera = new Entity();
camera.addComponent('camera', {
    clearColor: new Color(0.1, 0.1, 0.1)
});
app.root.addChild(camera);

const results = [];

/**
 * Run one test row: display source + copy, then verify the copy via readback.
 *
 * @param {string} label - Row label.
 * @param {Texture} source - Source texture (shown left).
 * @param {Texture} dest - Destination texture (shown right).
 * @param {object} options - Copy options.
 * @param {Uint8Array} expected - Expected destination pixels (mip 0 of the copied region).
 * @param {number} readW - Width to read back from dest.
 * @param {number} readH - Height to read back from dest.
 */
const runRow = async (label, source, dest, options, expected, readW, readH) => {
    const ok = dest.copy(source, options);
    addImage(source, 0, rowY);
    addImage(dest, 1, rowY);
    rowY += DISPLAY + GAP;

    let passed = ok;
    let detail = '';
    if (ok) {
        const actual = await dest.read(0, 0, readW, readH, { immediate: true });
        passed = equalPixels(expected, actual);
        if (!passed) detail = ' (pixel mismatch)';
    } else {
        detail = ' (copy returned false)';
    }
    console.log(`${passed ? 'PASS' : 'FAIL'}: ${label}${detail}`);
    results.push({ label, passed });
};

const RED = [220, 40, 40, 255];
const GREEN = [40, 200, 40, 255];
const BLUE = [40, 80, 230, 255];
const YELLOW = [230, 220, 40, 255];

// Row 1: loaded texture, full copy of mip 0
{
    const src = assets.playcanvas.resource;
    const w = src.width;
    const h = src.height;
    const dst = new Texture(device, {
        name: 'copy-loaded',
        width: w,
        height: h,
        format: src.format,
        mipmaps: false,
        minFilter: FILTER_NEAREST,
        magFilter: FILTER_NEAREST,
        addressU: ADDRESS_CLAMP_TO_EDGE,
        addressV: ADDRESS_CLAMP_TO_EDGE
    });
    const expected = await src.read(0, 0, w, h, { immediate: true });
    await runRow('loaded texture, full copy', src, dst, {}, expected, w, h);
}

// Row 2: procedural quadrants, full copy of mip 0
{
    const size = 64;
    const src = createTexture('quads-src', size, false);
    fillQuadrants(src, size, [RED, GREEN, BLUE, YELLOW]);
    src.upload();
    const dst = createTexture('quads-dst', size, false);
    const expected = await src.read(0, 0, size, size, { immediate: true });
    await runRow('procedural, full copy', src, dst, {}, expected, size, size);
}

// Row 3: copy source mip 1 into a destination's mip 0. The source is a mipmapped quadrant
// texture; the expected result is a direct read of the source's mip 1, so this verifies that
// the copy correctly selects the requested source mip level (independent of how mips are made).
{
    const size = 64;
    const src = createTexture('mips-src', size, true);
    fillQuadrants(src, size, [RED, GREEN, BLUE, YELLOW]);
    src.upload();
    const mip1Size = size >> 1;
    const dst = createTexture('mips-dst', mip1Size, false);
    const expected = await src.read(0, 0, mip1Size, mip1Size, { mipLevel: 1, immediate: true });
    await runRow('source mip 1 -> dest mip 0', src, dst, { sourceMipLevel: 1 }, expected, mip1Size, mip1Size);
}

// Row 4: sub-rect - copy the top-left 32x32 quadrant of the source into dest at offset (32, 32)
{
    const size = 64;
    const src = createTexture('subrect-src', size, false);
    fillQuadrants(src, size, [RED, GREEN, BLUE, YELLOW]);
    src.upload();
    const dst = createTexture('subrect-dst', size, false);
    // pre-fill dest with a flat background so the copied region is visible
    fillLevel(dst, 0, [60, 60, 60, 255]);
    dst.upload();
    const half = size / 2;
    // Build expected: grey background with the source's top-left (RED) quadrant placed at (32,32)
    const expected = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const o = (y * size + x) * 4;
            const inRegion = x >= half && y >= half;
            const c = inRegion ? RED : [60, 60, 60, 255];
            expected[o] = c[0];
            expected[o + 1] = c[1];
            expected[o + 2] = c[2];
            expected[o + 3] = c[3];
        }
    }
    await runRow(
        'sub-rect copy (offset)',
        src,
        dst,
        { sourceX: 0, sourceY: 0, width: half, height: half, destX: half, destY: half },
        expected,
        size,
        size
    );
}

// Summary
const passedCount = results.filter((r) => r.passed).length;
const allPassed = passedCount === results.length;
const lines = results.map((r) => `${r.passed ? '✓' : '✗'} ${r.label}`);
resultOverlay.textContent = `${allPassed ? 'ALL TESTS PASSED' : 'TESTS FAILED'} (${passedCount}/${results.length})\n${lines.join('\n')}`;
resultOverlay.style.color = allPassed ? '#7CFC7C' : '#FF6B6B';
console.log(`Texture.copy: ${passedCount}/${results.length} passed on ${device.deviceType.toUpperCase()}`);

export { app };
