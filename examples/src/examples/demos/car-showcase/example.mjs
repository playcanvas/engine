// @config
//
// A car configurator in a showroom.
//
// @flag CREDITS_HIDDEN
//
// @credit
// title: Car Concept
// author: Eric Chadwick / Darmstadt Graphics Group GmbH
// source: https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/CarConcept
// license: CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)

import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    BLEND_NORMAL,
    BoundingBox,
    CUBEPROJ_BOX,
    CameraComponentSystem,
    CameraFrame,
    Color,
    ContainerHandler,
    Entity,
    FILLMODE_FILL_WINDOW,
    JsonHandler,
    LAYERID_UI,
    LAYERID_WORLD,
    LIGHTFALLOFF_INVERSESQUARED,
    LIGHTSHAPE_RECT,
    Layer,
    LightComponentSystem,
    MASK_AFFECT_DYNAMIC,
    MASK_AFFECT_LIGHTMAPPED,
    Mouse,
    Quat,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    ScriptComponentSystem,
    TEXTURETYPE_RGBP,
    TONEMAP_NEUTRAL,
    TextureHandler,
    TouchDevice,
    Vec2,
    Vec3,
    WasmModule,
    createGraphicsDevice,
    math
} from 'playcanvas';
import { CameraControls } from 'playcanvas/scripts/esm/camera-controls.mjs';
import { PlanarRenderer } from 'playcanvas/scripts/esm/planar-renderer.mjs';

import { deviceType } from 'examples/context';

import { CameraPath } from './camera-path.mjs';
import { ConfiguratorUI } from './configurator-ui.mjs';
import { MaterialSweep } from './material-sweep.mjs';

/**
 * @import { GraphNode, RenderComponent, StandardMaterial } from 'playcanvas'
 * @import { CameraPose } from './camera-path.mjs'
 */

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

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

// Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
app.setCanvasFillMode(FILLMODE_FILL_WINDOW);
app.setCanvasResolution(RESOLUTION_AUTO);

// Ensure canvas is resized when window changes size
const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => window.removeEventListener('resize', resize));

// The meshes of the car are Draco compressed, and the textures of the car and the showroom are WebP
WasmModule.setConfig('DracoDecoderModule', {
    glueUrl: './assets/wasm/draco/draco.wasm.js',
    wasmUrl: './assets/wasm/draco/draco.wasm.wasm',
    fallbackUrl: './assets/wasm/draco/draco.js'
});

// The showroom was modeled and lit in Blender. The lighting of its walls, ceiling, floor and
// platform is baked into their emissive textures. The environment atlas is the empty room rendered
// from its center, without the ceiling strips, which are lights here, prefiltered into the sharp and
// blurred reflections and the ambient lighting.
const assets = {
    car: new Asset('car', 'container', { url: './assets/models/car-concept.glb' }),
    room: new Asset('room', 'container', { url: './assets/models/car-showroom.glb' }),
    envAtlas: new Asset(
        'env-atlas',
        'texture',
        { url: './assets/cubemaps/car-showroom-env-atlas.png' },
        { type: TEXTURETYPE_RGBP, mipmaps: false }
    ),
    luts: new Asset('luts', 'json', { url: './assets/json/area-light-luts.json' })
};
await new Promise((resolve) => {
    new AssetListLoader(Object.values(assets), app.assets).load(resolve);
});

app.start();

/**
 * Finds a material of a glTF container by its name.
 *
 * @param {Asset<'container'>} asset - The container asset.
 * @param {string} name - The name of the material.
 * @returns {StandardMaterial} The material.
 */
const findMaterial = (asset, name) =>
    /** @type {StandardMaterial} */ (
        asset.resource.materials.find((material) => material.resource.name === name).resource
    );

// ----- The showroom -----

// The environment lights the car and gives everything its reflections. The cameras do not render
// the skybox layer, the room surrounds them.
app.scene.envAtlas = assets.envAtlas.resource;

// The lights of the studio are brighter than they were baked and rendered, in the lighting of the
// room as well as in the environment lighting the car
const STUDIO_BRIGHTNESS = 1.3;

// The room is lit by its lightmaps, the environment lights mostly the car, brighter still so the car
// stands out of the dark room
const ENV_INTENSITY = 2 * STUDIO_BRIGHTNESS;
app.scene.skyboxIntensity = ENV_INTENSITY;

// The reflections are projected onto the box of the room, from the center of which the environment
// was rendered, so the reflections of its lights are where the lights are
const roomBox = new BoundingBox(new Vec3(0, 2.5, 0), new Vec3(9, 2.5, 11));
[assets.room, assets.car].forEach((asset) => {
    asset.resource.materials.forEach(({ resource }) => {
        const material = /** @type {StandardMaterial} */ (resource);
        material.cubeMapProjection = CUBEPROJ_BOX;
        material.cubeMapProjectionBox = roomBox;
        material.update();
    });
});

// The floor and the platform are on their own layer, rendered by the main camera but not by the
// reflection camera, as they cannot be in their own reflection
const worldLayer = app.scene.layers.getLayerById(LAYERID_WORLD);
const floorLayer = new Layer({ name: 'Floor' });
app.scene.layers.insert(floorLayer, 1);

const room = assets.room.resource.instantiateRenderEntity();
app.root.addChild(room);
const reflectiveMaterials = [
    { name: 'Floor', metalness: 0.7 },
    { name: 'PlatformTop', metalness: 0.85 }
].map(({ name, metalness }) => {
    /** @type {Entity} */ (room.findByName(name)).render.layers = [floorLayer.id];

    // mostly metallic, so the reflection shows clearly, and not only at grazing angles. The baked
    // lighting is emissive, the diffuse color only takes the light of the headlights.
    const material = findMaterial(assets.room, name);
    material.diffuse = new Color(0.5, 0.5, 0.52);
    material.metalness = metalness;
    material.update();
    return material;
});

