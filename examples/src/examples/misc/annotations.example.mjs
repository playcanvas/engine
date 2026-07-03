// @config
//
// @credit
// title: Mitsubishi F-2 - Fighter Jet - Free
// author: bohmerang
// source: https://sketchfab.com/3d-models/mitsubishi-f-2-fighter-jet-free-d3d7244554974f499b106e6c11fe3aaf
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
    EnvLighting,
    FILLMODE_FILL_WINDOW,
    LightComponentSystem,
    Mouse,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    SHADOW_VSM_16F,
    SKYTYPE_DOME,
    ScriptComponentSystem,
    TONEMAP_ACES2,
    TextureHandler,
    TouchDevice,
    Vec2,
    Vec3,
    WasmModule,
    basisInitialize,
    createGraphicsDevice
} from 'playcanvas';
import { Annotation, AnnotationManager } from 'playcanvas/scripts/esm/annotations.mjs';
import { CameraControls } from 'playcanvas/scripts/esm/camera-controls.mjs';
import { ShadowCatcher } from 'playcanvas/scripts/esm/shadow-catcher.mjs';

import { data, deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

// Set up and load draco module, as the glb we load is draco compressed
WasmModule.setConfig('DracoDecoderModule', {
    glueUrl: './assets/wasm/draco/draco.wasm.js',
    wasmUrl: './assets/wasm/draco/draco.wasm.wasm',
    fallbackUrl: './assets/wasm/draco/draco.js'
});

// Initialize basis to allow loading of compressed textures
basisInitialize({
    glueUrl: './assets/wasm/basis/basis.wasm.js',
    wasmUrl: './assets/wasm/basis/basis.wasm.wasm',
    fallbackUrl: './assets/wasm/basis/basis.js'
});

const assets = {
    jetFighter: new Asset('jet-fighter', 'container', { url: './assets/models/jet-fighter.glb' }),
    shanghai: new Asset('shanghai', 'texture', { url: './assets/hdri/shanghai-riverside-4k.hdr' }, { mipmaps: false })
};

const gfxOptions = {
    deviceTypes: [deviceType]
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
    ScriptComponentSystem
];
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

await new Promise(resolve => {
    new AssetListLoader(Object.values(assets), app.assets).load(resolve);
});

app.start();

// Setup HDR environment
const applyHdri = source => {
    const skybox = EnvLighting.generateSkyboxCubemap(source);
    app.scene.skybox = skybox;

    const lighting = EnvLighting.generateLightingSource(source);
    const envAtlas = EnvLighting.generateAtlas(lighting);
    lighting.destroy();
    app.scene.envAtlas = envAtlas;
};

device.on('devicerestored', () => {
    applyHdri(assets.shanghai.resource);
});

applyHdri(assets.shanghai.resource);

// Setup sky dome
app.scene.sky.type = SKYTYPE_DOME;
app.scene.sky.node.setLocalScale(new Vec3(50, 50, 50));
app.scene.sky.node.setLocalPosition(new Vec3(0, 0, 0));
app.scene.sky.center = new Vec3(0, 0.1, 0);

// Create camera entity
const camera = new Entity('camera');
camera.addComponent('camera', {
    clearColor: new Color(0.5, 0.6, 0.9),
    farClip: 500,
    toneMapping: TONEMAP_ACES2
});
camera.setPosition(12, 8.3, 4.5);

// Add camera controls
camera.addComponent('script');
camera.script.create(CameraControls, {
    properties: {
        focusPoint: new Vec3(-1, 1.5, 0),
        pitchRange: new Vec2(-90, 0),
        sceneSize: 2,
        zoomRange: new Vec2(5, 25)
    }
});

app.root.addChild(camera);

// Create directional light
const light = new Entity('light');
light.addComponent('light', {
    type: 'directional',
    castShadows: true,
    shadowDistance: 30,
    shadowIntensity: 0.6,
    shadowResolution: 1024,
    shadowType: SHADOW_VSM_16F
});
app.root.addChild(light);

// Create a wrapper entity for the jet fighter (like pc-model does in web-components)
const jetFighter = new Entity('jet-fighter');
jetFighter.setPosition(-2, 1.6, 0);
jetFighter.setEulerAngles(0, 0, 3);
app.root.addChild(jetFighter);

// Instantiate the model as a child of the wrapper
const jetModel = assets.jetFighter.resource.instantiateRenderEntity({
    castShadows: true
});
jetFighter.addChild(jetModel);

// Add annotation manager to the jet fighter entity
jetFighter.addComponent('script');
const manager = jetFighter.script.create(AnnotationManager);

// Set default values for controls
data.set('data', {
    hotspotSize: 25,
    hotspotColor: [0.8, 0.8, 0.8],
    hoverColor: [1, 0.4, 0],
    opacity: 1,
    behindOpacity: 0.25
});

// Handle control changes - update the manager directly
data.on('*:set', (/** @type {string} */ path, /** @type {any} */ value) => {
    const prop = path.split('.')[1];
    if (prop === 'hotspotSize') {
        manager.hotspotSize = value;
    } else if (prop === 'hotspotColor' || prop === 'hoverColor') {
        manager[prop] = new Color(value[0], value[1], value[2]);
    } else if (prop === 'opacity') {
        manager.opacity = value;
    } else if (prop === 'behindOpacity') {
        manager.behindOpacity = value;
    }
});

/**
 * Create an annotation entity
 * @param {Vec3} position - Position relative to parent
 * @param {string} label - Label number
 * @param {string} title - Annotation title
 * @param {string} text - Annotation description
 * @returns {Entity} The annotation entity
 */
const createAnnotation = (position, label, title, text) => {
    const entity = new Entity(`annotation${label}`);
    entity.setLocalPosition(position);
    entity.addComponent('script');
    entity.script.create(Annotation, {
        properties: {
            label: label,
            title: title,
            text: text
        }
    });
    return entity;
};

// Add annotations to the jet fighter
jetFighter.addChild(
    createAnnotation(
        new Vec3(5.5, 1.2, 0),
        '1',
        'Cockpit Canopy',
        "Transparent canopy offering visibility and housing the pilot's controls."
    )
);

jetFighter.addChild(
    createAnnotation(
        new Vec3(8, 0.25, 0),
        '2',
        'Nose Cone & Radar',
        'Houses the advanced radar system for targeting and navigation.'
    )
);

jetFighter.addChild(
    createAnnotation(
        new Vec3(5, -0.5, 0),
        '3',
        'Inlet Ducts',
        'Provides airflow to the engines, crucial for maintaining thrust.'
    )
);

jetFighter.addChild(
    createAnnotation(
        new Vec3(0.5, 0, 5.1),
        '4',
        'Wingtip Missile Rails',
        'Can be equipped with AIM-9 Sidewinder missiles for air-to-air combat.'
    )
);

jetFighter.addChild(
    createAnnotation(
        new Vec3(-4, 0, 0),
        '5',
        'Jet Engine Nozzles',
        'Dual afterburning turbofan engines for high-speed performance.'
    )
);

jetFighter.addChild(
    createAnnotation(
        new Vec3(1, -1, -1),
        '6',
        'Main Landing Gear',
        'Retractable gear for safe takeoff and landing on runways.'
    )
);

jetFighter.addChild(
    createAnnotation(
        new Vec3(2, 0, -3.1),
        '7',
        'Forward Leading-Edge Flaps',
        'Enhance maneuverability during high-speed or low-speed flight.'
    )
);

// Create shadow catcher
const shadowCatcher = new Entity('shadowCatcher');
shadowCatcher.addComponent('script');
shadowCatcher.script.create(ShadowCatcher, {
    properties: {
        scale: new Vec3(15, 15, 15)
    }
});
app.root.addChild(shadowCatcher);
