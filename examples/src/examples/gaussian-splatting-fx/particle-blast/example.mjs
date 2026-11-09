// @config
//
// Blast a gaussian splat room apart into compute shader particles, which take on the colors of the
// scene and bounce off its voxels. The reusable effect is in scene-particles-effect.mjs.
//
// @flag WEBGL_DISABLED
//
// `LMB` Look · `RMB` Blast · `WASD` `QE` Move · `Shift` Fast · `Wheel` Brush size · `Space` Gravity well
//
// @credit
// title: SA3D_R&D_XP47
// author: Stephane Agullo
// source: https://superspl.at/view?id=cdcec084
// license: CC BY 4.0 (http://creativecommons.org/licenses/by/4.0/)

import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    BinaryHandler,
    CameraComponentSystem,
    CameraFrame,
    Color,
    Entity,
    FILLMODE_FILL_WINDOW,
    GSplatComponentSystem,
    GSplatHandler,
    JsonHandler,
    KEY_A,
    KEY_D,
    KEY_E,
    KEY_Q,
    KEY_S,
    KEY_SHIFT,
    KEY_SPACE,
    KEY_W,
    Keyboard,
    MiniStats,
    MOUSEBUTTON_LEFT,
    MOUSEBUTTON_RIGHT,
    Mouse,
    RESOLUTION_AUTO,
    TONEMAP_LINEAR,
    TextureHandler,
    Vec3,
    VoxelOccupancy,
    createGraphicsDevice,
    math
} from 'playcanvas';

import { data, deviceType } from 'examples/context';

import { SceneParticlesEffect } from './scene-particles-effect.mjs';

/**
 * @import { VoxelOccupancyMetadata } from 'playcanvas'
 */

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const gfxOptions = {
    deviceTypes: [deviceType],

    // Gaussian splats do not benefit from antialiasing, and the scene depth the splats write
    // requires it to be off
    antialias: false
};

const device = await createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new AppOptions();
createOptions.graphicsDevice = device;
createOptions.mouse = new Mouse(document.body);
createOptions.keyboard = new Keyboard(window);

createOptions.componentSystems = [CameraComponentSystem, GSplatComponentSystem];
createOptions.resourceHandlers = [TextureHandler, GSplatHandler, JsonHandler, BinaryHandler];

const app = new AppBase(canvas);
app.init(createOptions);

app.setCanvasFillMode(FILLMODE_FILL_WINDOW);
app.setCanvasResolution(RESOLUTION_AUTO);

const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => {
    window.removeEventListener('resize', resize);
});

// The voxels were generated from the splats by splat-transform, with the floaters around the room
// removed, and without any of the fills meant for walkable collision. The low opacity threshold
// keeps the thinly covered parts of the floor solid, and the holes left in them up to 10 cm wide
// are closed, so the particles do not fall through the floor:
// splat-transform apartment.sog --seed-pos 4.3,1.3,-4.85 --filter-cluster --voxel-size 0.05 --voxel-opacity 0.02 --voxel-close 0.1 apartment.voxel.json
const assets = {
    splat: new Asset('apartment', 'gsplat', { url: './assets/splats/apartment.sog' }),
    voxelMeta: new Asset('apartment-voxels', 'json', { url: './assets/splats/apartment.voxel.json' }),
    voxelData: new Asset('apartment-voxel-data', 'binary', { url: './assets/splats/apartment.voxel.bin' })
};

await new Promise((resolve) => {
    new AssetListLoader(Object.values(assets), app.assets).load(resolve);
});

app.start();

const miniStats = new MiniStats(app, MiniStats.getDefaultOptions(['compute']));

