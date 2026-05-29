// @config
//
// Shows multiple Gaussian Splat objects in a gallery scene with custom vertex shaders.
//
// @credit
// title: VR Gallery
// author: Sketchfab
// source: https://sketchfab.com/3d-models/vr-gallery-1e087aa25dc742e680accb15249bd6be
// license: CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)

import * as pc from 'playcanvas';

import { data, deviceType } from 'examples/context';

import shaderGlslVert from './shader.glsl.vert';
import shaderWgslVert from './shader.wgsl.vert';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const gfxOptions = {
    deviceTypes: [deviceType],
    // disable antialiasing as gaussian splats do not benefit from it and it's expensive
    antialias: false
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
    pc.ScriptComponentSystem,
    pc.GSplatComponentSystem
];
createOptions.resourceHandlers = [pc.TextureHandler, pc.ContainerHandler, pc.ScriptHandler, pc.GSplatHandler];

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

const assets = {
    gallery: new pc.Asset('gallery', 'container', { url: './assets/models/vr-gallery.glb' }),
    guitar: new pc.Asset('gsplat', 'gsplat', { url: './assets/splats/guitar.compressed.ply' }),
    biker: new pc.Asset('gsplat', 'gsplat', { url: './assets/splats/biker.compressed.ply' }),
    skull: new pc.Asset('gsplat', 'gsplat', { url: './assets/splats/skull.sog' }),
    orbit: new pc.Asset('script', 'script', { url: './scripts/camera/orbit-camera.js' })
};

const assetListLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
assetListLoader.load(() => {
    app.start();

    data.on('renderer:set', () => {
        app.scene.gsplat.renderer = data.get('renderer');
        const current = app.scene.gsplat.currentRenderer;
        if (current !== data.get('renderer')) {
            setTimeout(() => data.set('renderer', current), 0);
        }
    });
    data.set('renderer', pc.GSPLAT_RENDERER_AUTO);

    // camera placement
    const ORBIT_PIVOT = new pc.Vec3(0, 0.8, 0);
    const ORBIT_DISTANCE = 5;
    const ORBIT_INITIAL_YAW = 28;
    const ORBIT_INITIAL_PITCH = -8;

    // get the instance of the gallery and set up with render component
    const galleryEntity = assets.gallery.resource.instantiateRenderEntity();
    app.root.addChild(galleryEntity);

    // Create an Entity with a camera component
    const camera = new pc.Entity();
    camera.addComponent('camera', {
        clearColor: new pc.Color(0.2, 0.2, 0.2),
        toneMapping: pc.TONEMAP_ACES
    });

    const guitar = new pc.Entity('guitar');
    guitar.addComponent('gsplat', {
        asset: assets.guitar
    });
    guitar.setLocalPosition(0, 0.8, 0);
    guitar.setLocalEulerAngles(0, 0, 180);
    guitar.setLocalScale(0.4, 0.4, 0.4);
    app.root.addChild(guitar);

    const createSplatInstance = (name, asset, px, py, pz, scale) => {
        const entity = new pc.Entity(name);
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
    const orbitCam = /** @type {any} */ (camera.script.create('orbitCamera', {
        attributes: {
            inertiaFactor: 0.2,
            distanceMax: 60,
            frameOnStart: false
        }
    }));
    if (orbitCam) {
        orbitCam.pivotPoint.copy(ORBIT_PIVOT);
        orbitCam.reset(ORBIT_INITIAL_YAW, ORBIT_INITIAL_PITCH, ORBIT_DISTANCE);
        orbitCam._updatePosition();
    }
    camera.script.create('orbitCameraInputMouse');
    camera.script.create('orbitCameraInputTouch');

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
});
