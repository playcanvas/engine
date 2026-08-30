// @config
//
// Move to aim, click to launch a burning boulder at the army marching up the valley. Every group you
// wipe out sends two more, and the bodies stay where they fall - the whole crowd is one instanced
// draw call using a {accent:VAT} (Vertex Animation Texture), so a corpse costs no more than a frozen
// animation frame.
//
// @credit
// title: Сatapult
// author: AlexJJ
// source: https://sketchfab.com/3d-models/atapult-1c33623dbe0049b98be97a750f27b51b
// license: CC BY 4.0 (http://creativecommons.org/licenses/by/4.0/)
//
// @credit
// title: Low Poly Lumberjack
// author: Daz
// source: https://sketchfab.com/3d-models/low-poly-lumberjack-a93a29105fc44bf594f8100b7726bcec
// license: CC BY 4.0 (http://creativecommons.org/licenses/by/4.0/)

import {
    ADDRESS_CLAMP_TO_EDGE,
    AnimComponentSystem,
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    CameraComponentSystem,
    CameraFrame,
    Color,
    ConeGeometry,
    ContainerHandler,
    CylinderGeometry,
    ELEMENTTYPE_IMAGE,
    ELEMENTTYPE_TEXT,
    ElementComponentSystem,
    Entity,
    FILLMODE_FILL_WINDOW,
    FILTER_LINEAR,
    FontHandler,
    KEY_SPACE,
    Keyboard,
    LIGHTFALLOFF_INVERSESQUARED,
    LINECAP_ROUND,
    LINEJOIN_ROUND,
    LightComponentSystem,
    Mat4,
    Mesh,
    MeshInstance,
    Mouse,
    PIXELFORMAT_RGBA8,
    PRIMITIVE_TRIANGLES,
    Quat,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    SCALEMODE_BLEND,
    SHADOW_PCF3_32F,
    ScreenComponentSystem,
    ScriptComponentSystem,
    SphereGeometry,
    StandardMaterial,
    TONEMAP_NEUTRAL,
    Texture,
    TextureHandler,
    TouchDevice,
    Vec2,
    Vec3,
    Vec4,
    WideLine,
    WideLineRenderer,
    calculateNormals,
    createGraphicsDevice,
    math,
    platform
} from 'playcanvas';
import { ProceduralSky } from 'playcanvas/scripts/esm/sky/procedural-sky.mjs';
import { VatCharacters } from 'playcanvas/scripts/esm/vat/vat-characters.mjs';

import { data, deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

// --------------------------------------------------------------------------------------------
// tuning constants

// The three effects that carry the sunset - the sun's shadows, the fog the light shafts are marched
// through, and a light inside every burning boulder - are between them most of the frame, and more than
// a lot of phones have to give. They start switched off on a mobile device, and the control panel still
// offers all three to anyone who wants to see what theirs can do.
const EFFECTS_ON = !platform.mobile;

// the terrain covers the whole playable valley, generated as a single height field mesh
const TERRAIN_MIN_X = -215;
const TERRAIN_MAX_X = 215;
const TERRAIN_MIN_Z = -250;
const TERRAIN_MAX_Z = 60;
const TERRAIN_SEGMENTS_X = 232;
const TERRAIN_SEGMENTS_Z = 170;

// height of the pad the catapult stands on, at the near end of the valley. Deliberately low, and
// reached by a very long ramp - a steep hill in front of the machine makes the ground the player is
// aiming at foreshortened and awkward to read
const PLATEAU_Y = 14;

// the valley floor the enemies march along stays flat within this distance of its center line. Wide,
// so that formations arrive spread right across it and the machine has to be swung a long way between
// one and the next
const VALLEY_HALF_WIDTH = 78;

// where a group appears, and how far up the hill it gets before it overruns the catapult
const SPAWN_Z = -120;
const BREACH_Z = -6;

// characters, live and dead - the dead stop being simulated but stay where they fell
const MAX_CHARACTERS = 2000;
const CHARACTER_HEIGHT = 1.8;

// how many formations worth of bodies are left lying on the battlefield. Once there are more than
// this, the oldest are cleared away as new ones fall, which keeps the field from growing without limit
const MAX_CORPSE_GROUPS = 20;

// a group is a rectangular formation marching together
const GROUP_SIZE = 30;
const GROUP_COLUMNS = 6;
const GROUP_SPACING = 2.4;
const MAX_GROUPS = 14;

// fast enough that a formation crosses the valley in twenty to thirty seconds - any slower and there
// is no pressure to keep firing
const MARCH_SPEED = 4.5;

// how many leg cycles the walk animation plays per unit travelled, which keeps the feet planted
const WALK_CYCLE_PER_SPEED = 0.42;

// destroying one group sends this many in its place, so the valley keeps filling up
const GROUPS_PER_KILL = 2;

// the boulder is launched at a fixed angle, the pointer only picks the direction and the power. A
// shallow angle keeps the arc low enough to read against the valley rather than shooting off the top
// of the screen
const LAUNCH_PITCH = 32;
// low enough to drop a boulder almost at the machine's own feet, so that the impact point can follow
// the cursor right up to the near edge of the screen
const LAUNCH_POWER_MIN = 8;
// high enough to reach the far end of the visible valley, so the cursor is never out of range
const LAUNCH_POWER_MAX = 78;
// how far off the valley's axis the machine can be turned. Wide enough to cover the whole clearing,
// including a formation coming up one edge of it at close range
const LAUNCH_YAW_RANGE = 72;
const GRAVITY = 30;

// How far from the impact point a character is still killed. The outer ring of the targeting reticle is
// drawn at exactly this radius.
const BLAST_RADIUS = 18;

// How hard the blast throws a body. Both the height it reaches and the distance it covers scale with
// the square of the launch speed, so these are the previous values multiplied by the square root of two
// and a half - bodies now go two and a half times as high and as far.
const BLAST_SPEED = 41;
const BLAST_LIFT = 11;

// the small ring at the middle of the reticle, marking where the boulder itself comes down
const IMPACT_MARKER_RADIUS = 2.2;

// The sun drifts back and forth around this heading, from just off the valley's axis to further round
// behind the far end of it and back again, which keeps the shafts through the trees slowly moving
// rather than looking painted on. A full cycle takes ten minutes - the motion should never be
// something the player notices happening, only that the light is not quite where it was.
//
// The sweep stops short of pointing straight down the valley: with the sun head on, the forward
// scattering in the fog turns the whole frame into orange glare and the ground stops reading.
const LIGHT_AZIMUTH = 143;
const LIGHT_SWEEP = 17;
const LIGHT_SWEEP_PERIOD = 640;

// The camera orbits the catapult, trailing the cursor so the view drifts round and tilts with it.
//
// It is driven by where the pointer is on screen rather than by the aim it produces. Deriving it from
// the aim instead couples the two: the camera moves, which moves the ground under the cursor, which
// moves the aim, which moves the camera. The tilt in particular runs away to one extreme that way,
// because a few degrees of pitch changes the distance to the ground under a fixed pixel enormously.
const CAMERA_DISTANCE = 30;
const CAMERA_HEIGHT = 16;
const CAMERA_YAW_RANGE = 18;
const CAMERA_EASE = 5;

// Touch aiming is relative, like a trackpad rather than a touchscreen: a finger landing does not move
// the aim at all, and dragging nudges it along from wherever it already was. Aiming at the spot the
// finger lands on sounds like the obvious way round, but it means every touch throws the aim across the
// valley before it can be adjusted, and the target spends the whole drag underneath a fingertip. This
// gain is how far the aim travels for a given drag, set so that one comfortable thumb sweep crosses the
// whole battlefield rather than needing several. A blast is wide enough that this is still easily precise
// enough to place - about a thumb's width of travel covers the kill radius.
//
// A tap, on the other hand, shoots straight at the spot it lands on, which is the quicker answer when a
// formation walks into the open. The slop is how far a finger may wander and still count as a tap.
const TOUCH_AIM_GAIN = 2.5;
const TOUCH_TAP_SLOP = 12;

// A touch screen follows every tap with compatibility mouse events - a move and a press at the same spot -
// meant for pages that only listen for a mouse. Acting on those undoes the tap: the move takes the aim
// back off the ground point the tap pinned it to, so it wanders off across the valley as the camera swings
// round, and the press asks for a second shot. Mouse input is therefore ignored for a moment afterwards.
const MOUSE_AFTER_TOUCH = 0.5;

// A blast knocks the camera about, by this many world units at point blank, falling off to nothing at
// this distance away from it. A hit at the far end of the valley should not be felt at all.
const SHAKE_STRENGTH = 1.4;
const SHAKE_FALLOFF = 110;
const SHAKE_DECAY = 7;

// the point the camera looks at, which lifts as the cursor moves up the screen towards longer shots
const CAMERA_TARGET_DISTANCE = 92;
const CAMERA_TARGET_LOW = -13;
const CAMERA_TARGET_HIGH = 3;
const CAMERA_TILT_BOTTOM = 0.72;
const CAMERA_TILT_TOP = 0.3;

// the fire animation is scrubbed by hand rather than played back, so that the throw always happens at
// its authored speed however short the reload is - played back fast enough to fit a one second reload
// the swing is over in a handful of frames and cannot be seen at all. These are times within the clip:
// the arm swings up and lets go, holds at the top, then winds back down
const FIRE_RELEASE_TIME = 0.4;
const FIRE_THROW_END = 0.55;
const FIRE_RETURN_START = 1.7;
const FIRE_ANIMATION_LENGTH = 2.87;
const RELOAD_TIME_DEFAULT = 1.1;

// how many steps the volumetric fog is marched in, which the control panel drives. Half of the engine's
// own default of 24 - the fog here is thin and even, so the banding a short march leaves does not show,
// and every step is another shadow map tap for every pixel of the fog buffer
const FOG_STEPS_DEFAULT = 12;

const assets = {
    catapult: new Asset('catapult', 'container', { url: './assets/models/catapult.glb' }),
    font: new Asset('font', 'font', { url: './assets/fonts/arial.json' })
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
    ScriptComponentSystem,
    AnimComponentSystem,
    ScreenComponentSystem,
    ElementComponentSystem
];

createOptions.resourceHandlers = [TextureHandler, ContainerHandler, FontHandler];

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

// --------------------------------------------------------------------------------------------
// the terrain

/**
 * Smoothstep which also accepts a reversed range, unlike {@link math.smoothstep}.
 *
 * @param {number} edge0 - The value the ramp starts at.
 * @param {number} edge1 - The value the ramp ends at.
 * @param {number} x - The value to ramp.
 * @returns {number} The ramped value, between zero and one.
 */
const smoothRamp = (edge0, edge1, x) => {
    const t = math.clamp((x - edge0) / (edge1 - edge0), 0, 1);
    return t * t * (3 - 2 * t);
};

/**
 * A hash of two integers, used as the random value at the corners of the noise lattice.
 *
 * @param {number} x - The x coordinate.
 * @param {number} y - The y coordinate.
 * @returns {number} A repeatable pseudo random value between zero and one.
 */
const hash = (x, y) => {
    const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return n - Math.floor(n);
};

/**
 * Value noise - the lattice hash, smoothly interpolated.
 *
 * @param {number} x - The x coordinate.
 * @param {number} y - The y coordinate.
 * @returns {number} The noise value, between zero and one.
 */
const valueNoise = (x, y) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;
    const u = xf * xf * (3 - 2 * xf);
    const v = yf * yf * (3 - 2 * yf);
    const a = hash(xi, yi);
    const b = hash(xi + 1, yi);
    const c = hash(xi, yi + 1);
    const d = hash(xi + 1, yi + 1);
    return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
};