// The presets, each setting all the parameters of the brush, the physics and the look at once,
// which can then be changed by hand. The first ones run on their own, the others are painted with
// the brush.
/** @type {Record<string, Record<string, number|string>>} */
const PRESETS = {
    // a gusty wind peels patches off the scene and carries them across the room, with no clicking
    windswept: {
        mode: 'wander',
        brush: 120,
        rate: 120,
        burst: 150,
        speed: 0.4,
        spread: 0.3,
        life: 8,
        size: 1.2,
        gravity: 1,
        bounce: 0.2,
        friction: 0.3,
        drag: 1.5,
        turbulence: 2.5,
        well: 25,
        glow: 0.2,
        streak: 0.008,
        bloom: 0.02,
        fire: 0,
        temperature: 1,
        cooling: 1,
        wind: 4
    },
    // a storm blows the whole scene away as sand, with no clicking
    sandstorm: {
        mode: 'screen',
        brush: 40,
        rate: 140,
        burst: 150,
        speed: 0.3,
        spread: 0,
        life: 6,
        size: 0.7,
        gravity: 2,
        bounce: 0.1,
        friction: 0.6,
        drag: 2,
        turbulence: 3,
        well: 25,
        glow: 0.1,
        streak: 0.015,
        bloom: 0.02,
        fire: 0,
        temperature: 1,
        cooling: 1,
        wind: 7
    },
    // the whole scene slowly turns to glowing ash, which drifts up and away, with no clicking
    dissolve: {
        mode: 'screen',
        brush: 40,
        rate: 80,
        burst: 150,
        speed: 0.15,
        spread: 0,
        life: 6,
        size: 1.1,
        gravity: -0.6,
        bounce: 0.2,
        friction: 0.3,
        drag: 1.5,
        turbulence: 2,
        well: 25,
        glow: 0.8,
        streak: 0.004,
        bloom: 0.04,
        fire: 0,
        temperature: 1,
        cooling: 1,
        wind: 0.6
    },
    // patches of the scene catch fire, which rises as flames, with no clicking
    burning: {
        mode: 'wander',
        brush: 110,
        rate: 50,
        burst: 150,
        speed: 0.8,
        spread: 0.5,
        life: 4,
        size: 0.8,
        gravity: -2,
        bounce: 0.3,
        friction: 0.2,
        drag: 1.4,
        turbulence: 5,
        well: 25,
        glow: 0.7,
        streak: 0.02,
        bloom: 0.04,
        fire: 1,
        temperature: 0.75,
        cooling: 0.6,
        wind: 0.8
    },
    // chunks of the surface, which tumble down and bounce around the room
    debris: {
        mode: 'stream',
        brush: 40,
        rate: 150,
        burst: 150,
        speed: 3.5,
        spread: 1.2,
        life: 12,
        size: 1.6,
        gravity: 9.8,
        bounce: 0.45,
        friction: 0.15,
        drag: 0.3,
        turbulence: 1.5,
        well: 25,
        glow: 0.3,
        streak: 0.006,
        bloom: 0.02,
        fire: 0,
        temperature: 1,
        cooling: 1,
        wind: 0
    },
    // fine grains, which pour off the surface and pile up on the floor
    sand: {
        mode: 'stream',
        brush: 40,
        rate: 500,
        burst: 300,
        speed: 1.2,
        spread: 0.5,
        life: 30,
        size: 1,
        gravity: 12,
        bounce: 0.05,
        friction: 0.85,
        drag: 0.4,
        turbulence: 0,
        well: 25,
        glow: 0,
        streak: 0.002,
        bloom: 0.01,
        fire: 0,
        temperature: 1,
        cooling: 1,
        wind: 0
    },
    // a click shatters the surface into a burst of hot fragments
    shatter: {
        mode: 'burst',
        brush: 40,
        rate: 150,
        burst: 300,
        speed: 7,
        spread: 2.5,
        life: 10,
        size: 1.4,
        gravity: 9.8,
        bounce: 0.35,
        friction: 0.3,
        drag: 0.4,
        turbulence: 0.5,
        well: 25,
        glow: 1.2,
        streak: 0.03,
        bloom: 0.06,
        fire: 0,
        temperature: 1,
        cooling: 1,
        wind: 0
    },
    // rubber balls, which keep bouncing off the walls
    bouncy: {
        mode: 'stream',
        brush: 40,
        rate: 60,
        burst: 100,
        speed: 6,
        spread: 2,
        life: 15,
        size: 2.5,
        gravity: 9.8,
        bounce: 0.92,
        friction: 0.02,
        drag: 0.05,
        turbulence: 0,
        well: 25,
        glow: 0.5,
        streak: 0.01,
        bloom: 0.03,
        fire: 0,
        temperature: 1,
        cooling: 1,
        wind: 0
    },
    // no gravity, the particles drift through the room and off the walls
    zeroGravity: {
        mode: 'stream',
        brush: 40,
        rate: 150,
        burst: 150,
        speed: 1.5,
        spread: 2,
        life: 20,
        size: 1.2,
        gravity: 0,
        bounce: 0.7,
        friction: 0.05,
        drag: 0.05,
        turbulence: 0.6,
        well: 40,
        glow: 0.8,
        streak: 0.015,
        bloom: 0.04,
        fire: 0,
        temperature: 1,
        cooling: 1,
        wind: 0
    },
    // white hot sparks, as from a grinder, which bounce off the floor and die out
    sparks: {
        mode: 'stream',
        brush: 40,
        rate: 25,
        burst: 60,
        speed: 6,
        spread: 2,
        life: 2.5,
        size: 0.5,
        gravity: 9.8,
        bounce: 0.5,
        friction: 0.1,
        drag: 0.2,
        turbulence: 0,
        well: 25,
        glow: 0.8,
        streak: 0.03,
        bloom: 0.04,
        fire: 1,
        temperature: 1,
        cooling: 1.6,
        wind: 0
    },
    // glowing embers, which rise on the heat, swirl, and fade
    embers: {
        mode: 'stream',
        brush: 40,
        rate: 40,
        burst: 100,
        speed: 1.5,
        spread: 1.5,
        life: 6,
        size: 0.7,
        gravity: -1.5,
        bounce: 0.3,
        friction: 0.2,
        drag: 1.2,
        turbulence: 6,
        well: 30,
        glow: 0.6,
        streak: 0.02,
        bloom: 0.04,
        fire: 1,
        temperature: 0.8,
        cooling: 0.5,
        wind: 0
    },
    // blobs of lava, which ooze off the surface, pool on the floor and cool into a dark crust
    lava: {
        mode: 'stream',
        brush: 40,
        rate: 60,
        burst: 100,
        speed: 2,
        spread: 0.8,
        life: 20,
        size: 3.5,
        gravity: 9.8,
        bounce: 0.05,
        friction: 0.9,
        drag: 0.6,
        turbulence: 0.3,
        well: 25,
        glow: 0.5,
        streak: 0.004,
        bloom: 0.03,
        fire: 1,
        temperature: 0.7,
        cooling: 0.15,
        wind: 0
    }
};