// The baked surfaces are lit by their emissive lighting, and not by the environment as well
const prepareRoomMaterial = (/** @type {string} */ name, /** @type {number} */ boost) => {
    const material = findMaterial(assets.room, name);
    if (material.emissiveMap) {
        material.ambient = Color.BLACK;
    }
    material.emissiveIntensity *= boost;
    material.update();
    return { material, intensity: material.emissiveIntensity };
};

// The stone panels are the lights of the studio, which dim together with the baked lighting, and
// are brighter than they were baked, so they bloom more
const studioMaterials = [
    { name: 'Wall', boost: 1 },
    { name: 'Ceiling', boost: 1 },
    { name: 'Floor', boost: 1 },
    { name: 'PlatformTop', boost: 1 },
    { name: 'Panel', boost: 1.5 }
].map(({ name, boost }) => prepareRoomMaterial(name, boost * STUDIO_BRIGHTNESS));

// The ceiling strips stay on when the studio dims, like the light of the platform. Their light on
// the room is baked together with the light of the panels, and dims with it.
const { material: stripMaterial } = prepareRoomMaterial('LightStrip', 1.3);

// The room is lit by its baked lighting, and only by the lights which affect lightmapped meshes
room.findComponents('render').forEach((render) => {
    /** @type {RenderComponent} */ (render).meshInstances.forEach((meshInstance) => {
        meshInstance.mask = MASK_AFFECT_LIGHTMAPPED;
    });
});

// Rectangular area lights in place of the strips light the car, which reflects them exactly where
// they are. The environment does not show the strips, so the car does not reflect them twice.
const luts = /** @type {{ LTC_MAT_1: number[], LTC_MAT_2: number[] }} */ (assets.luts.resource);
app.setAreaLightLuts(luts.LTC_MAT_1, luts.LTC_MAT_2);
app.scene.lighting.areaLightsEnabled = true;

// All the area lights are rectangles, so the shaders of the materials compile no disk and sphere
// light code, which makes them much faster to compile, mostly on Windows
app.scene.lighting.areaLightDiskEnabled = false;
app.scene.lighting.areaLightSphereEnabled = false;

// None of the lights casts shadows, so the clustered lighting compiles no shadow code into the
// shaders of the materials
app.scene.lighting.shadowsEnabled = false;

const STRIP_LIGHT_INTENSITY = 30;
const stripBounds = /** @type {Entity} */ (room.findByName('LightStrips')).render.meshInstances[0].aabb;
[-5.6, -1.7, 1.7, 5.6].forEach((x) => {
    const light = new Entity('StripLight');
    light.addComponent('light', {
        type: 'omni',
        shape: LIGHTSHAPE_RECT,
        color: stripMaterial.emissive,
        intensity: STRIP_LIGHT_INTENSITY,
        range: 12,
        falloffMode: LIGHTFALLOFF_INVERSESQUARED
    });

    // the rectangle is in the XZ plane of the light, which shines down
    light.setLocalScale(0.07, 1, stripBounds.halfExtents.z * 2);
    light.setPosition(x, stripBounds.getMin().y, stripBounds.center.z);
    app.root.addChild(light);
});

// ----- The car -----

// The car stands on the platform
const PLATFORM_HEIGHT = 0.12;
const car = assets.car.resource.instantiateRenderEntity();
car.setLocalPosition(0, PLATFORM_HEIGHT, 0);
app.root.addChild(car);

// The strip lights cast no shadows. The ambient occlusion of the car darkens their light as well, so
// they light its interior and the insides of its wheel arches through the roof and the body much
// less. The brakes, deep in the wheel arches, they do not light at all.
assets.car.resource.materials.forEach(({ resource }) => {
    const material = /** @type {StandardMaterial} */ (resource);
    if (material.aoMap) {
        material.occludeDirect = true;
        material.update();
    }
});
car.findComponents('render').forEach((render) => {
    /** @type {RenderComponent} */ (render).meshInstances.forEach((meshInstance) => {
        if (meshInstance.material.name === 'Brake' || meshInstance.material.name === 'Disc') {
            meshInstance.mask = MASK_AFFECT_LIGHTMAPPED;
        }
    });
});

// The windows are tinted glass, blended over the interior, keeping their reflections
const glass = findMaterial(assets.car, 'Glass');
glass.useDynamicRefraction = false;
glass.refraction = 0;
glass.blendType = BLEND_NORMAL;
glass.diffuse = new Color(0.02, 0.02, 0.025);
glass.opacity = 0.35;
glass.opacityFadesSpecular = false;
glass.depthWrite = false;
glass.update();

// The blacks of the glTF reflect less than half a percent of the light, so in the cabin they show
// only their specular highlights. Real black leather, plastic and rubber reflect a few percent, which
// shows their shapes and the textures of their normal maps in the dim light of the cabin.
[
    // the dash, the door panels and the steering wheel, the centers of the seats and the console
    { name: 'Interior 1', color: '#2a2a2a' },
    { name: 'Interior 2', color: '#2a2a2a' },
    { name: 'Panel Sides', color: '#2a2a2a' },

    // the trims: the cage, the seat frames, the gaskets and the insides of the clamshells
    { name: 'Untitled', color: '#222222' },
    { name: 'Floormat', color: '#1c1c1c' }
].forEach(({ name, color }) => {
    const material = findMaterial(assets.car, name);
    material.diffuse = new Color().fromString(color);
    material.update();
});

/**
 * @typedef {object} Hinged
 * @property {{ node: GraphNode, angles: Vec3 }[]} parts - The parts, which turn around the pivots of
 * their nodes to their angles when open.
 * @property {number} level - How far the parts are open, from 0 to 1.
 */

/**
 * Parts of the car on hinges, which swing open together.
 *
 * @param {{ name: string, angles: Vec3 }[]} parts - The names of the nodes, and their angles when
 * open.
 * @returns {Hinged} The parts.
 */
const hinged = (parts) => ({
    parts: parts.map(({ name, angles }) => ({ node: car.findByName(name), angles })),
    level: 0
});

// The butterfly doors are hinged at the front of their openings, and swing up and out
const doors = hinged([
    { name: 'BodyDoorLColor1', angles: new Vec3(62, 0, -16) },
    { name: 'BodyDoorRColor1', angles: new Vec3(62, 0, 16) }
]);

