// @config
//
// GPU regression test for TextureRenderer. Compares rendered pixels against CPU reference values
// for every reachable shader variant, output gamma, channel selection, raw depth and scene-depth encoding.
// Cubemaps are checked for their cross layout, face orientation, mip selection along cell edges, raw
// channels, unfilterable float and depth sampling.
// Also creates and removes textures every three frames, checking slot reuse and resource counts.
// Live output and a gallery show the actual framebuffer pixels alongside the test report.
// Select WebGL2, WebGPU or WebGPU (Bare) to run the tests on that backend.
//
// @flag HIDDEN
// @flag NO_MINISTATS

import {
    AppBase,
    AppOptions,
    CameraComponentSystem,
    Color,
    Entity,
    FILTER_LINEAR,
    FILTER_LINEAR_MIPMAP_LINEAR,
    FILTER_NEAREST,
    GAMMA_NONE,
    GAMMA_SRGB,
    PIXELFORMAT_DEPTH,
    PIXELFORMAT_DEPTH16,
    PIXELFORMAT_DEPTHSTENCIL,
    PIXELFORMAT_R32F,
    PIXELFORMAT_RGBA8,
    PIXELFORMAT_RGBA32F,
    PIXELFORMAT_SRGBA8,
    PROJECTION_ORTHOGRAPHIC,
    PROJECTION_PERSPECTIVE,
    RENDERTARGET_ORIGIN_TOP,
    RenderPass,
    RenderTarget,
    Texture,
    TextureRenderer,
    TEXTURETYPE_DEFAULT,
    TEXTURETYPE_RGBM,
    TEXTURETYPE_RGBE,
    TEXTURETYPE_RGBP,
    createGraphicsDevice
} from 'playcanvas';

import { deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));

const device = await createGraphicsDevice(canvas, { deviceTypes: [deviceType] });
const options = new AppOptions();
options.graphicsDevice = device;
options.componentSystems = [CameraComponentSystem];
const app = new AppBase(canvas);
app.init(options);
const renderer = new TextureRenderer(app);
const resources = new Set();
let destroyed = false;

// Dispose in-flight fixtures too if the example is stopped or its graphics backend is changed.
const track = (resource) => {
    resources.add(resource);
    return resource;
};
const release = (resource) => {
    resources.delete(resource);
    resource.destroy();
};
const cleanup = () => {
    renderer.destroy();
    for (const resource of resources) resource.destroy();
    resources.clear();
};
const output = track(new Texture(device, { width: 64, height: 64, format: PIXELFORMAT_RGBA8, mipmaps: false }));
const target = track(new RenderTarget({ colorBuffer: output, depth: false, origin: RENDERTARGET_ORIGIN_TOP }));
const camera = new Entity('Shader test camera');
camera.addComponent('camera', { renderTarget: target, clearColor: new Color(0, 0, 0), nearClip: 1, farClip: 10 });
app.root.addChild(camera);
const serial = (values, fn) => values.reduce((previous, value) => previous.then(() => fn(value)), Promise.resolve());
const passed = [];
const variants = new Set();
// the depth cube variant is only exercised on WebGL2, see the cubemap tests
const expectedVariants = device.isWebGPU ? 17 : 18;
let lifecycleFrames = 0;
// Show the actual pixels read from the test target. A separate canvas keeps presentation from
// adding textures, materials or layers to the resource counts being checked below.
const dashboard = document.createElement('div');
dashboard.style.cssText =
    'position:absolute;inset:0;display:grid;grid-template-columns:minmax(0,1fr) minmax(260px,34%);gap:24px;padding:24px;background:#101820;color:#d5e3ed;overflow:auto;font:13px/1.6 monospace;';
const visual = document.createElement('div');
visual.style.cssText = 'min-width:0;overflow:auto;';
const heading = document.createElement('h2');
heading.textContent = 'TextureRenderer / GPU output';
heading.style.margin = '0 0 16px';
visual.appendChild(heading);
const live = document.createElement('canvas');
live.width = live.height = 64;
live.id = 'texture-renderer-preview';
live.style.cssText =
    'display:block;width:min(100%,256px);aspect-ratio:1;image-rendering:pixelated;border:1px solid #455566;background:#000;';
