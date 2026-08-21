// @config
//
// Parallax mapping: a `heightMap` offsets the uv of the material's other maps by the surface height
// and the view direction, so a flat surface reads as though it had depth.
//
// The four shapes form a 2x2 grid: top left diffuse map only · top right normal map · bottom left
// height map · bottom right normal map and height map.
//
// The offset is zero head on, so orbit to a grazing angle. The Height slider drives
// `heightMapFactor`.
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
    RESOLUTION_AUTO,
    RenderComponentSystem,
    ScriptComponentSystem,
    ScriptHandler,
    StandardMaterial,
    TEXTURETYPE_RGBP,
    TONEMAP_ACES,
    TextureHandler,
    Vec3,
    createGraphicsDevice
} from 'playcanvas';
import { CameraControls } from 'playcanvas/scripts/esm/camera-controls.mjs';

import { data, deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    helipad: new Asset(
        'helipad-env-atlas',
        'texture',
        { url: './assets/cubemaps/morning-env-atlas.png' },
        { type: TEXTURETYPE_RGBP, mipmaps: false }
    ),
    normal: new Asset('normal', 'texture', { url: './assets/textures/seaside-rocks01-normal.jpg' }),
    height: new Asset('height', 'texture', { url: './assets/textures/seaside-rocks01-height.jpg' }),
    diffuse: new Asset('diffuse', 'texture', { url: './assets/textures/seaside-rocks01-color.jpg' })
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

app.scene.envAtlas = assets.helipad.resource;
app.scene.exposure = 1;

// keep the ambient contribution low, so the directional light shapes the surface relief
app.scene.skyboxIntensity = 0.15;

// Create an entity with a camera component, driven by the camera controls script. Drag to orbit the
// shapes - looking straight at a surface produces no parallax offset at all, the effect only appears
// as the viewing direction tilts away from the surface normal.
const camera = new Entity('camera');
camera.addComponent('camera', {
    toneMapping: TONEMAP_ACES,
    fov: 45,
    clearColor: new Color(0.05, 0.06, 0.08)
});

// Start off to the side and above, so the shapes are already seen at an angle on the first frame and
// their sides and tops are visible. Not too far round, or the near column would hide the far one -
// orbiting further is what makes the parallax offset grow.
camera.setLocalPosition(8.4, 6.5, 18.1);
camera.addComponent('script');
app.root.addChild(camera);

camera.script.create(CameraControls, {
    properties: {
        focusPoint: Vec3.ZERO,
        enableFly: false
    }
});

// A directional light raking across the front of the shapes at a shallow angle, which is what makes
// the surface relief read as depth, while still lighting the sides and tops the camera can see.
// A directional light shines along its entity's -Y axis, so these angles tilt that axis towards
// the camera side of the cubes.
const light = new Entity('light');
light.addComponent('light', {
    type: 'directional',
    color: new Color(1, 0.95, 0.85),
    intensity: 4
});
light.setLocalEulerAngles(45, 45, 0);
app.root.addChild(light);

const tiling = 1.5;

/**
 * Create a material sharing the same base textures, optionally with a normal map and a height map.
 *
 * @param {boolean} useNormalMap - True to assign the normal map.
 * @param {boolean} useHeightMap - True to assign the height map, enabling parallax mapping.
 * @returns {StandardMaterial} The new material.
 */
function createMaterial(useNormalMap, useHeightMap) {
    const material = new StandardMaterial();
    material.diffuseMap = assets.diffuse.resource;
    material.diffuseMapTiling.set(tiling, tiling);

    if (useNormalMap) {
        material.normalMap = assets.normal.resource;
        material.normalMapTiling.set(tiling, tiling);
    }

    if (useHeightMap) {
        material.heightMap = assets.height.resource;

        // the parallax offset is applied to the uv of all other maps, so the height map needs to
        // use the same tiling as those maps
        material.heightMapTiling.set(tiling, tiling);
    }

    material.gloss = 0.4;
    material.metalness = 0;
    material.useMetalness = true;
    material.update();
    return material;
}

// Four primitives, showing the base textures, the effect of the normal map on its own, parallax
// mapping without a normal map, and the two combined.
//
// They are laid out as a 2x2 grid, so all four are seen at the same viewing angle and can be
// compared directly:
//
//     diffuse only  |  normal map
//     -------------------------------------
//     parallax      |  normal map + parallax
//
// The shape is selectable, as the tangent frame the parallax offset is built from is oriented
// differently on each of them - the flat faces of a box, and the poles and equator of a sphere.
const primitives = [
    { name: 'diffuse only', normalMap: false, heightMap: false },
    { name: 'normal map', normalMap: true, heightMap: false },
    { name: 'parallax, no normal map', normalMap: false, heightMap: true },
    { name: 'normal map + parallax', normalMap: true, heightMap: true }
];

const primitiveSize = 4;

// the shapes are as deep as they are wide, so they need a gap wider than a small one to stop the
// near column and row hiding the far ones when the camera orbits round
const primitiveGap = 1.5;
const step = primitiveSize + primitiveGap;

/**
 * Scale a primitive so its largest dimension fills its grid cell, and push it back so the closest
 * point of the shape lands on the z = 0 plane, taking the extents from the mesh so any shape lines
 * up. Re-applied whenever the shape changes.
 *
 * @param {Entity} entity - The entity to place.
 * @param {number} i - The index of the entity in the grid.
 */
function fit(entity, i) {
    const halfExtents = entity.render.meshInstances[0].mesh.aabb.halfExtents;
    const scale = primitiveSize / (2 * Math.max(halfExtents.x, halfExtents.y, halfExtents.z));
    entity.setLocalScale(scale, scale, scale);
    entity.setLocalPosition(((i % 2) - 0.5) * step, (0.5 - Math.floor(i / 2)) * step, -halfExtents.z * scale);
}

primitives.forEach((primitive, i) => {
    primitive.material = createMaterial(primitive.normalMap, primitive.heightMap);

    const entity = new Entity(primitive.name);
    entity.addComponent('render', {
        type: 'box',
        material: primitive.material
    });

    fit(entity, i);
    app.root.addChild(entity);

    primitive.entity = entity;
});

// Initial values
data.set('data', {
    shape: 'box',
    height: 1
});

// keep the materials which use parallax mapping in sync with the control panel
const heightMaterials = primitives.filter((p) => p.heightMap).map((p) => p.material);

let shape = 'box';

app.on('update', () => {
    const height = data.get('data.height');
    heightMaterials.forEach((material) => {
        if (height !== material.heightMapFactor) {
            material.heightMapFactor = height;
            material.update();
        }
    });

    // assigning the render component type rebuilds the mesh instance, keeping the material
    const selected = data.get('data.shape');
    if (selected !== shape) {
        shape = selected;
        primitives.forEach((primitive, i) => {
            primitive.entity.render.type = shape;
            fit(primitive.entity, i);
        });
    }
});