// The front clamshell, the bonnet, is hinged at the nose and tilts forward with the headlights. The
// rear one, the boot, is hinged at the tail and lifts the rear window and lights. There is little
// under them, a box in place of the engine at the front and the back of the cabin at the rear.
const clamshells = hinged([
    { name: 'BodyHood', angles: new Vec3(50, 0, 0) },
    { name: 'BodyRearPanelsColor1', angles: new Vec3(-55, 0, 0) }
]);

const HINGE_TIME = 1.3;

/**
 * Swings hinged parts towards open or closed, easing in and out.
 *
 * @param {Hinged} parts - The parts.
 * @param {boolean} open - Whether to open them.
 * @param {number} dt - The time step, in seconds.
 */
const swing = (parts, open, dt) => {
    const target = open ? 1 : 0;
    if (parts.level !== target) {
        parts.level = math.clamp(parts.level + (Math.sign(target - parts.level) * dt) / HINGE_TIME, 0, 1);
        const t = parts.level * parts.level * (3 - 2 * parts.level);
        parts.parts.forEach(({ node, angles }) => {
            node.setLocalEulerAngles(angles.x * t, angles.y * t, angles.z * t);
        });
    }
};

/**
 * Prepares the material of a car light.
 *
 * @param {{ name: string, boost: number, color: string, metalness: number, roughness: number }} light - The
 * name of the material, the boost of its emission, and how it looks when off.
 * @returns {{ material: StandardMaterial, intensity: number }} The material and its emission.
 */
const prepareCarLight = ({ name, boost, color, metalness, roughness }) => {
    const material = findMaterial(assets.car, name);
    material.diffuse = new Color().fromString(color);
    material.metalness = metalness;

    // glTF materials store the roughness in the gloss property
    material.gloss = roughness;
    material.update();
    return { material, intensity: material.emissiveIntensity * boost };
};

// The emissive materials of the car lights, much brighter than in the glTF, so they bloom. The
// indicators blink as hazard lights while the lights are on. The glTF gives them a black base, which
// shows when they are off, so they look like what is behind their glass instead: the chrome
// reflectors of the headlights, the red and amber lenses of the rear lights, and the black glass of
// the dashboard display.
const carLightMaterials = [
    { name: 'Headlight', boost: 5, color: '#c4cad2', metalness: 1, roughness: 0.15 },
    { name: 'Brakelight', boost: 12, color: '#5a0808', metalness: 0, roughness: 0.1 },
    { name: 'Dashboard', boost: 1, color: '#040404', metalness: 0, roughness: 0.1 }
].map(prepareCarLight);
const { material: indicatorMaterial, intensity: INDICATOR_INTENSITY } = prepareCarLight({
    name: 'Signallight',
    boost: 12,
    color: '#6a4206',
    metalness: 0,
    roughness: 0.1
});

// A spot light in each headlight, shining forward and slightly down. The car faces the +Z axis. The
// lights are on the bonnet, which lifts them with the headlights. They sit back inside the body, so
// the sharp tips of their cones in the haze hide behind it, and the beams leave the headlights wide.
const HEADLIGHT_INTENSITY = 10;
const HEADLIGHT_SETBACK = 0.3;
const bonnet = clamshells.parts[0].node;
const headlightBounds = /** @type {Entity} */ (car.findByName('BodyHeadlights')).render.meshInstances[0].aabb;
const headlights = [-1, 1].map((side) => {
    const light = new Entity('Headlight');
    light.addComponent('light', {
        type: 'spot',
        layers: [worldLayer.id, floorLayer.id],
        color: new Color(0.85, 0.92, 1),
        intensity: HEADLIGHT_INTENSITY,
        range: 16,

        // the headlights light the room as well as the car
        mask: MASK_AFFECT_DYNAMIC | MASK_AFFECT_LIGHTMAPPED,
        falloffMode: LIGHTFALLOFF_INVERSESQUARED,
        innerConeAngle: 12,
        outerConeAngle: 28,

        // the beams scatter in the haze of the room
        volumetricScattering: 1
    });
    bonnet.addChild(light);
    light.setPosition(
        headlightBounds.center.x + side * headlightBounds.halfExtents.x * 0.7,
        headlightBounds.center.y,
        headlightBounds.center.z + headlightBounds.halfExtents.z
    );

    // spot lights shine down their negative Y axis
    light.setEulerAngles(-84, 0, 0);
    light.setPosition(light.up.clone().mulScalar(HEADLIGHT_SETBACK).add(light.getPosition()));
    return light;
});

// The paints. Carmine Candy, Pearly Swirly and Torched Graphite are the material variants of the car.
// Aurora Swirly gives the pearl paint a lavender base and a thinner film, which turns its swirls
// blue and violet. The others tint the metallic candy paint. Each paint comes with a trim of the
// interior, the variants with their own, which the interior options then change.
const PAINTS = [
    { name: 'Carmine Candy', color: '#8e0c12', look: 'Carmine', trim: 'Carmine Red' },
    { name: 'Pearly Swirly', color: '#e6e2da', look: 'Pearl', trim: 'Ivory' },
    {
        name: 'Aurora Swirly',
        color: '#8e9ccc',
        look: 'Pearl',
        film: { base: '#8e9ccc', thickness: [560, 700], iridescence: 1 },
        trim: 'Ocean Blue'
    },
    { name: 'Torched Graphite', color: '#34373c', look: 'Graphite', trim: 'Ocean Blue' },
    { name: 'Midnight Blue', color: '#102a66', look: 'Carmine', tint: '#102a66', trim: 'Ivory' },
    { name: 'Racing Green', color: '#0f4a30', look: 'Carmine', tint: '#0f4a30', trim: 'Cognac' },
    { name: 'Sunset Orange', color: '#d9530f', look: 'Carmine', tint: '#d9530f', trim: 'Onyx Black' },
    { name: 'Solar Yellow', color: '#e6ad12', look: 'Carmine', tint: '#e6ad12', trim: 'Onyx Black' },
    { name: 'Liquid Silver', color: '#b4b9bf', look: 'Carmine', tint: '#b4b9bf', trim: 'Carmine Red' }
];

