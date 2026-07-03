// @config
//
// @credit
// title: bench_wooden_01
// author: Sketchfab
// source: https://sketchfab.com/3d-models/bench-wooden-01-1400c9340d5049589deb43601462ac55
// license: CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)

import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    CameraComponentSystem,
    Color,
    ContainerHandler,
    Entity,
    FILLMODE_FILL_WINDOW,
    LightComponentSystem,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    TEXTURETYPE_RGBP,
    TONEMAP_ACES,
    TextureHandler,
    UsdzExporter,
    createGraphicsDevice
} from 'playcanvas';

import { data, deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

// Add AR button to download the usdz file
const appInner = /** @type {HTMLElement} */ (document.getElementById('appInner'));
const div = document.createElement('div');
div.style.cssText = 'width:100%; position:absolute; top:10px';
div.innerHTML = `<div style="text-align: center;">
    <a id="ar-link" rel="ar" download="bench.usdz">
        <img src="${'./assets/textures/transparent.png'}" id="button" width="200"/>
    </a>    
</div>`;
appInner.appendChild(div);

const assets = {
    helipad: new Asset(
        'helipad-env-atlas',
        'texture',
        { url: './assets/cubemaps/helipad-env-atlas.png' },
        { type: TEXTURETYPE_RGBP, mipmaps: false }
    ),
    bench: new Asset('bench', 'container', { url: './assets/models/bench_wooden_01.glb' })
};

const gfxOptions = {
    deviceTypes: [deviceType]
};

const device = await createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new AppOptions();
createOptions.graphicsDevice = device;

createOptions.componentSystems = [RenderComponentSystem, CameraComponentSystem, LightComponentSystem];
createOptions.resourceHandlers = [TextureHandler, ContainerHandler];

const app = new AppBase(canvas);
app.init(createOptions);

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

// Get the instance of the bench and set up with render component
const entity = assets.bench.resource.instantiateRenderEntity();
app.root.addChild(entity);

// Create an Entity with a camera component
const camera = new Entity();
camera.addComponent('camera', {
    clearColor: new Color(0.2, 0.1, 0.1),
    farClip: 100,
    toneMapping: TONEMAP_ACES
});
camera.translate(-3, 1, 2);
camera.lookAt(0, 0.5, 0);
app.root.addChild(camera);

// Set skybox
app.scene.envAtlas = assets.helipad.resource;
app.scene.skyboxMip = 1;

// a link element, created in the html part of the examples.
const link = document.getElementById('ar-link');

// Convert the loaded entity into asdz file
const options = {
    maxTextureSize: 1024
};

new UsdzExporter()
    .build(entity, options)
    .then((arrayBuffer) => {
        const blob = new Blob([arrayBuffer], { type: 'application/octet-stream' });
        // On iPhone Safari, this link creates a clickable AR link on the screen. When this is clicked,
        // the download of the .asdz file triggers its opening in QuickLook AT mode.
        // In other browsers, this simply downloads the generated .asdz file.

        // @ts-ignore
        link.href = URL.createObjectURL(blob);
    })
    .catch(console.error);

// When clicking on the download UI button, trigger the download
data.on('download', () => {
    link.click();
});

// Spin the meshe
app.on('update', (dt) => {
    if (entity) {
        entity.rotate(0, -12 * dt, 0);
    }
});
