// @config
//
// The Dingo Gap on Mars, streamed as {accent:3D Tiles} by the
// [3DTilesRendererJS](https://github.com/NASA-AMMOS/3DTilesRendererJS) library. The terrain was
// reconstructed from images taken by the Curiosity rover, which drove over this dune in 2014,
// and the rover model plays its deployment and drive animation.
//
// @credit
// title: Dingo Gap 3D Tiles
// author: NASA/JPL-Caltech
// source: https://github.com/NASA-AMMOS/3DTilesSampleData
// license: JPL Image Use Policy (https://www.jpl.nasa.gov/jpl-image-use-policy)
//
// @credit
// title: Curiosity Rover
// author: NASA/JPL-Caltech
// source: https://github.com/nasa/NASA-3D-Resources
// license: NASA Media Usage Guidelines (https://www.nasa.gov/nasa-brand-center/images-and-media)

import { TilesRenderer } from '3d-tiles-renderer/playcanvas';

import {
    AnimClipHandler,
    AnimComponentSystem,
    AnimStateGraphHandler,
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    CameraComponentSystem,
    CameraFrame,
    Color,
    ContainerHandler,
    Entity,
    FILLMODE_FILL_WINDOW,
    FOG_EXP2,
    LightComponentSystem,
    Mouse,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    SHADERLANGUAGE_GLSL,
    SHADERLANGUAGE_WGSL,
    ScriptComponentSystem,
    TONEMAP_NEUTRAL,
    TextureHandler,
    TouchDevice,
    Vec2,
    Vec3,
    createGraphicsDevice
} from 'playcanvas';
import { CameraControls } from 'playcanvas/scripts/esm/camera-controls.mjs';

import { data, deviceType } from 'examples/context';

/**
 * @import { StandardMaterial } from 'playcanvas'
 */

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

// the terrain near the rover, and the distant terrain around it
const TILESET_ROOT =
    'https://raw.githubusercontent.com/NASA-AMMOS/3DTilesSampleData/master/msl-dingo-gap/0528_0260184_to_s64o256_colorize';
const GROUND_URL = `${TILESET_ROOT}/0528_0260184_to_s64o256_colorize/0528_0260184_to_s64o256_colorize_tileset.json`;
const SKY_URL = `${TILESET_ROOT}/0528_0260184_to_s64o256_sky/0528_0260184_to_s64o256_sky_tileset.json`;

const assets = {
    rover: new Asset('rover', 'container', { url: './assets/models/curiosity-rover.glb' })
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
    ScriptComponentSystem,
    AnimComponentSystem
];
createOptions.resourceHandlers = [TextureHandler, ContainerHandler, AnimClipHandler, AnimStateGraphHandler];

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

data.set('data', {
    tiles: {
        errorTarget: 5
    },
    sun: {
        elevation: 15,
        azimuth: 320
    },
    fog: {
        density: 0.01
    },
    rover: {
        speed: 1
    }
});

// the color of the dusty sky in the panorama of the distant terrain, used for the light and the
// haze, and as the clear color above the panorama
const skyColor = new Color(0.7, 0.67, 0.51);
app.scene.ambientLight = new Color(0.4, 0.34, 0.28);
app.scene.fog.type = FOG_EXP2;
app.scene.fog.color = skyColor;

// the sun, a warm light through the dust
const sun = new Entity('Sun');
sun.addComponent('light', {
    type: 'directional',
    color: new Color(1, 0.88, 0.72),
    intensity: 1.8,
    castShadows: true,
    shadowBias: 0.2,
    normalOffsetBias: 0.05,
    shadowDistance: 40,
    numCascades: 2,
    shadowResolution: 2048
});
app.root.addChild(sun);

// the camera, orbiting the rover
const camera = new Entity('Camera');
camera.addComponent('camera', {
    clearColor: skyColor,
    fov: 50,
    nearClip: 0.1,
    farClip: 4000
});
camera.setLocalPosition(-5.78, 3.07, -7.09);
app.root.addChild(camera);

camera.addComponent('script');
const cameraControls = /** @type {CameraControls} */ (camera.script.create(CameraControls));
cameraControls.focusPoint = new Vec3(0, 1, 0);
cameraControls.pitchRange = new Vec2(-89, 5);
cameraControls.zoomRange = new Vec2(3, 200);

// the tilesets are Z down, so they are rotated to have Y up. The distant terrain shares the
// cache of the ground, so both are kept within one memory budget
const mars = new Entity('Mars');
mars.setLocalEulerAngles(90, 0, 0);
app.root.addChild(mars);

/**
 * Creates a tiles renderer for the tileset, and calls the callback for the material of every
 * loaded tile.
 *
 * @param {string} url - The URL of the tileset.
 * @param {(material: StandardMaterial) => void} setupMaterial - Called for each tile material.
 * @returns {TilesRenderer} The tiles renderer.
 */