/**
 * Fractional Brownian motion - a few octaves of value noise summed at halving amplitudes.
 *
 * @param {number} x - The x coordinate.
 * @param {number} y - The y coordinate.
 * @param {number} octaves - The number of octaves to sum.
 * @returns {number} The noise value, between minus one and one.
 */
const fbm = (x, y, octaves) => {
    let sum = 0;
    let norm = 0;
    let amplitude = 0.5;
    let frequency = 1;
    for (let i = 0; i < octaves; i++) {
        sum += amplitude * valueNoise(x * frequency, y * frequency);
        norm += amplitude;
        amplitude *= 0.5;
        frequency *= 2.03;
    }
    return (sum / norm) * 2 - 1;
};

/**
 * The shape of the world. The valley runs along the z axis with ridges on both sides funnelling the
 * enemies towards the hill the catapult stands on. Everything in the game - where a boulder lands,
 * how high a character's feet are - is answered by this function rather than by a raycast.
 *
 * @param {number} x - The world space x coordinate.
 * @param {number} z - The world space z coordinate.
 * @returns {number} The terrain height at that point.
 */
const terrainHeight = (x, z) => {
    const side = Math.abs(x);

    // the ridges walling in the valley - steep, so that it reads as a valley from the hill above
    const ridges = smoothRamp(VALLEY_HALF_WIDTH, 180, side) * 70;

    // the rise at the near end, which flattens out into the catapult's pad. Barely a slope at all -
    // eight degrees over its whole length - so the approach reads as a plain rather than a hillside
    const hill = smoothRamp(-95, 0, z) * PLATEAU_Y;

    // hills closing off the far end, so the valley reads as enclosed rather than endless
    const backdrop = smoothRamp(-165, -240, z) * 64;

    // detail noise, kept low on the valley floor so the crowd walks on even ground and rising on
    // the slopes where it is not in the way
    const roughness = 1.2 + 11 * smoothRamp(VALLEY_HALF_WIDTH, 160, side) + 7 * smoothRamp(-140, -230, z);
    const detail = fbm(x * 0.011, z * 0.011, 4) * roughness;

    const height = ridges + hill + backdrop + detail;

    // flatten a pad for the catapult so it does not stand on a slope. Kept tight, so it does not
    // raise a shelf whose lip hides the ground beyond it
    const pad = 1 - smoothRamp(7, 15, Math.hypot(x, z - 4));
    return math.lerp(height, PLATEAU_Y, pad);
};

/**
 * Builds the terrain mesh, colouring it per vertex - grass on the flat valley floor, rock where it
 * is steep, and a dry band along the tops of the ridges.
 *
 * @returns {Mesh} The terrain mesh.
 */
const createTerrainMesh = () => {
    const countX = TERRAIN_SEGMENTS_X + 1;
    const countZ = TERRAIN_SEGMENTS_Z + 1;
    const vertexCount = countX * countZ;

    const positions = new Float32Array(vertexCount * 3);
    const colors = new Uint8Array(vertexCount * 4);
    const indices = new Uint32Array(TERRAIN_SEGMENTS_X * TERRAIN_SEGMENTS_Z * 6);

    const stepX = (TERRAIN_MAX_X - TERRAIN_MIN_X) / TERRAIN_SEGMENTS_X;
    const stepZ = (TERRAIN_MAX_Z - TERRAIN_MIN_Z) / TERRAIN_SEGMENTS_Z;

    for (let iz = 0; iz < countZ; iz++) {
        for (let ix = 0; ix < countX; ix++) {
            const index = iz * countX + ix;
            const x = TERRAIN_MIN_X + ix * stepX;
            const z = TERRAIN_MIN_Z + iz * stepZ;
            positions[index * 3] = x;
            positions[index * 3 + 1] = terrainHeight(x, z);
            positions[index * 3 + 2] = z;
        }
    }

    let index = 0;
    for (let iz = 0; iz < TERRAIN_SEGMENTS_Z; iz++) {
        for (let ix = 0; ix < TERRAIN_SEGMENTS_X; ix++) {
            const i0 = iz * countX + ix;
            const i1 = i0 + 1;
            const i2 = i0 + countX;
            const i3 = i2 + 1;
            indices[index++] = i0;
            indices[index++] = i2;
            indices[index++] = i1;
            indices[index++] = i1;
            indices[index++] = i2;
            indices[index++] = i3;
        }
    }

    const normals = calculateNormals(positions, indices);

    // the palette the terrain is tinted with, in sRGB - the material converts it to linear
    const grass = [66, 78, 44];
    const rock = [88, 80, 70];
    const dry = [124, 102, 68];

    for (let i = 0; i < vertexCount; i++) {
        const x = positions[i * 3];
        const y = positions[i * 3 + 1];
        const z = positions[i * 3 + 2];

        // how steep the ground is, from flat to vertical
        const steepness = math.clamp(1 - normals[i * 3 + 1], 0, 1);

        // rock takes over on the steep faces, and the dry band fades in with height
        const rockMix = smoothRamp(0.12, 0.45, steepness);
        const dryMix = smoothRamp(18, 52, y) * (1 - rockMix);

        // two octaves of patchiness so large areas do not read as one flat colour
        const patch = 1 + 0.16 * fbm(x * 0.05, z * 0.05, 2) + 0.08 * fbm(x * 0.31, z * 0.31, 2);

        for (let c = 0; c < 3; c++) {
            const base = math.lerp(math.lerp(grass[c], rock[c], rockMix), dry[c], dryMix);
            colors[i * 4 + c] = math.clamp(base * patch, 0, 255);
        }
        colors[i * 4 + 3] = 255;
    }

    const mesh = new Mesh(device);
    mesh.setPositions(positions);
    mesh.setNormals(normals);
    mesh.setColors32(colors);
    mesh.setIndices(indices);
    mesh.update(PRIMITIVE_TRIANGLES);
    return mesh;
};

const terrainMaterial = new StandardMaterial();
terrainMaterial.diffuseVertexColor = true;
terrainMaterial.vertexColorGamma = true;
terrainMaterial.useMetalness = true;
terrainMaterial.metalness = 0;
terrainMaterial.gloss = 0.25;
terrainMaterial.update();

const terrain = new Entity('Terrain');
terrain.addComponent('render', {
    meshInstances: [new MeshInstance(createTerrainMesh(), terrainMaterial)],
    castShadows: true
});
app.root.addChild(terrain);

// --------------------------------------------------------------------------------------------
// trees and rocks on the slopes, which cast the long shadows and light shafts that sell the sunset

// every tree and rock is merged into one mesh. A forest this size would otherwise be hundreds of draw
// calls, and again as many for the shadow map and the depth prepass
const coneGeometry = new ConeGeometry({ baseRadius: 0.5, height: 1, heightSegments: 1, capSegments: 8 });
const cylinderGeometry = new CylinderGeometry({ radius: 0.5, height: 1, heightSegments: 1, capSegments: 6 });
const rockGeometry = new SphereGeometry({ radius: 0.5, latitudeBands: 5, longitudeBands: 7 });

/** @type {number[]} */
const sceneryPositions = [];
/** @type {number[]} */
const sceneryNormals = [];
/** @type {number[]} */
const sceneryColors = [];
/** @type {number[]} */
const sceneryIndices = [];

const _sceneryMatrix = new Mat4();
const _sceneryQuat = new Quat();
const _sceneryScale = new Vec3();
const _sceneryVertex = new Vec3();

/**
 * Appends one transformed copy of a geometry to the merged scenery mesh.
 *
 * @param {object} geometry - The geometry to copy, as generated by one of the geometry classes.
 * @param {Vec3} position - Where to put it.
 * @param {number} yaw - The rotation around the vertical axis, in degrees.
 * @param {Vec3} scale - The non uniform scale to apply.
 * @param {number[]} color - The sRGB vertex color the copy is tinted with.
 */
const appendScenery = (geometry, position, yaw, scale, color) => {
    const base = sceneryPositions.length / 3;
    _sceneryMatrix.setTRS(position, _sceneryQuat.setFromEulerAngles(0, yaw, 0), scale);

    // a non uniform scale needs the inverse scale on the normals to keep them perpendicular
    _sceneryScale.set(1 / scale.x, 1 / scale.y, 1 / scale.z);

    const positions = geometry.positions;
    const normals = geometry.normals;

    for (let i = 0; i < positions.length; i += 3) {
        _sceneryVertex.set(positions[i], positions[i + 1], positions[i + 2]);
        _sceneryMatrix.transformPoint(_sceneryVertex, _sceneryVertex);
        sceneryPositions.push(_sceneryVertex.x, _sceneryVertex.y, _sceneryVertex.z);

        _sceneryVertex.set(
            normals[i] * _sceneryScale.x,
            normals[i + 1] * _sceneryScale.y,
            normals[i + 2] * _sceneryScale.z
        );
        _sceneryMatrix.transformVector(_sceneryVertex, _sceneryVertex).normalize();
        sceneryNormals.push(_sceneryVertex.x, _sceneryVertex.y, _sceneryVertex.z);

        sceneryColors.push(color[0], color[1], color[2], 255);
    }

    const indices = geometry.indices;
    for (let i = 0; i < indices.length; i++) {
        sceneryIndices.push(base + indices[i]);
    }
};

const _sceneryPosition = new Vec3();

/**
 * Appends a stylized conifer - a trunk with two stacked cones - standing on the terrain.
 *
 * @param {number} x - The world space x coordinate.
 * @param {number} z - The world space z coordinate.
 * @param {number} height - The overall height of the tree.
 */
const addTree = (x, z, height) => {
    const ground = terrainHeight(x, z);
    const yaw = Math.random() * 360;

    // a spread of greens, so that a hillside of them does not read as one flat mass
    const tint = 0.85 + Math.random() * 0.3;
    const foliage = [42 * tint, 62 * tint, 34 * tint];

    _sceneryPosition.set(x, ground + height * 0.2, z);
    _sceneryScale.set(height * 0.07, height * 0.45, height * 0.07);
    appendScenery(cylinderGeometry, _sceneryPosition, yaw, _sceneryScale, [48, 34, 24]);

    for (let i = 0; i < 2; i++) {
        const radius = height * (0.34 - i * 0.1);
        _sceneryPosition.set(x, ground + height * (0.44 + i * 0.26), z);
        _sceneryScale.set(radius, height * 0.5, radius);
        appendScenery(coneGeometry, _sceneryPosition, yaw, _sceneryScale, foliage);
    }
};

/**
 * Appends a boulder - a squashed, randomly turned sphere - sitting on the terrain.
 *
 * @param {number} x - The world space x coordinate.
 * @param {number} z - The world space z coordinate.
 * @param {number} size - The rough diameter of the rock.
 */
const addRock = (x, z, size) => {
    _sceneryPosition.set(x, terrainHeight(x, z) - size * 0.2, z);
    _sceneryScale.set(size, size * (0.5 + Math.random() * 0.4), size * (0.7 + Math.random() * 0.5));
    appendScenery(rockGeometry, _sceneryPosition, Math.random() * 360, _sceneryScale, [74, 68, 60]);
};

for (let i = 0; i < 520; i++) {
    // keep the scenery out of the valley floor so it never blocks the marching crowd. Trees crowd
    // towards the bottom of the slopes, where the low sun rakes through them
    const side = Math.random() < 0.5 ? -1 : 1;
    const up = Math.random() * Math.random();
    const x = side * (VALLEY_HALF_WIDTH + 2 + up * 95);
    const z = TERRAIN_MIN_Z + 10 + Math.random() * (TERRAIN_MAX_Z - TERRAIN_MIN_Z - 20);
    if (i % 7 === 0) {
        addRock(x, z, 2.5 + Math.random() * 6);
    } else {
        addTree(x, z, 16 + Math.random() * 21);
    }
}

