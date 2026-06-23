// @config
//
// Demonstrates shadow catching with Gaussian Splats.
//
// @flag HIDDEN
//
// @credit
// title: St Peter's Square Night
// author: Poly Haven
// source: https://polyhaven.com/a/st_peters_square_night
// license: CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)

import * as pc from 'playcanvas';
import { ShadowCatcher } from 'playcanvas/scripts/esm/shadow-catcher.mjs';

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
    biker: new pc.Asset('gsplat', 'gsplat', { url: './assets/splats/biker.compressed.ply' }),
    hdri: new pc.Asset(
        'hdri',
        'texture',
        { url: './assets/hdri/st-peters-square.hdr' },
        { mipmaps: false }
    ),
    orbit: new pc.Asset('script', 'script', { url: './scripts/camera/orbit-camera.js' })
};

const assetListLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
assetListLoader.load(() => {
    app.start();

    // Setup projected skydome from HDR
    const hdriTexture = assets.hdri.resource;

    // Generate high resolution cubemap for skybox
    const skybox = pc.EnvLighting.generateSkyboxCubemap(hdriTexture);
    app.scene.skybox = skybox;

    // Generate env-atlas for lighting
    const lighting = pc.EnvLighting.generateLightingSource(hdriTexture);
    const envAtlas = pc.EnvLighting.generateAtlas(lighting);
    lighting.destroy();
    app.scene.envAtlas = envAtlas;

    // Set exposure and projected dome
    app.scene.exposure = 0.4;
    app.scene.sky.type = pc.SKYTYPE_DOME;
    app.scene.sky.node.setLocalScale(new pc.Vec3(50, 50, 50));
    app.scene.sky.node.setLocalPosition(pc.Vec3.ZERO);
    app.scene.sky.center = new pc.Vec3(0, 0.05, 0);

    data.on('renderer:set', () => {
        app.scene.gsplat.renderer = data.get('renderer');
        const current = app.scene.gsplat.currentRenderer;
        if (current !== data.get('renderer')) {
            setTimeout(() => data.set('renderer', current), 0);
        }
    });
    data.set('renderer', pc.GSPLAT_RENDERER_AUTO);

    data.on('alphaClip:set', () => {
        app.scene.gsplat.alphaClip = data.get('alphaClip');
    });
    data.set('alphaClip', 0.4);

    // Optional custom vertex shader that animates each splat's position (via modifySplatCenter). The
    // toggle verifies the cast shadow follows the animated position, since the shadow draw uses the
    // same quad vertex shader as the forward pass.
    const sceneMat = app.scene.gsplat.material;
    const applyCustomShader = (enabled) => {
        if (enabled) {
            sceneMat.getShaderChunks('glsl').set('gsplatModifyVS', shaderGlslVert);
            sceneMat.getShaderChunks('wgsl').set('gsplatModifyVS', shaderWgslVert);
        } else {
            sceneMat.getShaderChunks('glsl').delete('gsplatModifyVS');
            sceneMat.getShaderChunks('wgsl').delete('gsplatModifyVS');
        }
        sceneMat.update();
    };
    data.on('shader:set', () => applyCustomShader(!!data.get('shader')));
    applyCustomShader(false);
    data.set('shader', false);

    // Create first splat entity
    const biker = new pc.Entity('biker');
    biker.addComponent('gsplat', {
        asset: assets.biker,
        castShadows: true
    });
    biker.setLocalPosition(-1.5, 0.05, 0);
    biker.setLocalEulerAngles(180, 90, 0);
    biker.setLocalScale(0.7, 0.7, 0.7);
    app.root.addChild(biker);

    // Create second splat entity
    const biker2 = new pc.Entity('biker2');
    biker2.addComponent('gsplat', {
        asset: assets.biker,
        castShadows: true
    });
    biker2.setLocalPosition(0.5, 0.05, 0);
    biker2.setLocalEulerAngles(180, 0, 0);
    biker2.setLocalScale(0.7, 0.7, 0.7);
    app.root.addChild(biker2);

    // Create camera
    const camera = new pc.Entity('camera');
    camera.addComponent('camera', {
        clearColor: new pc.Color(1, 1, 1),
        toneMapping: pc.TONEMAP_ACES,
        fov: 60
    });
    camera.setLocalPosition(-3, 2, 4);

    // Add orbit camera script with mouse and touch support
    camera.addComponent('script');
    camera.script?.create('orbitCamera', {
        attributes: {
            inertiaFactor: 0.2,
            focusEntity: biker,
            distanceMax: 10,
            frameOnStart: false
        }
    });
    camera.script?.create('orbitCameraInputMouse');
    camera.script?.create('orbitCameraInputTouch');
    app.root.addChild(camera);

    // Create shadow catcher
    const shadowCatcher = new pc.Entity('ShadowCatcher');
    shadowCatcher.addComponent('script');
    const shadowCatcherScript = shadowCatcher.script?.create(ShadowCatcher);
    if (shadowCatcherScript) {
        shadowCatcherScript.scale = new pc.Vec3(10, 10, 10);
    }
    app.root.addChild(shadowCatcher);

    // Create up to 6 shadow-casting directional lights; the 'Lights' slider enables the first N of
    // them. Each light keeps a fixed base azimuth (so adding or removing one never moves the
    // others) and they all rotate together in the same direction. The azimuths are ordered so the
    // enabled set stays well-distributed: light 1 is opposite light 0, and at the full count of 6
    // they are evenly spaced 60° apart ({30,90,150,210,270,330}). Intermediate odd counts are
    // intentionally not symmetrical.
    const lightBaseAzimuths = [30, 210, 90, 270, 150, 330];
    const lights = lightBaseAzimuths.map((azimuth, i) => {
        const light = new pc.Entity(`light${i}`);
        light.addComponent('light', {
            type: 'directional',
            color: pc.Color.WHITE,
            castShadows: true,
            intensity: 1,
            shadowBias: 0.1,
            normalOffsetBias: 0.05,
            shadowDistance: 20,
            shadowIntensity: 0.5,
            shadowResolution: 2048,
            shadowType: pc.SHADOW_PCF5_16F
        });
        light.setEulerAngles(55, azimuth, 0);
        app.root.addChild(light);
        return light;
    });

    // Number of active lights (0..6). Enables the first N; the rest are disabled.
    data.on('numLights:set', () => {
        const count = data.get('numLights');
        lights.forEach((light, i) => {
            light.enabled = i < count;
        });
    });
    data.set('numLights', 2);

    // Rotate all lights together (same direction), preserving each light's fixed azimuth offset;
    // also advance the custom-shader animation time.
    let lightAngle = 0;
    let currentTime = 0;
    app.on('update', (/** @type {number} */ dt) => {
        lightAngle += dt * 20;
        lights.forEach((light, i) => {
            light.setEulerAngles(55, lightBaseAzimuths[i] + lightAngle, 0);
        });

        currentTime += dt;
        sceneMat.setParameter('uTime', currentTime);

        // re-dirty the scene gsplat material each frame so the per-frame uTime propagates to the
        // renderer's material copy (the quad renderer only re-copies template params when dirty)
        sceneMat.update();
    });
});
