// @config
//
// The PlayCanvas cube says hello. Drag to orbit the camera, scroll to zoom.

import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    CULLFACE_FRONT,
    CameraComponentSystem,
    CameraFrame,
    Color,
    Entity,
    FILLMODE_FILL_WINDOW,
    FOG_EXP2,
    Geometry,
    JsonHandler,
    LAYERID_UI,
    LAYERID_WORLD,
    LIGHTFALLOFF_INVERSESQUARED,
    LIGHTSHAPE_RECT,
    Layer,
    LightComponentSystem,
    Mesh,
    MeshInstance,
    Mouse,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    RoundedBoxGeometry,
    SHADOW_PCF5_32F,
    ScriptComponentSystem,
    StandardMaterial,
    TEXTURETYPE_RGBP,
    TONEMAP_NEUTRAL,
    TextureHandler,
    TouchDevice,
    Vec2,
    Vec3,
    createGraphicsDevice,
    math
} from 'playcanvas';
import { CameraControls } from 'playcanvas/scripts/esm/camera-controls.mjs';
import { PlanarRenderer } from 'playcanvas/scripts/esm/planar-renderer.mjs';

import { deviceType } from 'examples/context';

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
createOptions.resourceHandlers = [TextureHandler, JsonHandler];

const app = new AppBase(canvas);
app.init(createOptions);

// Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
app.setCanvasFillMode(FILLMODE_FILL_WINDOW);
app.setCanvasResolution(RESOLUTION_AUTO);

// Ensure canvas is resized when window changes size
const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => window.removeEventListener('resize', resize));

// The assets: a small, prefiltered studio environment, which lights the scene and gives the
// materials their reflections, and the lookup tables the area lights are evaluated with
const envAtlas = new Asset(
    'env-atlas',
    'texture',
    { url: './assets/cubemaps/studio-env-atlas.png' },
    { type: TEXTURETYPE_RGBP, mipmaps: false }
);
const luts = new Asset('luts', 'json', { url: './assets/json/area-light-luts.json' });
await new Promise((resolve) => {
    new AssetListLoader([envAtlas, luts], app.assets).load(resolve);
});

app.start();

// ----- The studio -----

// A dark studio. The floor fades into the backdrop with the distance, so there is no horizon.
const BACKGROUND = '#263034';

// The environment lights the scene and gives the materials their reflections. The cameras do not
// render the skybox layer, so it is not visible.
app.scene.envAtlas = envAtlas.resource;
app.scene.skyboxIntensity = 0.25;

app.scene.fog.type = FOG_EXP2;
app.scene.fog.color = new Color().fromString(BACKGROUND);
app.scene.fog.density = 0.035;

// The floor is on its own layer, rendered by the main camera but not by the reflection camera, as
// the floor cannot be in its own reflection
const worldLayer = app.scene.layers.getLayerById(LAYERID_WORLD);
const floorLayer = new Layer({ name: 'Floor' });
app.scene.layers.insert(floorLayer, 1);

/**
 * Creates a material.
 *
 * @param {string} color - The color, as a hex string.
 * @param {number} gloss - The glossiness, 0-1 range.
 * @returns {StandardMaterial} The material.
 */
const createMaterial = (color, gloss) => {
    const material = new StandardMaterial();
    material.diffuse = new Color().fromString(color);
    material.useMetalness = true;
    material.metalness = 0;
    material.gloss = gloss;
    material.update();
    return material;
};

/**
 * Creates an entity rendering a primitive shape.
 *
 * @param {'plane'|'sphere'} type - The type of the shape.
 * @param {StandardMaterial} material - The material.
 * @param {Entity} parent - The parent entity.
 * @returns {Entity} The entity.
 */
const createShape = (type, material, parent) => {
    const entity = new Entity(type);
    entity.addComponent('render', { type, material });
    parent.addChild(entity);
    return entity;
};

// The dark glossy floor reflects the cube. It only receives shadows, which keeps the shadow map
// focused on the cube.
const floorMaterial = createMaterial(BACKGROUND, 0.93);