const sceneryMaterial = new StandardMaterial();
sceneryMaterial.diffuseVertexColor = true;
sceneryMaterial.vertexColorGamma = true;
sceneryMaterial.useMetalness = true;
sceneryMaterial.metalness = 0;
sceneryMaterial.gloss = 0.2;
sceneryMaterial.update();

const sceneryMesh = new Mesh(device);
sceneryMesh.setPositions(sceneryPositions);
sceneryMesh.setNormals(sceneryNormals);
sceneryMesh.setColors32(new Uint8Array(sceneryColors));
sceneryMesh.setIndices(sceneryIndices);
sceneryMesh.update(PRIMITIVE_TRIANGLES);

const scenery = new Entity('Scenery');
scenery.addComponent('render', {
    meshInstances: [new MeshInstance(sceneryMesh, sceneryMaterial)],
    castShadows: true
});
app.root.addChild(scenery);

// --------------------------------------------------------------------------------------------
// sky, sun and camera

// the sun sits low and off to one side, so the ridges and the trees on them rake long shadows and
// shafts across the valley floor. The procedural sky dims it as it approaches the horizon, so the
// authored intensity is the value it would have at midday
const sun = new Entity('Sun');
sun.addComponent('light', {
    type: 'directional',
    intensity: 2.8,
    castShadows: EFFECTS_ON,
    shadowType: SHADOW_PCF3_32F,
    shadowBias: 0.3,
    normalOffsetBias: 0.2,
    shadowDistance: 320,

    // One cascade rather than three. Cascades buy texel density close to the camera, but each one is
    // another full pass over every caster in the scene, and the volumetric fog samples the map once
    // per marching step on top of that - the shafts and the long raking shadows are what this scene
    // wants from the sun, and both come from the map's coverage rather than its sharpness
    numCascades: 1,
    shadowResolution: 2048
});
app.root.addChild(sun);

// the procedural sky drives the sun's direction, colour and intensity, and generates the image
// based lighting for everything in the scene
const sky = new Entity('ProceduralSky');
sky.addComponent('script');
const skyScript = /** @type {ProceduralSky} */ (sky.script.create(ProceduralSky));
skyScript.sunLight = sun;
// The sun sits just off the valley's axis rather than straight down it - the enemies stay readable
// against the ground instead of being lost in the glare, and the ridges get some shape. It is low
// enough for a sunset, but not so low that the machine's own shadow is thrown for sixty metres
// straight at the camera and disappears behind it.
skyScript.elevation = 7.5;
skyScript.azimuth = LIGHT_AZIMUTH;
skyScript.turbidity = 8;
skyScript.rayleigh = 3;
skyScript.luminance = 0.9;
skyScript.twilightGlow = 0.8;
app.root.addChild(sky);

const camera = new Entity('Camera');
camera.addComponent('camera', {
    fov: 50,
    farClip: 600
});
app.root.addChild(camera);

const cameraFrame = new CameraFrame(app, camera.camera);
cameraFrame.rendering.toneMapping = TONEMAP_NEUTRAL;
cameraFrame.rendering.sharpness = 0.4;
// enough bloom that the burning boulders and the blast fireballs throw a real glow, without hazing
// the sunset sky behind them. Each blur level is a downsample and an upsample pass of its own, and the
// glow here is tight around small bright things rather than a wide wash, so it does not need many
cameraFrame.bloom.intensity = 0.07;
cameraFrame.bloom.blurLevel = 4;
cameraFrame.volumetricFog.light = sun.light;
cameraFrame.volumetricFog.enabled = EFFECTS_ON;
cameraFrame.volumetricFog.tint = new Color(1, 0.72, 0.42);
cameraFrame.volumetricFog.density = 0.0017;

// the fog reaches well up the valley walls rather than pooling on the floor, so the low sun raking
// through the trees on the slopes throws shafts rather than just shadows
cameraFrame.volumetricFog.heightBase = 26;
cameraFrame.volumetricFog.heightFalloff = 0.014;
cameraFrame.volumetricFog.anisotropy = 0.6;
cameraFrame.volumetricFog.intensity = 1.25;
cameraFrame.volumetricFog.ambientColor = new Color(0.9, 0.42, 0.2);
cameraFrame.volumetricFog.ambientIntensity = 0.04;
cameraFrame.volumetricFog.maxDistance = 340;

// the control panel offers the whole 4 to 128 range the engine accepts. This is the dial that decides
// what the shafts cost, and the march runs at half resolution on top of it
cameraFrame.volumetricFog.steps = FOG_STEPS_DEFAULT;
cameraFrame.volumetricFog.scale = 0.5;
cameraFrame.update();

// --------------------------------------------------------------------------------------------
// the catapult

const CATAPULT_POSITION = new Vec3(0, PLATEAU_Y, 2);

// the model already stands on its wheels, so all it needs is the aim, applied as the y euler angle
const CATAPULT_TIP = 0;

const catapult = assets.catapult.resource.instantiateRenderEntity();
catapult.setLocalScale(0.026, 0.026, 0.026);
catapult.setLocalPosition(CATAPULT_POSITION);
app.root.addChild(catapult);

catapult.findComponents('render').forEach((render) => {
    render.castShadows = true;
});

// only the firing animation is used. The layer stays paused and the game scrubs it a frame at a time,
// which is what lets the swing keep its own timing independently of the reload
const animations = assets.catapult.resource.animations;
const fireTrack = (animations.find((animation) => animation.resource.name.includes('Shot')) ?? animations[0]).resource;

catapult.addComponent('anim', { activate: false });
catapult.anim.assignAnimation('Fire', fireTrack, undefined, 1, false);
catapult.anim.baseLayer.pause();

// scrub once to settle the machine into its loaded pose, which also resolves the layer out of its
// start state so that the first shot poses it from its very first frame
catapult.anim.baseLayer.activeStateCurrentTime = 0;
catapult.anim.baseLayer.activeStateCurrentTime = 0;

// the boulder always leaves from the same point on the machine, so that the arc drawn for the player
// is exactly the arc the boulder flies - the tip of the animated arm would not be predictable. This
// matches where the arm actually is at the moment of release
const LAUNCH_HEIGHT = 3.7;
const LAUNCH_FORWARD = 0.3;
const launchPoint = new Vec3();

// --------------------------------------------------------------------------------------------
// game state

const STATE_FREE = 0;
const STATE_MARCH = 1;
const STATE_FLYING = 2;
const STATE_DEAD = 3;

const charState = new Uint8Array(MAX_CHARACTERS);
const charGroup = new Int16Array(MAX_CHARACTERS);
const charPos = new Float32Array(MAX_CHARACTERS * 3);
const charVel = new Float32Array(MAX_CHARACTERS * 3);
const charSpin = new Float32Array(MAX_CHARACTERS * 3);
const charTumble = new Float32Array(MAX_CHARACTERS * 3);
const charFormation = new Float32Array(MAX_CHARACTERS * 2);
const charPhase = new Float32Array(MAX_CHARACTERS);

// the number of character slots handed out so far - the crowd script renders exactly this many, so
// it grows as the battle goes on and never shrinks
let charCount = 0;

// dead characters in the order they died, so that the oldest bodies are the ones cleared away first
/** @type {number[]} */
const corpses = [];

// slots of bodies that have been cleared away, waiting to be handed out to a new formation
/** @type {number[]} */
const freeSlots = [];

/**
 * @typedef {object} Group
 * @property {number} x - The x coordinate of the formation's center.
 * @property {number} z - The z coordinate of the formation's center.
 * @property {number} speed - How fast it marches, in units per second.
 * @property {number[]} members - The slots of the characters still marching with it. A character
 * leaves this list the moment it dies, so that a slot recycled into a new formation can never be
 * driven by the formation it used to belong to.
 */

/** @type {Group[]} */
const groups = [];

let score = 0;
let gameOver = false;

// aim, solved from the pointer - an offset from straight down the valley, and a launch power
let aimYaw = 0;
let aimPower = (LAUNCH_POWER_MIN + LAUNCH_POWER_MAX) * 0.5;

// where the pointer last was, in canvas pixels, or minus one before it has ever moved. On touch this is
// the lifted aim point rather than the finger itself
let pointerX = -1;
let pointerY = -1;

// touch aiming state - the ground point the aim is pinned to, where the finger went down and where it was
// last seen, and whether it has moved far enough to count as a drag rather than a tap
let touchAiming = false;
let touchDragging = false;
let touchStartX = 0;
let touchStartY = 0;
let touchLastX = 0;
let touchLastY = 0;
let lastTouchTime = -1;
const touchAimPoint = new Vec3();

// the eased camera state, trailing the aim
let cameraYaw = 0;
let cameraTilt = 0;

// how hard the camera is currently being shaken, decaying away after each blast
let shake = 0;
let reloadTimer = 0;
let reloadTime = RELOAD_TIME_DEFAULT;
let time = 0;

// seconds since the lever was pulled, driving the fire animation, or minus one while the arm rests
let fireClock = -1;

// seconds since the catapult was overrun, which sequences the aftermath, or minus one while it stands
let overrunClock = -1;

// display state - how many shots have been taken, how visible the hint still is, and the countdown on
// the call out for the last formation wiped out
let shotsFired = 0;
let hintAlpha = 1;
let flashClock = -1;
let flashedScore = 0;

/**
 * Shots that have been fired but whose boulder has not left the arm yet.
 *
 * @type {{ delay: number, position: Vec3, velocity: Vec3 }[]}
 */
const pendingShots = [];

/** @type {VatCharacters} */
let characters = null;

const _position = new Vec3();
const _lookAt = new Vec3();
const _shakePoint = new Vec3();
const _step = new Vec3();
const _rotation = new Quat();
const _yawQuat = new Quat();
const _tiltQuat = new Quat();

// --------------------------------------------------------------------------------------------
// the crowd

const charactersEntity = new Entity('Characters');
charactersEntity.addComponent('script');
app.root.addChild(charactersEntity);

characters = /** @type {VatCharacters} */ (
    charactersEntity.script.create(VatCharacters, {
        properties: {
            // the standard material costs more than the example's custom shader material, but it
            // puts the crowd in the scene's lighting - the sunset environment, the sun's shadows and
            // the omni lights inside the burning boulders all reach it
            useStandardMaterial: true,
            castShadows: true
        }
    })
);

await characters.load('./assets/vat/lumberjack.vat');
characters.capacity = MAX_CHARACTERS;
characters.count = 0;

// the valley is backlit by a sun sitting almost on the horizon, which leaves the crowd as dark
// silhouettes against the ground. Feeding their own albedo back in as a weak emissive lifts them out
// of the shade without flattening the lighting on them
const charactersMaterial = charactersEntity.findComponent('render').meshInstances[0].material;
charactersMaterial.emissiveMap = charactersMaterial.diffuseMap;
charactersMaterial.emissive = new Color(1, 1, 1);
charactersMaterial.emissiveIntensity = 0.45;
charactersMaterial.update();

const WALK_ANIMATION = Math.max(0, characters.getAnimationIndex('Walk'));

// a single frame held forever - a body flying through the air or lying on the ground is just a
// character whose animation never advances
const DEAD_ANIMATION = Math.max(0, characters.getAnimationIndex('A-pose'));

/**
 * Takes a character slot, reusing the oldest corpse on the battlefield once every slot is in use.
 *
 * @returns {number} The index of the slot.
 */
const allocateCharacter = () => {
    // a slot freed up by a body being cleared away is the cheapest to reuse, as the crowd script
    // already renders it
    if (freeSlots.length) {
        return freeSlots.pop();
    }

    if (charCount < MAX_CHARACTERS) {
        const index = charCount++;
        characters.count = charCount;
        return index;
    }

    // every slot is in use, so the longest dead body is cleared away to make room
    return corpses.shift();
};

