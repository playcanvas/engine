// @config
//
// Skeletal animations made with the {accent:Spine} 4.3 editor, whose physics constraints react to
// the movement and rotation of their entities, using the physics inheritance of the
// [playcanvas-spine](https://github.com/playcanvas/playcanvas-spine) plugin. Drag the skeletons
// around, or pick a motion, and toggle the inheritance to compare. The animations are paused by
// default, so that only the movement drives physics. Celestial Circus loads from a JSON export, and
// Snowglobe from a binary .skel export.
//
// @credit
// title: Celestial Circus
// author: Esoteric Software
// source: https://esotericsoftware.com/
// license: (c) 2023-2024 Esoteric Software, non-commercial use only
//
// @credit
// title: Snowglobe
// author: Esoteric Software
// source: https://esotericsoftware.com/
// license: (c) 2023-2024 Esoteric Software, non-commercial use only

import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    BinaryHandler,
    CameraComponentSystem,
    Color,
    Entity,
    FILLMODE_FILL_WINDOW,
    JsonHandler,
    PROJECTION_ORTHOGRAPHIC,
    RESOLUTION_AUTO,
    ScriptComponentSystem,
    ScriptHandler,
    TextHandler,
    TextureHandler,
    Vec3,
    createGraphicsDevice
} from 'playcanvas';

import { data, deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

// as Spine 4.3 renders in gamma space, the textures are loaded without sRGB, and the texture
// asset names have to match the page names in the atlases
const texture = (/** @type {string} */ folder, /** @type {string} */ file) =>
    new Asset(file, 'texture', { url: `./assets/spine/${folder}/${file}` }, { srgb: false });

const assets = {
    circusSkeleton: new Asset('celestial-circus-pro.json', 'json', {
        url: './assets/spine/celestial-circus/celestial-circus-pro.json'
    }),
    circusAtlas: new Asset('celestial-circus-pma.atlas', 'text', {
        url: './assets/spine/celestial-circus/celestial-circus-pma.atlas'
    }),
    circusTexture: texture('celestial-circus', 'celestial-circus-pma.png'),
    // binary .skel exports load as binary assets
    globeSkeleton: new Asset('snowglobe-pro.skel', 'binary', { url: './assets/spine/snowglobe/snowglobe-pro.skel' }),
    globeAtlas: new Asset('snowglobe-pma.atlas', 'text', { url: './assets/spine/snowglobe/snowglobe-pma.atlas' }),
    globeTexture1: texture('snowglobe', 'snowglobe-pma.png'),
    globeTexture2: texture('snowglobe', 'snowglobe-pma_2.png'),
    globeTexture3: texture('snowglobe', 'snowglobe-pma_3.png'),
    spinescript: new Asset('spinescript', 'script', {
        url: './scripts/spine/playcanvas-spine.4.3.js'
    })
};

const gfxOptions = {
    deviceTypes: [deviceType]
};

const device = await createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new AppOptions();
createOptions.graphicsDevice = device;

createOptions.componentSystems = [CameraComponentSystem, ScriptComponentSystem];
createOptions.resourceHandlers = [TextureHandler, ScriptHandler, JsonHandler, TextHandler, BinaryHandler];

const app = new AppBase(canvas);
app.init(createOptions);

// Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
app.setCanvasFillMode(FILLMODE_FILL_WINDOW);
app.setCanvasResolution(RESOLUTION_AUTO);

// Ensure canvas is resized when window changes size
const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);

// the plugin adds the spine component system to the application when it loads
await new Promise((resolve) => {
    new AssetListLoader(Object.values(assets), app.assets).load(resolve);
});

app.start();

// an orthographic camera, framing both skeletons at any aspect ratio
const camera = new Entity('camera');
camera.addComponent('camera', {
    clearColor: new Color(0.17, 0.19, 0.25),
    projection: PROJECTION_ORTHOGRAPHIC
});
camera.setLocalPosition(-0.6, 3.5, 10);
app.root.addChild(camera);

const fitCamera = () => {
    const aspect = app.graphicsDevice.width / app.graphicsDevice.height;
    camera.camera.orthoHeight = Math.max(4.6, 9 / aspect);
};
fitCamera();
app.graphicsDevice.on('resizecanvas', fitCamera);

/**
 * Creates an entity with a spine component, standing on the ground at the given position.
 *
 * @param {string} name - The entity name.
 * @param {number} x - The horizontal position.
 * @param {number} y - The vertical position.
 * @param {number} scale - The scale.
 * @param {Asset} skeleton - The skeleton asset.
 * @param {Asset} atlas - The atlas asset.
 * @param {Asset[]} textures - The texture assets of the atlas pages.
 * @param {string} animation - The animation to loop.
 * @returns {Entity} The entity.
 */