const floor = createShape('plane', floorMaterial, app.root);
floor.render.layers = [floorLayer.id];
floor.render.castShadows = false;
floor.setLocalScale(200, 1, 200);

// The backdrop is a large sphere around the studio, far enough to take the color of the fog, the
// same color the floor fades to in the distance
const backdropMaterial = new StandardMaterial();
backdropMaterial.useLighting = false;
backdropMaterial.cull = CULLFACE_FRONT;
backdropMaterial.update();

const backdrop = createShape('sphere', backdropMaterial, app.root);
backdrop.render.castShadows = false;
backdrop.setLocalScale(120, 120, 120);

// ----- The cube -----

// The root of the cube moves it around, and its body squashes and stretches. The body is a rounded
// box, with its pivot at the bottom face, so it squashes against the floor.
const cube = new Entity('Cube');
app.root.addChild(cube);

// The orange gradient of the PlayCanvas logo, from the bottom to the top of the cube, stored in
// the vertex colors. The colors are in the sRGB space, which the material converts to linear.
const bodyGeometry = new RoundedBoxGeometry({ radius: 0.22, radiusSegments: 12, yOffset: 0.5 });
const bottomColor = new Color().fromString('#ffab45');
const topColor = new Color().fromString('#f06530');
const gradient = new Color();
const colors = [];
for (let i = 1; i < bodyGeometry.positions.length; i += 3) {
    gradient.lerp(bottomColor, topColor, bodyGeometry.positions[i]);
    colors.push(gradient.r * 255, gradient.g * 255, gradient.b * 255, 255);
}
bodyGeometry.colors = colors;

// A glossy candy-like coat over the orange
const bodyMaterial = createMaterial('#ffffff', 0.75);
bodyMaterial.diffuseVertexColor = true;
bodyMaterial.vertexColorGamma = true;
bodyMaterial.clearCoat = 0.6;
bodyMaterial.clearCoatGloss = 0.9;
bodyMaterial.update();

const body = new Entity('Body');
body.addComponent('render', { type: 'asset' });
body.render.meshInstances = [new MeshInstance(Mesh.fromGeometry(device, bodyGeometry), bodyMaterial, body)];
cube.addChild(body);

// The PlayCanvas logo mark: two chevrons, the lower one the upper one turned upside down. The
// points of the upper chevron are in pixels of the 512 pixel logo, from its center, with y up.
const CHEVRON = [
    [-76, 127],
    [76, 51],
    [-76, -25],
    [-76, 12],
    [2, 51],
    [-76, 90]
];

/**
 * Creates the mesh of the logo mark, facing +Z and raised from the surface it sits on.
 *
 * @param {number} size - The size of the logo the mark is a part of.
 * @param {number} depth - How far the mark is raised.
 * @returns {Mesh} The mesh.
 */
const createLogoMesh = (size, depth) => {
    const positions = [];
    const normals = [];
    const indices = [];

    [1, -1].forEach((sign) => {
        const points = CHEVRON.map(([x, y]) => [(sign * x * size) / 512, (sign * y * size) / 512]);

        // the front face, as the two arms of the chevron. The points go clockwise, so the triangles
        // list them in reverse.
        const front = positions.length / 3;
        points.forEach(([x, y]) => {
            positions.push(x, y, depth);
            normals.push(0, 0, 1);
        });
        [0, 4, 1, 0, 5, 4, 1, 3, 2, 1, 4, 3].forEach((i) => indices.push(front + i));

        // a wall along each edge, facing out
        points.forEach(([x0, y0], i) => {
            const [x1, y1] = points[(i + 1) % points.length];
            const length = Math.hypot(x1 - x0, y1 - y0);
            const wall = positions.length / 3;
            positions.push(x0, y0, 0, x1, y1, 0, x1, y1, depth, x0, y0, depth);
            for (let j = 0; j < 4; j++) {
                normals.push((y0 - y1) / length, (x1 - x0) / length, 0);
            }
            indices.push(wall, wall + 2, wall + 1, wall, wall + 3, wall + 2);
        });
    });

    const geometry = new Geometry();
    geometry.positions = positions;
    geometry.normals = normals;
    geometry.indices = indices;
    return Mesh.fromGeometry(device, geometry);
};

