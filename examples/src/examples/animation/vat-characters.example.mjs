// @config
//
// This example renders a crowd of animated characters using a {accent:VAT} (Vertex Animation
// Texture). Instead of animating a skeleton per character, the skinned position and normal of every
// vertex is baked into a texture, and the vertex shader interpolates between two frames of it. The
// whole crowd becomes a single instanced draw call, with only a world matrix and a fractional frame
// index per character, which is what makes ten thousand of them affordable.
//
// Use the {accent:Convert GLB} button to turn any glb with a single skinned mesh and animations into
// the format used here.
//
// @credit
// title: Low Poly Lumberjack
// author: Daz
// source: https://sketchfab.com/3d-models/low-poly-lumberjack-a93a29105fc44bf594f8100b7726bcec
// license: CC BY 4.0 (http://creativecommons.org/licenses/by/4.0/)

import {
    ADDRESS_REPEAT,
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    CameraComponentSystem,
    Color,
    ContainerHandler,
    Entity,
    FILLMODE_FILL_WINDOW,
    Keyboard,
    LightComponentSystem,
    Mouse,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    SHADOW_PCF3_32F,
    ScriptComponentSystem,
    StandardMaterial,
    TEXTURETYPE_RGBP,
    TONEMAP_ACES,
    TextureHandler,
    TouchDevice,
    Vec2,
    Vec3,
    createGraphicsDevice,
    math
} from 'playcanvas';
import { CameraControls } from 'playcanvas/scripts/esm/camera-controls.mjs';
import { VatCharacters } from 'playcanvas/scripts/esm/vat/vat-characters.mjs';
import { convertToVat, saveVat } from 'playcanvas/scripts/esm/vat/vat-converter.mjs';