// the car starts in Carmine Candy
const DEFAULT_PAINT = 0;

// a subtler normal map of the metallic flakes, which otherwise reads as noise at a distance
['Paint 1 Carmine', 'Paint 2 Carmine'].forEach((name) => {
    const material = findMaterial(assets.car, name);
    material.bumpiness = 0.08;
    material.update();
});

// The paints share one shader, so a change of the paint compiles nothing. Each paint material has
// every feature any paint uses: the normal map of the flakes, the clear coat, and the iridescent film
// with its thickness texture. Where its own look has none of them, they are set to have no effect.
const flakes = findMaterial(assets.car, 'Paint 1 Carmine');
const film = findMaterial(assets.car, 'Paint 1 Pearl');

// a clear coat or iridescence too faint to see, as a value of 0 leaves it out of the shader
const FAINT = 1e-9;

['Carmine', 'Pearl', 'Graphite'].forEach((look) => {
    ['Paint 1', 'Paint 2'].forEach((slot) => {
        const material = findMaterial(assets.car, `${slot} ${look}`);
        if (!material.normalMap) {
            // the flakes, flattened out by a bumpiness of 0
            material.normalMap = flakes.normalMap;
            material.normalMapTiling = flakes.normalMapTiling.clone();
            material.normalMapOffset = flakes.normalMapOffset.clone();
            material.bumpiness = 0;
        }
        if (!material.clearCoat) {
            // the gloss is set as the coat of the flakes sets it, which the shader reads the same way
            material.clearCoat = FAINT;
            material.clearCoatGloss = flakes.clearCoatGloss;
            material.clearCoatGlossInvert = flakes.clearCoatGlossInvert;
        }
        if (!material.useIridescence || !material.iridescence) {
            material.useIridescence = true;
            material.iridescence = FAINT;
        }
        if (!material.iridescenceThicknessMap) {
            // the texture blends between two equal thicknesses, so the film keeps its one thickness
            material.iridescenceThicknessMap = film.iridescenceThicknessMap;
            material.iridescenceThicknessMapTiling = film.iridescenceThicknessMapTiling.clone();
            material.iridescenceThicknessMapOffset = film.iridescenceThicknessMapOffset.clone();
            material.iridescenceThicknessMapChannel = film.iridescenceThicknessMapChannel;
            material.iridescenceThicknessMin = material.iridescenceThicknessMax;
        }
        material.update();
    });
});

// The candy paint is tinted for the colors other than its own, and the pearl paint takes other base
// colors and film thicknesses for other colors of its swirls
const candyColor = findMaterial(assets.car, 'Paint 1 Carmine').diffuse.clone();
const pearl = findMaterial(assets.car, 'Paint 1 Pearl');
const pearlFilm = {
    base: pearl.diffuse.toString(false),
    thickness: [pearl.iridescenceThicknessMin, pearl.iridescenceThicknessMax],
    iridescence: pearl.iridescence
};

// A new paint sweeps over the car from its front to its back, with a warm glowing front. A new trim
// of the interior sweeps the same way, with a cool one, so a paint and its trim change together.
const SWEEP_PATH = { asset: assets.car, entity: car, layer: worldLayer, start: 2.8, end: -2.4 };
const paintSweep = new MaterialSweep({
    ...SWEEP_PATH,
    slots: ['Paint 1', 'Paint 2'],
    looks: ['Carmine', 'Pearl', 'Graphite'],
    glow: new Color(1, 0.45, 0.15),
    intensity: 14
});
const trimSweep = new MaterialSweep({
    ...SWEEP_PATH,
    slots: ['Interior 3'],
    looks: ['Carmine'],
    glow: new Color(0.3, 0.6, 1),
    intensity: 10
});

const WHEELS = [
    { name: 'Gloss Black', color: '#111214', metalness: 0, roughness: 0.4 },
    { name: 'Satin Silver', color: '#c3c7cc', metalness: 1, roughness: 0.3 },
    { name: 'Bronze', color: '#9a7443', metalness: 1, roughness: 0.35 },
    { name: 'Gunmetal', color: '#4a4e54', metalness: 1, roughness: 0.25 }
];
const rimMaterial = findMaterial(assets.car, 'Rim1');

const CALIPERS = [
    { name: 'Racing Red', color: '#d40000' },
    { name: 'Signal Yellow', color: '#f2b705' },
    { name: 'Electric Blue', color: '#1d5fd6' },
    { name: 'Carbon Black', color: '#1a1b1d' }
];
const caliperMaterial = findMaterial(assets.car, 'Brake');

// The trims of the interior color the leather of the seats, the steering wheel and the doors
const TRIMS = [
    { name: 'Carmine Red', color: '#801000' },
    { name: 'Onyx Black', color: '#1d1f22' },
    { name: 'Cognac', color: '#7a3f1d' },
    { name: 'Ivory', color: '#e8e2d6' },
    { name: 'Ocean Blue', color: '#273f59' }
];
let currentTrim = -1;
const caliperRed = caliperMaterial.diffuse.clone();

// The calipers hide behind the spokes, in the dark wheel arches. Painted instead of metallic, without
// the ambient occlusion and with a little glow of their color, they show through the spokes.
caliperMaterial.metalness = 0;
caliperMaterial.aoMap = null;
caliperMaterial.emissiveIntensity = 0.3;

/**
 * @param {number} index - The index of the trim.
 * @param {boolean} [animate] - Whether to sweep the new trim over the old one.
 */
const applyTrim = (index, animate = true) => {
    if (index !== currentTrim) {
        currentTrim = index;
        const color = new Color().fromString(TRIMS[index].color);
        trimSweep.apply(
            'Carmine',
            (materials) => {
                materials['Interior 3'].diffuse = color;
                materials['Interior 3'].update();
            },
            animate
        );
    }
};

/**
 * @param {number} index - The index of the paint.
 * @returns {number} The index of the trim the paint comes with.
 */
