// @config
//
// The polished floor reflects the room with a planar reflection. A camera mirrored by the floor
// renders the room into a texture each frame, and the lit material of the floor uses it in place of
// its environment reflection. Unlike the cubemap baked from the empty room, it reflects the statue,
// the drone and the spinning torus exactly, also where they touch the floor. Rougher floors blur
// the reflection, using the mipmaps of the texture.

import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    BoundingBox,
    CUBEPROJ_BOX,
    CameraComponentSystem,
    CameraFrame,
    Color,
    ContainerHandler,
    Entity,
    FILLMODE_FILL_WINDOW,
    Layer,
    LightComponentSystem,
    Mat4,
    Mouse,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    SHADERLANGUAGE_GLSL,
    SHADERLANGUAGE_WGSL,
    ScriptComponentSystem,
    StandardMaterial,
    TEXTURETYPE_RGBP,
    TONEMAP_ACES,
    TextureHandler,
    TextureRenderer,
    TouchDevice,
    Vec2,
    Vec3,
    createGraphicsDevice
} from 'playcanvas';
import { CameraControls } from 'playcanvas/scripts/esm/camera-controls.mjs';
import { PlanarRenderer } from 'playcanvas/scripts/esm/planar-renderer.mjs';

import { data, deviceType } from 'examples/context';

import reflectionGlsl from './reflection.glsl.frag';
import reflectionWgsl from './reflection.wgsl.frag';

/**
 * @import { RenderComponent } from 'playcanvas'
 */

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    room: new Asset('room', 'container', { url: './assets/models/area-lights-room.glb' }),
    statue: new Asset('statue', 'container', { url: './assets/models/statue.glb' }),
    drone: new Asset('drone', 'container', { url: './assets/models/drone.glb' }),
    helipad: new Asset(
        'helipad-env-atlas',
        'texture',
        { url: './assets/cubemaps/helipad-env-atlas.png' },
        { type: TEXTURETYPE_RGBP, mipmaps: false }
    ),

    // the empty room rendered into a cubemap from the center of the room, prefiltered into an
    // environment atlas, holding the reflection for each level of roughness
    roomEnvAtlas: new Asset(
        'room-env-atlas',
        'texture',
        { url: './assets/cubemaps/area-lights-room-env-atlas.png' },
        { type: TEXTURETYPE_RGBP, mipmaps: false }
    )
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
createOptions.resourceHandlers = [TextureHandler, ContainerHandler];

const app = new AppBase(canvas);
app.init(createOptions);
app.setCanvasFillMode(FILLMODE_FILL_WINDOW);
app.setCanvasResolution(RESOLUTION_AUTO);

const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => window.removeEventListener('resize', resize));

await new Promise((resolve) => {
    new AssetListLoader(Object.values(assets), app.assets).load(resolve);
});

app.start();

data.set('settings', {
    reflection: 'planar',
    resolution: 0.5,
    roughness: 0.1,
    showTexture: false,
    speed: 1
});

// The layers:
// - World: the room and everything in it, rendered by both cameras
// - Skybox: the sky, rendered by both cameras
// - Floor: the floor, rendered only by the main camera. A surface cannot be in the reflection it
//   displays.
const worldLayer = app.scene.layers.getLayerByName('World');
const skyboxLayer = app.scene.layers.getLayerByName('Skybox');
const uiLayer = app.scene.layers.getLayerByName('UI');
const floorLayer = new Layer({ name: 'Floor' });
app.scene.layers.insert(floorLayer, 1);
const LIGHT_LAYERS = [worldLayer.id, floorLayer.id];

// The sky, at the full resolution of its environment atlas, shows through the windows and the
// skylight of the room
app.scene.envAtlas = assets.helipad.resource;
app.scene.skyboxMip = 0;
app.scene.exposure = 0.6;

// The box projection uses the inside of the room, the cubemap was rendered from its center
const roomBox = new BoundingBox(new Vec3(0, 3.25, 0), new Vec3(8, 3.25, 9));

/**
 * Makes a material reflect the room, and be lit by it.
 *
 * @param {StandardMaterial} material - The material.
 */
const addReflections = (material) => {
    material.envAtlas = assets.roomEnvAtlas.resource;
    material.cubeMapProjection = CUBEPROJ_BOX;
    material.cubeMapProjectionBox = roomBox;
    material.update();
};

/**
 * Creates a primitive on the World layer.
 *
 * @param {RenderComponent['type']} type - The primitive type.
 * @param {StandardMaterial} material - The material.
 * @param {Vec3} position - The position.
 * @param {Vec3} scale - The scale.
 * @param {Entity} [parent] - The parent entity.
 * @returns {Entity} The primitive.
 */