const createTiles = (url, setupMaterial) => {
    const tiles = new TilesRenderer(url, app);
    tiles.fetchOptions.mode = 'cors';
    tiles.setCamera(camera.camera);
    mars.addChild(tiles.group);

    tiles.addEventListener('load-model', ({ scene }) => {
        for (const render of scene.findComponents('render')) {
            for (const meshInstance of render.meshInstances) {
                setupMaterial(/** @type {StandardMaterial} */ (meshInstance.material));
                meshInstance.material.update();
            }
        }
    });
    return tiles;
};

// the tiles are photographs, stored as unlit materials with the color in the emissive map. The
// ground moves it to the diffuse map, so it is lit and receives the shadow of the rover
const groundTiles = createTiles(GROUND_URL, (material) => {
    material.diffuseMap = material.emissiveMap;
    material.emissiveMap = null;
    material.emissive.set(0, 0, 0);
    material.useLighting = true;
});
groundTiles.renderOptions = { castShadows: false, receiveShadows: true };

// the panorama of the distant terrain and the sky stays unlit. It is white where the rover did not
// photograph the scene, which is blended to the color of the sky
const linearSkyColor = skyColor.clone().linear();
const skyTiles = createTiles(SKY_URL, (material) => {
    material.setParameter('skyColor', [linearSkyColor.r, linearSkyColor.g, linearSkyColor.b]);
    material.getShaderChunks(SHADERLANGUAGE_GLSL).set('litUserDeclarationPS', 'uniform vec3 skyColor;');
    material.getShaderChunks(SHADERLANGUAGE_GLSL).set(
        'litUserMainEndPS',
        `
        float noData = smoothstep(0.45, 0.6, min(gl_FragColor.r, min(gl_FragColor.g, gl_FragColor.b)));
        gl_FragColor.rgb = mix(gl_FragColor.rgb, skyColor, noData);
    `
    );
    material.getShaderChunks(SHADERLANGUAGE_WGSL).set('litUserDeclarationPS', 'uniform skyColor: vec3f;');
    material.getShaderChunks(SHADERLANGUAGE_WGSL).set(
        'litUserMainEndPS',
        `
        let noData = smoothstep(0.45, 0.6, min(output.color.r, min(output.color.g, output.color.b)));
        output.color = vec4f(mix(output.color.rgb, uniform.skyColor, noData), output.color.a);
    `
    );
});
skyTiles.lruCache = groundTiles.lruCache;

// the rover. Its clip deploys it during the first 10 seconds and then drives it. The whole clip
// plays once, and then only the drive section plays, alternating in reverse and forward, as
// looping the clip would snap the rover back to its stowed starting pose
const rover = assets.rover.resource.instantiateRenderEntity({
    castShadows: true,
    receiveShadows: true
});
const roverTrack = assets.rover.resource.animations[0].resource;
const driveStart = 10 / roverTrack.duration;
rover.addComponent('anim', { activate: true });
rover.anim.loadStateGraph({
    layers: [
        {
            name: 'Base',
            states: [
                { name: 'START' },
                { name: 'Deploy', speed: 1, loop: false },
                { name: 'Reverse', speed: -1, loop: false },
                { name: 'Forward', speed: 1, loop: false }
            ],
            transitions: [
                { from: 'START', to: 'Deploy' },
                // a reversed state starts at the end of the clip, and leaves it at the drive start
                { from: 'Deploy', to: 'Reverse', exitTime: 1 },
                { from: 'Reverse', to: 'Forward', exitTime: 1 - driveStart, transitionOffset: driveStart },
                { from: 'Forward', to: 'Reverse', exitTime: 1 }
            ]
        }
    ],
    parameters: {}
});
['Deploy', 'Reverse', 'Forward'].forEach((state) => rover.anim.baseLayer.assignAnimation(state, roverTrack));
rover.setLocalEulerAngles(0, 180, 0);
app.root.addChild(rover);

// HDR rendering, with a soft bloom and a vignette
const cameraFrame = new CameraFrame(app, camera.camera);
cameraFrame.rendering.toneMapping = TONEMAP_NEUTRAL;
cameraFrame.bloom.intensity = 0.01;
cameraFrame.vignette.intensity = 0.4;
cameraFrame.update();

// Downloads and parses can still be in flight when the example is switched. Disposing the
// renderers aborts them, so they do not touch the destroyed asset registry and device.
app.on('destroy', () => {
    groundTiles.dispose();
    skyTiles.dispose();
});

app.on('update', () => {
    groundTiles.errorTarget = data.get('data.tiles.errorTarget');
    skyTiles.errorTarget = data.get('data.tiles.errorTarget');
    groundTiles.update();
    skyTiles.update();

    sun.setLocalEulerAngles(data.get('data.sun.elevation') - 90, data.get('data.sun.azimuth'), 0);
    app.scene.fog.density = data.get('data.fog.density');
    rover.anim.speed = data.get('data.rover.speed');
});