/**
 * Spawns a formation at the far end of the valley.
 */
const spawnGroup = () => {
    if (groups.length >= MAX_GROUPS) {
        return;
    }

    const rows = Math.ceil(GROUP_SIZE / GROUP_COLUMNS);

    // formations start spread across the width of the valley and at staggered depths, and each
    // marches at its own pace, so that they arrive as a series of waves rather than one wall
    const group = {
        x: (Math.random() - 0.5) * 2 * (VALLEY_HALF_WIDTH - 7),
        z: SPAWN_Z - Math.random() * 35,
        speed: MARCH_SPEED * (0.85 + Math.random() * 0.3),
        members: []
    };

    for (let i = 0; i < GROUP_SIZE; i++) {
        const index = allocateCharacter();
        const column = i % GROUP_COLUMNS;
        const row = Math.floor(i / GROUP_COLUMNS);

        charState[index] = STATE_MARCH;
        charGroup[index] = groups.length;
        charFormation[index * 2] = (column - (GROUP_COLUMNS - 1) * 0.5) * GROUP_SPACING;
        charFormation[index * 2 + 1] = (row - (rows - 1) * 0.5) * GROUP_SPACING;
        charPhase[index] = Math.random() * Math.PI * 2;

        // the leg cycle is driven by how fast the formation is advancing, which keeps the feet from
        // sliding, and starting each one at a random time stops the formation moving as one rigid
        // block
        characters.setScale(index, CHARACTER_HEIGHT * (0.92 + Math.random() * 0.16));
        characters.setAnimation(
            index,
            WALK_ANIMATION,
            group.speed * WALK_CYCLE_PER_SPEED * (0.92 + Math.random() * 0.16),
            true,
            Math.random() * 10
        );

        group.members.push(index);
    }

    groups.push(group);
};

/**
 * Reindexes the group each character points at, called after a group is removed from the list.
 */
const reindexGroups = () => {
    for (let g = 0; g < groups.length; g++) {
        const members = groups[g].members;
        for (let i = 0; i < members.length; i++) {
            charGroup[members[i]] = g;
        }
    }
};

/**
 * Kills a character, throwing it away from a blast.
 *
 * @param {number} index - The index of the character.
 * @param {number} dirX - The x component of the direction to throw it in.
 * @param {number} dirZ - The z component of the direction to throw it in.
 * @param {number} strength - How hard to throw it, between zero and one.
 */
const killCharacter = (index, dirX, dirZ, strength) => {
    const group = groups[charGroup[index]];
    if (group) {
        const at = group.members.indexOf(index);
        if (at !== -1) {
            group.members.splice(at, 1);
        }
    }

    charState[index] = STATE_FLYING;
    charGroup[index] = -1;

    const speed = BLAST_SPEED * (0.35 + strength);
    charVel[index * 3] = dirX * speed * 0.6;
    charVel[index * 3 + 1] = BLAST_LIFT + speed * 0.55;
    charVel[index * 3 + 2] = dirZ * speed * 0.6;

    // a fast, arbitrary tumble - at this distance any spin reads as a body thrown by a blast
    for (let c = 0; c < 3; c++) {
        charSpin[index * 3 + c] = (Math.random() - 0.5) * 900;
        charTumble[index * 3 + c] = Math.random() * 360;
    }

    characters.setAnimation(index, DEAD_ANIMATION, 0, false, 0);
};

/**
 * Lays a character flat on the ground where it landed, and leaves it there. Bodies pile up until there
 * are more than the battlefield keeps, at which point the oldest are cleared away as new ones fall.
 *
 * @param {number} index - The index of the character.
 */
const landCharacter = (index) => {
    charState[index] = STATE_DEAD;
    corpses.push(index);

    while (corpses.length > MAX_CORPSE_GROUPS * GROUP_SIZE) {
        const retired = corpses.shift();
        charState[retired] = STATE_FREE;
        characters.setScale(retired, 0);
        freeSlots.push(retired);
    }

    const x = charPos[index * 3];
    const z = charPos[index * 3 + 2];

    // lifted a little so the body sits on the ground rather than half inside it
    charPos[index * 3 + 1] = terrainHeight(x, z) + 0.16;
    _position.set(x, charPos[index * 3 + 1], z);
    characters.setPosition(index, _position);

    // yaw first, then tipped onto its back - composed as quaternions so the order is unambiguous
    _yawQuat.setFromAxisAngle(Vec3.UP, Math.random() * 360);
    _tiltQuat.setFromAxisAngle(Vec3.RIGHT, -90);
    characters.setRotation(index, _rotation.mul2(_yawQuat, _tiltQuat));
};

// --------------------------------------------------------------------------------------------
// the boulders

// Far brighter than anything else in the scene, which is what the bloom needs to bite on. It only
// works because the rock is small: at this intensity a large sphere would blow out into a flat white
// disc, whereas a small one reads as a burning ember with a halo around it.
const boulderMaterial = new StandardMaterial();
boulderMaterial.diffuse = new Color(0.09, 0.06, 0.05);
boulderMaterial.emissive = new Color(1, 0.35, 0.08);
boulderMaterial.emissiveIntensity = 60;
boulderMaterial.useMetalness = true;
boulderMaterial.metalness = 0;
boulderMaterial.gloss = 0.4;
boulderMaterial.update();

/**
 * @typedef {object} Boulder
 * @property {Entity} entity - The visible rock, with the light inside it.
 * @property {Entity} light - The omni light making it look like it is burning.
 * @property {boolean} active - Whether it is in flight.
 * @property {Vec3} position - Where it is.
 * @property {Vec3} velocity - Where it is going.
 */

/** @type {Boulder[]} */
const boulders = [];

// The longest shot hangs in the air for about three and a half seconds, and the fastest reload the
// control panel allows is a tenth of a second, so this many can be aloft at once. Sizing the pool any
// smaller would recycle a rock that is still flying and visibly teleport it back to the arm.
for (let i = 0; i < 40; i++) {
    const entity = new Entity('Boulder');
    entity.addComponent('render', { type: 'sphere', material: boulderMaterial, castShadows: false });
    entity.setLocalScale(1.3, 1.3, 1.3);
    entity.enabled = false;
    app.root.addChild(entity);

    // the light that makes the rock look like it is burning, lighting the ground and the crowd it
    // passes over. Only the directional light contributes to the volumetric fog, so this one lights
    // surfaces but does not glow through the air
    const light = new Entity('BoulderLight');
    light.addComponent('light', {
        type: 'omni',
        color: new Color(1, 0.46, 0.16),
        intensity: 12,
        range: 55,
        falloffMode: LIGHTFALLOFF_INVERSESQUARED,
        castShadows: false
    });
    light.enabled = EFFECTS_ON;
    entity.addChild(light);

    boulders.push({
        entity: entity,
        light: light,
        active: false,
        position: new Vec3(),
        velocity: new Vec3()
    });
}

/**
 * Takes every boulder out of the air, along with any shot still waiting to leave the arm. They vanish
 * rather than exploding - nothing should still be coming down once the machine that threw them is gone.
 */
const clearBoulders = () => {
    boulders.forEach((boulder) => {
        boulder.active = false;
        boulder.entity.enabled = false;
    });
    pendingShots.length = 0;
};

const explosionMaterial = new StandardMaterial();
explosionMaterial.diffuse = new Color(0, 0, 0);
explosionMaterial.emissive = new Color(1, 0.55, 0.2);
explosionMaterial.emissiveIntensity = 14;
explosionMaterial.update();

/**
 * @typedef {object} Explosion
 * @property {Entity} entity - The expanding emissive ball.
 * @property {Entity} light - The flash lighting the ground and the bodies around it.
 * @property {number} age - How long it has been going, in seconds, or minus one when unused.
 * @property {number} size - The diameter the fireball grows to.
 * @property {number} duration - How long it takes to grow and fade, in seconds.
 */

/** @type {Explosion[]} */
const explosions = [];

// a boulder landing
const EXPLOSION_DURATION = 0.5;
const EXPLOSION_SIZE = 20;

// the catapult itself going up, which is a far bigger event. The fireball stops short of the camera,
// which would otherwise end up inside the sphere and see nothing
const OVERRUN_EXPLOSION_DURATION = 1.3;
const OVERRUN_EXPLOSION_SIZE = 34;

for (let i = 0; i < 4; i++) {
    const entity = new Entity('Explosion');
    entity.addComponent('render', { type: 'sphere', material: explosionMaterial, castShadows: false });
    entity.enabled = false;
    app.root.addChild(entity);

    const light = new Entity('ExplosionLight');
    light.addComponent('light', {
        type: 'omni',
        color: new Color(1, 0.6, 0.25),
        intensity: 30,
        range: 90,
        falloffMode: LIGHTFALLOFF_INVERSESQUARED,
        castShadows: false
    });
    entity.addChild(light);

    explosions.push({ entity: entity, light: light, age: -1, size: EXPLOSION_SIZE, duration: EXPLOSION_DURATION });
}

/**
 * Starts a fireball. Purely visual - it lights the scene and nothing more.
 *
 * @param {number} x - The x coordinate of its center.
 * @param {number} y - The y coordinate of its center.
 * @param {number} z - The z coordinate of its center.
 * @param {number} [size] - The diameter the fireball grows to.
 * @param {number} [duration] - How long the fireball takes to grow and fade, in seconds.
 */
const spawnFlash = (x, y, z, size = EXPLOSION_SIZE, duration = EXPLOSION_DURATION) => {
    const explosion = explosions.find((item) => item.age < 0) ?? explosions[0];
    explosion.age = 0;
    explosion.size = size;
    explosion.duration = duration;
    explosion.entity.enabled = true;
    explosion.entity.setLocalPosition(x, y + 1, z);

    // shake the camera, harder for a bigger blast and softer the further away it went off. The larger
    // of the old and new values wins, so a distant hit cannot damp out a close one
    _shakePoint.set(x, y, z);
    const distance = camera.getPosition().distance(_shakePoint);
    const strength = (SHAKE_STRENGTH * size) / EXPLOSION_SIZE;
    shake = Math.max(shake, strength * (1 - smoothRamp(0, SHAKE_FALLOFF, distance)));
};

/**
 * Kills everything within the blast radius, and sets off a fireball where it landed.
 *
 * @param {number} x - The x coordinate of the impact.
 * @param {number} y - The y coordinate of the impact.
 * @param {number} z - The z coordinate of the impact.
 */
const explode = (x, y, z) => {
    for (let i = 0; i < charCount; i++) {
        if (charState[i] !== STATE_MARCH) {
            continue;
        }

        const dx = charPos[i * 3] - x;
        const dz = charPos[i * 3 + 2] - z;
        const distance = Math.hypot(dx, dz);
        if (distance > BLAST_RADIUS) {
            continue;
        }

        // characters at the edge of the blast are thrown less far than those at its center
        const strength = 1 - distance / BLAST_RADIUS;
        const scale = distance > 0.001 ? 1 / distance : 0;
        killCharacter(i, dx * scale, dz * scale, strength);
    }

    spawnFlash(x, y, z);
};

/**
 * Launches a boulder.
 *
 * @param {Vec3} position - Where it starts.
 * @param {Vec3} velocity - How fast, and in which direction.
 */
const launchBoulder = (position, velocity) => {
    const boulder = boulders.find((item) => !item.active) ?? boulders[0];
    boulder.active = true;
    boulder.position.copy(position);
    boulder.velocity.copy(velocity);
    boulder.entity.enabled = true;
    boulder.entity.setLocalPosition(position);
};

