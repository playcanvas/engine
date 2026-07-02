import * as pc from 'playcanvas';

import { deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

// the basis transcoder is required for both .basis and (basis-supercompressed) .ktx2 textures
pc.basisInitialize({
    glueUrl: './assets/wasm/basis/basis.wasm.js',
    wasmUrl: './assets/wasm/basis/basis.wasm.wasm',
    fallbackUrl: './assets/wasm/basis/basis.js'
});

// one texture per supported format, to exercise each texture parser (img / dds / ktx2 / basis / hdr).
// png, dds and ktx2 are the same source image (the PlayCanvas logo) in three encodings.
const assets = {
    png: new pc.Asset('png', 'texture', { url: './assets/textures/playcanvas.png' }, { srgb: true }),
    dds: new pc.Asset('dds', 'texture', { url: './assets/textures/playcanvas.dds' }, { srgb: true }),
    ktx2: new pc.Asset('ktx2', 'texture', { url: './assets/textures/playcanvas.ktx2' }, { srgb: true }),
    basis: new pc.Asset('basis', 'texture', { url: './assets/textures/seaside-rocks01-color.basis' }, { srgb: true }),
    hdr: new pc.Asset('hdr', 'texture', { url: './assets/hdri/st-peters-square.hdr' })
};

const gfxOptions = {
    deviceTypes: [deviceType]
};

const device = await pc.createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new pc.AppOptions();
createOptions.graphicsDevice = device;

createOptions.componentSystems = [pc.CameraComponentSystem];
createOptions.resourceHandlers = [pc.TextureHandler];

const app = new pc.AppBase(canvas);
app.init(createOptions);

// Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
app.setCanvasResolution(pc.RESOLUTION_AUTO);

// Ensure canvas is resized when window changes size
const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => {
    window.removeEventListener('resize', resize);
});

await new Promise((resolve) => {
    new pc.AssetListLoader(Object.values(assets), app.assets).load(resolve);
});

app.start();

// a camera is required to render the immediate-mode textures
const camera = new pc.Entity();
camera.addComponent('camera', {
    clearColor: new pc.Color(0.1, 0.1, 0.1)
});
app.root.addChild(camera);

// grid layout (screen-space NDC, -1..1), one tile per format
const grid = [
    { asset: assets.png, x: -0.5, y: 0.42 },
    { asset: assets.dds, x: 0.0, y: 0.42 },
    { asset: assets.ktx2, x: 0.5, y: 0.42 },
    { asset: assets.basis, x: -0.25, y: -0.42 },
    { asset: assets.hdr, x: 0.25, y: -0.42 }
];

// immediate-mode texture draws must be re-issued every frame
app.on('update', () => {
    grid.forEach(({ asset, x, y }) => {
        app.drawTexture(x, y, 0.4, 0.6, asset.resource);
    });
});
