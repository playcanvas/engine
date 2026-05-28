// @config
//
// @credit
// title: Laboratory
// author: Sketchfab
// source: https://sketchfab.com/3d-models/laboratory-e860e49837c044478db650868866a448
// license: CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)

import * as pc from 'playcanvas';

import { deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

// set up and load draco module, as the glb we load is draco compressed
pc.WasmModule.setConfig('DracoDecoderModule', {
    glueUrl: './assets/wasm/draco/draco.wasm.js',
    wasmUrl: './assets/wasm/draco/draco.wasm.wasm',
    fallbackUrl: './assets/wasm/draco/draco.js'
});

const assets = {
    laboratory: new pc.Asset('statue', 'container', { url: './assets/models/laboratory.glb' }),
    orbit: new pc.Asset('orbit', 'script', { url: './scripts/camera/orbit-camera.js' }),
    helipad: new pc.Asset(
        'helipad-env-atlas',
        'texture',
        { url: './assets/cubemaps/helipad-env-atlas.png' },
        { type: pc.TEXTURETYPE_RGBP, mipmaps: false }
    )
};

const gfxOptions = {
    deviceTypes: [deviceType]
};

const device = await pc.createGraphicsDevice(canvas, gfxOptions);
const createOptions = new pc.AppOptions();
createOptions.graphicsDevice = device;
createOptions.mouse = new pc.Mouse(document.body);
createOptions.touch = new pc.TouchDevice(document.body);

createOptions.componentSystems = [
    pc.RenderComponentSystem,
    pc.CameraComponentSystem,
    pc.LightComponentSystem,
    pc.ScriptComponentSystem
];
createOptions.resourceHandlers = [
    pc.ScriptHandler,
    pc.TextureHandler,
    pc.ContainerHandler
];

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

const assetListLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
assetListLoader.load(() => {
    app.start();

    // setup skydome
    app.scene.envAtlas = assets.helipad.resource;
    app.scene.skyboxMip = 2;
    app.scene.exposure = 2.5;

    // get the instance of the laboratory
    const laboratoryEntity = assets.laboratory.resource.instantiateRenderEntity();
    laboratoryEntity.setLocalScale(100, 100, 100);
    app.root.addChild(laboratoryEntity);

    // Create an Entity with a camera component
    const cameraEntity = new pc.Entity('SceneCamera');
    cameraEntity.addComponent('camera', {
        clearColor: new pc.Color(0.4, 0.45, 0.5),
        nearClip: 1,
        farClip: 600
    });

    // add orbit camera script
    cameraEntity.addComponent('script');
    cameraEntity.script.create('orbitCamera', {
        attributes: {
            inertiaFactor: 0.2,
            focusEntity: laboratoryEntity,
            distanceMax: 300
        }
    });
    cameraEntity.script.create('orbitCameraInputMouse');
    cameraEntity.script.create('orbitCameraInputTouch');

    // position the camera in the world
    cameraEntity.setLocalPosition(-60, 30, 60);
    app.root.addChild(cameraEntity);

    // create the outline renderer
    const outlineRenderer = new pc.OutlineRenderer(app);

    // add entities to the outline renderer
    outlineRenderer.addEntity(laboratoryEntity.findByName('Weltkugel'), pc.Color.RED);
    outlineRenderer.addEntity(laboratoryEntity.findByName('Stuhl'), pc.Color.WHITE);
    outlineRenderer.addEntity(laboratoryEntity.findByName('Teleskop'), pc.Color.GREEN);

    app.on('update', (/** @type {number} */ dt) => {

        // update the outline renderer each frame, and render the outlines inside the opaque sub-layer
        // of the immediate layer
        const immediateLayer = app.scene.layers.getLayerByName('Immediate');
        outlineRenderer.frameUpdate(cameraEntity, immediateLayer, false);
    });
});
