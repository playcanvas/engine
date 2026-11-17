// @config
//
// One video texture shown on two surfaces. The video wall is a grid of glowing tiles, each mapping
// its own part of the video, which flip in waves. The rounded cube in front of it shows the whole
// video on each of its faces. A rectangular area light in front of the wall takes the average color
// of each frame, read from the smallest mip level of the texture, and lights the floor with it. A
// new frame is uploaded only when the video has one.
//
// @credit
// title: Big Buck Bunny
// author: Blender Foundation
// source: https://peach.blender.org
// license: CC BY 3.0 (https://creativecommons.org/licenses/by/3.0/)

import {
    ADDRESS_CLAMP_TO_EDGE,
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    BoxGeometry,
    CameraComponentSystem,
    CameraFrame,
    Color,
    ContainerHandler,
    Entity,
    FILLMODE_FILL_WINDOW,
    FILTER_LINEAR,
    FILTER_LINEAR_MIPMAP_LINEAR,
    FOG_LINEAR,
    JsonHandler,
    LIGHTFALLOFF_INVERSESQUARED,
    LIGHTSHAPE_RECT,
    LightComponentSystem,
    Mesh,
    MeshInstance,
    Mouse,
    PIXELFORMAT_SRGBA8,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    RoundedBoxGeometry,
    ScriptComponentSystem,
    StandardMaterial,
    TONEMAP_NEUTRAL,
    Texture,
    TextureHandler,
    TouchDevice,
    Vec2,
    Vec3,
    createGraphicsDevice,
    math
} from 'playcanvas';
import { CameraControls } from 'playcanvas/scripts/esm/camera-controls.mjs';

import { data, deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    luts: new Asset('luts', 'json', { url: './assets/json/area-light-luts.json' })
};

const device = await createGraphicsDevice(canvas, {
    deviceTypes: [deviceType]
});
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
createOptions.resourceHandlers = [TextureHandler, ContainerHandler, JsonHandler];

const app = new AppBase(canvas);
app.init(createOptions);
app.setCanvasFillMode(FILLMODE_FILL_WINDOW);
app.setCanvasResolution(RESOLUTION_AUTO);

const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => window.removeEventListener('resize', resize));

// ----- The video and its texture -----

// The video element. It starts muted, as browsers only autoplay videos without sound. Some
// browsers, mobile ones especially, only load a video that is in the page, so it is added to it,
// hidden behind the canvas.
const video = document.createElement('video');
video.src = './assets/video/SampleVideo_1280x720_1mb.mp4';
video.crossOrigin = 'anonymous';
video.loop = true;
video.muted = true;
video.autoplay = true;

// inline playback, as iOS would play it full screen otherwise
video.playsInline = true;
video.setAttribute(
    'style',
    'position: absolute; top: 0; width: 1px; height: 1px; opacity: 0; z-index: -1000; pointer-events: none'
);
document.body.append(video);
app.on('destroy', () => {
    video.pause();
    video.remove();
});

// load the assets, and the first frame of the video, which gives its size
await Promise.all([
    new Promise((resolve) => {
        new AssetListLoader(Object.values(assets), app.assets).load(resolve);
    }),
    new Promise((resolve) => {
        video.addEventListener('loadeddata', resolve, { once: true });
    })
]);

app.start();

data.set('settings', {
    playing: true,
    sound: false,
    wave: true,
    wallLight: true
});

// The texture the video frames are uploaded to, the size of the video. A video holds sRGB colors,
// so the texture uses the sRGB format, which the GPU converts to linear when sampling it. The
// mipmaps keep the video smooth on the distant and tilted surfaces, and their smallest level is the
// average color of the frame.
const videoTexture = new Texture(device, {
    name: 'Video',
    width: video.videoWidth,
    height: video.videoHeight,
    format: PIXELFORMAT_SRGBA8,
    mipmaps: true,
    minFilter: FILTER_LINEAR_MIPMAP_LINEAR,
    magFilter: FILTER_LINEAR,
    addressU: ADDRESS_CLAMP_TO_EDGE,
    addressV: ADDRESS_CLAMP_TO_EDGE,
    anisotropy: 8
});
videoTexture.setSource(video);

// The video plays at its own frame rate, which is usually lower than the frame rate of the app.
// Where the browser reports each new frame of the video, a frame is uploaded only when there is a
// new one, otherwise every frame of the app.
const frameCallbacks = 'requestVideoFrameCallback' in video;
let newFrame = false;
if (frameCallbacks) {
    const onVideoFrame = () => {
        newFrame = true;
        video.requestVideoFrameCallback(onVideoFrame);
    };
    video.requestVideoFrameCallback(onVideoFrame);
}

// ----- The scene -----

// The lookup tables the area light is evaluated with
const luts = /** @type {{ LTC_MAT_1: number[], LTC_MAT_2: number[] }} */ (assets.luts.resource);
app.setAreaLightLuts(luts.LTC_MAT_1, luts.LTC_MAT_2);

