// @config
//
// Bullet impacts, explosions and magic bursts, each built from several one-shot particle emitters.
// Click the room to hit it, or let auto fire do it. The shots are raycast against mesh colliders of
// the room, and bullets play a different effect on metal and stone. The effects are reusable:
// particle-effects.mjs plays and pools them, and impact-effects.mjs defines them as data. The
// polished floor reflects them with a planar reflection.

import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    BoundingBox,
    CUBEPROJ_BOX,
    CameraComponentSystem,
    CameraFrame,
    CollisionComponentSystem,
    Color,
    ContainerHandler,
    Entity,
    FILLMODE_FILL_WINDOW,
    GraphNode,
    Layer,
    LightComponentSystem,
    MeshInstance,
    Model,
    Mouse,
    ParticleSystemComponentSystem,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    RigidBodyComponentSystem,
    ScriptComponentSystem,
    StandardMaterial,
    TEXTURETYPE_RGBP,
    TONEMAP_ACES,
    TextureHandler,
    TouchDevice,
    Vec2,
    Vec3,
    WasmModule,
    createGraphicsDevice
} from 'playcanvas';
import { CameraControls } from 'playcanvas/scripts/esm/camera-controls.mjs';
import { PlanarRenderer } from 'playcanvas/scripts/esm/planar-renderer.mjs';

import { data, deviceType } from 'examples/context';

import { createEffectResources, effectAssets } from './effect-resources.mjs';
import { createImpactEffects } from './impact-effects.mjs';
import { ParticleEffectPool } from './particle-effects.mjs';

/**
 * @import { CameraComponent, ContainerResource, RenderComponent } from 'playcanvas'
 */

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

// the shots are raycast against the room with the Ammo physics engine
WasmModule.setConfig('Ammo', {
    glueUrl: './assets/wasm/ammo/ammo.wasm.js',
    wasmUrl: './assets/wasm/ammo/ammo.wasm.wasm',
    fallbackUrl: './assets/wasm/ammo/ammo.js'
});
await new Promise((resolve) => {
    WasmModule.getInstance('Ammo', () => resolve(true));
});

const assets = {
    room: new Asset('room', 'container', { url: './assets/models/area-lights-room.glb' }),
    statue: new Asset('statue', 'container', { url: './assets/models/statue.glb' }),
    helipad: new Asset(
        'helipad-env-atlas',
        'texture',
        { url: './assets/cubemaps/helipad-env-atlas.png' },
        { type: TEXTURETYPE_RGBP, mipmaps: false }
    ),

    // the empty room rendered into a cubemap from its center, prefiltered into an environment atlas
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
    ParticleSystemComponentSystem,
    ScriptComponentSystem,
    CollisionComponentSystem,
    RigidBodyComponentSystem
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
    new AssetListLoader([...Object.values(assets), ...Object.values(effectAssets)], app.assets).load(resolve);
});

app.start();

// ----- The room -----

// The layers:
// - World: the room, everything in it and the effects, rendered by both cameras
// - Skybox: the sky, rendered by both cameras
// - Floor: the floor, rendered only by the main camera. A surface cannot be in the reflection it
//   displays.
const worldLayer = app.scene.layers.getLayerByName('World');
const skyboxLayer = app.scene.layers.getLayerByName('Skybox');
const uiLayer = app.scene.layers.getLayerByName('UI');
const floorLayer = new Layer({ name: 'Floor' });
app.scene.layers.insert(floorLayer, 1);
const LIGHT_LAYERS = [worldLayer.id, floorLayer.id];

// the sky shows through the windows and the skylight of the room
app.scene.envAtlas = assets.helipad.resource;
app.scene.skyboxMip = 0;
app.scene.exposure = 0.6;

// mesh particles, such as the debris, are lit by the ambient light and directional lights only
app.scene.ambientLight = new Color(0.25, 0.25, 0.28);

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
 * Gives the meshes of a model static mesh colliders, which the shots hit. The tag names the
 * surface, which picks the bullet effect. Call it once the model is placed, as the colliders take
 * its scale.
 *
 * @param {Entity} model - The model.
 * @param {'metal'|'stone'} surface - The surface type.
 */
const addMeshColliders = (model, surface) => {
    model.findComponents('render').forEach((/** @type {RenderComponent} */ render) => {
        render.entity.addComponent('rigidbody', { type: 'static' });
        render.entity.addComponent('collision', { type: 'mesh', renderAsset: render.asset });
        render.entity.tags.add(surface);
    });
};

// The metal room, with the stone statue on the pedestal in the middle
const room = /** @type {ContainerResource} */ (assets.room.resource).instantiateRenderEntity({
    castShadows: true,
    receiveShadows: true
});
app.root.addChild(room);
addMeshColliders(room, 'metal');

const statue = /** @type {ContainerResource} */ (assets.statue.resource).instantiateRenderEntity({
    castShadows: true,
    receiveShadows: true
});
statue.setLocalScale(0.15, 0.15, 0.15);
statue.setLocalPosition(0, 0.36, 0);
statue.setLocalEulerAngles(0, 30, 0);
app.root.addChild(statue);
addMeshColliders(statue, 'stone');