data.set('data', {
    preset: 'sandstorm',
    ...PRESETS.sandstorm,
    collide: true
});

data.on('data.preset:set', (/** @type {string} */ name) => {
    const preset = PRESETS[name];
    if (preset) {
        for (const [key, value] of Object.entries(preset)) {
            data.set(`data.${key}`, value);
        }
    }
});
data.set('stats', { particles: '0' });

// ------ The scene ------

// splat-transform writes the voxels in the frame the splats render in after the usual 180 degree
// rotation around Z, so the splats are rotated the same way to line up with them
const splat = new Entity('apartment');
splat.addComponent('gsplat', { asset: assets.splat });
splat.setLocalEulerAngles(0, 0, 180);
app.root.addChild(splat);

// The particles are spawned at the depth of the pixels under the brush, which only the forward pass
// of the splats can produce
app.scene.gsplat.sceneDepthWrite = true;

const camera = new Entity('camera');
camera.addComponent('camera', {
    clearColor: new Color(0, 0, 0, 1),
    fov: 75,
    nearClip: 0.05,
    farClip: 100,
    toneMapping: TONEMAP_LINEAR
});
camera.setLocalPosition(3.5, 1.5, -4.5);
app.root.addChild(camera);

// ------ The voxels ------

// The voxels stay in CPU memory in the sparse octree splat-transform writes, for the camera to
// collide with, and the particles query them on the GPU, from a volume texture with a 64 bit mask
// of a block of 4x4x4 voxels in each texel
const voxels = new VoxelOccupancy(
    /** @type {VoxelOccupancyMetadata} */ (assets.voxelMeta.resource),
    /** @type {ArrayBuffer} */ (assets.voxelData.resource)
);