// The logo on the top, back and sides of the cube, its face on the front
const logoMesh = createLogoMesh(1, 0.04);
const logoMaterial = createMaterial('#fffaf5', 0.7);

// The logo mark glows, brighter than white, so the bloom spreads its light around it
logoMaterial.emissive = new Color().fromString('#fff2e6');
logoMaterial.emissiveIntensity = 8;
logoMaterial.update();
[
    { position: [0.5, 0.5, 0], angles: [0, 90, 0] },
    { position: [-0.5, 0.5, 0], angles: [0, -90, 0] },
    { position: [0, 0.5, -0.5], angles: [0, 180, 0] },
    { position: [0, 1, 0], angles: [-90, 0, 0] }
].forEach(({ position, angles }) => {
    const logo = new Entity('Logo');
    logo.addComponent('render', { type: 'asset' });
    logo.render.meshInstances = [new MeshInstance(logoMesh, logoMaterial, logo)];
    logo.setLocalPosition(position[0], position[1], position[2]);
    logo.setLocalEulerAngles(angles[0], angles[1], angles[2]);
    body.addChild(logo);
});

// Two eyes with a sparkle, and rosy cheeks, on the front face. They are parented to the body, so they
// squash with it. The pupils are only moderately glossy, so the lights do not leave thin, flickering
// highlights along their edges, the sparkle gives them their shine.
const pupilMaterial = createMaterial('#2b2233', 0.5);
const cheekMaterial = createMaterial('#ff6f7d', 0.4);
const sparkleMaterial = new StandardMaterial();
sparkleMaterial.useLighting = false;
sparkleMaterial.emissive = Color.WHITE;
sparkleMaterial.update();

const eyes = [-1, 1].map((side) => {
    const eye = new Entity('Eye');
    eye.setLocalPosition(side * 0.17, 0.6, 0.5);
    body.addChild(eye);

    const pupil = createShape('sphere', pupilMaterial, eye);
    pupil.setLocalScale(0.12, 0.17, 0.06);

    const sparkle = createShape('sphere', sparkleMaterial, eye);
    sparkle.render.castShadows = false;
    sparkle.setLocalPosition(0.02, 0.035, 0.028);
    sparkle.setLocalScale(0.035, 0.035, 0.01);

    const cheek = createShape('sphere', cheekMaterial, body);
    cheek.setLocalPosition(side * 0.3, 0.42, 0.495);
    cheek.setLocalScale(0.13, 0.07, 0.02);
    return eye;
});

// The cube casts its shadows on the floor, but does not receive shadows. It is rounded and convex, so
// it could only shadow the sides facing away from the lights, which the lighting already darkens,
// and the filtered shadows would flicker along its curved lower edges as it squashes.
cube.forEach((node) => {
    const render = /** @type {Entity} */ (node).render;
    if (render) {
        render.receiveShadows = false;
    }
});

// ----- Lights and cameras -----

// Two tall softboxes behind the cube outline it with rim highlights, and glow in the floor. Each is
// a rectangular area light, a spot light shaped as a rectangle that shines in a cone towards the
// cube, and a glowing rectangle showing it. The lights are clustered, which supports area
// lights once enabled.
const areaLuts = /** @type {{ LTC_MAT_1: number[], LTC_MAT_2: number[] }} */ (luts.resource);
app.setAreaLightLuts(areaLuts.LTC_MAT_1, areaLuts.LTC_MAT_2);
app.scene.lighting.areaLightsEnabled = true;

// Both softboxes are rectangles, so the shaders of the materials compile no disk and sphere light
// code, which makes them faster to compile
app.scene.lighting.areaLightDiskEnabled = false;
app.scene.lighting.areaLightSphereEnabled = false;