// --------------------------------------------------------------------------------------------
// aiming

/**
 * The direction and speed the boulder would leave at, for the current aim.
 *
 * @param {Vec3} out - The vector to receive the velocity.
 * @returns {Vec3} The launch velocity.
 */
const launchVelocity = (out) => {
    // the aim is a compass angle, with 180 degrees pointing straight down the valley
    const yaw = (180 - aimYaw) * math.DEG_TO_RAD;
    const pitch = LAUNCH_PITCH * math.DEG_TO_RAD;
    const horizontal = Math.cos(pitch) * aimPower;
    return out.set(Math.sin(yaw) * horizontal, Math.sin(pitch) * aimPower, Math.cos(yaw) * horizontal);
};

/**
 * Where the boulder leaves the catapult, which is a fixed point on the rotated machine rather than
 * the tip of the animated arm, so that the arc drawn for the player is the arc that is flown.
 *
 * @param {Vec3} out - The vector to receive the position.
 * @returns {Vec3} The launch point.
 */
const launchPosition = (out) => {
    const yaw = (180 - aimYaw) * math.DEG_TO_RAD;
    return out.set(
        CATAPULT_POSITION.x + LAUNCH_FORWARD * Math.sin(yaw),
        CATAPULT_POSITION.y + LAUNCH_HEIGHT,
        CATAPULT_POSITION.z + LAUNCH_FORWARD * Math.cos(yaw)
    );
};

const MAX_ARC_POINTS = 120;

// one extra point of room, for the landing point appended once the arc reaches the ground
const arcPositions = new Float32Array((MAX_ARC_POINTS + 1) * 3);
const arcColors = new Float32Array((MAX_ARC_POINTS + 1) * 3);
const arcWidths = new Float32Array(MAX_ARC_POINTS + 1);

const RING_POINTS = 64;
const outerRingPositions = new Float32Array(RING_POINTS * 3);
const innerRingPositions = new Float32Array(RING_POINTS * 3);

// four short spokes crossing the ring, which give the reticle a center to read against
const TICK_COUNT = 4;
const tickPositions = new Float32Array(TICK_COUNT * 2 * 3);

const lineRenderer = new WideLineRenderer(app);

// all of these batch into the renderer's single draw call, so the reticle can afford a few lines
const arcLine = new WideLine();
arcLine.dashLength = 9;
arcLine.gapLength = 7;
arcLine.cap = LINECAP_ROUND;
arcLine.join = LINEJOIN_ROUND;
lineRenderer.add(arcLine);

// solid rather than dashed - it is the edge of the lethal area, not an ornament
const outerRingLine = new WideLine();
outerRingLine.closed = true;
lineRenderer.add(outerRingLine);

const innerRingLine = new WideLine();
innerRingLine.closed = true;
lineRenderer.add(innerRingLine);

/** @type {WideLine[]} */
const tickLines = [];
for (let i = 0; i < TICK_COUNT; i++) {
    const tick = new WideLine();
    tick.cap = LINECAP_ROUND;
    tickLines.push(tick);
    lineRenderer.add(tick);
}

app.on('destroy', () => lineRenderer.destroy());

// the reticle is green while the catapult is loaded and red while it is being wound back, which is
// the only feedback the player needs about when the next shot is available
const READY_COLOR = [0.35, 1, 0.45];
const BLOCKED_COLOR = [1, 0.22, 0.18];

// the arc runs from near white at the arm to the state color where it lands, so it reads as a
// direction even when the camera is looking straight down the line of fire
const ARC_NEAR_COLOR = [0.9, 0.95, 1];

const arcFarColor = new Color();
const ringColor = new Color();
const innerRingColor = new Color();
const _velocity = new Vec3();

/**
 * Steps the current shot through the world until it hits the ground, filling in the arc drawn as a
 * targeting hint and returning where it would land.
 *
 * @returns {number} The number of points in the arc.
 */
const predictArc = () => {
    launchPosition(launchPoint);
    launchVelocity(_velocity);

    let x = launchPoint.x;
    let y = launchPoint.y;
    let z = launchPoint.z;
    const vx = _velocity.x;
    let vy = _velocity.y;
    const vz = _velocity.z;

    const step = 0.07;
    let count = 0;

    for (let i = 0; i < MAX_ARC_POINTS; i++) {
        arcPositions[count * 3] = x;
        arcPositions[count * 3 + 1] = y;
        arcPositions[count * 3 + 2] = z;
        count++;

        // the half acceleration term makes this exact for a constant gravity rather than merely close,
        // which matters because the launch speed is solved analytically - without it the shot lands a
        // couple of metres past the point the player asked for
        const nx = x + vx * step;
        const ny = y + vy * step - 0.5 * GRAVITY * step * step;
        const nz = z + vz * step;

        // height above the ground at both ends of the step, which changes sign as it lands
        const above = y - terrainHeight(x, z);
        const below = ny - terrainHeight(nx, nz);

        if (below <= 0) {
            // land on the surface rather than below it, so that the ring sits where it will hit
            const t = above / Math.max(0.001, above - below);
            arcPositions[count * 3] = math.lerp(x, nx, t);
            arcPositions[count * 3 + 1] = math.lerp(y, ny, t);
            arcPositions[count * 3 + 2] = math.lerp(z, nz, t);
            count++;
            break;
        }

        x = nx;
        y = ny;
        z = nz;
        vy -= GRAVITY * step;
    }

    return count;
};

/**
 * Fills a packed position array with a circle laid over the terrain.
 *
 * @param {Float32Array} out - The array to fill, of `RING_POINTS * 3` values.
 * @param {number} centerX - The x coordinate of the center.
 * @param {number} centerZ - The z coordinate of the center.
 * @param {number} radius - The radius of the circle.
 * @param {number} spin - A rotation applied to the whole circle, in radians.
 */
const buildRing = (out, centerX, centerZ, radius, spin) => {
    for (let i = 0; i < RING_POINTS; i++) {
        const angle = (i / RING_POINTS) * Math.PI * 2 + spin;
        const x = centerX + Math.cos(angle) * radius;
        const z = centerZ + Math.sin(angle) * radius;
        out[i * 3] = x;

        // held just above the surface, so that it follows the ground without z-fighting it
        out[i * 3 + 1] = terrainHeight(x, z) + 0.3;
        out[i * 3 + 2] = z;
    }
};

/**
 * Redraws the predicted arc and the reticle marking the blast area around where it lands.
 */
const updateTargeting = () => {
    const count = predictArc();
    const last = count - 1;

    // the dashes crawl along the arc, which reads as a direction rather than a static curve
    arcLine.dashOffset = -time * 30;

    const state = reloadTimer > 0 || gameOver ? BLOCKED_COLOR : READY_COLOR;
    arcFarColor.set(state[0], state[1], state[2]);
    ringColor.set(state[0], state[1], state[2]);
    innerRingColor.set(math.lerp(state[0], 1, 0.45), math.lerp(state[1], 1, 0.45), math.lerp(state[2], 1, 0.45));

    for (let i = 0; i < count; i++) {
        const t = i / last;

        // ease the gradient towards the impact end, where the eye needs to go
        const hot = t * t;
        arcColors[i * 3] = math.lerp(ARC_NEAR_COLOR[0], arcFarColor.r, hot);
        arcColors[i * 3 + 1] = math.lerp(ARC_NEAR_COLOR[1], arcFarColor.g, hot);
        arcColors[i * 3 + 2] = math.lerp(ARC_NEAR_COLOR[2], arcFarColor.b, hot);

        // tapered like a tracer, thick as it leaves the arm and fine where it comes down
        arcWidths[i] = math.lerp(5, 1.5, Math.sqrt(t));
    }

    arcLine.set(arcPositions.subarray(0, count * 3), arcColors.subarray(0, count * 3), arcWidths.subarray(0, count));

    const impactX = arcPositions[last * 3];
    const impactZ = arcPositions[last * 3 + 2];

    // the outer ring is exactly the blast radius - everything inside it dies - so it is drawn as a
    // solid unmoving boundary. The inner ring marks the impact point itself and stays a fixed small
    // size, and the four ticks straddle the boundary so the outer circle reads as a hard edge rather
    // than as decoration
    buildRing(outerRingPositions, impactX, impactZ, BLAST_RADIUS, 0);
    buildRing(innerRingPositions, impactX, impactZ, IMPACT_MARKER_RADIUS, 0);
    outerRingLine.set(outerRingPositions, ringColor, 2.5);
    innerRingLine.set(innerRingPositions, innerRingColor, 2.5);

    for (let i = 0; i < TICK_COUNT; i++) {
        const angle = (i / TICK_COUNT) * Math.PI * 2 + Math.PI * 0.25 + time * 0.35;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        for (let end = 0; end < 2; end++) {
            const radius = BLAST_RADIUS * (end === 0 ? 0.86 : 1.14);
            const x = impactX + cos * radius;
            const z = impactZ + sin * radius;
            const offset = (i * 2 + end) * 3;
            tickPositions[offset] = x;
            tickPositions[offset + 1] = terrainHeight(x, z) + 0.3;
            tickPositions[offset + 2] = z;
        }
        tickLines[i].set(tickPositions.subarray(i * 6, i * 6 + 6), ringColor, 2.5);
    }
};

/**
 * Points the catapult where the player is aiming.
 */
const updateCatapultAim = () => {
    catapult.setLocalEulerAngles(CATAPULT_TIP, 180 - aimYaw, 0);
};

/**
 * Starts the firing animation. The boulder itself is released partway through it.
 */
const fire = () => {
    if (gameOver || reloadTimer > 0) {
        return;
    }

    reloadTimer = reloadTime;
    shotsFired++;

    // the shot is locked in when the lever is pulled, so moving the pointer during the swing does
    // not bend the boulder's path. Several can be in the air at once, so each waits its own turn to
    // leave the arm
    pendingShots.push({
        delay: FIRE_RELEASE_TIME,
        position: launchPosition(new Vec3()),
        velocity: launchVelocity(new Vec3())
    });

    fireClock = 0;
};

/**
 * Poses the catapult for this moment of the shot. The swing runs at the speed it was authored at, and
 * only the wind back afterwards is stretched or squeezed to finish as the catapult becomes ready
 * again, so the throw is always readable no matter how fast the crew is reloading.
 *
 * @param {number} dt - The time step.
 */
const updateCatapultAnimation = (dt) => {
    if (fireClock < 0) {
        return;
    }

    fireClock += dt;

    let clipTime = fireClock;
    if (fireClock >= FIRE_THROW_END) {
        // the clip holds the arm at the top between the throw and the wind back, so skipping
        // straight from one to the other is not visible
        const winding = Math.min(1, (fireClock - FIRE_THROW_END) / Math.max(0.2, reloadTime - FIRE_THROW_END));
        clipTime = math.lerp(FIRE_RETURN_START, FIRE_ANIMATION_LENGTH, winding);
        if (winding >= 1) {
            fireClock = -1;
        }
    }

    // the layer is paused, so assigning the time scrubs the pose rather than starting playback
    catapult.anim.baseLayer.activeStateCurrentTime = clipTime;
};

/**
 * Clears the battlefield and starts again.
 */
const restart = () => {
    groups.length = 0;
    corpses.length = 0;
    freeSlots.length = 0;
    for (let i = 0; i < charCount; i++) {
        charState[i] = STATE_FREE;
        characters.setScale(i, 0);
    }
    charCount = 0;
    characters.count = 0;

    clearBoulders();

    score = 0;
    gameOver = false;
    reloadTimer = 0;
    fireClock = -1;

    // a fresh player gets the hint back
    shotsFired = 0;
    hintAlpha = 1;
    flashClock = -1;
    flashedScore = 0;

    // rebuild the machine and give the player its sights back
    overrunClock = -1;
    catapult.enabled = true;
    lineRenderer.enabled = true;

    spawnGroup();
};