// The lights are clustered, which supports area lights once enabled
app.scene.lighting.areaLightsEnabled = true;

// The only area light is a rectangle, so the shaders of the materials compile no disk and sphere
// light code, which makes them faster to compile
app.scene.lighting.areaLightDiskEnabled = false;
app.scene.lighting.areaLightSphereEnabled = false;

// A dark space, with the floor fading into the distance
app.scene.ambientLight = new Color(0.01, 0.01, 0.012);
app.scene.fog.type = FOG_LINEAR;
app.scene.fog.color = Color.BLACK;
app.scene.fog.start = 12;
app.scene.fog.end = 30;

/**
 * Creates an entity rendering a mesh.
 *
 * @param {Mesh} mesh - The mesh.
 * @param {StandardMaterial} material - The material.
 * @param {Entity} parent - The parent entity.
 * @returns {Entity} The entity.
 */
const createMeshEntity = (mesh, material, parent) => {
    const entity = new Entity();
    entity.addComponent('render', { type: 'asset' });
    entity.render.meshInstances = [new MeshInstance(mesh, material, entity)];
    parent.addChild(entity);
    return entity;
};

// A dark matte floor, lit by the video wall
const floorMaterial = new StandardMaterial();
floorMaterial.diffuse = new Color(0.15, 0.15, 0.16);
floorMaterial.update();

const floor = new Entity('Floor');
floor.addComponent('render', { type: 'plane', material: floorMaterial });
floor.setLocalScale(60, 1, 60);
app.root.addChild(floor);

// The tiles and the cube glow with the video, as they do not need lighting. The emissive intensity
// above 1 makes them bright enough to bloom.
const videoMaterial = new StandardMaterial();
videoMaterial.diffuse = Color.BLACK;
videoMaterial.emissive = Color.WHITE;
videoMaterial.emissiveMap = videoTexture;
videoMaterial.emissiveIntensity = 1.6;
videoMaterial.update();

// ----- Surface 1: the video wall -----

// A grid of 16 by 9 square tiles, matching the 16:9 video
const COLUMNS = 16;
const ROWS = 9;
const TILE_SIZE = 0.4;
const TILE_PITCH = TILE_SIZE + 0.03;
const WALL_WIDTH = COLUMNS * TILE_PITCH;
const WALL_HEIGHT = ROWS * TILE_PITCH;

const wall = new Entity('VideoWall');
wall.setLocalPosition(0, 0.6 + WALL_HEIGHT * 0.5, -4.5);
app.root.addChild(wall);

/**
 * @typedef {object} Tile
 * @property {Entity} entity - The entity of the tile.
 * @property {number} column - The column of the tile, from the left.
 * @property {number} row - The row of the tile, from the top.
 * @property {Vec3} position - The position of the tile on the wall.
 */

/** @type {Tile[]} */
const tiles = [];
for (let row = 0; row < ROWS; row++) {
    for (let column = 0; column < COLUMNS; column++) {
        // Each tile has its own mesh, its texture coordinates mapping its part of the video onto
        // all of its faces. The box faces map the full texture, with v running down the face, the
        // same way as the rows of the video.
        const geometry = new BoxGeometry({ halfExtents: new Vec3(TILE_SIZE * 0.5, TILE_SIZE * 0.5, 0.04) });
        const uvs = geometry.uvs;
        for (let i = 0; i < uvs.length; i += 2) {
            uvs[i] = (column + uvs[i]) / COLUMNS;
            uvs[i + 1] = (row + uvs[i + 1]) / ROWS;
        }

        const entity = createMeshEntity(Mesh.fromGeometry(device, geometry), videoMaterial, wall);
        const position = new Vec3(
            (column - (COLUMNS - 1) * 0.5) * TILE_PITCH,
            ((ROWS - 1) * 0.5 - row) * TILE_PITCH,
            0
        );
        entity.setLocalPosition(position);
        tiles.push({ entity, column, row, position });
    }
}

// The light of the wall: a rectangular area light the size of the wall, shining over the whole half
// space in front of it. The spot light shines down its -Y axis, so it is turned to face the front,
// its height along the Z axis.
const wallLight = new Entity('WallLight');
wallLight.addComponent('light', {
    type: 'spot',
    shape: LIGHTSHAPE_RECT,
    falloffMode: LIGHTFALLOFF_INVERSESQUARED,
    color: Color.BLACK,
    intensity: 12,
    range: 25,
    innerConeAngle: 80,
    outerConeAngle: 90
});
wallLight.setLocalPosition(0, 0, 0.05);
wallLight.setLocalEulerAngles(-90, 0, 0);
wallLight.setLocalScale(WALL_WIDTH, 1, WALL_HEIGHT);
wall.addChild(wallLight);

// ----- Surface 2: the rounded cube -----

// A cube with rounded edges, floating in front of the wall. Each face maps the whole video, and
// takes half of each rounded edge next to it.
const cube = createMeshEntity(
    Mesh.fromGeometry(device, new RoundedBoxGeometry({ radius: 0.12, radiusSegments: 12 })),
    videoMaterial,
    app.root
);