// The shadows of the softboxes use the wide filter, and an atlas large enough for their edges to stay
// smooth where they cross the bright highlights of the softboxes on the floor
app.scene.lighting.shadowType = SHADOW_PCF5_32F;
app.scene.lighting.shadowAtlasResolution = 2048;

// one slightly teal, one slightly warm
[
    { position: new Vec3(-1.9, 1.3, -1.8), color: new Color(0.75, 1, 0.95) },
    { position: new Vec3(2, 1.3, -1.5), color: new Color(1, 0.86, 0.72) }
].forEach(({ position, color }) => {
    // the softbox faces the cube along its -Z axis
    const softbox = new Entity('Softbox');
    app.root.addChild(softbox);
    softbox.setPosition(position);
    softbox.lookAt(0, position.y, 0);

    // the light shines down its -Y axis, turned to the -Z axis of the softbox, its size scaled in X and Z
    const softboxLight = new Entity('SoftboxLight');
    softboxLight.addComponent('light', {
        type: 'spot',
        shape: LIGHTSHAPE_RECT,
        falloffMode: LIGHTFALLOFF_INVERSESQUARED,
        color,
        intensity: 6,
        range: 10,
        innerConeAngle: 40,
        outerConeAngle: 60,
        layers: [worldLayer.id, floorLayer.id],

        // shadows, rendered from the center of the light by a camera with a field of view of twice
        // the outer cone angle, which needs to stay well below 90 degrees. They also hide the
        // highlight of the softbox on the floor where the cube blocks it, so it does not show over
        // the reflection of the cube.
        castShadows: true,
        shadowBias: 0.2,
        normalOffsetBias: 0.05
    });
    softboxLight.setLocalEulerAngles(90, 0, 0);
    softboxLight.setLocalScale(0.5, 1, 2);
    softbox.addChild(softboxLight);

    // the glowing rectangle, its +Y axis turned to the -Z axis of the softbox
    const glowMaterial = new StandardMaterial();
    glowMaterial.diffuse = Color.BLACK;
    glowMaterial.emissive = color;
    glowMaterial.emissiveIntensity = 3;
    glowMaterial.useLighting = false;
    glowMaterial.update();

    const glow = createShape('plane', glowMaterial, softbox);
    glow.render.castShadows = false;
    glow.setLocalEulerAngles(-90, 0, 0);
    glow.setLocalScale(0.5, 1, 2);
});

const camera = new Entity('Camera');
camera.addComponent('camera', {
    fov: 34,
    nearClip: 0.1,
    farClip: 100,
    layers: [worldLayer.id, floorLayer.id, LAYERID_UI]
});
camera.addComponent('script');
camera.setLocalPosition(1.1, 1.5, 5);
app.root.addChild(camera);

// On narrow screens, the field of view widens to keep the cube in view
const fitFov = () => {
    const aspect = window.innerWidth / window.innerHeight;
    const fitWidth = 2 * Math.atan(Math.tan(20 * math.DEG_TO_RAD) / aspect) * math.RAD_TO_DEG;
    camera.camera.fov = Math.max(34, fitWidth);
};
fitFov();
window.addEventListener('resize', fitFov);
app.on('destroy', () => window.removeEventListener('resize', fitFov));

const cameraControls = /** @type {CameraControls} */ (camera.script.create(CameraControls));
cameraControls.focusPoint = new Vec3(0, 0.5, 0);
cameraControls.enableFly = false;
cameraControls.enablePan = false;
cameraControls.pitchRange = new Vec2(-70, -5);
cameraControls.zoomRange = new Vec2(2.5, 10);

// The neutral tone mapping keeps the colors of the logo, the bloom makes the logo mark glow, and a
// subtle vignette finishes the image
const cameraFrame = new CameraFrame(app, camera.camera);
cameraFrame.rendering.samples = 4;
cameraFrame.rendering.toneMapping = TONEMAP_NEUTRAL;
cameraFrame.bloom.intensity = 0.03;
cameraFrame.bloom.blurLevel = 6;
cameraFrame.vignette.intensity = 0.25;
cameraFrame.vignette.inner = 0.5;
cameraFrame.vignette.outer = 1.4;
cameraFrame.update();