const _rayStart = new Vec3();
const _rayEnd = new Vec3();
const _rayDirection = new Vec3();
const _aimPoint = new Vec3();
const _screenPoint = new Vec3();

/**
 * Finds where a ray meets the terrain, by walking forward until it passes below the surface and then
 * bisecting the step it crossed on. The terrain is a height field rather than a collision shape, so
 * this samples the same function everything else in the game uses.
 *
 * @param {Vec3} start - Where the ray starts.
 * @param {Vec3} direction - The normalized direction of the ray.
 * @param {Vec3} out - The vector to receive the hit point.
 * @returns {boolean} True if the ray hit the terrain.
 */
const raycastTerrain = (start, direction, out) => {
    const step = 4;
    const maxDistance = 500;
    let last = 0;

    for (let distance = step; distance <= maxDistance; distance += step) {
        const x = start.x + direction.x * distance;
        const y = start.y + direction.y * distance;
        const z = start.z + direction.z * distance;

        if (y <= terrainHeight(x, z)) {
            let above = last;
            let below = distance;
            for (let i = 0; i < 12; i++) {
                const middle = (above + below) * 0.5;
                const mx = start.x + direction.x * middle;
                const my = start.y + direction.y * middle;
                const mz = start.z + direction.z * middle;
                if (my > terrainHeight(mx, mz)) {
                    above = middle;
                } else {
                    below = middle;
                }
            }
            const hit = (above + below) * 0.5;
            out.set(start.x + direction.x * hit, start.y + direction.y * hit, start.z + direction.z * hit);
            return true;
        }

        last = distance;
    }

    return false;
};

/**
 * Aims at a point on the ground. The catapult releases at a fixed angle, so only the launch speed has
 * to be worked out.
 *
 * @param {Vec3} point - The point on the ground to land the shot on.
 */
const aimAtPoint = (point) => {
    // turn the machine towards the point. launchVelocity fires along (sin(aimYaw), -cos(aimYaw)), so
    // inverting that gives the angle
    const dx = point.x - CATAPULT_POSITION.x;
    const dz = point.z - CATAPULT_POSITION.z;
    aimYaw = math.clamp(Math.atan2(dx, -dz) * math.RAD_TO_DEG, -LAUNCH_YAW_RANGE, LAUNCH_YAW_RANGE);

    // for a fixed release angle, the speed needed to pass through a point at horizontal distance d and
    // relative height h is v = sqrt(g * d^2 / (2 * cos(pitch)^2 * (d * tan(pitch) - h)))
    launchPosition(launchPoint);
    const distance = Math.hypot(point.x - launchPoint.x, point.z - launchPoint.z);
    const rise = point.y - launchPoint.y;
    const pitch = LAUNCH_PITCH * math.DEG_TO_RAD;
    const cosPitch = Math.cos(pitch);
    const reach = distance * Math.tan(pitch) - rise;

    // beyond the angle's flat trajectory limit there is no solution, so ask for the shortest shot
    aimPower =
        reach > 0.01
            ? math.clamp(
                  Math.sqrt((GRAVITY * distance * distance) / (2 * cosPitch * cosPitch * reach)),
                  LAUNCH_POWER_MIN,
                  LAUNCH_POWER_MAX
              )
            : LAUNCH_POWER_MIN;
};

/**
 * Finds the point on the ground under a screen position, without touching the aim, so that a move can be
 * tried out and thrown away.
 *
 * @param {number} x - The screen x coordinate, in canvas pixels.
 * @param {number} y - The screen y coordinate, in canvas pixels.
 * @returns {boolean} True if the ground was hit, leaving the point in _aimPoint.
 */
const probeGround = (x, y) => {
    const component = camera.camera;
    component.screenToWorld(x, y, component.nearClip, _rayStart);
    component.screenToWorld(x, y, component.farClip, _rayEnd);
    _rayDirection.sub2(_rayEnd, _rayStart).normalize();

    return raycastTerrain(_rayStart, _rayDirection, _aimPoint);
};

/**
 * Aims at whatever the pointer is over, by raycasting the height field under it. The player therefore
 * points at a spot rather than learning what some arbitrary screen position means.
 *
 * @param {number} x - The pointer's x coordinate, in canvas pixels.
 * @param {number} y - The pointer's y coordinate, in canvas pixels.
 * @returns {boolean} True if the pointer was over the ground, false if it was pointed at the sky.
 */
const aimAt = (x, y) => {
    if (!probeGround(x, y)) {
        // pointing off the end of the world turns along the cursor's heading and throws as far as the
        // machine can
        aimYaw = math.clamp(
            Math.atan2(_rayDirection.x, -_rayDirection.z) * math.RAD_TO_DEG,
            -LAUNCH_YAW_RANGE,
            LAUNCH_YAW_RANGE
        );
        aimPower = LAUNCH_POWER_MAX;
        return false;
    }

    aimAtPoint(_aimPoint);
    return true;
};

/**
 * Finds the aim point for a screen position, falling back to where the ray crosses the valley floor when
 * it passes over the edge of the height field. On a narrow screen the sides of the valley are off the end
 * of the terrain from where the camera stands, and without this the aim stops well short of the ground a
 * mouse can reach - the pointer path has always turned along the ray in that case.
 *
 * @param {number} x - The screen x coordinate, in canvas pixels.
 * @param {number} y - The screen y coordinate, in canvas pixels.
 * @returns {boolean} True if an aim point was found, leaving it in _aimPoint.
 */
const probeAim = (x, y) => {
    if (probeGround(x, y)) {
        return true;
    }

    // a ray heading upwards is pointed at the sky, and there is nothing out there to aim at
    if (_rayDirection.y >= -0.001) {
        return false;
    }

    const along = -_rayStart.y / _rayDirection.y;
    const x0 = math.clamp(_rayStart.x + _rayDirection.x * along, TERRAIN_MIN_X, TERRAIN_MAX_X);
    const z0 = math.clamp(_rayStart.z + _rayDirection.z * along, TERRAIN_MIN_Z, TERRAIN_MAX_Z);
    _aimPoint.set(x0, terrainHeight(x0, z0), z0);
    return true;
};

/**
 * Puts the aim on a screen position, and pins it to the ground point found there. Pinning is what keeps
 * the shot and the ring together: solving the aim afresh every frame would slide it away as the camera
 * swings round to follow, which reads as the shot missing on its own. Nothing is changed if there is no
 * ground to be had, so a move can be tried and dropped.
 *
 * @param {number} x - The screen x coordinate, in canvas pixels.
 * @param {number} y - The screen y coordinate, in canvas pixels.
 * @returns {boolean} True if the aim was moved.
 */
const setTouchAim = (x, y) => {
    if (!probeAim(x, y)) {
        return false;
    }

    pointerX = x;
    pointerY = y;
    touchAiming = true;
    touchAimPoint.copy(_aimPoint);

    // solved right away rather than on the next frame, so that a touch ending immediately still fires the
    // shot it asked for instead of the one before it
    aimAtPoint(touchAimPoint);
    return true;
};

/**
 * Nudges the aim along by an amount of screen movement, from wherever it already is.
 *
 * @param {number} dx - How far to move it horizontally, in canvas pixels.
 * @param {number} dy - How far to move it vertically, in canvas pixels.
 */
const nudgeAim = (dx, dy) => {
    // the aim is carried as a screen position, so it has to be taken from where the pinned ground point
    // appears *now* - the camera will have swung since it was set, which moves it on screen
    if (touchAiming) {
        camera.camera.worldToScreen(touchAimPoint, _screenPoint);
        pointerX = _screenPoint.x;
        pointerY = _screenPoint.y;
    } else if (pointerX < 0) {
        pointerX = canvas.clientWidth * 0.5;
        pointerY = canvas.clientHeight * 0.5;
    }

    const x = math.clamp(pointerX + dx, 0, canvas.clientWidth - 1);
    const y = math.clamp(pointerY + dy, 0, canvas.clientHeight - 1);

    // A move that would take the aim off the battlefield and into the sky is dropped rather than applied,
    // which pins the reticle to the far end of the ground instead of letting it fly up into nothing. The
    // two axes are then tried on their own, so that an aim already pressed up against the far end can
    // still be slid sideways or brought back - dropping the whole move would strand it there.
    if (!setTouchAim(x, y) && !setTouchAim(x, pointerY)) {
        setTouchAim(pointerX, y);
    }
};

/**
 * Places the camera behind the machine, swung round and tilted towards wherever the pointer is, and
 * eased so that it trails the cursor rather than snapping to it.
 *
 * @param {number} dt - The time step.
 */
const updateCamera = (dt) => {
    const nx = math.clamp(pointerX / canvas.clientWidth, 0, 1);
    const ny = math.clamp(pointerY / canvas.clientHeight, 0, 1);

    const ease = Math.min(1, dt * CAMERA_EASE);
    cameraYaw = math.lerp(cameraYaw, (nx - 0.5) * 2 * CAMERA_YAW_RANGE, ease);
    cameraTilt = math.lerp(cameraTilt, smoothRamp(CAMERA_TILT_BOTTOM, CAMERA_TILT_TOP, ny), ease);

    // the same heading convention the shot uses, so the view turns the way the machine does
    const yaw = cameraYaw * math.DEG_TO_RAD;
    const forwardX = Math.sin(yaw);
    const forwardZ = -Math.cos(yaw);

    // orbiting the machine rather than the world origin keeps it in the same spot on screen as the
    // view swings around it
    camera.setLocalPosition(
        CATAPULT_POSITION.x - forwardX * CAMERA_DISTANCE,
        CATAPULT_POSITION.y + CAMERA_HEIGHT,
        CATAPULT_POSITION.z - forwardZ * CAMERA_DISTANCE
    );

    // and the point it looks at swings with it, lifting as the shot gets longer so that a distant
    // target sits in the middle of the frame instead of near the top of it
    _lookAt.set(
        CATAPULT_POSITION.x + forwardX * CAMERA_TARGET_DISTANCE,
        math.lerp(CAMERA_TARGET_LOW, CAMERA_TARGET_HIGH, cameraTilt),
        CATAPULT_POSITION.z + forwardZ * CAMERA_TARGET_DISTANCE
    );
    camera.lookAt(_lookAt);
};

/**
 * Jolts the camera by the current shake and lets it decay. Two sine waves at unrelated frequencies read
 * as a knock rather than as vibration, and displacing along the camera's own axes shakes the view in
 * screen space. This runs after the aim has been solved for the frame, so that a shaking view never
 * drags the point the player is aiming at around with it.
 *
 * @param {number} dt - The time step.
 */
const applyCameraShake = (dt) => {
    if (shake < 0.001) {
        return;
    }

    camera.translateLocal(Math.sin(time * 47) * shake, Math.sin(time * 59 + 1.7) * shake, 0);
    shake *= Math.max(0, 1 - SHAKE_DECAY * dt);
};

/**
 * Whether mouse input should be acted on, which it should not be when it is really a touch screen's
 * compatibility events arriving just after a tap.
 *
 * @returns {boolean} True if the event came from an actual mouse.
 */
const realMouse = () => time - lastTouchTime >= MOUSE_AFTER_TOUCH;

// the pointer is only sampled here - the aim itself is re-solved every frame, because the camera
// moves with it and the ground under the cursor moves with the camera
app.mouse.on('mousemove', (event) => {
    if (!realMouse()) {
        return;
    }

    pointerX = event.x;
    pointerY = event.y;

    // a mouse on a machine that also has a touch screen takes the aim back off the last touch
    touchAiming = false;
});
app.mouse.on('mousedown', () => {
    if (!realMouse()) {
        return;
    }

    if (gameOver) {
        restart();
    } else {
        fire();
    }
});