const liveContext = live.getContext('2d');
visual.appendChild(live);
const caption = document.createElement('p');
caption.textContent = 'Waiting for the first rendered frame…';
visual.appendChild(caption);
const galleryHeading = document.createElement('h3');
galleryHeading.textContent = 'Shader variants';
visual.appendChild(galleryHeading);
const gallery = document.createElement('div');
gallery.id = 'texture-renderer-gallery';
gallery.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:16px;';
visual.appendChild(gallery);
const thumbnails = new Map();
let lifecycle = false;
const report = document.createElement('pre');
report.id = 'texture-renderer-results';
report.style.cssText =
    'margin:0;padding-left:20px;border-left:1px solid #344351;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;font:11px/1.7 monospace;';
dashboard.append(visual, report);
document.body.appendChild(dashboard);

// The shader variant of the first preview, named by its shader and the defines selecting it.
const variantName = () => {
    const { material } = app.scene.defaultDrawLayer.meshInstances[0];
    const defines = Array.from(material.defines, ([key, value]) => (value === true ? key : value)).sort();
    return [material.shaderDesc.uniqueName.replace(/^TextureRenderer-?/, ''), ...defines].filter(Boolean).join(' ');
};
const showPixels = (pixels, updateGallery) => {
    const lastPixels = new ImageData(new Uint8ClampedArray(pixels), 64, 64);
    liveContext.putImageData(lastPixels, 0, 0);
    if (!lifecycle && updateGallery) {
        let name = variantName();
        if (name.includes('RAW_CHANNELS')) name += ` / ${renderer.channels}`;
        let thumbnail = thumbnails.get(name);
        if (!thumbnail) {
            const card = document.createElement('div');
            thumbnail = document.createElement('canvas');
            thumbnail.width = thumbnail.height = 64;
            thumbnail.style.cssText =
                'display:block;width:100%;aspect-ratio:1;image-rendering:pixelated;border:1px solid #344351;';
            const label = document.createElement('div');
            label.textContent = name;
            label.style.cssText = 'margin-top:4px;font-size:11px;overflow-wrap:anywhere;';
            card.append(thumbnail, label);
            gallery.appendChild(card);
            thumbnails.set(name, thumbnail);
        }
        thumbnail.getContext('2d').putImageData(lastPixels, 0, 0);
    }
};
const showReport = (status) => {
    report.dataset.status = status;
    report.textContent = [
        `TextureRenderer — ${deviceType} — ${status.toUpperCase()}`,
        `${variants.size}/${expectedVariants} shader variants | ${passed.length} pixel checks | ${lifecycleFrames}/72 lifecycle frames`,
        '',
        ...passed
    ].join('\n');
};
app.on('destroy', () => {
    destroyed = true;
    cleanup();
    dashboard.remove();
});
const sourceTypes = [TEXTURETYPE_DEFAULT, TEXTURETYPE_RGBM, TEXTURETYPE_RGBE, TEXTURETYPE_RGBP];
const originalFilterable = device.textureFloatFilterable;
const setFiltering = (value) => {
    device.textureFloatFilterable = value;
};
const setGamma = (value) => {
    camera.camera.gammaCorrection = value;
};

const check = (condition, message) => {
    if (!condition) throw new Error(message);
};
const read = async (updateGallery = true) => {
    // Keep each submission on a separate display frame, including the three-frame source lifetime.
    await new Promise((resolve) => {
        requestAnimationFrame(resolve);
    });
    if (destroyed) throw new Error('Example stopped');
    app.render();
    const pixels = await output.read(0, 0, 64, 64, { renderTarget: target, immediate: true });
    if (destroyed) throw new Error('Example stopped');
    showPixels(pixels, updateGallery);
    return pixels;
};
const pixel = (pixels, x, y, expected, label) => {
    caption.textContent = label;
    const actual = Array.from(pixels.slice((y * 64 + x) * 4, (y * 64 + x) * 4 + 4));
    check(
        actual.every((value, i) => Math.abs(value - expected[i]) <= 2),
        `${label}: expected ${expected}, got ${actual}`
    );
};
// CPU reference arithmetic is independent of the generated shader source.
const decode = (raw, encoding, hardwareSrgb) =>
    raw.slice(0, 3).map((value) => {
        if (hardwareSrgb) return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
        if (encoding === 'srgb') return value ** 2.2;
        if (encoding === 'rgbm') return (value * raw[3] * 8) ** 2;
        if (encoding === 'rgbe') return raw[3] === 0 ? 0 : value * 2 ** (raw[3] * 255 - 128);
        if (encoding === 'rgbp') return (value * (8 - raw[3] * 7)) ** 2;
        return value;
    });