// The reflection camera renders the World layer into the reflection texture. Its priority is lower
// than the main camera's, so it renders first each frame. The planarRenderer script mirrors the main
// camera by the floor, and creates the texture: at the full resolution of the screen, with mipmaps
// for the blurred reflection of the glossy floor, and with a high dynamic range, so the reflection is
// tone mapped once, with the scene.
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
            scale: 1,
            mipmaps: true,
            hdr: true,
            planePoint: new Vec3(0, 0, 0),
            planeNormal: new Vec3(0, 1, 0)
        }
    })
);
app.root.addChild(reflectionCamera);

// ----- Animation -----

const HOP_DURATION = 0.55;
const HOP_HEIGHT = 0.55;
const CROUCH_DURATION = 0.18;

// The body squash is a spring, which wobbles after each take-off and landing
let squash = 1;
let squashVelocity = 0;

let hopTime = 0;
let restTime = 0;
let restDuration = 1;
let hopCount = 0;
let airborne = false;
let yaw = 0;
let startYaw = 0;
let targetYaw = 0;
let blinkTime = 2;

app.on('update', (/** @type {number} */ dt) => {
    // limit the time step, so the spring stays stable after the tab was in the background
    dt = Math.min(dt, 1 / 30);

    let height = 0;
    let crouching = false;

    if (airborne) {
        hopTime += dt;
        const t = Math.min(hopTime / HOP_DURATION, 1);

        // every fourth hop is a higher one, with a spin
        const spin = hopCount % 4 === 0;
        height = 4 * t * (1 - t) * HOP_HEIGHT * (spin ? 2 : 1);

        // turn towards the camera in the air
        const turn = t * t * (3 - 2 * t);
        yaw = math.lerpAngle(startYaw, targetYaw, turn) + (spin ? turn * 360 : 0);

        if (t === 1) {
            airborne = false;
            restTime = 0;
            restDuration = 0.6 + Math.random() * 1.2;
            yaw = targetYaw;
            squashVelocity -= 5;
        }
    } else {
        restTime += dt;
        crouching = restTime > restDuration - CROUCH_DURATION;

        if (restTime > restDuration) {
            airborne = true;
            hopTime = 0;
            hopCount++;
            squashVelocity += hopCount % 4 === 0 ? 7 : 5;

            // the direction to the camera, turned by up to 30 degrees either way, so the cube also
            // shows its sides
            const cameraPosition = camera.getPosition();
            startYaw = yaw % 360;
            targetYaw = Math.atan2(cameraPosition.x, cameraPosition.z) * math.RAD_TO_DEG + math.random(-30, 30);
        }
    }

    // the spring pulls the squash towards its rest value, lower when crouching before a hop
    const rest = crouching ? 0.8 : 1;
    squashVelocity += ((rest - squash) * 320 - squashVelocity * 14) * dt;
    squash += squashVelocity * dt;

    // the body keeps its volume as it squashes
    const width = 1 / Math.sqrt(squash);
    body.setLocalScale(width, squash, width);

    cube.setLocalPosition(0, height, 0);
    cube.setLocalEulerAngles(0, yaw, 0);

    // blink every few seconds
    blinkTime -= dt;
    if (blinkTime < 0) {
        blinkTime = 2 + Math.random() * 3;
    }
    const blink = blinkTime < 0.15 ? Math.abs(blinkTime / 0.075 - 1) : 1;
    eyes.forEach((eye) => eye.setLocalScale(1, Math.max(blink, 0.1), 1));

    // Update the reflection camera, after the main camera has moved this frame. The floor reflects
    // the texture it renders to, projected by its view projection matrix.
    floorMaterial.planarReflectionMap = planarRenderer.frameUpdate();
    floorMaterial.planarReflectionMatrix = planarRenderer.viewProjectionMatrix;
    floorMaterial.update();
});
