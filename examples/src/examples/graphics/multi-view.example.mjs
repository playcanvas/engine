import * as pc from 'playcanvas';
import { data } from 'examples/observer';
import { deviceType, rootPath } from 'examples/utils';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

// set up and load draco module, as the glb we load is draco compressed
pc.WasmModule.setConfig('DracoDecoderModule', {
    glueUrl: rootPath + '/static/lib/draco/draco.wasm.js',
    wasmUrl: rootPath + '/static/lib/draco/draco.wasm.wasm',
    fallbackUrl: rootPath + '/static/lib/draco/draco.js'
});

await new Promise((resolve) => {
    pc.WasmModule.getInstance('DracoDecoderModule', () => resolve());
});

const assets = {
    script: new pc.Asset('script', 'script', { url: rootPath + '/static/scripts/camera/orbit-camera.js' }),
    helipad: new pc.Asset(
        'helipad-env-atlas',
        'texture',
        { url: rootPath + '/static/assets/cubemaps/helipad-env-atlas.png' },
        { type: pc.TEXTURETYPE_RGBP, mipmaps: false }
    ),
    board: new pc.Asset('statue', 'container', { url: rootPath + '/static/assets/models/chess-board.glb' })
};

const gfxOptions = {
    deviceTypes: [deviceType],
    glslangUrl: rootPath + '/static/lib/glslang/glslang.js',
    twgslUrl: rootPath + '/static/lib/twgsl/twgsl.js'
};

const device = await pc.createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

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
createOptions.resourceHandlers = [pc.TextureHandler, pc.ContainerHandler, pc.ScriptHandler];

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

    data.set('settings', {
        shaderPassName: pc.SHADERPASS_FORWARD
    });

    // get few existing layers and create a new layer for the spot light
    const worldLayer = app.scene.layers.getLayerByName('World');
    const skyboxLayer = app.scene.layers.getLayerByName('Skybox');
    const spotLightLayer = new pc.Layer({ name: 'SpotLightLayer' });
    app.scene.layers.insert(spotLightLayer, 0);

    // get the instance of the chess board and set up with render component
    const boardEntity = assets.board.resource.instantiateRenderEntity({
        castShadows: true,
        receiveShadows: true,

        // add it to both layers with lights, as we want it to lit by directional light and spot light,
        // depending on the camera
        layers: [worldLayer.id, spotLightLayer.id]
    });
    app.root.addChild(boardEntity);

    // Create left camera, using default layers (including the World)
    const cameraLeft = new pc.Entity('LeftCamera');
    cameraLeft.addComponent('camera', {
        farClip: 500,
        rect: new pc.Vec4(0, 0, 0.5, 0.5)
    });
    app.root.addChild(cameraLeft);

    // Create right orthographic camera, using spot light layer and skybox layer,
    // so that it receives the light from the spot light but not from the directional light
    const cameraRight = new pc.Entity('RightCamera');
    cameraRight.addComponent('camera', {
        layers: [spotLightLayer.id, skyboxLayer.id],
        farClip: 500,
        rect: new pc.Vec4(0.5, 0, 0.5, 0.5),
        projection: pc.PROJECTION_ORTHOGRAPHIC,
        orthoHeight: 150
    });
    cameraRight.translate(0, 150, 0);
    cameraRight.lookAt(pc.Vec3.ZERO, pc.Vec3.RIGHT);
    app.root.addChild(cameraRight);

    // Create top camera, using default layers (including the World)
    const cameraTop = new pc.Entity('TopCamera');
    cameraTop.addComponent('camera', {
        farClip: 500,
        rect: new pc.Vec4(0, 0.5, 1, 0.5)
    });
    cameraTop.translate(-100, 75, 100);
    cameraTop.lookAt(0, 7, 0);
    app.root.addChild(cameraTop);

    // add orbit camera script with a mouse and a touch support
    cameraTop.addComponent('script');
    cameraTop.script.create('orbitCamera', {
        attributes: {
            inertiaFactor: 0.2,
            focusEntity: app.root,
            distanceMax: 300,
            frameOnStart: false
        }
    });
    cameraTop.script.create('orbitCameraInputMouse');
    cameraTop.script.create('orbitCameraInputTouch');

    // Create a directional light which casts shadows
    const dirLight = new pc.Entity();
    dirLight.addComponent('light', {
        type: 'directional',
        layers: [worldLayer.id],
        color: pc.Color.WHITE,
        intensity: 5,
        range: 500,
        shadowDistance: 500,
        castShadows: true,
        shadowBias: 0.2,
        normalOffsetBias: 0.05
    });
    app.root.addChild(dirLight);
    dirLight.setLocalEulerAngles(45, 0, 30);

    // Create a single directional light which casts shadows
    const spotLight = new pc.Entity();
    spotLight.addComponent('light', {
        type: 'spot',
        layers: [spotLightLayer.id],
        color: pc.Color.YELLOW,
        intensity: 7,
        innerConeAngle: 20,
        outerConeAngle: 80,
        range: 200,
        shadowDistance: 200,
        castShadows: true,
        shadowBias: 0.2,
        normalOffsetBias: 0.05
    });
    app.root.addChild(spotLight);

    // set skybox - this DDS file was 'prefiltered' in the PlayCanvas Editor and then downloaded.
    app.scene.envAtlas = assets.helipad.resource;
    app.scene.rendering.toneMapping = pc.TONEMAP_ACES;
    app.scene.skyboxMip = 1;

    // handle HUD changes - update the debug mode for the top and right cameras
    data.on('*:set', (/** @type {string} */ path, value) => {
        cameraTop.camera.setShaderPass(value);
        cameraRight.camera.setShaderPass(value);
    });

    // update function called once per frame
    let time = 0;
    app.on('update', function (dt) {
        time += dt;

        // orbit camera left around
        cameraLeft.setLocalPosition(100 * Math.sin(time * 0.2), 35, 100 * Math.cos(time * 0.2));
        cameraLeft.lookAt(pc.Vec3.ZERO);

        // move the spot light around
        spotLight.setLocalPosition(40 * Math.sin(time * 0.5), 60, 40 * Math.cos(time * 0.5));

        // zoom in and out the orthographic camera
        cameraRight.camera.orthoHeight = 90 + Math.sin(time * 0.3) * 60;
    });
});

export { app };
