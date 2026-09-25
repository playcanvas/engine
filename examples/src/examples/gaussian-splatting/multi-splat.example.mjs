// @config
//
// Shows multiple Gaussian Splat objects in a gallery scene with custom vertex shaders.
//
// @credit
// title: VR Gallery
// author: Sketchfab
// source: https://sketchfab.com/3d-models/vr-gallery-1e087aa25dc742e680accb15249bd6be
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
    GSPLAT_RENDERER_AUTO,
    GSplatComponentSystem,
    GSplatHandler,
    LightComponentSystem,
    Mouse,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    ScriptComponentSystem,
    ScriptHandler,
    TONEMAP_ACES,
    TextureHandler,
    TouchDevice,
    Vec2,
    Vec3,
    createGraphicsDevice
} from 'playcanvas';
import { CameraControls } from 'playcanvas/scripts/esm/camera-controls.mjs';

import { data, deviceType } from 'examples/context';

import shaderGlslVert from './shader.glsl.vert';
import shaderWgslVert from './shader.wgsl.vert';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const gfxOptions = {
    deviceTypes: [deviceType],
    // Disable antialiasing as gaussian splats do not benefit from it and it's expensive
    antialias: false
};

const device = await createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new AppOptions();
createOptions.graphicsDevice = device;
createOptions.mouse = new Mouse(document.body);
createOptions.touch = new TouchDevice(document.body);

createOptions.componentSystems = [
    RenderComponentSystem,
    CameraComponentSystem,
    LightComponentSystem,
    ScriptComponentSystem,
    GSplatComponentSystem
];
createOptions.resourceHandlers = [TextureHandler, ContainerHandler, ScriptHandler, GSplatHandler];

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

const assets = {
    gallery: new Asset('gallery', 'container', { url: './assets/models/vr-gallery.glb' }),
    guitar: new Asset('gsplat', 'gsplat', { url: './assets/splats/guitar.compressed.ply' }),
    biker: new Asset('gsplat', 'gsplat', { url: './assets/splats/biker.compressed.ply' }),
    skull: new Asset('gsplat', 'gsplat', { url: './assets/splats/skull.sog' })
};

await new Promise((resolve) => {
    new AssetListLoader(Object.values(assets), app.assets).load(resolve);
});

app.start();

data.on('renderer:set', () => {
    app.scene.gsplat.renderer = data.get('renderer');
    const current = app.scene.gsplat.currentRenderer;
    if (current !== data.get('renderer')) {
        setTimeout(() => data.set('renderer', current), 0);
    }
});
data.set('renderer', GSPLAT_RENDERER_AUTO);

// Camera placement
const ORBIT_PIVOT = new Vec3(0, 0.8, 0);
const ORBIT_DISTANCE = 5;
const ORBIT_INITIAL_YAW = 28;
const ORBIT_INITIAL_PITCH = -8;

// Get the instance of the gallery and set up with render component
const galleryEntity = assets.gallery.resource.instantiateRenderEntity();
app.root.addChild(galleryEntity);

// Create an Entity with a camera component
const camera = new Entity();
camera.addComponent('camera', {
    clearColor: new Color(0.2, 0.2, 0.2),
    toneMapping: TONEMAP_ACES
});

const guitar = new Entity('guitar');
guitar.addComponent('gsplat', {
    asset: assets.guitar
});
guitar.setLocalPosition(0, 0.8, 0);
guitar.setLocalEulerAngles(0, 0, 180);
guitar.setLocalScale(0.4, 0.4, 0.4);
app.root.addChild(guitar);

const createSplatInstance = (name, asset, px, py, pz, scale) => {
    const entity = new Entity(name);
    entity.addComponent('gsplat', {
        asset
    });
    entity.setLocalPosition(px, py, pz);
    entity.setLocalEulerAngles(180, 90, 0);
    entity.setLocalScale(scale, scale, scale);
    app.root.addChild(entity);

    return entity;
};

createSplatInstance('biker', assets.biker, -1.5, 0.05, 0, 0.7);

const skull = createSplatInstance('skull', assets.skull, 1.5, 0.05, 0, 0.7);
skull.rotate(0, 150, 0);

app.root.addChild(camera);

camera.addComponent('script');
const cameraControls = /** @type {CameraControls} */ (
    camera.script.create(CameraControls, {
        properties: {
            zoomRange: new Vec2(0.01, 60),
            enableFly: false
        }
    })
);

// place the camera on an orbit around the pivot (yaw/pitch in degrees, at ORBIT_DISTANCE)
const orbitYaw = (ORBIT_INITIAL_YAW * Math.PI) / 180;
const orbitPitch = (ORBIT_INITIAL_PITCH * Math.PI) / 180;
cameraControls.reset(
    ORBIT_PIVOT,
    new Vec3(
        ORBIT_PIVOT.x + ORBIT_DISTANCE * Math.sin(orbitYaw) * Math.cos(orbitPitch),
        ORBIT_PIVOT.y - ORBIT_DISTANCE * Math.sin(orbitPitch),
        ORBIT_PIVOT.z + ORBIT_DISTANCE * Math.cos(orbitYaw) * Math.cos(orbitPitch)
    )
);

const glslVs = shaderGlslVert;
const wgslVs = shaderWgslVert;
const sceneMat = app.scene.gsplat.material;

/**
 * @param {boolean} enabled - Whether to apply the shared gsplatModifyVS chunk.
 */
const applyCustomShader = (enabled) => {
    if (enabled) {
        sceneMat.getShaderChunks('glsl').set('gsplatModifyVS', glslVs);
        sceneMat.getShaderChunks('wgsl').set('gsplatModifyVS', wgslVs);
    } else {
        sceneMat.getShaderChunks('glsl').delete('gsplatModifyVS');
        sceneMat.getShaderChunks('wgsl').delete('gsplatModifyVS');
    }
    sceneMat.update();
};

data.on('shader:set', () => {
    applyCustomShader(!!data.get('shader'));
});
applyCustomShader(false);
data.set('shader', false);

let currentTime = 0;
app.on('update', (dt) => {
    currentTime += dt;

    sceneMat.setParameter('uTime', currentTime);
    sceneMat.update();

    skull.rotate(0, 80 * dt, 0);
});