const encodeOutput = (linear, gamma) => [
    ...linear.map((value) => Math.round(Math.min(1, gamma === GAMMA_SRGB ? (value + 1e-7) ** (1 / 2.2) : value) * 255)),
    255
];
const makeSource = (format, type = TEXTURETYPE_DEFAULT, zeroExponent = false, alphaOverride = undefined) => {
    const float = format === PIXELFORMAT_RGBA32F;
    const alpha =
        alphaOverride ??
        (type === TEXTURETYPE_RGBM ? 0.125 : type === TEXTURETYPE_RGBE ? (zeroExponent ? 0 : 128 / 255) : 1);
    const raw = [0.25, 0.45, 0.65, alpha];
    // A patterned fixture makes the UVs and decoding visible; the sampled center retains the
    // exact reference color so the numerical checks remain independent of the pattern.
    const size = 8;
    const values = float ? new Float32Array(size * size * 4) : new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const center = x >= 3 && x <= 4 && y >= 3 && y <= 4;
            const shade = center ? 1 : 0.25 + (0.75 * (x + y)) / (2 * size - 2);
            for (let channel = 0; channel < 4; channel++) {
                const value = raw[channel] * (channel === 3 ? 1 : shade);
                values[(y * size + x) * 4 + channel] = float ? value : Math.round(value * 255);
            }
        }
    }
    const texture = track(
        new Texture(device, {
            width: size,
            height: size,
            format,
            type,
            mipmaps: false,
            minFilter: FILTER_NEAREST,
            magFilter: FILTER_NEAREST,
            levels: [values]
        })
    );
    const centerOffset = (4 * size + 4) * 4;
    return { texture, raw: Array.from(values.slice(centerOffset, centerOffset + 4), (v) => (float ? v : v / 255)) };
};