// the glTF materials are standard materials
[assets.room, assets.statue].forEach((asset) => {
    asset.resource.materials.forEach((material) => addReflections(/** @type {StandardMaterial} */ (material.resource)));
});

// A chrome sphere on the left pedestal, and a gold torus standing on the right one
const chromeMaterial = new StandardMaterial();
chromeMaterial.diffuse = new Color(0.95, 0.95, 0.95);
chromeMaterial.useMetalness = true;
chromeMaterial.metalness = 1;
chromeMaterial.gloss = 0.95;
addReflections(chromeMaterial);
const sphere = new Entity('Sphere');
sphere.addComponent('render', { type: 'sphere', material: chromeMaterial, layers: [worldLayer.id] });
sphere.setLocalPosition(-4, 1.15, 0.8);
sphere.setLocalScale(1.2, 1.2, 1.2);
app.root.addChild(sphere);

// primitive collision shapes don't take the scale of the entity
sphere.addComponent('rigidbody', { type: 'static' });
sphere.addComponent('collision', { type: 'sphere', radius: 0.6 });
sphere.tags.add('metal');

const goldMaterial = new StandardMaterial();
goldMaterial.diffuse = new Color(1, 0.77, 0.34);
goldMaterial.useMetalness = true;
goldMaterial.metalness = 1;
goldMaterial.gloss = 0.75;
addReflections(goldMaterial);
const torus = new Entity('Torus');
torus.addComponent('render', { type: 'torus', material: goldMaterial, layers: [worldLayer.id] });
torus.setLocalPosition(4, 1.29, 0.8);
torus.setLocalScale(1.5, 1.5, 1.5);
torus.setLocalEulerAngles(90, -20, 0);
app.root.addChild(torus);

// a mesh collider made of the mesh of the torus, so the decals land on its surface
const torusModel = new Model();
torusModel.graph = new GraphNode();
torusModel.meshInstances = [new MeshInstance(torus.render.meshInstances[0].mesh, goldMaterial, torusModel.graph)];
torus.addComponent('rigidbody', { type: 'static' });
torus.addComponent('collision', { type: 'mesh', model: torusModel });
torus.tags.add('metal');

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
    const door = new Entity('Door');
    door.addComponent('render', { type: 'box', material, layers: [worldLayer.id] });
    door.setLocalPosition(x, 1.7, -9.45);
    door.setLocalScale(1.7, 3.3, 0.02);
    app.root.addChild(door);

    // the spot light shines down its -Y axis, so it is turned to face the room
    const light = new Entity('Door Light');
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
const roomLight = new Entity('Light');
roomLight.addComponent('light', {
    type: 'omni',
    layers: LIGHT_LAYERS,
    color: new Color(1, 0.95, 0.9),
    intensity: 2,
    range: 20,
    castShadows: true,
    shadowBias: 0.2,
    normalOffsetBias: 0.05
});
roomLight.setLocalPosition(1, 5.5, 4);
app.root.addChild(roomLight);

// The floor, on its own layer
const floor = /** @type {Entity} */ (room.findByName('RoomFloor'));
/** @type {RenderComponent} */ (floor.render).layers = [floorLayer.id];
const floorMaterial = /** @type {StandardMaterial} */ (
    assets.room.resource.materials.find((asset) => asset.resource.name === 'Floor').resource
);

// the floor material is mostly metallic, so the reflection shows over its diffuse lighting
floorMaterial.metalness = 0.7;
floorMaterial.gloss = 0.1;
floorMaterial.update();

// ----- The cameras -----

// The main camera, low in the room, where the floor reflects the most
const camera = new Entity('Camera');
camera.addComponent('camera', {
    fov: 60,
    nearClip: 0.1,
    farClip: 100,
    layers: [worldLayer.id, floorLayer.id, skyboxLayer.id, uiLayer.id]
});
camera.addComponent('script');
camera.setLocalPosition(1.5, 1.8, 6.8);
app.root.addChild(camera);

const cameraControls = /** @type {CameraControls} */ (camera.script.create(CameraControls));
cameraControls.focusPoint = new Vec3(0, 1.2, 0);
cameraControls.enableFly = false;
cameraControls.pitchRange = new Vec2(-45, 5);
cameraControls.zoomRange = new Vec2(3.5, 9);

// Bloom makes the doors, the fire and the sparks glow, and their reflections. The soft particles
// fade where they meet the room, using the scene depth map.
const cameraFrame = new CameraFrame(app, camera.camera);
cameraFrame.rendering.samples = 4;
cameraFrame.rendering.toneMapping = TONEMAP_ACES;
cameraFrame.rendering.sceneDepthMap = true;
cameraFrame.bloom.intensity = 0.03;
cameraFrame.bloom.blurLevel = 6;
cameraFrame.vignette.intensity = 0.35;
cameraFrame.update();

// The reflection camera renders the World and Skybox layers, with the effects, into the reflection
// texture of the floor. Its priority is lower than the main camera's, so it renders first.
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
            scale: 0.5,
            planePoint: new Vec3(0, 0, 0),
            planeNormal: new Vec3(0, 1, 0)
        }
    })
);
app.root.addChild(reflectionCamera);

