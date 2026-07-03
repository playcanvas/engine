// @config
//
// @credit
// title: House Scene
// author: Sketchfab
// source: https://sketchfab.com/3d-models/house-scene-52772448c62348e0a4951b51758d5587
// license: CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)

import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    BAKE_COLOR,
    CameraComponentSystem,
    Color,
    ContainerHandler,
    CubemapHandler,
    Entity,
    FILLMODE_FILL_WINDOW,
    LightComponentSystem,
    Lightmapper,
    Mouse,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    SHADOW_PCF3_32F,
    ScriptComponentSystem,
    ScriptHandler,
    TEXTURETYPE_RGBP,
    TextureHandler,
    TouchDevice,
    createGraphicsDevice
} from 'playcanvas';

import { data, deviceType } from 'examples/context';

/**
 * @import { RenderComponent } from 'playcanvas'
 */

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    helipad: new Asset(
        'helipad-env-atlas',
        'texture',
        { url: './assets/cubemaps/helipad-env-atlas.png' },
        { type: TEXTURETYPE_RGBP, mipmaps: false }
    ),
    house: new Asset('house', 'container', { url: './assets/models/house.glb' }),
    script: new Asset('script', 'script', { url: './scripts/camera/orbit-camera.js' })
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

createOptions.lightmapper = Lightmapper;

createOptions.componentSystems = [
    RenderComponentSystem,
    CameraComponentSystem,
    LightComponentSystem,
    ScriptComponentSystem
];
createOptions.resourceHandlers = [ScriptHandler, TextureHandler, ContainerHandler, CubemapHandler];

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

// Setup skydome - this is the main source of ambient light
app.scene.skyboxMip = 3;
app.scene.skyboxIntensity = 0.6;
app.scene.envAtlas = assets.helipad.resource;

// If skydome cubemap is disabled using HUD, a constant ambient color is used instead
app.scene.ambientLight = new Color(0.1, 0.3, 0.4);

// Instantiate the house model, which has unwrapped texture coordinates for lightmap in UV1
const house = assets.house.resource.instantiateRenderEntity();
house.setLocalScale(100, 100, 100);
app.root.addChild(house);

// Change its materials to lightmapping
/** @type {Array<RenderComponent>} */
const renders = house.findComponents('render');
renders.forEach(render => {
    render.castShadows = true;
    render.castShadowsLightmap = true;
    render.lightmapped = true;
});

// Directional light
const lightDirectional = new Entity('Directional');
lightDirectional.addComponent('light', {
    type: 'directional',

    // disable to not have shadow map updated every frame,
    // as the scene does not have dynamically lit objects
    affectDynamic: false,

    affectLightmapped: true,
    castShadows: true,
    normalOffsetBias: 0.05,
    shadowBias: 0.2,
    shadowDistance: 100,
    shadowResolution: 2048,
    shadowType: SHADOW_PCF3_32F,
    color: new Color(0.7, 0.7, 0.5),
    intensity: 1.6
});
app.root.addChild(lightDirectional);
lightDirectional.setLocalEulerAngles(-55, 0, -30);

// Create an entity with a omni light component that is configured as a baked light
const lightOmni = new Entity('Omni');
lightOmni.addComponent('light', {
    type: 'omni',
    affectDynamic: false,
    affectLightmapped: true,
    bake: true,
    castShadows: true,
    normalOffsetBias: 0.05,
    shadowBias: 0.2,
    shadowDistance: 25,
    shadowResolution: 512,
    shadowType: SHADOW_PCF3_32F,
    color: Color.YELLOW,
    range: 25,
    intensity: 0.9
});
lightOmni.setLocalPosition(-4, 10, 5);
app.root.addChild(lightOmni);

// Create an entity with a spot light component that is configured as a baked light
const lightSpot = new Entity('Spot');
lightSpot.addComponent('light', {
    type: 'spot',
    affectDynamic: false,
    affectLightmapped: true,
    bake: true,
    castShadows: true,
    normalOffsetBias: 0.05,
    shadowBias: 0.2,
    shadowDistance: 50,
    shadowResolution: 512,
    shadowType: SHADOW_PCF3_32F,
    color: Color.RED,
    range: 10,
    intensity: 2.5
});
lightSpot.setLocalPosition(-5, 10, -7.5);
app.root.addChild(lightSpot);

// Create an entity with a camera component
const camera = new Entity();
camera.addComponent('camera', {
    clearColor: new Color(0.4, 0.45, 0.5),
    farClip: 100,
    nearClip: 1
});
camera.setLocalPosition(40, 20, 40);

// add orbit camera script with a mouse and a touch support
camera.addComponent('script');
camera.script.create('orbitCamera', {
    attributes: {
        inertiaFactor: 0.2,
        focusEntity: house,
        distanceMax: 60
    }
});
camera.script.create('orbitCameraInputMouse');
camera.script.create('orbitCameraInputTouch');
app.root.addChild(camera);

// lightmap baking properties
const bakeType = BAKE_COLOR;
app.scene.lightmapMode = bakeType;
app.scene.lightmapMaxResolution = 1024;

// multiplier for lightmap resolution
app.scene.lightmapSizeMultiplier = 512;

// bake when settings are changed only
let needBake = false;

// handle data changes from HUD to modify baking properties
data.on('*:set', (/** @type {string} */ path, value) => {
    let bakeSettingChanged = true;
    const pathArray = path.split('.');

    // ambient light
    if (pathArray[1] === 'ambient') {
        if (pathArray[2] === 'cubemap') {
            // enable / disable cubemap
            app.scene.envAtlas = value ? assets.helipad.resource : null;
        } else if (pathArray[2] === 'hemisphere') {
            // switch between smaller upper hemisphere and full sphere
            app.scene.ambientBakeSpherePart = value ? 0.4 : 1;
        } else {
            // all other values are set directly on the scene
            // @ts-ignore engine-tsd
            app.scene[pathArray[2]] = value;
        }
    } else if (pathArray[1] === 'directional') {
        // @ts-ignore engine-tsd
        lightDirectional.light[pathArray[2]] = value;
    } else if (pathArray[1] === 'settings') {
        // @ts-ignore engine-tsd
        app.scene[pathArray[2]] = value;
    } else if (pathArray[1] === 'other') {
        // @ts-ignore engine-tsd
        lightOmni.light[pathArray[2]] = value;
        // @ts-ignore engine-tsd
        lightSpot.light[pathArray[2]] = value;
    } else {
        // don't rebake if stats change
        bakeSettingChanged = false;
    }

    // trigger bake on the next frame if relevant settings were changes
    needBake ||= bakeSettingChanged;
});

// bake properties connected to the HUD
data.set('data', {
    settings: {
        lightmapFilterEnabled: true,
        lightmapFilterRange: 10,
        lightmapFilterSmoothness: 0.2
    },
    ambient: {
        ambientBake: true,
        cubemap: true,
        hemisphere: true,
        ambientBakeNumSamples: 20,
        ambientBakeOcclusionContrast: -0.6,
        ambientBakeOcclusionBrightness: -0.5
    },
    directional: {
        enabled: true,
        bake: true,
        bakeNumSamples: 15,
        bakeArea: 10
    },
    other: {
        enabled: true
    },
    stats: {
        duration: ''
    }
});

// Set an update function on the app's update event
app.on('update', _dt => {
    // bake lightmaps when HUD properties change
    if (needBake) {
        needBake = false;
        app.lightmapper.bake(null, bakeType);

        // update stats with the bake duration
        data.set('data.stats.duration', `${app.lightmapper.stats.totalRenderTime.toFixed(1)}ms`);
    }
});