async function runTests() {
    try {
        await serial([GAMMA_NONE, GAMMA_SRGB], async (gamma) => {
            setGamma(gamma);
            // All reachable mode/encoding combinations: five filtered, four unfilterable.
            // Float formats are linear unless an explicit HDR encoding is selected.
            await serial(['filtered', 'unfilterable'], async (mode) => {
                setFiltering(mode === 'filtered' && originalFilterable);
                const formats = mode === 'filtered' ? [PIXELFORMAT_RGBA8, PIXELFORMAT_SRGBA8] : [PIXELFORMAT_RGBA32F];
                await serial(formats, async (format) => {
                    const types = format === PIXELFORMAT_SRGBA8 ? [TEXTURETYPE_DEFAULT] : sourceTypes;
                    const cases = types.map((type) => ({ type, zeroExponent: false }));
                    if (types.includes(TEXTURETYPE_RGBE)) cases.push({ type: TEXTURETYPE_RGBE, zeroExponent: true });
                    await serial(cases, async ({ type, zeroExponent }) => {
                        const { texture, raw } = makeSource(format, type, zeroExponent);
                        const label = `${mode}/${texture.encoding}/gamma-${gamma}/zero-${zeroExponent}`;
                        renderer.draw(texture, 0, 0, 1, 1);
                        variants.add(variantName());
                        // Keep the representative RGBE sample in the gallery. The zero-exponent
                        // case still appears live and is checked and recorded in the report.
                        const pixels = await read(!zeroExponent);
                        pixel(
                            pixels,
                            32,
                            32,
                            encodeOutput(decode(raw, texture.encoding, format === PIXELFORMAT_SRGBA8), gamma),
                            label
                        );
                        passed.push(label);
                        showReport('running');
                        release(texture);
                    });
                });
            });
        });
        setFiltering(originalFilterable);

        // All 63 non-default selections read stored values, independently of output gamma.
        // sRGB textures exercise hardware color decoding; float textures exercise textureLoad.
        const components = ['r', 'g', 'b', 'a'];
        const selections = components
            .flatMap((r) => components.flatMap((g) => components.map((b) => r + g + b)))
            .filter((channels) => channels !== 'rgb');
        const storedOutput = (raw, channels) => [
            ...Array.from(channels, (channel) => Math.round(raw['rgba'.indexOf(channel)] * 255)),
            255
        ];
        await serial([GAMMA_NONE, GAMMA_SRGB], async (gamma) => {
            setGamma(gamma);
            await serial([PIXELFORMAT_RGBA8, PIXELFORMAT_SRGBA8, PIXELFORMAT_RGBA32F], async (format) => {
                setFiltering(false);
                const { texture, raw } = makeSource(format, TEXTURETYPE_DEFAULT, false, 0.4);
                await serial(selections, async (channels) => {
                    renderer.channels = channels;
                    renderer.draw(texture, 0, 0, 1, 1);
                    variants.add(variantName());
                    const label = `channels/${channels}/format-${format}/gamma-${gamma}`;
                    pixel(
                        await read(['rrr', 'aaa', 'bgr'].includes(channels)),
                        32,
                        32,
                        storedOutput(raw, channels),
                        label
                    );
                    passed.push(label);
                    showReport('running');
                });
                // Switching back to rgb must restore color decoding on the same preview.
                renderer.channels = 'rgb';
                renderer.draw(texture, 0, 0, 1, 1);
                pixel(
                    await read(false),
                    32,
                    32,
                    encodeOutput(decode(raw, texture.encoding, format === PIXELFORMAT_SRGBA8), gamma),
                    'restore-rgb'
                );
                passed.push(`restore-rgb/format-${format}/gamma-${gamma}`);
                release(texture);
            });
            // HDR alpha is metadata for rgb, but must be shown literally in a channel view.
            await serial([PIXELFORMAT_RGBA8, PIXELFORMAT_RGBA32F], async (format) => {
                await serial([TEXTURETYPE_RGBM, TEXTURETYPE_RGBE, TEXTURETYPE_RGBP], async (type) => {
                    const { texture, raw } = makeSource(format, type);
                    renderer.channels = 'aaa';
                    renderer.draw(texture, 0, 0, 1, 1);
                    const label = `hdr-alpha/${texture.encoding}/format-${format}/gamma-${gamma}`;
                    pixel(await read(false), 32, 32, storedOutput(raw, 'aaa'), label);
                    passed.push(label);
                    showReport('running');
                    release(texture);
                });
            });
        });
        setFiltering(originalFilterable);
        // Leave aaa selected to prove that both raw and scene depth ignore channel selection.

        // Raw depth uses a depth texture binding on WebGPU, including comparison textures.
        const samplers = device.isWebGPU
            ? [false, true].flatMap((compareOnRead) =>
                  [FILTER_NEAREST, FILTER_LINEAR].map((filter) => ({ compareOnRead, filter }))
              )
            : [{ compareOnRead: false, filter: FILTER_NEAREST }];
        await serial([PIXELFORMAT_DEPTH, PIXELFORMAT_DEPTH16, PIXELFORMAT_DEPTHSTENCIL], async (format) => {
            await serial(samplers, async ({ compareOnRead, filter }) => {
                const depth = track(
                    new Texture(device, {
                        width: 16,
                        height: 16,
                        format,
                        compareOnRead,
                        mipmaps: false,
                        minFilter: filter,
                        magFilter: filter
                    })
                );
                const depthTarget = track(new RenderTarget({ depthBuffer: depth }));
                const clear = track(new RenderPass(device));
                clear.init(depthTarget);
                clear.setClearDepth(0.35);
                clear.render();
                renderer.draw(depth, 0, 0, 1, 1);
                variants.add(variantName());
                pixel(
                    await read(),
                    32,
                    32,
                    [89, 89, 89, 255],
                    `raw-depth/${format}/compare-${compareOnRead}/filter-${filter}`
                );
                passed.push(`raw-depth/${format}/compare-${compareOnRead}/filter-${filter}`);
                showReport('running');
                release(clear);
                release(depthTarget);
                release(depth);
            });
        });

        // Supply controlled scene-depth fixtures to test every producer encoding, including
        // the WebGL packed fallback, without depending on the machine's renderable formats.
        await serial([GAMMA_NONE, GAMMA_SRGB], async (gamma) => {
            setGamma(gamma);
            await serial([PROJECTION_PERSPECTIVE, PROJECTION_ORTHOGRAPHIC], async (projection) => {
                camera.camera.projection = projection;
                await serial(
                    ['non-linear', 'linear', 'reciprocal', 'reciprocal-empty', ...(device.isWebGPU ? [] : ['packed'])],
                    async (encoding) => {
                        const distance = 4;
                        let stored = distance;
                        if (encoding === 'non-linear') {
                            stored =
                                projection === PROJECTION_PERSPECTIVE
                                    ? (10 * (distance - 1)) / (distance * 9)
                                    : (distance - 1) / 9;
                        }
                        if (encoding === 'reciprocal') stored = 1 / distance;
                        if (encoding === 'reciprocal-empty') stored = 0;
                        const packed = encoding === 'packed';
                        const bits = new ArrayBuffer(4);
                        new DataView(bits).setFloat32(0, stored, false);
                        const values = packed ? new Uint8Array(bits) : new Float32Array([stored]);
                        const depth = track(
                            new Texture(device, {
                                width: 1,
                                height: 1,
                                format: packed ? PIXELFORMAT_RGBA8 : PIXELFORMAT_R32F,
                                mipmaps: false,
                                minFilter: FILTER_NEAREST,
                                magFilter: FILTER_NEAREST,
                                levels: [values]
                            })
                        );
                        const params = camera.camera.shaderParams;
                        params.sceneDepthMapLinear = encoding !== 'non-linear';
                        params.sceneDepthMapPacked = packed;
                        params.sceneDepthMapReciprocal = encoding.startsWith('reciprocal');
                        device.scope.resolve('uSceneDepthMap').setValue(depth);
                        renderer.sceneDepth(0, 0, 1, 1);
                        variants.add(variantName());
                        const label = `scene-depth/${encoding}/projection-${projection}/gamma-${gamma}`;
                        const normalized = encoding === 'reciprocal-empty' ? 1 : 0.4;
                        pixel(await read(), 32, 32, encodeOutput([normalized, normalized, normalized], gamma), label);
                        passed.push(label);
                        showReport('running');
                        release(depth);
                    }
                );
            });
        });
        device.scope.resolve('uSceneDepthMap').setValue(null);

        // Cubemaps display as a 4x3 cross of 16x16 pixel cells. The preview is offset by one pixel,
        // so cell edges fall inside 2x2 pixel quads and implicit derivatives would span two faces.
        // Cells hold the faces in order +X, -X, +Y, -Y, +Z, -Z.
        setGamma(GAMMA_NONE);
        renderer.channels = 'rgb';
        const crossCells = [
            [2, 1],
            [0, 1],
            [1, 0],
            [1, 2],
            [1, 1],
            [3, 1]
        ];
        const emptyCells = [
            [0, 0],
            [2, 0],
            [3, 0],
            [0, 2],
            [2, 2],
            [3, 2]
        ];
        const faceColors = [
            [1, 0, 0],
            [0, 1, 0],
            [0, 0, 1],
            [1, 1, 0],
            [1, 0, 1],
            [0, 1, 1]
        ];
        const cellPixel = ([column, row], x, y) => [1 + column * 16 + x, 1 + row * 16 + y];
        const drawCube = (texture) => {
            renderer.draw(texture, 1 / 64, 1 / 64, 1, 0.75);
            variants.add(variantName());
        };
        // Each 8x8 face is a solid color with a half-intensity top-left quadrant marking its
        // orientation. Smaller mip levels are gray, exposing a level selected from the derivatives
        // of the direction instead of the preview.
        const makeCube = (format, mipmaps) => {
            const float = format === PIXELFORMAT_RGBA32F;
            const levels = [];
            for (let size = 8; size >= (mipmaps ? 1 : 8); size >>= 1) {
                levels.push(
                    faceColors.map((color) => {
                        const values = float ? new Float32Array(size * size * 4) : new Uint8Array(size * size * 4);
                        for (let y = 0; y < size; y++) {
                            for (let x = 0; x < size; x++) {
                                const marker = x < 4 && y < 4;
                                const texel = size === 8 ? color.map((v) => (marker ? v * 0.5 : v)) : [0.5, 0.5, 0.5];
                                for (let channel = 0; channel < 4; channel++) {
                                    const value = channel === 3 ? 1 : texel[channel];
                                    values[(y * size + x) * 4 + channel] = float ? value : Math.round(value * 255);
                                }
                            }
                        }
                        return values;
                    })
                );
            }
            return track(
                new Texture(device, {
                    width: 8,
                    height: 8,
                    format,
                    cubemap: true,
                    mipmaps,
                    minFilter: mipmaps ? FILTER_LINEAR_MIPMAP_LINEAR : FILTER_NEAREST,
                    magFilter: FILTER_NEAREST,
                    levels
                })
            );
        };
        // stored values are decoded by the source encoding, raw channel selections show them as is
        const checkCross = (pixels, label, faceColor, encoding) => {
            const toBytes = (color) => encodeOutput(decode([...color, 1], encoding, false), GAMMA_NONE);
            crossCells.forEach((cell, face) => {
                const color = faceColor(face);
                pixel(pixels, ...cellPixel(cell, 12, 12), toBytes(color), `${label}/face-${face}`);
                pixel(
                    pixels,
                    ...cellPixel(cell, 3, 3),
                    toBytes(color.map((v) => v * 0.5)),
                    `${label}/face-${face}/orientation`
                );
            });
            // the pixels on both sides of every edge between neighboring faces
            const edgePixel = (cell, x, y) => {
                const face = crossCells.findIndex(([column, row]) => column === cell[0] && row === cell[1]);
                pixel(pixels, ...cellPixel(cell, x, y), toBytes(faceColor(face)), `${label}/edge-${face}-${x}-${y}`);
            };
            for (let column = 0; column < 3; column++) {
                edgePixel([column, 1], 15, 12);
                edgePixel([column + 1, 1], 0, 12);
            }
            for (let row = 0; row < 2; row++) {
                edgePixel([1, row], 12, 15);
                edgePixel([1, row + 1], 12, 0);
            }
            emptyCells.forEach((cell) => {
                pixel(pixels, ...cellPixel(cell, 8, 8), [0, 0, 0, 255], `${label}/empty-${cell}`);
            });
            passed.push(label);
            showReport('running');
        };

        const colorCube = makeCube(PIXELFORMAT_RGBA8, true);
        drawCube(colorCube);
        checkCross(await read(), 'cube/filtered', (face) => faceColors[face], colorCube.encoding);
        renderer.channels = 'bgr';
        drawCube(colorCube);
        checkCross(await read(), 'cube/channels-bgr', (face) => faceColors[face].slice().reverse(), 'linear');
        renderer.channels = 'rgb';
        release(colorCube);

        setFiltering(false);
        const floatCube = makeCube(PIXELFORMAT_RGBA32F, false);
        drawCube(floatCube);
        checkCross(await read(), 'cube/unfilterable', (face) => faceColors[face], floatCube.encoding);
        release(floatCube);
        setFiltering(originalFilterable);

        // Depth cubes show each face's cleared depth. The fixture clears one face per render target,
        // which WebGPU depth-only targets do not support, so this runs on WebGL2 only.
        await serial(
            device.isWebGPU ? [] : [PIXELFORMAT_DEPTH, PIXELFORMAT_DEPTH16, PIXELFORMAT_DEPTHSTENCIL],
            async (format) => {
                await serial(samplers, async ({ compareOnRead, filter }) => {
                    const depth = track(
                        new Texture(device, {
                            width: 8,
                            height: 8,
                            format,
                            cubemap: true,
                            compareOnRead,
                            mipmaps: false,
                            minFilter: filter,
                            magFilter: filter
                        })
                    );
                    for (let face = 0; face < 6; face++) {
                        const faceTarget = track(new RenderTarget({ depthBuffer: depth, face }));
                        const clear = track(new RenderPass(device));
                        clear.init(faceTarget);
                        clear.setClearDepth(0.1 + face * 0.15);
                        clear.render();
                        release(clear);
                        release(faceTarget);
                    }
                    drawCube(depth);
                    const pixels = await read();
                    const label = `cube/raw-depth/${format}/compare-${compareOnRead}/filter-${filter}`;
                    crossCells.forEach((cell, face) => {
                        const value = Math.round((0.1 + face * 0.15) * 255);
                        pixel(pixels, ...cellPixel(cell, 8, 8), [value, value, value, 255], `${label}/face-${face}`);
                    });
                    emptyCells.forEach((cell) => {
                        pixel(pixels, ...cellPixel(cell, 8, 8), [0, 0, 0, 255], `${label}/empty-${cell}`);
                    });
                    passed.push(label);
                    showReport('running');
                    release(depth);
                });
            }
        );

        // Every three frames, replace all sources and change the preview count. This
        // includes empty frames, shrink/grow, encoding changes and immediate destruction.
        setGamma(GAMMA_SRGB);
        const layer = app.scene.defaultDrawLayer;
        const counts = [0, 1, 4, 2, 0, 3, 1, 0];
        const lifecycleChannels = ['rgb', 'rrr', 'aaa', 'bgr'];
        lifecycle = true;
        let warmTextureCount;
        let warmInstances;
        await serial([0, 1, 2], async (cycle) => {
            await serial(counts, async (count) => {
                const sources = Array.from({ length: count }, (_, i) =>
                    makeSource(PIXELFORMAT_RGBA8, sourceTypes[(i + cycle) % sourceTypes.length])
                );
                await serial([0, 1, 2], async (frame) => {
                    sources.forEach(({ texture }, i) => {
                        renderer.channels = lifecycleChannels[(i + frame + cycle) % 4];
                        renderer.draw(texture, i / 4, 0, 0.25, 1);
                    });
                    const pixels = await read();
                    for (let i = 0; i < 4; i++) {
                        const source = sources[i];
                        const channels = lifecycleChannels[(i + frame + cycle) % 4];
                        const expected = source
                            ? channels === 'rgb'
                                ? encodeOutput(decode(source.raw, source.texture.encoding, false), GAMMA_SRGB)
                                : storedOutput(source.raw, channels)
                            : [0, 0, 0, 255];
                        pixel(
                            pixels,
                            i * 16 + 8,
                            32,
                            expected,
                            `lifecycle/cycle-${cycle}/count-${count}/frame-${frame}/slot-${i}`
                        );
                    }
                    caption.textContent = `Lifecycle: ${count} textures / cycle ${cycle + 1} / frame ${frame + 1} of 3`;
                    lifecycleFrames++;
                    showReport('running');
                    check(
                        layer.meshInstances.every(
                            (instance) => !instance.visible && instance.material.getParameter('colorMap').data === null
                        ),
                        'Frame cleanup retained a preview or texture'
                    );
                });
                sources.forEach(({ texture }) => release(texture));
            });
            if (cycle === 0) {
                warmTextureCount = device.textures.length;
                warmInstances = layer.meshInstances.slice();
            } else {
                check(device.textures.length === warmTextureCount, 'Texture count grew after destroying sources');
                check(
                    layer.meshInstances.length === 4 &&
                        layer.meshInstances.every((instance, i) => instance === warmInstances[i]),
                    'Preview pool grew or replaced its mesh instances'
                );
            }
        });
        check(
            variants.size === expectedVariants,
            `Expected ${expectedVariants} shader variants, exercised ${variants.size}`
        );
        showReport('passed');
        // Leave a useful result visible after the final empty lifecycle frame.
        const overview = thumbnails.get('decodeGamma');
        liveContext.drawImage(overview, 0, 0);
        caption.textContent =
            'Tests complete. Gallery shows the rendered shader variants; the lifecycle test ended with no active textures.';
    } catch (error) {
        if (!destroyed) {
            passed.push(String(error));
            showReport('failed');
            console.error(error);
        }
    } finally {
        if (!destroyed) {
            setFiltering(originalFilterable);
            device.scope.resolve('uSceneDepthMap').setValue(null);
            camera.camera.renderTarget = null;
            cleanup();
        }
    }
}

showReport('running');
runTests();
