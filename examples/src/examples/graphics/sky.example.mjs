// @config
//
// @credit
// title: Wide Street 02
// author: Poly Haven
// source: https://polyhaven.com/a/wide_street_02
// license: CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)
//
// @credit
// title: Small Empty Room 2
// author: Poly Haven
// source: https://polyhaven.com/a/small_empty_room_2
// license: CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)

import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    CameraComponentSystem,
    CameraFrame,
    ContainerHandler,
    DISPLAYFORMAT_HDR,
    Entity,
    EnvLighting,
    FILLMODE_FILL_WINDOW,
    GAMMA_SRGB,
    Mouse,
    Quat,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    SKYTYPE_BOX,
    SKYTYPE_DOME,
    SKYTYPE_INFINITE,
    ScriptComponentSystem,
    ScriptHandler,
    TONEMAP_ACES,
    TONEMAP_NONE,
    TextureHandler,
    TouchDevice,
    Vec3,
    createGraphicsDevice
} from 'playcanvas';

import { data, deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    orbit: new Asset('script', 'script', { url: './scripts/camera/orbit-camera.js' }),
    statue: new Asset('statue', 'container', { url: './assets/models/statue.glb' }),
    hdri_street: new Asset('hdri', 'texture', { url: './assets/hdri/wide-street.hdr' }, { mipmaps: false }),
    hdri_room: new Asset('hdri', 'texture', { url: './assets/hdri/empty-room.hdr' }, { mipmaps: false })
};

const gfxOptions = {
    deviceTypes: [deviceType],

    // enable HDR rendering if supported
    displayFormat: DISPLAYFORMAT_HDR
};

const device = await createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new AppOptions();
createOptions.graphicsDevice = device;
createOptions.mouse = new Mouse(document.body);
createOptions.touch = new TouchDevice(document.body);

createOptions.componentSystems = [RenderComponentSystem, CameraComponentSystem, ScriptComponentSystem];
createOptions.resourceHandlers = [TextureHandler, ContainerHandler, ScriptHandler];

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

// add an instance of the statue
const statueEntity = assets.statue.resource.instantiateRenderEntity();
app.root.addChild(statueEntity);

// Create an Entity with a camera component
const cameraEntity = new Entity();
cameraEntity.addComponent('camera', {
    farClip: 500,
    fov: 60,

    // if the device renders in HDR mode, disable tone mapping to output HDR values without any processing
    toneMapping: device.isHdr ? TONEMAP_NONE : TONEMAP_ACES,
    gammaCorrection: GAMMA_SRGB
});

// add orbit camera script with a mouse and a touch support
cameraEntity.addComponent('script');
cameraEntity.script.create('orbitCamera', {
    attributes: {
        inertiaFactor: 0.2,
        focusEntity: statueEntity,
        distanceMax: 500,
        frameOnStart: false
    }
});
cameraEntity.script.create('orbitCameraInputMouse');
cameraEntity.script.create('orbitCameraInputTouch');

// position the camera in the world
cameraEntity.setLocalPosition(-4, 5, 22);
cameraEntity.lookAt(0, 0, 1);
app.root.addChild(cameraEntity);

// ------ Custom render passes set up ------
const cameraFrame = new CameraFrame(app, cameraEntity.camera);
cameraFrame.update();

// skydome presets
const presetStreetDome = {
    skybox: {
        preset: 'Street Dome',
        type: SKYTYPE_DOME,
        scale: [200, 200, 200],
        position: [0, 0, 0],
        tripodY: 0.05,
        exposure: 0.7,
        rotation: 0
    }
};

const presetStreetInfinite = {
    skybox: {
        preset: 'Street Infinite',
        type: SKYTYPE_INFINITE,
        scale: [1, 1, 1],
        position: [0, 0, 0],
        tripodY: 0,
        exposure: 0.7,
        rotation: 0
    }
};

const presetRoom = {
    skybox: {
        preset: 'Room',
        type: SKYTYPE_BOX,
        scale: [44, 24, 28],
        position: [0, 0, 0],
        tripodY: 0.6,
        exposure: 0.7,
        rotation: 50
    }
};

// apply hdri texture
const applyHdri = (source) => {
    // convert it to high resolution cubemap for the skybox
    // this is optional in case you want a really high resolution skybox
    const skybox = EnvLighting.generateSkyboxCubemap(source);
    app.scene.skybox = skybox;

    // generate env-atlas texture for the lighting
    // this would also be used as low resolution skybox if high resolution is not available
    const lighting = EnvLighting.generateLightingSource(source);
    const envAtlas = EnvLighting.generateAtlas(lighting);
    lighting.destroy();
    app.scene.envAtlas = envAtlas;
};

// when UI value changes, update skybox data
data.on('*:set', (/** @type {string} */ path, value) => {
    const pathArray = path.split('.');

    if (pathArray[2] === 'preset' && pathArray.length === 3) {
        // apply preset
        if (data.get('data.skybox.preset') === value) {
            // apply preset data
            data.set(
                'data',
                value === 'Room' ? presetRoom : value === 'Street Dome' ? presetStreetDome : presetStreetInfinite
            );

            // update hdri texture
            applyHdri(value === 'Room' ? assets.hdri_room.resource : assets.hdri_street.resource);
        }
    } else {
        // apply individual settings
        app.scene.sky.type = data.get('data.skybox.type');
        app.scene.sky.node.setLocalScale(new Vec3(data.get('data.skybox.scale') ?? [1, 1, 1]));
        app.scene.sky.node.setLocalPosition(new Vec3(data.get('data.skybox.position') ?? [0, 0, 0]));
        app.scene.sky.center = new Vec3(0, data.get('data.skybox.tripodY') ?? 0, 0);
        app.scene.skyboxRotation = new Quat().setFromEulerAngles(0, data.get('data.skybox.rotation'), 0);
        app.scene.exposure = data.get('data.skybox.exposure');

        // colorEnhance
        cameraFrame.colorEnhance.enabled = data.get('data.colorEnhance.enabled');
        cameraFrame.colorEnhance.shadows = data.get('data.colorEnhance.shadows');
        cameraFrame.colorEnhance.highlights = data.get('data.colorEnhance.highlights');
        cameraFrame.colorEnhance.midtones = data.get('data.colorEnhance.midtones');
        cameraFrame.colorEnhance.vibrance = data.get('data.colorEnhance.vibrance');
        cameraFrame.colorEnhance.dehaze = data.get('data.colorEnhance.dehaze');
        cameraFrame.update();
    }
});

// apply initial preset
data.set('data.skybox.preset', 'Street Dome');

// set initial colorEnhance values (AFTER preset so it doesn't get overwritten)
data.set('data.colorEnhance', {
    enabled: false,
    shadows: 0,
    highlights: 0,
    midtones: 0,
    vibrance: 0,
    dehaze: 0
});
