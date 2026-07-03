// @config
//
// @credit
// title: bench_wooden_01
// author: Sketchfab
// source: https://sketchfab.com/3d-models/bench-wooden-01-1400c9340d5049589deb43601462ac55
// license: CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)
//
// @credit
// title: Chess Board
// author: Idmental
// source: https://sketchfab.com/3d-models/chess-board-901eeeca884f4622ac37b7e8f7cb82c3
// license: CC BY 4.0 (http://creativecommons.org/licenses/by/4.0/)

import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    CameraComponentSystem,
    Color,
    ConeGeometry,
    ContainerHandler,
    Entity,
    FILLMODE_FILL_WINDOW,
    GltfExporter,
    LightComponentSystem,
    Mesh,
    MeshInstance,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    SphereGeometry,
    StandardMaterial,
    TEXTURETYPE_RGBP,
    TONEMAP_ACES,
    TextureHandler,
    WasmModule,
    basisInitialize,
    createGraphicsDevice
} from 'playcanvas';

import { data, deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

// Add AR button to download the glb file
const appInner = /** @type {HTMLElement} */ (document.getElementById('appInner'));
const div = document.createElement('div');
div.style.cssText = 'width:100%; position:absolute; top:10px';
div.innerHTML = `<div style="text-align: center;">
    <a id="ar-link" rel="ar" download="scene.glb">
        <img src="${'./assets/textures/transparent.png'}" id="button" width="200"/>
    </a>    
</div>`;
appInner.appendChild(div);

// Set up and load draco module, as the glb we load is draco compressed
WasmModule.setConfig('DracoDecoderModule', {
    glueUrl: './assets/wasm/draco/draco.wasm.js',
    wasmUrl: './assets/wasm/draco/draco.wasm.wasm',
    fallbackUrl: './assets/wasm/draco/draco.js'
});
await new Promise((resolve) => {
    WasmModule.getInstance('DracoDecoderModule', () => resolve(true));
});

// Initialize basis to allow to load compressed textures
basisInitialize({
    glueUrl: './assets/wasm/basis/basis.wasm.js',
    wasmUrl: './assets/wasm/basis/basis.wasm.wasm',
    fallbackUrl: './assets/wasm/basis/basis.js'
});

const assets = {
    helipad: new Asset(
        'helipad-env-atlas',
        'texture',
        { url: './assets/cubemaps/helipad-env-atlas.png' },
        { type: TEXTURETYPE_RGBP, mipmaps: false }
    ),
    bench: new Asset('bench', 'container', { url: './assets/models/bench_wooden_01.glb' }),
    model: new Asset('model', 'container', { url: './assets/models/bitmoji.glb' }),
    board: new Asset('statue', 'container', { url: './assets/models/chess-board.glb' }),
    boombox: new Asset('statue', 'container', { url: './assets/models/boom-box.glb' }),
    color: new Asset('color', 'texture', { url: './assets/textures/seaside-rocks01-color.basis' })
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
const entity1 = assets.bench.resource.instantiateRenderEntity();
entity1.setLocalPosition(0, 0, -1.5);
app.root.addChild(entity1);

// The character
const entity2 = assets.model.resource.instantiateRenderEntity();
app.root.addChild(entity2);

// Chess board
const entity3 = assets.board.resource.instantiateRenderEntity();
entity3.setLocalScale(0.01, 0.01, 0.01);
app.root.addChild(entity3);

const entity4 = assets.boombox.resource.instantiateRenderEntity();
entity4.setLocalPosition(0, 0.5, -3);
entity4.setLocalScale(100, 100, 100);
app.root.addChild(entity4);

// a render component with a sphere and cone primitives
const material = new StandardMaterial();
material.diffuse = Color.YELLOW;
material.diffuseMap = assets.color.resource;
material.update();

const entity = new Entity('TwoMeshInstances');
entity.addComponent('render', {
    type: 'asset',
    meshInstances: [
        new MeshInstance(Mesh.fromGeometry(app.graphicsDevice, new SphereGeometry()), material),
        new MeshInstance(Mesh.fromGeometry(app.graphicsDevice, new ConeGeometry()), material)
    ]
});
app.root.addChild(entity);
entity.setLocalPosition(0, 1.5, -1.5);

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
app.scene.exposure = 1.5;

// a link element, created in the html part of the examples.
const link = document.getElementById('ar-link');

// Export the whole scene into a glb format
const options = {
    maxTextureSize: 1024
};

new GltfExporter()
    .build(app.root, options)
    .then((arrayBuffer) => {
        const blob = new Blob([arrayBuffer], { type: 'application/octet-stream' });

        // @ts-ignore
        link.href = URL.createObjectURL(blob);
    })
    .catch(console.error);

// When clicking on the download UI button, trigger the download
data.on('download', () => {
    link.click();
});