// ------ Input ------

const state = {
    yaw: 90,
    pitch: -5,
    mouseX: 0,
    mouseY: 0,
    pendingBurst: 0,
    velocity: new Vec3(),

    // the brush this frame, in CSS pixels
    brushX: 0,
    brushY: 0,
    brushRadius: 0
};

/**
 * Places the brush: under the mouse, roaming the screen on its own in the wander mode, or covering
 * all of it in the screen mode.
 *
 * @param {number} time - The time, in seconds.
 */
const updateBrush = (time) => {
    const mode = data.get('data.mode');
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (mode === 'wander') {
        state.brushX = width * (0.5 + 0.38 * Math.sin(time * 0.29) * Math.cos(time * 0.11 + 1.3));
        state.brushY = height * (0.5 + 0.32 * Math.sin(time * 0.23 + 2.1));
        state.brushRadius = data.get('data.brush');
    } else if (mode === 'screen') {
        state.brushX = width * 0.5;
        state.brushY = height * 0.5;
        state.brushRadius = Math.hypot(width, height) * 0.5;
    } else {
        state.brushX = state.mouseX;
        state.brushY = state.mouseY;
        state.brushRadius = data.get('data.brush');
    }
};

// The buttons held down, to look with the left one and paint with the right one, are read with
// isPressed instead of being tracked from the mousedown and mouseup events: Mouse does not fire
// mouseup for a button released outside of the window, which would leave them stuck down.
// TODO: track them with the mouse events again once mouseup fires for those releases (#9906)
const isLooking = () => app.mouse.isPressed(MOUSEBUTTON_LEFT);
const isPainting = () => app.mouse.isPressed(MOUSEBUTTON_RIGHT);

app.mouse.disableContextMenu();
app.mouse.on('mousedown', (e) => {
    if (e.button === MOUSEBUTTON_RIGHT && data.get('data.mode') === 'burst') {
        state.pendingBurst += data.get('data.burst') * 1000;
    }
});
app.mouse.on('mousemove', (e) => {
    state.mouseX = e.x;
    state.mouseY = e.y;
    if (isLooking()) {
        state.yaw -= e.dx * 0.2;
        state.pitch = math.clamp(state.pitch - e.dy * 0.2, -89, 89);
    }
});
app.mouse.on('mousewheel', (e) => {
    data.set('data.brush', math.clamp(data.get('data.brush') * (e.wheelDelta > 0 ? 1.1 : 1 / 1.1), 4, 300));
});

// the brush outline
const brushRing = document.createElement('div');
brushRing.style.cssText =
    'position:absolute; pointer-events:none; border-radius:50%; border:1.5px solid rgba(255,190,120,0.8); box-shadow:0 0 8px rgba(255,140,60,0.6);';
document.body.appendChild(brushRing);
app.on('destroy', () => brushRing.remove());

const move = new Vec3();
const step = new Vec3();
const position = new Vec3();

// a fly camera, which collides with the voxels when asked to
const updateCamera = (/** @type {number} */ dt) => {
    camera.setLocalEulerAngles(state.pitch, state.yaw, 0);

    const keyboard = app.keyboard;
    move.set(0, 0, 0);
    if (keyboard.isPressed(KEY_W)) move.add(camera.forward);
    if (keyboard.isPressed(KEY_S)) move.sub(camera.forward);
    if (keyboard.isPressed(KEY_D)) move.add(camera.right);
    if (keyboard.isPressed(KEY_A)) move.sub(camera.right);
    if (keyboard.isPressed(KEY_E)) move.add(Vec3.UP);
    if (keyboard.isPressed(KEY_Q)) move.sub(Vec3.UP);
    if (move.lengthSq() > 0) {
        move.normalize().mulScalar(keyboard.isPressed(KEY_SHIFT) ? 6 : 2);
    }

    // ease the velocity toward the requested one
    state.velocity.lerp(state.velocity, move, Math.min(1, dt * 10));
    step.copy(state.velocity).mulScalar(dt);

    // each axis moves on its own, so the camera slides along the walls it hits. A camera which is in
    // a solid voxel already is free to move, so that it cannot get stuck.
    position.copy(camera.getLocalPosition());
    const collide = data.get('data.collide');
    const axes = /** @type {const} */ (['x', 'y', 'z']);
    for (const axis of axes) {
        const previous = position[axis];
        const free = !voxels.isSolid(position);
        position[axis] += step[axis];
        if (collide && free && voxels.isSolid(position)) {
            position[axis] = previous;
            state.velocity[axis] = 0;
        }
    }
    camera.setLocalPosition(position);
};