const trimOf = (index) => TRIMS.findIndex((trim) => trim.name === PAINTS[index].trim);

/**
 * Changes the paint, and the trim to the one the paint comes with.
 *
 * @param {number} index - The index of the paint.
 * @param {boolean} [animate] - Whether to sweep the new paint and trim over the old ones.
 */
const applyPaint = (index, animate = true) => {
    const { look, tint, film } = PAINTS[index];
    paintSweep.apply(
        look,
        (materials) => {
            const paint = materials['Paint 1'];
            if (look === 'Carmine') {
                paint.diffuse = tint ? new Color().fromString(tint) : candyColor;
            } else if (look === 'Pearl') {
                const { base, thickness, iridescence } = film ?? pearlFilm;
                paint.diffuse = new Color().fromString(base);
                paint.iridescenceThicknessMin = thickness[0];
                paint.iridescenceThicknessMax = thickness[1];
                paint.iridescence = iridescence;
            }
            paint.update();
        },
        animate
    );
    applyTrim(trimOf(index), animate);
};

/**
 * @param {number} index - The index of the wheel finish.
 */
const applyWheels = (index) => {
    const wheels = WHEELS[index];
    rimMaterial.diffuse = new Color().fromString(wheels.color);
    rimMaterial.metalness = wheels.metalness;

    // glTF materials store the roughness in the gloss property
    rimMaterial.gloss = wheels.roughness;
    rimMaterial.update();
};

/**
 * @param {number} index - The index of the caliper color.
 */
const applyCalipers = (index) => {
    const color = index === 0 ? caliperRed : new Color().fromString(CALIPERS[index].color);
    caliperMaterial.diffuse = color;
    caliperMaterial.emissive = color;
    caliperMaterial.update();
};

// ----- The cameras -----

const FOCUS = new Vec3(0, 0.6, 0.15);

// The views the camera moves to, as its position and the point it looks at, all of them looking
// down by more than the lowest angle of the camera
const SHOTS = {
    paint: { position: new Vec3(5.2, 2.75, 5.0), focus: FOCUS },
    wheels: { position: new Vec3(3.7, 1.0, 3.3), focus: new Vec3(0.9, 0.45, 1.3) }
};

const camera = new Entity('MainCamera');
camera.addComponent('camera', {
    nearClip: 0.1,
    farClip: 50,
    layers: [worldLayer.id, floorLayer.id, LAYERID_UI]
});
camera.addComponent('script');
camera.setPosition(SHOTS.paint.position);
app.root.addChild(camera);

// A horizontal field of view of 60 degrees keeps the car in view in narrow windows, limited to a
// vertical one of 70 degrees in portrait windows. In the cabin, it widens to 80 and 85 degrees, and
// the near clip plane moves closer, so it does not cut open the wings of the seat beside the head.
let cabinFov = 0;
const updateFov = () => {
    const aspect = device.width / device.height;
    const blend = cabinFov * cabinFov * (3 - 2 * cabinFov);
    const horizontal = math.lerp(60, 80, blend) * math.DEG_TO_RAD;
    camera.camera.fov = Math.min(
        math.lerp(70, 85, blend),
        2 * Math.atan(Math.tan(horizontal * 0.5) / aspect) * math.RAD_TO_DEG
    );
    camera.camera.nearClip = math.lerp(0.1, 0.02, blend);
};
updateFov();
device.on('resizecanvas', updateFov);

const cameraControls = /** @type {CameraControls} */ (camera.script.create(CameraControls));
cameraControls.focusPoint = FOCUS;
cameraControls.enableFly = false;
cameraControls.enablePan = false;

// Orbit around the car. The ranges keep the camera inside the room and below the ceiling lights,
// and looking down by at least 8 degrees, as the reflection of the car stretches at lower angles.
const ORBIT_RANGES = { pitch: new Vec2(-24, -8), zoom: new Vec2(2, 8), zoomSpeed: cameraControls.zoomSpeed };

// In the seat, the camera orbits a point just in front of it, so it looks around without moving.
// It looks down by up to 40 degrees, as further down it sees little but the seat.
const SEAT_RANGES = { pitch: new Vec2(-40, 30), zoom: new Vec2(0.02, 0.05), zoomSpeed: 0 };

/**
 * @param {{ pitch: Vec2, zoom: Vec2, zoomSpeed: number }} ranges - The ranges of the camera.
 */
const setRanges = ({ pitch, zoom, zoomSpeed }) => {
    cameraControls.pitchRange = pitch;
    cameraControls.zoomRange = zoom;
    cameraControls.zoomSpeed = zoomSpeed;
};
setRanges(ORBIT_RANGES);

// The driver sits in the middle of the car. The camera gets in through a door, flying from outside
// of the door, where it looks into the cabin, through the doorway, to the seat, where it looks out
// of the windshield. It passes through the doorway behind the hinge, as the bottom edge of the open
// door slopes down towards it.
const SEAT = { position: new Vec3(0, 1.05, 0.25), focus: new Vec3(0, 0.98, 1.3) };

/**
 * The views of the camera passing through a door, outside of it and in its doorway.
 *
 * @param {number} side - 1 for the left door, -1 for the right one.
 * @returns {{ outside: CameraPose, doorway: CameraPose }} The views.
 */
const doorViews = (side) => ({
    outside: { position: new Vec3(2.3 * side, 1.0, -0.05), focus: new Vec3(0, 0.95, 0.1) },
    doorway: { position: new Vec3(1.15 * side, 0.98, -0.05), focus: new Vec3(0, 0.97, 0.6) }
});

// The camera leaves the box of the cabin and the doors through a door
const cabinBox = new BoundingBox(new Vec3(0, 0.8, 0.2), new Vec3(1.5, 0.6, 1.3));

/**
 * The flight of the camera into or out of the cabin, while the camera controls are disabled. The
 * camera waits at the gate for the doors to open, and is just outside of the door at the outside,
 * both given as the progress of the flight, where 1 is the end of the flight.
 *
 * @type {{ path: CameraPath, entering: boolean, gate: number, outside: number } | null}
 */