// ----- The effects -----

const resources = createEffectResources(device);
const definitions = createImpactEffects(resources);

// the lights of the effects light the floor as well
const pool = new ParticleEffectPool(app, definitions, { lightLayers: LIGHT_LAYERS });

// explosions shake the camera, less when they are further away
let shake = 0;
pool.on('shake', (/** @type {number} */ strength, /** @type {Vec3} */ position) => {
    const falloff = Math.max(0, 1 - camera.getPosition().distance(position) / 20);
    shake = Math.min(1, shake + strength * falloff);
});

let time = 0;
app.on('update', (/** @type {number} */ dt) => {
    time += dt;

    // the camera controls set the camera transform before this runs, so the shake doesn't add up
    if (shake > 0) {
        const angle = shake * shake * 2;
        camera.rotateLocal(
            Math.sin(time * 47) * angle,
            Math.sin(time * 39 + 1) * angle,
            Math.sin(time * 31 + 2) * angle * 0.5
        );
        shake = Math.max(0, shake - dt * 1.5);
    }

    // Update the reflection camera, after the main camera has moved and shaken this frame
    floorMaterial.planarReflectionMap = planarRenderer.frameUpdate();
    floorMaterial.planarReflectionMatrix = planarRenderer.viewProjectionMatrix;
    floorMaterial.update();
});

// ----- Hitting the room -----

const effectNames = ['bullet', 'explosion', 'magic'];
const surfaces = ['metal', 'stone'];

/**
 * Plays the selected effect where a shot from the camera hits the room, facing out of the surface.
 *
 * @param {Vec3} end - The end of the shot. It starts at the camera.
 */
const fire = (end) => {
    const hit = app.systems.rigidbody.raycastFirst(camera.getPosition(), end);
    if (!hit) return;

    let effect = data.get('settings.effect');
    if (effect === 'mixed') {
        effect = effectNames[Math.random() < 0.7 ? 0 : 1 + Math.floor(Math.random() * 2)];
    }

    // bullets play the effect of the surface they hit, which the tags of the collider name
    const name = effect === 'bullet' ? `bullet-${surfaces.find((surface) => hit.entity.tags.has(surface))}` : effect;
    pool.spawn(name, hit.point, hit.normal);
};

const farPoint = new Vec3();

// fire on a click or a tap, but not at the end of a drag that orbits the camera
const pointerDown = new Vec2();
const onPointerDown = (/** @type {PointerEvent} */ event) => {
    pointerDown.set(event.clientX, event.clientY);
};
const onPointerUp = (/** @type {PointerEvent} */ event) => {
    if (pointerDown.distance(new Vec2(event.clientX, event.clientY)) > 5) return;
    const rect = canvas.getBoundingClientRect();
    const cam = /** @type {CameraComponent} */ (camera.camera);
    cam.screenToWorld(event.clientX - rect.left, event.clientY - rect.top, cam.farClip, farPoint);
    fire(farPoint);
};
canvas.addEventListener('pointerdown', onPointerDown);
canvas.addEventListener('pointerup', onPointerUp);
app.on('destroy', () => {
    canvas.removeEventListener('pointerdown', onPointerDown);
    canvas.removeEventListener('pointerup', onPointerUp);
});

// auto fire aims at random points in the back half of the room, and shoots on past them
const target = new Vec3();
let autoFireTime = 0;
app.on('update', (/** @type {number} */ dt) => {
    if (!data.get('settings.autoFire')) return;
    autoFireTime += dt;
    const interval = 1 / data.get('settings.rate');
    while (autoFireTime >= interval) {
        autoFireTime -= interval;
        target.set(Math.random() * 14 - 7, Math.random() * 3.5, Math.random() * 11 - 9);
        target.sub(camera.getPosition()).mulScalar(10).add(camera.getPosition());
        fire(target);
    }
});

// ----- Settings -----

// remember the softening of each layer, to turn soft particles off and on again
const softening = new Map();
Object.values(definitions).forEach((definition) => {
    definition.layers.forEach((layer) => softening.set(layer, layer.options.depthSoftening ?? 0));
});

data.set('settings', {
    effect: 'mixed',
    autoFire: true,
    rate: 10,
    softParticles: true
});

data.on('settings.softParticles:set', (/** @type {boolean} */ soft) => {
    cameraFrame.rendering.sceneDepthMap = soft;
    cameraFrame.update();

    // change the definitions for the instances still to be created, and the existing instances
    softening.forEach((value, layer) => {
        layer.options.depthSoftening = soft ? value : 0;
    });
    pool.forEachLayer((ps, layer) => {
        ps.depthSoftening = layer.options.depthSoftening;
    });
});

// show how many effects are playing
let statsTime = 0;
app.on('update', (/** @type {number} */ dt) => {
    statsTime += dt;
    if (statsTime > 0.25) {
        statsTime = 0;
        data.set('stats', {
            active: pool.activeCount,
            instances: pool.instanceCount
        });
    }
});

app.on('destroy', () => {
    pool.destroy();
    cameraFrame.destroy();
    resources.destroy();
});
