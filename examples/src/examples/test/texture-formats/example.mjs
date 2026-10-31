// @config
//
// Test example for texture asset loading — png, dds, ktx2, basis, and hdr parsers.
//
// @flag HIDDEN

import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    CameraComponentSystem,
    Color,
    Entity,
    FILLMODE_FILL_WINDOW,
    RESOLUTION_AUTO,
    TextureHandler,
    TextureRenderer,
    basisInitialize,
    createGraphicsDevice
} from 'playcanvas';

import { deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

// The basis transcoder is required for both .basis and (basis-supercompressed) .ktx2 textures
basisInitialize({
    glueUrl: './assets/wasm/basis/basis.wasm.js',
    wasmUrl: './assets/wasm/basis/basis.wasm.wasm',
    fallbackUrl: './assets/wasm/basis/basis.js'
});

// One texture per supported format, to exercise each texture parser (img / dds / ktx2 / basis / hdr).
// png, dds and ktx2 are the same source image (the PlayCanvas logo) in three encodings.
const assets = {
    png: new Asset('png', 'texture', { url: './assets/textures/playcanvas.png' }, { srgb: true }),
    dds: new Asset('dds', 'texture', { url: './assets/textures/playcanvas.dds' }, { srgb: true }),
    ktx2: new Asset('ktx2', 'texture', { url: './assets/textures/playcanvas.ktx2' }, { srgb: true }),
    basis: new Asset('basis', 'texture', { url: './assets/textures/seaside-rocks01-color.basis' }, { srgb: true }),
    hdr: new Asset('hdr', 'texture', { url: './assets/hdri/st-peters-square.hdr' })
};

const gfxOptions = {
    deviceTypes: [deviceType]
};

const device = await createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new AppOptions();
createOptions.graphicsDevice = device;

createOptions.componentSystems = [CameraComponentSystem];
createOptions.resourceHandlers = [TextureHandler];

const app = new AppBase(canvas);
app.init(createOptions);

const textures = new TextureRenderer(app);

// Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
app.setCanvasFillMode(FILLMODE_FILL_WINDOW);
app.setCanvasResolution(RESOLUTION_AUTO);

// Ensure canvas is resized when window changes size
const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => {
    window.removeEventListener('resize', resize);
});

await new Promise((resolve) => {
    new AssetListLoader(Object.values(assets), app.assets).load(resolve);
});

app.start();

// A camera is required to render the texture previews
const camera = new Entity();
camera.addComponent('camera', {
    clearColor: new Color(0.1, 0.1, 0.1)
});
app.root.addChild(camera);

// Grid layout in normalized viewport coordinates, one tile per format
const grid = [
    { asset: assets.png, x: 0.15, y: 0.14 },
    { asset: assets.dds, x: 0.4, y: 0.14 },
    { asset: assets.ktx2, x: 0.65, y: 0.14 },
    { asset: assets.basis, x: 0.275, y: 0.56 },
    { asset: assets.hdr, x: 0.525, y: 0.56 }
];

// Submit the texture previews every frame
app.on('update', () => {
    grid.forEach(({ asset, x, y }) => {
        textures.draw(asset.resource, x, y, 0.2, 0.3);
    });
});