let flight = null;
const flightPosition = new Vec3();
const flightFocus = new Vec3();

// Whether the camera sits in the seat
let seated = false;

/**
 * @param {CameraPose[]} poses - The poses to fly through, from where the camera is.
 * @param {boolean} entering - Whether the camera gets in.
 * @param {(knots: number[]) => { gate: number, outside: number }} stops - Gets the gate and the
 * outside from the progress at the poses.
 */
const fly = (poses, entering, stops) => {
    const position = camera.getPosition().clone();
    const focus = camera.forward.clone().mulScalar(2).add(position);
    const path = new CameraPath([{ position, focus }, ...poses], (length) => math.clamp(1.4 + length * 0.16, 1.6, 3.4));
    flight = { path, entering, ...stops(path.knots) };
    seated = false;
    cameraControls.enabled = false;
};

/**
 * The camera controls take the camera back from a flight where it is. Setting their focus point
 * moves them to the camera at once, while a reset would move them smoothly from where they were
 * before the flight.
 *
 * @param {Vec3} focus - The point the camera controls orbit.
 * @param {{ pitch: Vec2, zoom: Vec2, zoomSpeed: number }} ranges - The ranges of the camera.
 */
const handBack = (focus, ranges) => {
    setRanges(ranges);
    cameraControls.enabled = true;
    cameraControls.focusPoint = focus;
};

/**
 * Moves the camera smoothly to a view, out of the cabin through a door if it is in. Any input
 * takes the control back.
 *
 * @param {keyof SHOTS} name - The name of the view.
 */
const moveCamera = (name) => {
    const shot = SHOTS[name];
    if (cabinBox.containsPoint(camera.getPosition())) {
        // backing out through the door on the side of the view, once the door opens
        const { doorway, outside } = doorViews(Math.sign(shot.position.x));
        fly([{ ...doorway, pace: 2 }, { ...outside, pace: 2 }, shot], false, (knots) => ({
            gate: knots[1] * 0.35,
            outside: knots[2]
        }));
    } else if (flight && Math.sign(camera.getPosition().x) === Math.sign(shot.position.x)) {
        // on to the view, from outside of the car on the side of the view
        fly([shot], false, () => ({ gate: 1, outside: 0 }));
    } else {
        // the camera controls orbit the car to the view
        if (flight) {
            flight = null;
            handBack(flightFocus, ORBIT_RANGES);
        }
        cameraControls.reset(shot.focus, shot.position);
    }
};

// Gets in through the door on the side of the camera
const enterCabin = () => {
    if (seated || flight?.entering) {
        return;
    }
    const position = camera.getPosition();
    const seat = { ...SEAT, pace: 2 };
    if (cabinBox.containsPoint(position)) {
        fly([seat], true, () => ({ gate: 0, outside: 0 }));
    } else {
        const { outside, doorway } = doorViews(position.x < 0 ? -1 : 1);
        fly([outside, { ...doorway, pace: 2 }, seat], true, (knots) => ({ gate: knots[1], outside: knots[1] }));
    }
};

/**
 * Moves the camera along its flight.
 *
 * @param {number} dt - The time step, in seconds.
 */
const updateFlight = (dt) => {
    // the field of view widens in the cabin, from the outside of the door to the seat
    const progress = flight ? flight.path.progressAt(flight.path.time) : 0;
    const inCabin = flight ? (flight.entering ? progress > flight.outside : progress < flight.outside) : seated;
    const fovTarget = inCabin ? 1 : 0;
    if (cabinFov !== fovTarget) {
        cabinFov = math.clamp(cabinFov + Math.sign(fovTarget - cabinFov) * dt * 1.5, 0, 1);
        updateFov();
    }

    if (!flight) {
        return;
    }
    const { path, entering, gate } = flight;
    if (doors.level >= 1 || path.progressAt(path.time + dt) <= gate) {
        path.time = Math.min(path.time + dt, path.duration);
    }
    path.evaluate(flightPosition, flightFocus);
    camera.setPosition(flightPosition);
    camera.lookAt(flightFocus);

    if (path.done) {
        flight = null;
        seated = entering;
        if (entering) {
            handBack(camera.forward.clone().mulScalar(0.03).add(flightPosition), SEAT_RANGES);
        } else {
            handBack(flightFocus, ORBIT_RANGES);
        }
    }
};

// After a few seconds without any input, the camera slowly orbits the car, easing in, until the next
// input takes the control back. It orbits a position of its own, which the camera controls follow.
// It only orbits in the view of the body, and only where it cannot swing into the car.
const IDLE_TIME = 3;
const IDLE_ORBIT_SPEED = 6;
let bodyView = true;

// The bounds of the car with its doors and shells open, x -1.44..1.44, y -0.04..2.39 and z
// -2.52..2.94 measured from its mesh instances, padded by 0.3 m for the near plane of the camera
const CAR_CLEARANCE = new BoundingBox(new Vec3(0, 1.2, 0.2), new Vec3(1.75, 1.5, 3.05));

/**
 * Whether the camera orbiting the focus point cannot get into the car: it is above the car, or its
 * circle around the focus point encloses the car.
 *
 * @param {Vec3} position - The position of the camera.
 * @param {Vec3} focus - The point the camera orbits.
 * @returns {boolean} True if the camera clears the car all the way around.
 */
const clearsCar = (position, focus) => {
    const min = CAR_CLEARANCE.getMin();
    const max = CAR_CLEARANCE.getMax();
    if (position.y > max.y) {
        return true;
    }
    const cornerX = Math.max(Math.abs(min.x - focus.x), Math.abs(max.x - focus.x));
    const cornerZ = Math.max(Math.abs(min.z - focus.z), Math.abs(max.z - focus.z));
    const x = position.x - focus.x;
    const z = position.z - focus.z;
    return x * x + z * z > cornerX * cornerX + cornerZ * cornerZ;
};