const createPrimitive = (type, material, position, scale, parent = app.root) => {
    const entity = new Entity();
    entity.addComponent('render', { type, material, layers: [worldLayer.id] });
    entity.setLocalPosition(position);
    entity.setLocalScale(scale);
    parent.addChild(entity);
    return entity;
};

// The room, with the statue on the pedestal in the middle
const room = assets.room.resource.instantiateRenderEntity({
    castShadows: true,
    receiveShadows: true
});
app.root.addChild(room);

const statue = assets.statue.resource.instantiateRenderEntity({
    castShadows: true,
    receiveShadows: true
});
statue.setLocalScale(0.15, 0.15, 0.15);
statue.setLocalPosition(0, 0.36, 0);
statue.setLocalEulerAngles(0, 30, 0);
app.root.addChild(statue);

// The drone, flying around the statue
const drone = assets.drone.resource.instantiateRenderEntity({
    castShadows: true
});
app.root.addChild(drone);

// the rotors spin, the ones on opposite corners in the same direction, and the LED blinks
const rotors = drone
    .find((node) => node.name.startsWith('Rotor'))
    .map((rotor) => {
        const position = rotor.getLocalPosition();
        return { rotor, direction: Math.sign(position.x * position.z) };
    });
const led = drone.findByName('LED');

// the glTF materials are standard materials
[assets.room, assets.statue, assets.drone].forEach((asset) => {
    asset.resource.materials.forEach((material) => addReflections(/** @type {StandardMaterial} */ (material.resource)));
});

// A chrome sphere on the left pedestal, and a gold torus spinning on the right one
const chromeMaterial = new StandardMaterial();
chromeMaterial.diffuse = new Color(0.95, 0.95, 0.95);
chromeMaterial.useMetalness = true;
chromeMaterial.metalness = 1;
chromeMaterial.gloss = 0.95;
addReflections(chromeMaterial);
createPrimitive('sphere', chromeMaterial, new Vec3(-4, 1.15, 0.8), new Vec3(1.2, 1.2, 1.2));

const goldMaterial = new StandardMaterial();
goldMaterial.diffuse = new Color(1, 0.77, 0.34);
goldMaterial.useMetalness = true;
goldMaterial.metalness = 1;
goldMaterial.gloss = 0.75;
addReflections(goldMaterial);
const torusPivot = new Entity('Torus');
torusPivot.setLocalPosition(4, 1.29, 0.8);
app.root.addChild(torusPivot);
const torus = createPrimitive('torus', goldMaterial, Vec3.ZERO, new Vec3(1.5, 1.5, 1.5), torusPivot);
torus.setLocalEulerAngles(90, 0, 0);

// The glowing doors in the back wall, each with a spot light shining into the room
[
    { x: -4.5, color: new Color(1, 0.42, 0.12) },
    { x: 0, color: new Color(0.25, 0.8, 1) },
    { x: 4.5, color: new Color(1, 0.8, 0.35) }
].forEach(({ x, color }) => {
    const material = new StandardMaterial();
    material.diffuse = Color.BLACK;
    material.emissive = color;
    material.emissiveIntensity = 4;
    material.useLighting = false;
    material.update();
    createPrimitive('box', material, new Vec3(x, 1.7, -9.45), new Vec3(1.7, 3.3, 0.02));

    // the spot light shines down its -Y axis, so it is turned to face the room
    const light = new Entity();
    light.addComponent('light', {
        type: 'spot',
        layers: LIGHT_LAYERS,
        color,
        intensity: 1.5,
        range: 20,
        innerConeAngle: 50,
        outerConeAngle: 80
    });
    light.setLocalPosition(x, 1.7, -9.2);
    light.setLocalEulerAngles(-90, 0, 0);
    app.root.addChild(light);
});

// The light of the room, shining on the statue from the front
const light = new Entity('Light');
light.addComponent('light', {
    type: 'omni',
    layers: LIGHT_LAYERS,
    color: new Color(1, 0.95, 0.9),
    intensity: 2,
    range: 20,
    castShadows: true,
    shadowBias: 0.2,
    normalOffsetBias: 0.05
});
light.setLocalPosition(1, 5.5, 4);
app.root.addChild(light);

// The floor, on its own layer
const floor = /** @type {Entity} */ (room.findByName('RoomFloor'));
floor.render.layers = [floorLayer.id];
const floorMaterial = /** @type {StandardMaterial} */ (
    assets.room.resource.materials.find((asset) => asset.resource.name === 'Floor').resource
);

// The main camera, low in the room, where the floor reflects the most
const camera = new Entity('MainCamera');
camera.addComponent('camera', {
    fov: 60,
    nearClip: 0.1,
    farClip: 100,
    layers: [worldLayer.id, floorLayer.id, skyboxLayer.id, uiLayer.id]
});
camera.addComponent('script');
camera.setLocalPosition(1.5, 1.8, 6.8);
app.root.addChild(camera);

