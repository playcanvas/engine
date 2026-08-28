// @config
//
// Parallax mapping on open ground, where one ground material is seen across a wide range of
// distances and angles at once - the case the marched mode earns its cost in.
//
// `WASDQE` Move · Hold `Shift` Move fast · Hold `Ctrl` Move slow · `LMB` / `RMB` Orbit / fly · Hold `Shift` / `MMB` Pan · `Wheel` Zoom
//
// @credit
// title: Low-poly Tree with Twisting Branches
// author: Sketchfab
// source: https://sketchfab.com/3d-models/low-poly-tree-with-twisting-branches-4e2589134f2442bcbdab51c1f306cd58
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
    LightComponentSystem,
    Mesh,
    MeshInstance,
    PARALLAX_OCCLUSION,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    SHADOW_PCF3_32F,
    ScriptComponentSystem,
    ScriptHandler,
    StandardMaterial,
    TEXTURETYPE_RGBP,
    TONEMAP_ACES,
    TextureHandler,
    Vec2,
    Vec3,
    calculateNormals,
    createGraphicsDevice
} from 'playcanvas';
import { CameraControls } from 'playcanvas/scripts/esm/camera-controls.mjs';

import { data, deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const path = './assets/textures/ground092c';
const assets = {
    envAtlas: new Asset(
        'env-atlas',
        'texture',
        { url: './assets/cubemaps/morning-env-atlas.png' },
        { type: TEXTURETYPE_RGBP, mipmaps: false }
    ),
    color: new Asset('color', 'texture', { url: `${path}/color.webp` }, { srgb: true }),
    normal: new Asset('normal', 'texture', { url: `${path}/normal.webp` }),
    height: new Asset('height', 'texture', { url: `${path}/height.webp` }),
    roughness: new Asset('roughness', 'texture', { url: `${path}/roughness.webp` }),
    ao: new Asset('ao', 'texture', { url: `${path}/ao.webp` }),
    tree: new Asset('tree', 'container', { url: './assets/models/low-poly-tree.glb' })
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

app.scene.envAtlas = assets.envAtlas.resource;
app.scene.skyboxIntensity = 0.35;
app.scene.skyboxMip = 2;
app.scene.exposure = 0.9;

const terrainSize = 200;
const terrainHeight = 14;
const terrainSegments = 200;
const textureTiling = 10;

/**
 * A couple of octaves of smoothed value noise, which is enough for rolling ground and keeps the
 * generation on the cpu simple. Returns roughly -1 to 1.
 *
 * @param {number} x - Sample position.
 * @param {number} y - Sample position.
 * @returns {number} The noise value.
 */
function noise(x, y) {
    // hash a lattice point to a repeatable pseudo random value
    const at = (ix, iy) => {
        const n = Math.sin(ix * 127.1 + iy * 311.7) * 43758.5453;
        return (n - Math.floor(n)) * 2 - 1;
    };

    let total = 0;
    let amplitude = 1;
    let frequency = 1;

    for (let octave = 0; octave < 3; octave++) {
        const sx = x * frequency;
        const sy = y * frequency;
        const ix = Math.floor(sx);
        const iy = Math.floor(sy);
        const fx = sx - ix;
        const fy = sy - iy;

        // smoothstep the interpolation so the surface has no creases along the lattice
        const ux = fx * fx * (3 - 2 * fx);
        const uy = fy * fy * (3 - 2 * fy);

        const top = at(ix, iy) * (1 - ux) + at(ix + 1, iy) * ux;
        const bottom = at(ix, iy + 1) * (1 - ux) + at(ix + 1, iy + 1) * ux;
        total += (top * (1 - uy) + bottom * uy) * amplitude;

        amplitude *= 0.5;
        frequency *= 2.17;
    }

    return total;
}

/**
 * The height of the terrain surface at a world position.
 *
 * @param {number} x - World x.
 * @param {number} z - World z.
 * @returns {number} The height.
 */
function terrainHeightAt(x, z) {
    // flatten the middle out a little, so the camera starts on open ground
    const distance = Math.sqrt(x * x + z * z) / (terrainSize * 0.5);
    const flatten = Math.min(1, distance * 1.6);
    return noise(x * 0.02, z * 0.02) * terrainHeight * flatten;
}

/**
 * Build the terrain as a displaced grid. Positions and uvs are generated directly, and the normals
 * are derived from the finished triangles so the lighting matches the geometry exactly.
 *
 * @returns {Mesh} The terrain mesh.
 */
function createTerrain() {
    const positions = [];
    const uvs = [];
    const indices = [];
    const step = terrainSize / terrainSegments;

    for (let z = 0; z <= terrainSegments; z++) {
        for (let x = 0; x <= terrainSegments; x++) {
            const wx = x * step - terrainSize * 0.5;
            const wz = z * step - terrainSize * 0.5;

            positions.push(wx, terrainHeightAt(wx, wz), wz);
            uvs.push((x / terrainSegments) * textureTiling, (z / terrainSegments) * textureTiling);

            if (x < terrainSegments && z < terrainSegments) {
                const i = z * (terrainSegments + 1) + x;
                const next = i + terrainSegments + 1;
                indices.push(i, next, i + 1);
                indices.push(i + 1, next, next + 1);
            }
        }
    }

    const mesh = new Mesh(app.graphicsDevice);
    mesh.setPositions(positions);
    mesh.setNormals(calculateNormals(positions, indices));
    mesh.setUvs(0, uvs);
    mesh.setIndices(indices);
    mesh.update();
    return mesh;
}

// the ground material - the uvs are generated already tiled, so the maps use no tiling of their own
const material = new StandardMaterial();
material.diffuseMap = assets.color.resource;
material.normalMap = assets.normal.resource;
material.heightMap = assets.height.resource;
material.aoMap = assets.ao.resource;
// The map is roughness rather than gloss, so it is used inverted. The gloss scalar multiplies the
// map before that inversion, so it has to be 1 here - the material default of 0.25 would compress
// the whole range into a uniform near mirror gloss, the opposite of a rough ground.
material.glossMap = assets.roughness.resource;
material.glossInvert = true;
material.gloss = 1;
material.useMetalness = true;
material.metalness = 0;
material.parallaxMode = PARALLAX_OCCLUSION;
material.update();

const terrain = new Entity('terrain');
terrain.addComponent('render', { type: 'asset', castShadows: true, receiveShadows: true });
terrain.render.meshInstances = [new MeshInstance(createTerrain(), material, terrain)];
app.root.addChild(terrain);

// Trees to cast shadows onto the ground. The model comes in its own units, so it gets measured
// once and each instance is parented to an entity that scales it to a height in scene units - the
// scale goes on the parent, so the transform the model arrives with is left alone.
const treeTemplate = assets.tree.resource.instantiateRenderEntity();
app.root.addChild(treeTemplate);
const treeMeshInstances = treeTemplate.findComponents('render').flatMap((render) => render.meshInstances);
const treeAabb = treeMeshInstances[0].aabb.clone();
for (let i = 1; i < treeMeshInstances.length; i++) {
    treeAabb.add(treeMeshInstances[i].aabb);
}
const treeUnitScale = 1 / (treeAabb.halfExtents.y * 2);
const treeUnitBase = treeAabb.getMin().y;
treeTemplate.destroy();

const trees = new Entity('trees');
app.root.addChild(trees);

for (let i = 0; i < 40; i++) {
    // a golden angle spiral, which scatters evenly without lining up into rings, and leaves the
    // middle clear so the ground can be seen up close
    const angle = i * 2.39996;
    const radius = 20 + Math.sqrt(i / 40) * 72;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const scale = treeUnitScale * 24 * (0.75 + (i % 4) * 0.2);

    const tree = new Entity(`tree ${i}`);
    tree.setLocalScale(scale, scale, scale);
    tree.setLocalEulerAngles(0, i * 47, 0);

    // lift the pivot so the base of the trunk is on the ground, then sink it a little so the trunk
    // still meets the ground on a slope
    tree.setLocalPosition(x, terrainHeightAt(x, z) - treeUnitBase * scale - 0.5, z);
    tree.addChild(assets.tree.resource.instantiateRenderEntity());
    trees.addChild(tree);
}

// A directional light with cascaded shadows, low in the sky so the ground is raked and the relief
// reads. Its cascade settings are driven by the control panel.
const light = new Entity('directional light');
light.addComponent('light', {
    type: 'directional',
    color: new Color(1, 0.94, 0.86),
    intensity: 1.1,
    castShadows: true,
    shadowDistance: 260,
    shadowResolution: 2048,
    cascadeDistribution: 0.6,
    cascadeBlend: 0.1,
    shadowBias: 0.4,
    normalOffsetBias: 0.1,
    vsmBlurSize: 11,

    // The pcss penumbra is a fraction of the depth range the cascade covers, which over a terrain
    // this size is hundreds of units - so the same number reads as a far wider penumbra here than
    // it would on a small scene, and much past this the shadow washes out into a flat grey.
    penumbraSize: 0.02
});

// A light shines along the negative y axis of its entity, so this pitch rakes it across the ground.
// The rotation around y is driven by the control panel, so the relief can be lit from any side - the
// self shadowing only appears where the light rakes across the grain of the height map, so which way
// it comes from matters as much as how low it is.
const lightPitch = 62;

// degrees per second the animation turns the light, slow enough to watch the shadows travel
const lightSpin = 6;
light.setLocalEulerAngles(lightPitch, 25, 0);
app.root.addChild(light);

const camera = new Entity('camera');
camera.addComponent('camera', {
    toneMapping: TONEMAP_ACES,
    fov: 55,
    farClip: 600,
    clearColor: new Color(0.5, 0.6, 0.7)
});
camera.setLocalPosition(75.17, 5.36, -25.6);
camera.addComponent('script');
app.root.addChild(camera);

// the hybrid controller - orbit with the left mouse button, fly with the right one or with the keys
camera.script.create(CameraControls, {
    properties: {
        focusPoint: new Vec3(10.01, -6.44, -1.92),
        moveSpeed: 20,
        moveFastSpeed: 60,
        moveSlowSpeed: 6,
        pitchRange: new Vec2(-89, 89),
        zoomRange: new Vec2(1, 300)
    }
});

// Selecting this mode unassigns the height map rather than setting a mode on the material, which
// takes the parallax code out of the generated shader altogether
const MODE_NONE = 'none';

// Initial values
data.set('data', {
    mode: PARALLAX_OCCLUSION,
    samples: 16,
    selfShadowSamples: 8,
    height: 0.35,

    // the height map value that sits at the level of the geometry - the engine default pivots the
    // relief around mid-grey, and 1 treats the map as pure depth carved below the surface
    base: 0.5,
    shadowType: SHADOW_PCF3_32F,
    numCascades: 4,
    lightRotation: 25,
    animate: true
});

let mode, samples, selfShadowSamples, height, base, shadowType, numCascades;
let lightRotation, animate;

// the live angle, which the animation advances and the slider follows
let lightAngle = 25;

app.on('update', (dt) => {
    const newMode = data.get('data.mode');
    const newSamples = data.get('data.samples');
    const newSelfShadowSamples = data.get('data.selfShadowSamples');
    const newHeight = data.get('data.height');
    const newBase = data.get('data.base');

    if (
        newMode !== mode ||
        newSamples !== samples ||
        newSelfShadowSamples !== selfShadowSamples ||
        newHeight !== height ||
        newBase !== base
    ) {
        mode = newMode;
        samples = newSamples;
        selfShadowSamples = newSelfShadowSamples;
        height = newHeight;
        base = newBase;

        material.heightMap = mode === MODE_NONE ? null : assets.height.resource;
        if (mode !== MODE_NONE) {
            material.parallaxMode = mode;
        }
        material.parallaxSamples = samples;

        // zero takes the self shadow march out of the shader, so this both budgets and switches it
        material.parallaxShadowSamples = selfShadowSamples;
        material.heightMapFactor = height;
        material.heightMapBase = base;
        material.update();
    }

    const newShadowType = data.get('data.shadowType');
    const newNumCascades = data.get('data.numCascades');

    if (newShadowType !== shadowType || newNumCascades !== numCascades) {
        shadowType = newShadowType;
        numCascades = newNumCascades;

        light.light.shadowType = shadowType;
        light.light.numCascades = numCascades;
    }

    const newAnimate = data.get('data.animate');
    const newRotation = data.get('data.lightRotation');

    if (newAnimate !== animate) {
        animate = newAnimate;

        // carry on from wherever the slider was left
        lightAngle = newRotation;
    }

    if (animate) {
        lightAngle = (lightAngle + dt * lightSpin) % 360;

        // a change the animation did not make is the slider being dragged, so follow it
        if (Math.abs(newRotation - lightRotation) > 1) {
            lightAngle = newRotation;
        }

        // write the angle back a degree at a time, so the slider tracks without churning every frame
        const rounded = Math.round(lightAngle);
        if (rounded !== lightRotation) {
            lightRotation = rounded;
            data.set('data.lightRotation', rounded);
        }
    } else if (newRotation !== lightRotation) {
        lightRotation = newRotation;
        lightAngle = newRotation;
    }

    light.setLocalEulerAngles(lightPitch, lightAngle, 0);
});