// ------ The camera frame ------

const cameraFrame = new CameraFrame(app, camera.camera);
cameraFrame.rendering.toneMapping = TONEMAP_LINEAR;
cameraFrame.bloom.blurLevel = 7;

// the particles spawn from the scene the camera frame renders, and render into it
const particles = new SceneParticlesEffect(device, { capacity: 2 * 1024 * 1024 });
particles.voxels = voxels;
cameraFrame.addEffect(particles);

const windDirection = new Vec3();
let time = 0;

// ------ Update ------

app.on('update', (/** @type {number} */ dt) => {
    time += dt;
    updateCamera(dt);

    // the particles spawned this frame: by the brush under the mouse while painting, or all the
    // time by the automatic modes
    const mode = data.get('data.mode');
    const automatic = mode === 'wander' || mode === 'screen';
    updateBrush(time);
    let count = state.pendingBurst;
    state.pendingBurst = 0;
    const looking = isLooking();
    if (automatic || (isPainting() && !looking && mode === 'stream')) {
        count += Math.round(data.get('data.rate') * 1000 * Math.min(dt, 1 / 30));
    }
    const height = canvas.clientHeight;
    particles.emit(state.brushX / canvas.clientWidth, state.brushY / height, state.brushRadius / height, count);

    // a burst blasts the particles off faster
    particles.speed = data.get('data.speed') * (mode === 'burst' ? 2 : 1);
    particles.spread = data.get('data.spread');
    particles.lifetime = data.get('data.life');
    particles.size = data.get('data.size');

    particles.gravity.set(0, -data.get('data.gravity'), 0);
    particles.drag = data.get('data.drag');
    particles.turbulence = data.get('data.turbulence');
    particles.bounce = data.get('data.bounce');
    particles.friction = data.get('data.friction');

    // the wind blows across the view, in gusts
    const gust = 0.55 + 0.45 * Math.sin(time * 0.8) * Math.sin(time * 0.31 + 0.7);
    const wind = data.get('data.wind') * gust;
    windDirection.copy(camera.right);
    windDirection.y = 0;
    windDirection.normalize();
    particles.wind.set(windDirection.x * wind, wind * 0.15, windDirection.z * wind);

    // the gravity well floats in front of the camera, under the mouse, and swirls toward it
    camera.camera.screenToWorld(state.mouseX, state.mouseY, 3, particles.attractorPosition);
    particles.attractorStrength = app.keyboard.isPressed(KEY_SPACE) ? data.get('data.well') : 0;
    particles.attractorAxis.copy(camera.forward);

    particles.glow = data.get('data.glow');
    particles.streak = data.get('data.streak');
    particles.fire = data.get('data.fire');
    particles.temperature = data.get('data.temperature');
    particles.cooling = data.get('data.cooling');

    cameraFrame.bloom.intensity = data.get('data.bloom');
    cameraFrame.update();

    // the brush outline follows the mouse, and is hidden in the automatic modes
    const radius = data.get('data.brush');
    brushRing.style.left = `${state.mouseX - radius}px`;
    brushRing.style.top = `${state.mouseY - radius}px`;
    brushRing.style.width = `${radius * 2}px`;
    brushRing.style.height = `${radius * 2}px`;
    brushRing.style.display = looking || automatic ? 'none' : 'block';

    data.set('stats.particles', particles.count.toLocaleString());
});

app.on('destroy', () => {
    particles.destroy();
    voxels.destroy();
});

export { app, miniStats };