let idleTime = 0;
let idleSpeed = 0;
const idlePosition = new Vec3();
const idleFocus = new Vec3();
const idleRotation = new Quat();
const wake = () => {
    idleTime = 0;
};
const WAKE_EVENTS = ['pointerdown', 'wheel', 'keydown', 'touchstart'];
WAKE_EVENTS.forEach((name) => window.addEventListener(name, wake, { passive: true }));

// A pointer held down keeps the camera still until it is released, even when it does not move
/** @type {Set<number>} */
const pressedPointers = new Set();
/** @param {PointerEvent} event - The pointer event. */
const press = (event) => {
    pressedPointers.add(event.pointerId);
};
/** @param {PointerEvent} event - The pointer event. */
const release = (event) => {
    pressedPointers.delete(event.pointerId);
};
window.addEventListener('pointerdown', press);
window.addEventListener('pointerup', release);
window.addEventListener('pointercancel', release);

app.on('destroy', () => {
    WAKE_EVENTS.forEach((name) => window.removeEventListener(name, wake));
    window.removeEventListener('pointerdown', press);
    window.removeEventListener('pointerup', release);
    window.removeEventListener('pointercancel', release);
});

/**
 * Orbits the camera around the car when there was no input for a while.
 *
 * @param {number} dt - The time step, in seconds.
 */
const updateIdleOrbit = (dt) => {
    // the camera only orbits the car from outside, not while it flies, sits in the seat or is held
    const orbits =
        pressedPointers.size === 0 &&
        bodyView &&
        !flight &&
        !seated &&
        clearsCar(camera.getPosition(), cameraControls.focusPoint);
    idleTime = orbits ? idleTime + dt : 0;
    if (idleTime < IDLE_TIME) {
        idleSpeed = 0;
        return;
    }
    if (idleSpeed === 0) {
        idlePosition.copy(camera.getPosition());
    }
    idleSpeed = Math.min(idleSpeed + (IDLE_ORBIT_SPEED / 2) * dt, IDLE_ORBIT_SPEED);

    idleFocus.copy(cameraControls.focusPoint);
    idleRotation.setFromAxisAngle(Vec3.UP, idleSpeed * dt);
    idleRotation.transformVector(idlePosition.sub(idleFocus), idlePosition).add(idleFocus);
    cameraControls.reset(idleFocus, idlePosition);
};

// In the seat, the camera moves on a circle through the seat, to the side opposite of where it looks:
// it stays in the seat looking ahead, moves right and forward looking at the left door, and 0.6 m
// forward looking back. It sees more of the cabin that way, and past the wings of the seat beside
// the head instead of into them. The camera controls place the camera every frame, and this moves it
// on from there.
const SEAT_CIRCLE_RADIUS = 0.3;

const updateSeatCircle = () => {
    if (!seated) {
        return;
    }
    const forward = camera.forward;
    const scale = SEAT_CIRCLE_RADIUS / Math.hypot(forward.x, forward.z);
    const position = camera.getPosition();
    camera.setPosition(position.x - forward.x * scale, position.y, position.z + SEAT_CIRCLE_RADIUS - forward.z * scale);
};

// Rendering with a neutral tone mapping, bloom making the lights glow, and the volumetric fog as
// the haze the headlights scatter in, lit only by the spot lights
const cameraFrame = new CameraFrame(app, camera.camera);
cameraFrame.rendering.toneMapping = TONEMAP_NEUTRAL;
cameraFrame.bloom.blurLevel = 7;
cameraFrame.vignette.intensity = 0.3;
cameraFrame.volumetricFog.density = 0.04;
cameraFrame.volumetricFog.heightFalloff = 0;
cameraFrame.volumetricFog.ambientIntensity = 0;
cameraFrame.volumetricFog.maxDistance = 30;
cameraFrame.volumetricFog.localSpotLights = true;
cameraFrame.volumetricFog.localSteps = 16;

// less forward scattering than the default, so looking into the headlights does not wash out the
// front of the car, and a little less scattering to keep the beams seen from the side as bright
cameraFrame.volumetricFog.anisotropy = 0.5;
const BEAMS_LIT = 0.24;
const BEAMS_DARK = 2;
cameraFrame.volumetricFog.localIntensity = BEAMS_LIT;

// The reflection camera renders the World layer mirrored by the plane of the platform, into a
// texture with mipmaps for the blurred reflections, and a high dynamic range, so the reflections of
// the lights are as bright as the lights. The floor around the platform uses the same reflection.
const reflectionCamera = new Entity('ReflectionCamera');
reflectionCamera.addComponent('camera', {
    layers: [worldLayer.id],
    priority: -1
});
reflectionCamera.addComponent('script');
const planarRenderer = /** @type {PlanarRenderer} */ (
    reflectionCamera.script.create(PlanarRenderer, {
        properties: {
            sceneCameraEntity: camera,
            mipmaps: true,
            hdr: true,

            // at the full resolution of the screen, the sharp reflections are not pixelated
            scale: 1,
            planePoint: new Vec3(0, PLATFORM_HEIGHT, 0),
            planeNormal: new Vec3(0, 1, 0)
        }
    })
);
app.root.addChild(reflectionCamera);

// ----- The configurator -----

const LIGHTS_ICON =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M11 6.5C6.5 6.5 4 9 4 12s2.5 5.5 7 5.5z"/><path d="M14.5 8.5l6-1.5M14.5 12h6.5M14.5 15.5l6 1.5"/></svg>';
const STUDIO_ICON =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M3 4.5h18"/><path d="M7 4.5v3M17 4.5v3"/><path d="M5 7.5h4l1 3H4zM15 7.5h4l1 3h-6z"/>' +
    '<path d="M6.5 13l-1.5 6M17.5 13l1.5 6"/></svg>';
const DOORS_ICON =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M2.5 16v-2.5c1.5-1 3-1.6 5-2"/><path d="M16 11c1.8.4 3.4 1.2 4.6 2 .6.4.9.9.9 1.5V16"/>' +
    '<path d="M2.5 16h2.2M8.8 16h6.4M19.3 16h2.2"/><circle cx="6.7" cy="16" r="2"/><circle cx="17.2" cy="16" r="2"/>' +
    '<path d="M7.5 11.5L16 11l1.6-7.2"/><path d="M11.5 11.3l4.1-6.8 2-.7"/></svg>';
