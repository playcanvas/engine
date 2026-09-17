// @config
//
// Parallax mapping uses a height map to offset the uv of the material's other maps, so a flat
// surface reads as though it had depth. The Mode control switches between the two the engine
// offers - a single tap of the map, and marching the view ray through it, which holds up at much
// deeper relief - and the height map switched off entirely for comparison.
//
// The same brick material covers the inside of the room and the sphere, lit by a spot light and an
// omni light. Samples caps the number of height map taps taken along the ray, and Height scales the
// depth of the height field.
//
// `LMB` Orbit · Hold `Shift` / `MMB` Pan · `Wheel` Zoom

import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    CameraComponentSystem,
    Color,
    Entity,
    FILLMODE_FILL_WINDOW,
    LightComponentSystem,
    Mesh,
    MeshInstance,
    PARALLAX_OCCLUSION,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    ScriptComponentSystem,
    ScriptHandler,
    SphereGeometry,
    StandardMaterial,
    TEXTURETYPE_RGBP,
    TONEMAP_ACES,
    TextureHandler,
    Vec2,
    Vec3,
    createGraphicsDevice
} from 'playcanvas';
import { CameraControls } from 'playcanvas/scripts/esm/camera-controls.mjs';

import { data, deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const path = './assets/textures/bricks076a';
const assets = {
    helipad: new Asset(
        'helipad-env-atlas',
        'texture',
        { url: './assets/cubemaps/morning-env-atlas.png' },
        { type: TEXTURETYPE_RGBP, mipmaps: false }
    ),
    color: new Asset('color', 'texture', { url: `${path}/color.webp` }, { srgb: true }),
    normal: new Asset('normal', 'texture', { url: `${path}/normal.webp` }),
    height: new Asset('height', 'texture', { url: `${path}/height.webp` }),
    roughness: new Asset('roughness', 'texture', { url: `${path}/roughness.webp` }),
    ao: new Asset('ao', 'texture', { url: `${path}/ao.webp` })
};

const gfxOptions = {
    deviceTypes: [deviceType]
};

const device = await createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new AppOptions();
createOptions.graphicsDevice = device;
createOptions.componentSystems = [
    RenderComponentSystem,
    CameraComponentSystem,
    LightComponentSystem,
    ScriptComponentSystem
];
createOptions.resourceHandlers = [TextureHandler, ScriptHandler];

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

// the room is closed, so the environment is only there to fill the shadows with some ambient light
const envIntensity = 0.1;
app.scene.envAtlas = assets.helipad.resource;
app.scene.skyboxIntensity = envIntensity;
app.scene.exposure = 1;

/**
 * Create a brick material from the full set of maps.
 *
 * @param {Vec2} tiling - The tiling to apply to every map.
 * @returns {StandardMaterial} The new material.
 */
function createBrickMaterial(tiling) {
    const material = new StandardMaterial();
    material.diffuseMap = assets.color.resource;
    material.normalMap = assets.normal.resource;
    material.heightMap = assets.height.resource;
    material.aoMap = assets.ao.resource;

    // the map is roughness rather than gloss, so it is used inverted
    material.glossMap = assets.roughness.resource;
    material.glossInvert = true;

    material.useMetalness = true;
    material.metalness = 0;

    // the parallax offset is applied to the uv of all other maps, so they all need the same tiling
    const maps = [
        material.diffuseMapTiling,
        material.normalMapTiling,
        material.heightMapTiling,
        material.aoMapTiling,
        material.glossMapTiling
    ];
    maps.forEach((map) => map.copy(tiling));

    material.update();
    return material;
}

const roomSize = 10;
const sphereSize = 2.2;

// the sphere rests on the floor, and is what the camera orbits
const spherePosition = new Vec3(0, (sphereSize - roomSize) * 0.5, 0);

const roomMaterial = createBrickMaterial(new Vec2(3, 3));
const sphereMaterial = createBrickMaterial(new Vec2(3, 2));
const materials = [roomMaterial, sphereMaterial];

// The room is six inward facing planes rather than a box seen from the inside. A tangent frame
// derived from screen space derivatives is mirrored on a back face, and as two sided lighting only
// flips the normal of the frame and not its tangents, the marched relief on those faces comes out
// inside out. Keeping every face front facing avoids that, and needs no back face culling either.
const half = roomSize * 0.5;
const walls = [
    { name: 'floor', position: new Vec3(0, -half, 0), rotation: new Vec3(0, 0, 0) },
    { name: 'ceiling', position: new Vec3(0, half, 0), rotation: new Vec3(180, 0, 0) },
    { name: 'wall back', position: new Vec3(0, 0, -half), rotation: new Vec3(90, 0, 0) },
    { name: 'wall front', position: new Vec3(0, 0, half), rotation: new Vec3(-90, 0, 0) },
    { name: 'wall left', position: new Vec3(-half, 0, 0), rotation: new Vec3(0, 0, -90) },
    { name: 'wall right', position: new Vec3(half, 0, 0), rotation: new Vec3(0, 0, 90) }
];

walls.forEach((wall) => {
    const entity = new Entity(wall.name);
    entity.addComponent('render', {
        type: 'plane',
        material: roomMaterial
    });
    entity.setLocalPosition(wall.position);
    entity.setLocalEulerAngles(wall.rotation);
    entity.setLocalScale(roomSize, 1, roomSize);
    app.root.addChild(entity);
});

// A sphere, so the effect can be seen on a curved surface as well as on the flat walls. It is built
// from the geometry directly rather than as a primitive, as the sixteen bands a primitive sphere uses
// leave the silhouette and the shading faceted, and the facet edges shimmer as the parallax offset
// steps across them.
const sphereMesh = Mesh.fromGeometry(
    app.graphicsDevice,
    new SphereGeometry({
        radius: 0.5,
        latitudeBands: 128,
        longitudeBands: 128
    })
);

const sphere = new Entity('sphere');
sphere.addComponent('render', { type: 'asset' });
sphere.render.meshInstances = [new MeshInstance(sphereMesh, sphereMaterial, sphere)];
sphere.setLocalScale(sphereSize, sphereSize, sphereSize);
sphere.setLocalPosition(spherePosition);
app.root.addChild(sphere);

// A spot light above the sphere, casting shadows. A light shines along the negative y axis of its
// entity, so lookAt - which orients the negative z axis - is followed by a quarter turn to bring
// that axis onto the target.
const spot = new Entity('spot light');
spot.addComponent('light', {
    type: 'spot',
    color: new Color(1, 0.95, 0.85),
    intensity: 3,
    range: 18,
    innerConeAngle: 12,
    outerConeAngle: 32,
    castShadows: true,
    shadowBias: 0.2,
    normalOffsetBias: 0.05,
    shadowResolution: 1024
});
spot.setLocalPosition(2.8, 4, 2.8);
spot.lookAt(spherePosition);
spot.rotateLocal(90, 0, 0);
app.root.addChild(spot);

// an omni light in the opposite corner, filling the shadows with a cooler colour, and casting its
// own set of them
const omni = new Entity('omni light');
omni.addComponent('light', {
    type: 'omni',
    color: new Color(0.55, 0.7, 1),
    intensity: 2,
    range: 18,
    castShadows: true,
    shadowBias: 0.2,
    normalOffsetBias: 0.05,
    shadowResolution: 1024
});
omni.setLocalPosition(-3.2, -2, -3.4);
app.root.addChild(omni);

// The camera orbits the sphere from inside the room. The zoom range keeps it clear of the sphere and
// of the walls, and the pitch range stops it dropping below the sphere and through the floor.
const camera = new Entity('camera');
camera.addComponent('camera', {
    toneMapping: TONEMAP_ACES,
    fov: 60,
    clearColor: new Color(0, 0, 0)
});
camera.setLocalPosition(spherePosition.x + 2.6, spherePosition.y + 1.5, spherePosition.z + 3);
camera.addComponent('script');
app.root.addChild(camera);

camera.script.create(CameraControls, {
    properties: {
        focusPoint: spherePosition,
        enableFly: false,
        zoomRange: new Vec2(sphereSize * 0.8, roomSize * 0.45),
        pitchRange: new Vec2(-75, 0)
    }
});

// Selecting this mode unassigns the height map rather than setting a mode on the material, which
// takes the parallax code out of the generated shader altogether
const MODE_NONE = 'none';

// Initial values
data.set('data', {
    mode: PARALLAX_OCCLUSION,
    samples: 16,

    // A height of 1 asks for a relief a tenth of a uv tile deep, which on these walls is a good
    // third of a world unit - real enough to march correctly, but far deeper than brickwork, and it
    // reads as spikes when the floor is viewed from low down. This is the depth the material suits.
    height: 0.4,

    // the height map value that sits at the level of the geometry - the engine default pivots the
    // relief around mid-grey, and 1 treats the map as pure depth carved below the surface
    base: 0.5,

    spot: true,
    omni: true,
    env: envIntensity
});

let mode, samples, height, base;

app.on('update', () => {
    const newMode = data.get('data.mode');
    const newSamples = data.get('data.samples');
    const newHeight = data.get('data.height');
    const newBase = data.get('data.base');

    if (newMode !== mode || newSamples !== samples || newHeight !== height || newBase !== base) {
        mode = newMode;
        samples = newSamples;
        height = newHeight;
        base = newBase;

        materials.forEach((material) => {
            material.heightMap = mode === MODE_NONE ? null : assets.height.resource;
            if (mode !== MODE_NONE) {
                material.parallaxMode = mode;
            }
            material.parallaxSamples = samples;
            material.heightMapFactor = height;
            material.heightMapBase = base;
            material.update();
        });
    }

    // both setters ignore a value they already hold, so these need no change tracking
    spot.enabled = data.get('data.spot');
    omni.enabled = data.get('data.omni');
    app.scene.skyboxIntensity = data.get('data.env');
});