// ----- The camera -----

const camera = new Entity('Camera');
camera.addComponent('camera', {
    clearColor: Color.BLACK,
    fov: 60,
    nearClip: 0.1,
    farClip: 100
});
camera.addComponent('script');
camera.setLocalPosition(0.4, 1.8, 3.6);
app.root.addChild(camera);

// The camera orbits the cube, looking past it at the wall
const cameraControls = /** @type {CameraControls} */ (camera.script.create(CameraControls));
cameraControls.focusPoint = new Vec3(0, 1.9, -1.5);
cameraControls.enableFly = false;
cameraControls.pitchRange = new Vec2(-40, 0);
cameraControls.zoomRange = new Vec2(2, 10);

// Bloom makes the video glow. The neutral tone mapping keeps the colors of the video.
const cameraFrame = new CameraFrame(app, camera.camera);
cameraFrame.rendering.samples = 4;
cameraFrame.rendering.toneMapping = TONEMAP_NEUTRAL;
cameraFrame.bloom.intensity = 0.02;
cameraFrame.bloom.blurLevel = 6;
cameraFrame.vignette.intensity = 0.4;
cameraFrame.update();

// ----- Settings -----

const applySettings = () => {
    const settings = data.get('settings');

    if (settings.playing) {
        video.play().catch(() => {});
    } else {
        video.pause();
    }

    // unmuting is allowed only after the user interacted with the page, otherwise the video stays
    // muted
    video.muted = !settings.sound;
    if (!video.muted && settings.playing) {
        video.play().catch(() => {
            video.muted = true;
            data.set('settings.sound', false);
        });
    }

    wallLight.enabled = settings.wallLight;
};
applySettings();
data.on('*:set', applySettings);

// ----- Update -----

// The average color of the video, read back from the GPU, and the color of the wall light, which
// eases towards it
const averageColor = new Color(0, 0, 0);
const lightColor = new Color(0, 0, 0);
let reading = false;

/**
 * Reads the average color of the video from the 1x1 pixel, smallest mip level of its texture. The
 * read is frequent, which takes a frame longer, and does not stall the GPU.
 */
const readAverageColor = () => {
    reading = true;
    videoTexture.read(0, 0, 1, 1, { mipLevel: videoTexture.numLevels - 1, frequent: true }).then(
        (pixels) => {
            averageColor.set(pixels[0] / 255, pixels[1] / 255, pixels[2] / 255);
            reading = false;
        },
        // the read is rejected when the app is destroyed before it completes
        () => {}
    );
};

// A new wave of flipping tiles starts every few seconds, each from a different point of the wall,
// spreading from it. The waves spin the tiles in alternating directions.
const WAVE_PERIOD = 4;
const WAVE_ORIGINS = [
    new Vec2(0, (ROWS - 1) * 0.5),
    new Vec2((COLUMNS - 1) * 0.5, (ROWS - 1) * 0.5),
    new Vec2(COLUMNS - 1, 0),
    new Vec2((COLUMNS - 1) * 0.5, 0),
    new Vec2(COLUMNS - 1, (ROWS - 1) * 0.5),
    new Vec2(0, ROWS - 1)
];
const FLIP_DURATION = 1.2;
const FLIP_DELAY = 0.08;

let time = 0;
app.on('update', (/** @type {number} */ dt) => {
    time += dt;

    // Each tile flips a full turn around its vertical axis as the wave passes it, and comes forward
    // while it turns. Its back face shows the same part of the video.
    const wave = data.get('settings.wave');
    const waveIndex = Math.floor(time / WAVE_PERIOD);
    const waveTime = time - waveIndex * WAVE_PERIOD;
    const origin = WAVE_ORIGINS[waveIndex % WAVE_ORIGINS.length];
    const direction = waveIndex % 2 ? 1 : -1;
    tiles.forEach(({ entity, column, row, position }) => {
        const delay = Math.hypot(column - origin.x, row - origin.y) * FLIP_DELAY;
        const flip = wave ? math.clamp((waveTime - delay) / FLIP_DURATION, 0, 1) : 0;
        const turn = flip * flip * (3 - 2 * flip);
        entity.setLocalPosition(position.x, position.y, Math.sin(flip * Math.PI) * 0.7);
        entity.setLocalEulerAngles(0, direction * turn * 360, 0);
    });

    // the cube floats and tumbles slowly
    cube.setLocalPosition(0, 1.3 + Math.sin(time * 0.8) * 0.08, 0);
    cube.setLocalEulerAngles(20 + Math.sin(time * 0.3) * 15, time * 20, 30);

    // upload the new frame of the video to the texture
    if (newFrame || !frameCallbacks) {
        newFrame = false;
        videoTexture.upload();

        if (!reading) {
            readAverageColor();
        }
    }

    // the wall light changes color smoothly, as the video frames change
    lightColor.lerp(lightColor, averageColor, Math.min(1, dt * 8));
    wallLight.light.color = lightColor;
});