const CLAMSHELLS_ICON =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M2.5 16h2.2M8.8 16h6.4M19.3 16h2.2"/><circle cx="6.7" cy="16" r="2"/><circle cx="17.2" cy="16" r="2"/>' +
    '<path d="M2.5 16v-2.5h19V16"/><path d="M7.5 13.5c1.2-2.8 3-4 4.5-4s3.3 1.2 4.5 4"/>' +
    '<path d="M6.8 11.6L2.6 9.4"/><path d="M17.2 11.6l4.2-2.2"/></svg>';

const settings = { lights: true, doors: false, clamshells: false, studio: true, taa: true, bloom: true, beams: true };

const groups = [
    { id: 'paint', label: 'Paint', options: PAINTS, selected: DEFAULT_PAINT },
    { id: 'wheels', label: 'Wheels', options: WHEELS, selected: 0 },
    { id: 'calipers', label: 'Calipers', options: CALIPERS, selected: 0 },
    { id: 'interior', label: 'Interior', options: TRIMS, selected: trimOf(DEFAULT_PAINT) }
];

const applyRendering = () => {
    // TAA resolves the edges, otherwise MSAA does
    cameraFrame.taa.enabled = settings.taa;
    cameraFrame.rendering.samples = settings.taa ? 1 : 4;
    cameraFrame.rendering.sharpness = settings.taa ? 0.5 : 0;
    cameraFrame.bloom.intensity = settings.bloom ? 0.04 : 0;
    cameraFrame.volumetricFog.enabled = settings.beams;
    cameraFrame.update();
};

const ui = new ConfiguratorUI({
    parent: document.body,
    eyebrow: 'PlayCanvas Showroom',
    title: 'Concept',
    groups,
    toggles: [
        { id: 'lights', label: 'Lights', on: settings.lights, icon: LIGHTS_ICON, group: 'lighting' },
        { id: 'studio', label: 'Studio', on: settings.studio, icon: STUDIO_ICON, group: 'lighting' },
        { id: 'doors', label: 'Doors', on: settings.doors, icon: DOORS_ICON, group: 'opening' },
        { id: 'clamshells', label: 'Shells', on: settings.clamshells, icon: CLAMSHELLS_ICON, group: 'opening' },
        { id: 'taa', label: 'TAA', on: settings.taa },
        { id: 'bloom', label: 'Bloom', on: settings.bloom },
        { id: 'beams', label: 'Beams', on: settings.beams }
    ],
    onTab: (group) => {
        bodyView = group.id === 'paint';
        if (group.id === 'interior') {
            enterCabin();
        } else {
            moveCamera(group.id === 'paint' ? 'paint' : 'wheels');
        }
    },
    onSelect: (group, index) => {
        if (group.id === 'paint') {
            applyPaint(index);
            ui.select('interior', trimOf(index));
            ui.subtitle = PAINTS[index].name;
        } else if (group.id === 'wheels') {
            applyWheels(index);
        } else if (group.id === 'interior') {
            applyTrim(index);
        } else {
            applyCalipers(index);
        }
    },
    onToggle: (toggle) => {
        settings[toggle.id] = toggle.on;
        applyRendering();
    }
});
app.on('destroy', () => ui.destroy());

applyPaint(DEFAULT_PAINT, false);
applyCalipers(0);
ui.subtitle = PAINTS[DEFAULT_PAINT].name;
applyRendering();

// The lights fade on and off. The studio lights dim to a glow, where the headlights light the room.
let lightsLevel = 0;
let studioLevel = 1;
let indicatorLevel = 0;
let time = 0;
app.on('update', (/** @type {number} */ dt) => {
    time += dt;

    const lightsTarget = settings.lights ? 1 : 0;
    if (lightsLevel !== lightsTarget) {
        lightsLevel = math.clamp(lightsLevel + Math.sign(lightsTarget - lightsLevel) * dt * 3, 0, 1);
        carLightMaterials.forEach(({ material, intensity }) => {
            material.emissiveIntensity = intensity * lightsLevel;
            material.update();
        });
        headlights.forEach((light) => {
            light.light.intensity = HEADLIGHT_INTENSITY * lightsLevel;
            light.enabled = lightsLevel > 0;
        });
    }

    // the indicators blink with a quick fade, like bulbs
    const blink = math.clamp(Math.sin(time * Math.PI * 1.6) * 4, 0, 1) * lightsLevel;
    if (blink !== indicatorLevel) {
        indicatorLevel = blink;
        indicatorMaterial.emissiveIntensity = INDICATOR_INTENSITY * blink;
        indicatorMaterial.update();
    }

    const studioTarget = settings.studio ? 1 : 0.1;
    if (studioLevel !== studioTarget) {
        studioLevel = math.clamp(studioLevel + Math.sign(studioTarget - studioLevel) * dt * 1.5, 0.1, 1);
        studioMaterials.forEach(({ material, intensity }) => {
            material.emissiveIntensity = intensity * studioLevel;
            material.update();
        });
        app.scene.skyboxIntensity = ENV_INTENSITY * studioLevel;

        // the beams show more in the dark room
        cameraFrame.volumetricFog.localIntensity = math.lerp(BEAMS_LIT, BEAMS_DARK, (1 - studioLevel) / 0.9);
    }

    // the doors open for the flights of the camera, and close again when the camera is in the seat
    // or at the view outside
    swing(doors, settings.doors || flight !== null, dt);
    swing(clamshells, settings.clamshells, dt);

    paintSweep.update(dt);
    trimSweep.update(dt);
    updateFlight(dt);
    updateIdleOrbit(dt);
    updateSeatCircle();

    // Update the reflection camera, after the main camera has moved this frame
    const texture = planarRenderer.frameUpdate();
    reflectiveMaterials.forEach((material) => {
        material.planarReflectionMap = texture;
        material.planarReflectionMatrix = planarRenderer.viewProjectionMatrix;
        material.update();
    });
});