app.touch.on('touchstart', (event) => {
    lastTouchTime = time;

    // deliberately nothing but remembering where the finger went down. Whether this turns out to be a tap
    // at that spot or a drag from wherever the aim already is is not known until the finger either moves
    // or comes back up
    touchStartX = event.touches[0].x;
    touchStartY = event.touches[0].y;
    touchLastX = touchStartX;
    touchLastY = touchStartY;
    touchDragging = false;
});
app.touch.on('touchmove', (event) => {
    lastTouchTime = time;

    const touch = event.touches[0];

    // a finger never holds perfectly still, so a little wander is left alone and still counts as a tap.
    // Once past that it is a drag, and the movement so far is spent on the aim rather than thrown away
    if (!touchDragging && Math.hypot(touch.x - touchStartX, touch.y - touchStartY) < TOUCH_TAP_SLOP) {
        return;
    }
    touchDragging = true;

    nudgeAim((touch.x - touchLastX) * TOUCH_AIM_GAIN, (touch.y - touchLastY) * TOUCH_AIM_GAIN);
    touchLastX = touch.x;
    touchLastY = touch.y;
});
app.touch.on('touchend', () => {
    lastTouchTime = time;

    if (gameOver) {
        restart();
        return;
    }

    // a tap shoots at the spot it landed on, which is the quickest way to answer a formation that has just
    // walked into the open. A drag has already placed the aim, so it fires wherever that ended up
    if (!touchDragging) {
        setTouchAim(touchStartX, touchStartY);
    }

    fire();
});

// --------------------------------------------------------------------------------------------
// the heads up display

// The readouts sit low and centered rather than in the top corners. In the examples browser the top
// left is under the description panel and the top right is under the controls, and the bottom corners
// hold the frame counter and the asset credits - the band just above the middle of the bottom edge is
// the only part of the frame that is reliably clear.
const PANEL_WIDTH = 520;
const PANEL_HEIGHT = 84;
const PANEL_CORNER = 14;

// clear of the asset credits, which the examples browser prints along the bottom edge
const PANEL_BOTTOM = 100;
const HINT_BOTTOM = 68;

// the hint has done its job once the player has fired a few times, so it fades away rather than sitting
// there for the rest of the game
const HINT_SHOTS = 3;
const HINT_FADE = 3;

// how long a wiped out formation is called out for
const FLASH_DURATION = 1.4;

const COLOR_READOUT = new Color(1, 0.95, 0.85);
const COLOR_ALERT = new Color(1, 0.38, 0.26);
const COLOR_CHARGING = new Color(1, 0.62, 0.2);
const COLOR_READY = new Color(0.62, 0.95, 0.62);
const _readoutColor = new Color();

const screen = new Entity('Hud');
screen.addComponent('screen', {
    referenceResolution: new Vec2(1280, 720),
    scaleBlend: 0.5,
    scaleMode: SCALEMODE_BLEND,
    screenSpace: true
});
app.root.addChild(screen);

/**
 * Builds the rounded, softly shaded panel the readouts sit on. It is generated at exactly the size it
 * is drawn at, so the corners stay crisp instead of being stretched, and it is white so that the
 * element color is free to tint it.
 *
 * @param {number} width - The width in pixels.
 * @param {number} height - The height in pixels.
 * @param {number} radius - The corner radius in pixels.
 * @returns {Texture} The panel texture.
 */
const createPanelTexture = (width, height, radius) => {
    const pixels = new Uint8Array(width * height * 4);

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            // how far outside the rounded rectangle this pixel is, which is the distance to the corner
            // circle once it is past both of the straight edges
            const dx = Math.max(radius - x, x - (width - 1 - radius), 0);
            const dy = Math.max(radius - y, y - (height - 1 - radius), 0);
            const outside = Math.hypot(dx, dy) - radius;
            const edge = math.clamp(0.5 - outside, 0, 1);

            // heavier along the bottom, so the panel reads as lit from above rather than as a flat card
            const shade = 0.72 + 0.28 * (y / (height - 1));
            const alpha = Math.round(255 * edge * shade);
            const offset = (y * width + x) * 4;

            // premultiplied white, which is what the element material expects
            pixels[offset] = alpha;
            pixels[offset + 1] = alpha;
            pixels[offset + 2] = alpha;
            pixels[offset + 3] = alpha;
        }
    }

    const texture = new Texture(app.graphicsDevice, {
        name: 'HudPanel',
        width: width,
        height: height,
        format: PIXELFORMAT_RGBA8,
        mipmaps: false,
        minFilter: FILTER_LINEAR,
        magFilter: FILTER_LINEAR,
        addressU: ADDRESS_CLAMP_TO_EDGE,
        addressV: ADDRESS_CLAMP_TO_EDGE,
        levels: [pixels]
    });
    texture.upload();
    return texture;
};

/**
 * Adds a block of color to the display. Children are drawn in the order they are added, so the
 * backdrop goes in first and the text on top of it.
 *
 * @param {Vec4} anchor - Where on the screen it is anchored.
 * @param {number} x - The horizontal offset from the anchor.
 * @param {number} y - The vertical offset from the anchor.
 * @param {number} width - The width of the block.
 * @param {number} height - The height of the block.
 * @param {Color} color - The color of the block.
 * @param {number} opacity - How solid the block is.
 * @param {Texture|null} [texture] - An optional shape to draw instead of a plain rectangle.
 * @returns {Entity} The image entity.
 */
const addImage = (anchor, x, y, width, height, color, opacity, texture = null) => {
    const entity = new Entity('Image');
    entity.addComponent('element', {
        anchor: anchor,
        pivot: new Vec2(0.5, 0.5),
        width: width,
        height: height,
        color: color,
        opacity: opacity,
        texture: texture ?? undefined,
        type: ELEMENTTYPE_IMAGE
    });
    entity.setLocalPosition(x, y, 0);
    screen.addChild(entity);
    return entity;
};

/**
 * Adds a line of text to the display.
 *
 * @param {Vec4} anchor - Where on the screen it is anchored.
 * @param {Vec2} pivot - Which of its own corners sits on the anchor.
 * @param {number} x - The horizontal offset from the anchor.
 * @param {number} y - The vertical offset from the anchor.
 * @param {number} fontSize - The size of the text.
 * @param {number} [spacing] - How far the letters are tracked apart.
 * @returns {Entity} The text entity.
 */
const addText = (anchor, pivot, x, y, fontSize, spacing = 1) => {
    const entity = new Entity('Text');
    entity.addComponent('element', {
        anchor: anchor,
        pivot: pivot,
        fontAsset: assets.font.id,
        fontSize: fontSize,
        spacing: spacing,
        text: '',
        color: COLOR_READOUT,
        outlineColor: new Color(0, 0, 0, 0.9),
        outlineThickness: 0.6,
        type: ELEMENTTYPE_TEXT
    });
    entity.setLocalPosition(x, y, 0);
    screen.addChild(entity);
    return entity;
};

const BOTTOM = new Vec4(0.5, 0, 0.5, 0);
const MIDDLE = new Vec4(0.5, 0.5, 0.5, 0.5);
const CENTER = new Vec2(0.5, 0.5);
const COLUMN = PANEL_WIDTH * 0.25;

// the whole screen is dipped in a dark red as the machine goes up, which sells the ending far better
// than the banner alone. It goes in first so that everything else stays legible on top of it
const scrim = addImage(new Vec4(0, 0, 1, 1), 0, 0, 0, 0, new Color(0.1, 0.01, 0), 0);
scrim.element.margin = new Vec4(0, 0, 0, 0);
scrim.enabled = false;

addImage(
    BOTTOM,
    0,
    PANEL_BOTTOM + PANEL_HEIGHT * 0.5,
    PANEL_WIDTH,
    PANEL_HEIGHT,
    new Color(0.02, 0.02, 0.03),
    0.42,
    createPanelTexture(PANEL_WIDTH, PANEL_HEIGHT, PANEL_CORNER)
);

// a hairline between the two readouts, and the reload track along the foot of the panel
addImage(BOTTOM, 0, PANEL_BOTTOM + 48, 1, 46, Color.WHITE, 0.14);
addImage(BOTTOM, 0, PANEL_BOTTOM + 12, PANEL_WIDTH - 60, 3, Color.WHITE, 0.14);
const reloadFill = addImage(BOTTOM, 0, PANEL_BOTTOM + 12, PANEL_WIDTH - 60, 3, COLOR_READY, 0.9);
reloadFill.element.pivot = new Vec2(0, 0.5);
reloadFill.setLocalPosition(-(PANEL_WIDTH - 60) * 0.5, PANEL_BOTTOM + 12, 0);

// each readout is a quiet tracked label with the number itself carrying the weight. The tracking has to
// stay modest - it multiplies the advance of every glyph, so a wide setting runs the two labels together
const scoreLabel = addText(BOTTOM, CENTER, -COLUMN, PANEL_BOTTOM + 62, 12, 1.6);
const statusLabel = addText(BOTTOM, CENTER, COLUMN, PANEL_BOTTOM + 62, 12, 1.6);
const scoreText = addText(BOTTOM, CENTER, -COLUMN, PANEL_BOTTOM + 34, 32);
const statusText = addText(BOTTOM, CENTER, COLUMN, PANEL_BOTTOM + 34, 32);
scoreLabel.element.text = 'GROUPS DESTROYED';
statusLabel.element.text = 'ENEMIES LEFT';
scoreLabel.element.opacity = 0.55;
statusLabel.element.opacity = 0.55;

// the tally is a warm gold, leaving plain white to the count that turns red as the enemy closes in
scoreText.element.color = new Color(1, 0.86, 0.6);

const messageText = addText(BOTTOM, CENTER, 0, HINT_BOTTOM, 20);
const flashText = addText(BOTTOM, CENTER, 0, PANEL_BOTTOM + PANEL_HEIGHT + 26, 22, 2.4);
flashText.element.color = new Color(1, 0.78, 0.35);

// the game over banner, spread across the middle of the screen
const bannerText = addText(MIDDLE, CENTER, 0, 0, 90, 1.5);
bannerText.element.color = COLOR_ALERT;

// --------------------------------------------------------------------------------------------
// the game

/**
 * How many enemies are still on their feet and coming.
 *
 * @returns {number} The number of marching characters.
 */
const enemyCount = () => {
    let count = 0;
    for (let i = 0; i < groups.length; i++) {
        count += groups[i].members.length;
    }
    return count;
};

/**
 * How far up the valley the closest formation has come.
 *
 * @returns {number} The z of the nearest formation, or the spawn line if the valley is empty.
 */
const nearestGroupZ = () => {
    let z = SPAWN_Z;
    for (let i = 0; i < groups.length; i++) {
        z = Math.max(z, groups[i].z);
    }
    return z;
};

/**
 * Refreshes the display. Everything here is driven off the game state rather than being set when it
 * changes, which keeps the fades and the countdowns in one place.
 *
 * @param {number} dt - The time step.
 */