// The camera orbits all the way around, and the pitch and zoom ranges keep it inside the room
const cameraControls = /** @type {CameraControls} */ (camera.script.create(CameraControls));
cameraControls.focusPoint = new Vec3(0, 1.2, 0);
cameraControls.enableFly = false;
cameraControls.pitchRange = new Vec2(-45, 5);
cameraControls.zoomRange = new Vec2(3.5, 7);

// Bloom makes the doors glow, and their reflections
const cameraFrame = new CameraFrame(app, camera.camera);
cameraFrame.rendering.samples = 4;
cameraFrame.rendering.toneMapping = TONEMAP_ACES;
cameraFrame.bloom.intensity = 0.03;
cameraFrame.bloom.blurLevel = 6;
cameraFrame.vignette.intensity = 0.35;
cameraFrame.update();

// The reflection camera, rendering the World and Skybox layers into the reflection texture. Its
// priority is lower than the main camera's, so it renders first each frame. The planarRenderer
// script mirrors the main camera by the plane of the floor, and creates the texture: with mipmaps
// for the blurred reflections of rough floors, and with a high dynamic range, so the reflections of
// the doors are as bright as the doors.
const reflectionCamera = new Entity('ReflectionCamera');
reflectionCamera.addComponent('camera', {
    layers: [worldLayer.id, skyboxLayer.id],
    priority: -1
});
reflectionCamera.addComponent('script');
const planarRenderer = /** @type {PlanarRenderer} */ (
    reflectionCamera.script.create(PlanarRenderer, {
        properties: {
            sceneCameraEntity: camera,
            mipmaps: true,
            hdr: true,
            planePoint: new Vec3(0, 0, 0),
            planeNormal: new Vec3(0, 1, 0)
        }
    })
);
app.root.addChild(reflectionCamera);

// The floor material reflects the room using the planar reflection, replacing its environment
// reflection chunk. It is mostly metallic, so the reflection shows over its diffuse lighting.
floorMaterial.metalness = 0.7;
floorMaterial.shaderChunksVersion = '2.24';

// The view projection matrix of the reflection camera, which projects points to the texture
const reflectionView = new Mat4();
const reflectionViewProjection = new Mat4();

// The reflection texture in the corner of the screen, for debugging
const textures = new TextureRenderer(app);
textures.layer = uiLayer;

const applySettings = () => {
    const settings = data.get('settings');
    const planar = settings.reflection === 'planar';

    // with the cubemap, the floor uses its default environment reflection chunk, and the
    // reflection camera does not need to render
    const glslChunks = floorMaterial.getShaderChunks(SHADERLANGUAGE_GLSL);
    const wgslChunks = floorMaterial.getShaderChunks(SHADERLANGUAGE_WGSL);
    if (planar) {
        glslChunks.set('reflectionEnvPS', reflectionGlsl);
        wgslChunks.set('reflectionEnvPS', reflectionWgsl);
    } else {
        glslChunks.delete('reflectionEnvPS');
        wgslChunks.delete('reflectionEnvPS');
    }
    reflectionCamera.camera.enabled = planar;

    planarRenderer.scale = settings.resolution;
    floorMaterial.gloss = settings.roughness;
    floorMaterial.update();
};
applySettings();
data.on('*:set', applySettings);

let time = 0;
app.on('update', (/** @type {number} */ dt) => {
    const settings = data.get('settings');
    time += dt * settings.speed;

    // the drone circles the statue, dipping down to the floor and back up, facing where it flies,
    // with its nose down and banking into the turn
    const angle = time * 0.5;
    const radius = 2.6;
    const height = 1.1 + Math.sin(time * 0.7) * 0.5;
    drone.setLocalPosition(Math.sin(angle) * radius, height, Math.cos(angle) * radius);
    drone.lookAt(Math.sin(angle + 0.1) * radius, height, Math.cos(angle + 0.1) * radius);
    drone.rotateLocal(-8, 0, 15);
    rotors.forEach(({ rotor, direction }) => rotor.setLocalEulerAngles(0, direction * time * 2000, 0));
    led.enabled = Math.floor(time * 2) % 2 === 0;

    // the torus spins on its pedestal
    torusPivot.setLocalEulerAngles(0, time * 40, 0);

    // Update the reflection camera, after the main camera has moved this frame, and pass the
    // texture it renders to and its view projection matrix to the floor material
    const texture = planarRenderer.frameUpdate();
    if (texture) {
        reflectionView.copy(reflectionCamera.getWorldTransform()).invert();
        reflectionViewProjection.mul2(reflectionCamera.camera.projectionMatrix, reflectionView);
        floorMaterial.setParameter('planarReflectionMap', texture);
        floorMaterial.setParameter('planarReflectionViewProjection', reflectionViewProjection.data);

        if (settings.showTexture) {
            textures.draw(texture, 0.7, 0.7, 0.28, 0.28);
        }
    }
});