const createSkeleton = (name, x, y, scale, skeleton, atlas, textures, animation) => {
    const entity = new Entity(name);
    entity.setLocalPosition(x, y, 0);
    entity.setLocalScale(scale, scale, scale);
    entity.addComponent('spine', {
        atlasAsset: atlas.id,
        skeletonAsset: skeleton.id,
        textureAssets: textures.map((texture) => texture.id)
    });
    app.root.addChild(entity);

    // the spine component comes from the plugin, which has no type information
    /** @type {any} */ (entity).spine.state.setAnimation(0, animation, true);
    return entity;
};

const skeletons = [
    createSkeleton(
        'celestial-circus',
        -4.6,
        1.9,
        0.28,
        assets.circusSkeleton,
        assets.circusAtlas,
        [assets.circusTexture],
        'swing'
    ),
    createSkeleton(
        'snowglobe',
        4,
        2.7,
        0.26,
        assets.globeSkeleton,
        assets.globeAtlas,
        [assets.globeTexture1, assets.globeTexture2, assets.globeTexture3],
        'idle'
    )
].map((entity) => ({
    entity,
    // the position the skeleton moves around, which dragging changes
    base: entity.getLocalPosition().clone(),
    skeletonPhysics: /** @type {any} */ (entity).spine.spine.skeletonPhysics
}));

// passes the movement and rotation of the entities to the physics constraints of the skeletons, so
// that the hair, the cloth and the snow react to it
const setInheritance = (/** @type {boolean} */ enabled) => {
    const value = enabled ? 1 : 0;
    for (const { skeletonPhysics } of skeletons) {
        skeletonPhysics.setPositionInheritance(value, value);
        skeletonPhysics.rotationInheritance = value;
    }
};

// plays the animations of the skeletons, or freezes them in their current pose, so that only the
// movement of the entities drives physics
const setAnimate = (/** @type {boolean} */ enabled) => {
    for (const { entity } of skeletons) {
        /** @type {any} */ (entity).spine.state.timeScale = enabled ? 1 : 0;
    }
};

data.set('spine', {
    animate: false,
    inheritance: true,
    motion: 'sway'
});
setAnimate(data.get('spine.animate'));
setInheritance(data.get('spine.inheritance'));

const dataEvent = data.on('*:set', (/** @type {string} */ path, /** @type {any} */ value) => {
    if (path === 'spine.animate') {
        setAnimate(value);
    } else if (path === 'spine.inheritance') {
        setInheritance(value);
    }
});

// the horizontal offset and the rotation in degrees of each motion, over time
const motions = {
    none: () => [0, 0],
    sway: (/** @type {number} */ t) => [0.8 * Math.sin(t * 3), 0],
    rock: (/** @type {number} */ t) => [0, 20 * Math.sin(t * 2.5)],
    shake: (/** @type {number} */ t) => [Math.sin(t * 1.5) > 0.3 ? 0.25 * Math.sin(t * 25) : 0, 0]
};

// drag the skeleton under the pointer
const pointer = new Vec3();
const dragOffset = new Vec3();
let dragged = null;

const pointerToWorld = (/** @type {PointerEvent} */ event) => {
    const rect = canvas.getBoundingClientRect();
    return camera.camera.screenToWorld(event.clientX - rect.left, event.clientY - rect.top, 10, pointer);
};

const onPointerDown = (/** @type {PointerEvent} */ event) => {
    pointerToWorld(event);
    dragged =
        skeletons.find(({ entity }) => {
            const { x, y, width, height } = /** @type {any} */ (entity).spine.skeleton.getBoundsRect();
            const position = entity.getLocalPosition();
            const scale = entity.getLocalScale().x;
            const localX = (pointer.x - position.x) / scale;
            const localY = (pointer.y - position.y) / scale;
            return localX >= x && localX <= x + width && localY >= y && localY <= y + height;
        }) ?? null;
    if (dragged) {
        dragOffset.sub2(dragged.base, pointer);
        canvas.setPointerCapture(event.pointerId);
    }
};

const onPointerMove = (/** @type {PointerEvent} */ event) => {
    if (dragged) {
        dragged.base.add2(pointerToWorld(event), dragOffset);
    }
};

const onPointerUp = () => {
    dragged = null;
};

canvas.addEventListener('pointerdown', onPointerDown);
canvas.addEventListener('pointermove', onPointerMove);
canvas.addEventListener('pointerup', onPointerUp);

// move the skeletons around their positions, except the dragged one
let time = 0;
app.on('update', (/** @type {number} */ dt) => {
    time += dt;
    const [offset, angle] = motions[/** @type {keyof typeof motions} */ (data.get('spine.motion'))](time);
    for (const skeleton of skeletons) {
        const { entity, base } = skeleton;
        const still = skeleton === dragged;
        entity.setLocalPosition(base.x + (still ? 0 : offset), base.y, base.z);
        entity.setLocalEulerAngles(0, 0, still ? 0 : angle);
    }
});

app.on('destroy', () => {
    window.removeEventListener('resize', resize);
    canvas.removeEventListener('pointerdown', onPointerDown);
    canvas.removeEventListener('pointermove', onPointerMove);
    canvas.removeEventListener('pointerup', onPointerUp);
    dataEvent.unbind();
});