import { data, deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

// the height of a character in world units - the converted data is normalized to be one unit tall
const CHARACTER_HEIGHT = 1.8;

// the largest number of characters the crowd can grow to
const MAX_CHARACTERS = 10000;

// the size of the square area the crowd walks around in
const AREA_SIZE = 150;

// rotation applied on top of the walking direction, to make the character face where it walks
const FACING_OFFSET = 0;

const assets = {
    helipad: new Asset(
        'helipad-env-atlas',
        'texture',
        { url: './assets/cubemaps/table-mountain-env-atlas.png' },
        { type: TEXTURETYPE_RGBP, mipmaps: false }
    ),
    ground: new Asset('ground', 'texture', { url: './assets/textures/coast_sand_rocks_02_diff_1k.jpg' }, { srgb: true })
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
createOptions.keyboard = new Keyboard(document.body);

createOptions.componentSystems = [
    RenderComponentSystem,
    CameraComponentSystem,
    LightComponentSystem,
    ScriptComponentSystem
];

createOptions.resourceHandlers = [TextureHandler, ContainerHandler];

const app = new AppBase(canvas);
app.init(createOptions);

app.setCanvasFillMode(FILLMODE_FILL_WINDOW);
app.setCanvasResolution(RESOLUTION_AUTO);

const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => {
    window.removeEventListener('resize', resize);
});

await new Promise((resolve) => {
    new AssetListLoader(Object.values(assets), app.assets).load(resolve);
});

app.start();

// environment lighting, used by the StandardMaterial version of the characters and the ground
app.scene.envAtlas = assets.helipad.resource;
app.scene.skyboxMip = 2;
app.scene.skyboxIntensity = 0.7;
app.scene.exposure = 1.2;
app.scene.ambientLight = new Color(0.15, 0.16, 0.2);

// the ground the characters walk on
const groundMaterial = new StandardMaterial();
groundMaterial.diffuseMap = assets.ground.resource;
groundMaterial.diffuseMapTiling.set(20, 20);
groundMaterial.diffuseMap.addressU = ADDRESS_REPEAT;
groundMaterial.diffuseMap.addressV = ADDRESS_REPEAT;
groundMaterial.gloss = 0.2;
groundMaterial.metalness = 0;
groundMaterial.useMetalness = true;
groundMaterial.update();

const ground = new Entity('Ground');
ground.addComponent('render', {
    type: 'plane',
    material: groundMaterial,
    castShadows: false
});
ground.setLocalScale(AREA_SIZE * 2, 1, AREA_SIZE * 2);
app.root.addChild(ground);

// the sun, which the custom shader material of the characters also takes its lighting from
const light = new Entity('DirectionalLight');
light.addComponent('light', {
    type: 'directional',
    color: new Color(1, 0.95, 0.85),
    intensity: 2,
    castShadows: true,
    shadowType: SHADOW_PCF3_32F,
    shadowBias: 0.2,
    normalOffsetBias: 0.05,
    shadowDistance: 40,
    numCascades: 2,
    shadowResolution: 2048
});
light.setEulerAngles(45, 30, 0);
app.root.addChild(light);

const camera = new Entity('Camera');
camera.addComponent('camera', {
    clearColor: new Color(0.4, 0.45, 0.5),
    toneMapping: TONEMAP_ACES,
    farClip: 400
});
camera.addComponent('script');
app.root.addChild(camera);

const cameraControls = /** @type {CameraControls} */ (camera.script.create(CameraControls));
cameraControls.pitchRange = new Vec2(-90, -2);
cameraControls.zoomRange = new Vec2(1, 300);

// --------------------------------------------------------------------------------------------
// the characters

/** @type {Entity|null} */
let charactersEntity = null;

/** @type {VatCharacters|null} */
let characters = null;

/** @type {ArrayBuffer|null} */
let vatData = null;

// the file name the generated data is saved as
let savedName = 'lumberjack.vat';

// per character state driving the crowd, allocated up front to avoid allocations while it walks
const headings = new Float32Array(MAX_CHARACTERS);
const turnRates = new Float32Array(MAX_CHARACTERS);
const walkSpeeds = new Float32Array(MAX_CHARACTERS);
const walkPositions = new Float32Array(MAX_CHARACTERS * 3);
let crowdInitialized = 0;

const _position = new Vec3();

/**
 * Grows or shrinks the crowd, giving any newly added characters a random position, walking speed and
 * animation phase.
 *
 * @param {number} count - The number of characters.
 */
const setCrowdCount = (count) => {
    characters.count = count;

    const walk = Math.max(0, characters.getAnimationIndex('Walk'));

    for (let i = crowdInitialized; i < count; i++) {
        headings[i] = Math.random() * Math.PI * 2;
        turnRates[i] = (Math.random() - 0.5) * 0.6;
        walkSpeeds[i] = 1.4 + Math.random() * 0.8;
        walkPositions[i * 3] = (Math.random() - 0.5) * AREA_SIZE;
        walkPositions[i * 3 + 2] = (Math.random() - 0.5) * AREA_SIZE;

        // the playback speed is tied to the walking speed to limit foot sliding, and starting the
        // animation at a random time stops the crowd from moving in lock step
        characters.setAnimation(i, walk, walkSpeeds[i] * 0.75, true, Math.random() * 10);
        characters.setScale(i, CHARACTER_HEIGHT * (0.9 + Math.random() * 0.2));
        characters.setPosition(i, _position.set(walkPositions[i * 3], 0, walkPositions[i * 3 + 2]));
        characters.setEulerAngles(i, 0, headings[i] * math.RAD_TO_DEG + FACING_OFFSET, 0);
    }

    crowdInitialized = Math.max(crowdInitialized, count);
};

/**
 * Sets up either a single character or the walking crowd.
 */
const applyMode = () => {
    if (!characters) {
        return;
    }

    if (data.get('data.mode') === 'single') {
        characters.capacity = 1;
        characters.count = 1;
        characters.setPosition(0, Vec3.ZERO);
        characters.setEulerAngles(0, 0, FACING_OFFSET, 0);
        characters.setScale(0, CHARACTER_HEIGHT);
        characters.setAnimation(0, data.get('data.animation'), data.get('data.speed'));

        camera.setPosition(2.3, 1.8, 3.7);
        cameraControls.focusPoint = new Vec3(0, CHARACTER_HEIGHT * 0.45, 0);
    } else {
        // the single character mode shrinks the capacity of the script, which discards the state of
        // all but the first characters, so set them all up again
        crowdInitialized = 0;
        setCrowdCount(data.get('data.count'));

        camera.setPosition(0, 14, 34);
        cameraControls.focusPoint = new Vec3(0, 1, 0);
    }
};

/**
 * Creates the script rendering the characters. The script is recreated when the data or the material
 * type changes, as the material is set up when the data is loaded.
 *
 * @param {ArrayBuffer|string} source - The VAT container, or the url to load it from.
 */
const createCharacters = async (source) => {
    charactersEntity?.destroy();
    crowdInitialized = 0;

    charactersEntity = new Entity('Characters');
    charactersEntity.addComponent('script');
    app.root.addChild(charactersEntity);

    characters = /** @type {VatCharacters} */ (
        charactersEntity.script.create(VatCharacters, {
            properties: {
                useStandardMaterial: data.get('data.material') === 'standard',
                castShadows: data.get('data.shadows'),
                light: light,

                // hemispherical ambient for the custom shader material - cool from the sky above,
                // warm bounce from the sandy ground below
                ambientSky: new Color(0.45, 0.5, 0.62),
                ambientGround: new Color(0.34, 0.29, 0.22)
            }
        })
    );

    if (typeof source === 'string') {
        vatData = await (await fetch(source)).arrayBuffer();
    } else {
        vatData = source;
    }
    await characters.setData(vatData);

    // let the animation drop down know what is available
    data.set(
        'data.animationNames',
        characters.animations.map((animation) => animation.name)
    );
    if (data.get('data.animation') >= characters.animations.length) {
        data.set('data.animation', 0);
    }

    applyMode();
};

// walk the crowd around the area, wrapping it at the edges
app.on('update', (dt) => {
    if (!characters || data.get('data.mode') === 'single') {
        return;
    }

    const half = AREA_SIZE * 0.5;
    const count = characters.count;

    for (let i = 0; i < count; i++) {
        headings[i] += turnRates[i] * dt;
        const distance = walkSpeeds[i] * dt;

        let x = walkPositions[i * 3] + Math.sin(headings[i]) * distance;
        let z = walkPositions[i * 3 + 2] + Math.cos(headings[i]) * distance;
        if (x > half) x -= AREA_SIZE;
        if (x < -half) x += AREA_SIZE;
        if (z > half) z -= AREA_SIZE;
        if (z < -half) z += AREA_SIZE;
        walkPositions[i * 3] = x;
        walkPositions[i * 3 + 2] = z;

        characters.setPosition(i, _position.set(x, 0, z));
        characters.setEulerAngles(i, 0, headings[i] * math.RAD_TO_DEG + FACING_OFFSET, 0);
    }
});

// --------------------------------------------------------------------------------------------
// the converter, turning a glb the user picks into the VAT format used above

data.on('glb:selected', async (file) => {
    data.set('data.status', 'Converting…');
    savedName = `${file.name.replace(/\.(glb|gltf)$/i, '')}.vat`;

    const url = URL.createObjectURL(file);
    const asset = new Asset(file.name, 'container', { url: url, filename: file.name });

    try {
        app.assets.add(asset);
        await new Promise((resolve, reject) => {
            asset.once('load', resolve);
            asset.once('error', reject);
            app.assets.load(asset);
        });

        const container = await convertToVat(app, asset.resource, {
            fps: data.get('data.fps'),
            embedAlbedo: data.get('data.embedTexture')
        });

        // display the result right away, which also exercises the round trip through the container
        await createCharacters(container);

        const size = (container.byteLength / (1024 * 1024)).toFixed(2);
        data.set('data.status', `${characters.animations.length} animations, ${size} MB`);
        data.set('data.converted', true);
    } catch (error) {
        console.error(error);
        data.set('data.status', error.message);
    } finally {
        asset.unload();
        app.assets.remove(asset);
        URL.revokeObjectURL(url);
    }
});

data.on('vat:save', () => {
    if (vatData) {
        saveVat(vatData, savedName);
    }
});

// --------------------------------------------------------------------------------------------
// control panel handling

data.on('data.mode:set', applyMode);

data.on('data.count:set', (count) => {
    if (characters && data.get('data.mode') === 'crowd') {
        setCrowdCount(count);
    }
});

data.on('data.animation:set', (animation) => {
    if (characters && data.get('data.mode') === 'single') {
        characters.setAnimation(0, animation, data.get('data.speed'));
    }
});

data.on('data.speed:set', (speed) => {
    if (characters && data.get('data.mode') === 'single') {
        characters.setSpeed(0, speed);
    }
});

data.on('data.shadows:set', (shadows) => {
    if (characters) {
        characters.castShadows = shadows;
    }
});

data.on('data.material:set', () => {
    if (vatData) {
        createCharacters(vatData);
    }
});

data.set('data', {
    mode: 'crowd',
    material: 'shader',
    animation: 0,
    animationNames: [],
    speed: 1,
    count: 2000,
    shadows: true,
    fps: 10,
    embedTexture: true,
    converted: false,
    status: 'Pick a glb with a single skinned mesh'
});

try {
    await createCharacters('./assets/vat/lumberjack.vat');
} catch (error) {
    console.error(error);
    data.set('data.status', 'Failed to load the character, convert a glb instead');
}