const updateHud = (dt) => {
    scoreText.element.text = `${score}`;
    statusText.element.text = `${enemyCount()}`;

    // the enemy count runs from bone white to alarm red as the nearest formation closes on the machine,
    // so the number itself carries the warning
    _readoutColor.lerp(COLOR_READOUT, COLOR_ALERT, smoothRamp(BREACH_Z - 60, BREACH_Z, nearestGroupZ()));
    statusText.element.color = _readoutColor;

    // the track fills as the crew winds the arm back, and sits full and green while a shot is ready
    const charge = reloadTimer > 0 ? 1 - reloadTimer / Math.max(0.001, reloadTime) : 1;
    reloadFill.element.width = Math.max(1, (PANEL_WIDTH - 60) * charge);
    reloadFill.element.color = charge >= 1 ? COLOR_READY : COLOR_CHARGING;

    // a formation going down is called out above the panel, drifting up as it fades
    if (score !== flashedScore) {
        flashedScore = score;
        flashClock = 0;
        flashText.element.text = 'FORMATION DESTROYED';
    }
    if (flashClock >= 0) {
        flashClock += dt;
        const left = 1 - flashClock / FLASH_DURATION;
        flashText.element.opacity = math.clamp(left * 2.5, 0, 1);
        flashText.setLocalPosition(0, PANEL_BOTTOM + PANEL_HEIGHT + 26 + (1 - left) * 16, 0);
        if (left <= 0) {
            flashClock = -1;
            flashText.element.text = '';
        }
    }

    // the banner waits until the machine has actually gone, so it does not cover the explosion, and
    // then settles into place as the screen dips into red
    const ending = overrunClock >= OVERRUN_EXPLOSION_DURATION * 0.35;
    bannerText.element.text = ending ? 'OVERRUN' : '';
    scrim.enabled = ending;
    if (ending) {
        const enter = math.clamp((overrunClock - OVERRUN_EXPLOSION_DURATION * 0.35) / 0.4, 0, 1);
        const eased = 1 - (1 - enter) * (1 - enter);
        const scale = math.lerp(1.4, 1, eased);
        bannerText.setLocalScale(scale, scale, 1);
        bannerText.element.opacity = eased;
        scrim.element.opacity = eased * 0.5;
    }

    // the hint retires once the player has clearly got the idea, but the restart prompt always shows
    let message = 'Move to aim, click to fire';
    let visible = shotsFired < HINT_SHOTS ? 1 : 0;
    if (gameOver) {
        message = 'Click to try again';
        visible = 1;
    }
    hintAlpha = math.lerp(hintAlpha, visible, math.clamp(dt * HINT_FADE, 0, 1));
    messageText.element.text = message;
    messageText.element.opacity = hintAlpha;
};

/**
 * Marches every formation towards the catapult and lays out its members.
 *
 * @param {number} dt - The time step.
 */
const updateGroups = (dt) => {
    for (let g = groups.length - 1; g >= 0; g--) {
        const group = groups[g];

        // a wiped out formation is replaced by several more, which is what makes the battle grow
        if (group.members.length === 0) {
            groups.splice(g, 1);
            reindexGroups();
            score++;
            for (let i = 0; i < GROUPS_PER_KILL; i++) {
                spawnGroup();
            }
            continue;
        }

        // head for the catapult
        let dirX = -group.x;
        let dirZ = -group.z;
        const length = Math.max(0.001, Math.hypot(dirX, dirZ));
        dirX /= length;
        dirZ /= length;

        group.x += dirX * group.speed * dt;
        group.z += dirZ * group.speed * dt;

        // the first formation to reach the machine overruns it, and that is the end of the game. The
        // fireball is the machine going up, not a weapon - it takes nobody with it
        if (group.z > BREACH_Z) {
            gameOver = true;
            clearBoulders();
            spawnFlash(
                CATAPULT_POSITION.x,
                CATAPULT_POSITION.y + 1.5,
                CATAPULT_POSITION.z,
                OVERRUN_EXPLOSION_SIZE,
                OVERRUN_EXPLOSION_DURATION
            );

            overrunClock = 0;
            return;
        }

        const heading = Math.atan2(dirX, dirZ) * math.RAD_TO_DEG;
        const members = group.members;

        for (let i = 0; i < members.length; i++) {
            const index = members[i];

            // a slow sway per character stops the formation from looking like a rigid grid
            const sway = Math.sin(time * 2.2 + charPhase[index]) * 0.4;
            const x = group.x + charFormation[index * 2] + sway;
            const z = group.z + charFormation[index * 2 + 1];

            charPos[index * 3] = x;
            charPos[index * 3 + 1] = terrainHeight(x, z);
            charPos[index * 3 + 2] = z;

            _position.set(x, charPos[index * 3 + 1], z);
            characters.setPosition(index, _position);
            characters.setEulerAngles(index, 0, heading, 0);
        }
    }

    // formations that walk past the catapult are removed without being replaced, so the valley can
    // end up empty if they are simply let through. Send another one rather than stall the game
    if (groups.length === 0) {
        spawnGroup();
    }
};

/**
 * Flies every character thrown by a blast, and lays it down where it lands.
 *
 * @param {number} dt - The time step.
 */
const updateFlying = (dt) => {
    for (let i = 0; i < charCount; i++) {
        if (charState[i] !== STATE_FLYING) {
            continue;
        }

        charVel[i * 3 + 1] -= GRAVITY * dt;

        const x = charPos[i * 3] + charVel[i * 3] * dt;
        const y = charPos[i * 3 + 1] + charVel[i * 3 + 1] * dt;
        const z = charPos[i * 3 + 2] + charVel[i * 3 + 2] * dt;

        charPos[i * 3] = x;
        charPos[i * 3 + 1] = y;
        charPos[i * 3 + 2] = z;

        if (y <= terrainHeight(x, z)) {
            landCharacter(i);
            continue;
        }

        charTumble[i * 3] += charSpin[i * 3] * dt;
        charTumble[i * 3 + 1] += charSpin[i * 3 + 1] * dt;
        charTumble[i * 3 + 2] += charSpin[i * 3 + 2] * dt;

        _position.set(x, y, z);
        characters.setPosition(i, _position);
        characters.setEulerAngles(i, charTumble[i * 3], charTumble[i * 3 + 1], charTumble[i * 3 + 2]);
    }
};

/**
 * Flies the boulders and blows them up where they land.
 *
 * @param {number} dt - The time step.
 */
const updateBoulders = (dt) => {
    boulders.forEach((boulder) => {
        if (!boulder.active) {
            return;
        }

        // integrated the same exact way the predicted arc is, so the boulder lands on the reticle
        boulder.position.add(_step.copy(boulder.velocity).mulScalar(dt));
        boulder.position.y -= 0.5 * GRAVITY * dt * dt;
        boulder.velocity.y -= GRAVITY * dt;

        const { x, y, z } = boulder.position;
        const ground = terrainHeight(x, z);

        if (y <= ground || Math.abs(x) > TERRAIN_MAX_X || z < TERRAIN_MIN_Z || z > TERRAIN_MAX_Z) {
            boulder.active = false;
            boulder.entity.enabled = false;
            explode(x, Math.max(y, ground), z);
            return;
        }

        boulder.entity.setLocalPosition(boulder.position);

        // the rock tumbles as it flies, which makes it read as a lump of burning rock rather than
        // a sphere sliding along a curve
        boulder.entity.rotateLocal(360 * dt, 180 * dt, 0);
    });
};

/**
 * Fades out the blast flashes.
 *
 * @param {number} dt - The time step.
 */
const updateExplosions = (dt) => {
    explosions.forEach((explosion) => {
        if (explosion.age < 0) {
            return;
        }

        explosion.age += dt;
        const t = explosion.age / explosion.duration;
        if (t >= 1) {
            explosion.age = -1;
            explosion.entity.enabled = false;
            return;
        }

        // the fireball punches out to almost its full size straight away and then dims as it hangs
        // there, rather than swelling gently, which is what makes it read as a detonation
        const size = math.lerp(3, explosion.size, 1 - (1 - t) * (1 - t));
        explosion.entity.setLocalScale(size, size, size);
        explosion.light.light.range = explosion.size * 4;
        explosion.light.light.intensity = 40 * (explosion.size / EXPLOSION_SIZE) * (1 - t) * (1 - t);
    });
};

app.on('update', (dt) => {
    time += dt;

    // drift the sun round and back, which sweeps the shafts and the long shadows across the valley
    const sweep = 0.5 - 0.5 * Math.cos((time / LIGHT_SWEEP_PERIOD) * Math.PI * 2);
    skyScript.azimuth = LIGHT_AZIMUTH + sweep * LIGHT_SWEEP;

    // The camera moves first and the aim is then solved against the pose it ended up in, so the two
    // settle together on the state where the reticle sits exactly under a stationary cursor.
    //
    // The camera is placed every frame even once the game is over, both so the machine blowing up can
    // shake it and because the shake displaces it - without being put back each frame the jolts would
    // accumulate and walk the camera away.
    updateCamera(dt);

    if (!gameOver) {
        if (touchAiming) {
            // pinned to the ground the finger picked, so that the camera can swing round to it without
            // dragging the shot along with it
            aimAtPoint(touchAimPoint);
        } else {
            if (pointerX < 0) {
                pointerX = canvas.clientWidth * 0.5;
                pointerY = canvas.clientHeight * 0.5;
            }
            aimAt(pointerX, pointerY);
        }
    }

    updateCatapultAim();
    updateCatapultAnimation(dt);

    if (overrunClock >= 0) {
        overrunClock += dt;

        // the wrecked machine leaves while the fireball is at its widest and covering it, along with
        // the aiming graphics - an arc reaching out of empty ground would just look broken
        if (overrunClock >= OVERRUN_EXPLOSION_DURATION * 0.35) {
            catapult.enabled = false;
            lineRenderer.enabled = false;
        }

        // and once the flames are out the army goes too, rather than being left jogging on the spot.
        // The crowd is a single instanced draw, so hiding all of it is one assignment
        if (overrunClock >= OVERRUN_EXPLOSION_DURATION) {
            characters.count = 0;
        }
    }

    if (lineRenderer.enabled) {
        updateTargeting();
    }

    // release each boulder partway through the swing of the arm that threw it
    for (let i = pendingShots.length - 1; i >= 0; i--) {
        const shot = pendingShots[i];
        shot.delay -= dt;
        if (shot.delay <= 0) {
            launchBoulder(shot.position, shot.velocity);
            pendingShots.splice(i, 1);
        }
    }

    if (reloadTimer > 0) {
        reloadTimer -= dt;
    }

    if (app.keyboard.wasPressed(KEY_SPACE)) {
        if (gameOver) {
            restart();
        } else {
            fire();
        }
    }

    if (!gameOver) {
        updateGroups(dt);
    }
    updateFlying(dt);
    updateBoulders(dt);
    updateExplosions(dt);

    // last, so that a blast landing this frame is felt on this frame, and after the aim was solved
    applyCameraShake(dt);

    updateHud(dt);
});

// --------------------------------------------------------------------------------------------
// control panel

data.set('data', {
    reloadTime: RELOAD_TIME_DEFAULT,
    shadows: EFFECTS_ON,
    volumetricFog: EFFECTS_ON,
    fogSteps: FOG_STEPS_DEFAULT,
    boulderLights: EFFECTS_ON
});

data.on('data.reloadTime:set', (value) => {
    reloadTime = value;
});

data.on('data.shadows:set', (value) => {
    // the whole shadow pass goes with it, as the sun is the only light in the scene that casts. The
    // volumetric fog checks the light every frame and drops its shadow sampling to match, so the shafts
    // turn into an even haze rather than disappearing
    sun.light.castShadows = value;
});

data.on('data.volumetricFog:set', (value) => {
    cameraFrame.volumetricFog.enabled = value;

    // the fog settings are only pushed to the render pass by update(), so changing one without
    // calling it has no effect at all
    cameraFrame.update();
});

data.on('data.fogSteps:set', (value) => {
    cameraFrame.volumetricFog.steps = value;
    cameraFrame.update();
});

data.on('data.boulderLights:set', (value) => {
    boulders.forEach((boulder) => {
        boulder.light.enabled = value;
    });
});

restart();
