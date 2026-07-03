// @config
//
// Realistic wind swaying of the trees in a gaussian splat scene. Each tree is given a small
// procedural skeleton: a vertical chain of bones running up through the green canopy, anchored
// at the trunk. The bones sway as a cantilever - the trunk stays put and the motion grows
// towards the branch tips, with a wave travelling up the tree, per-tree phase, gusts and a fast
// leaf flutter. Splats are skinned to the nearby bones (a weighted blend) in the per-frame
// vertex stage, so the foliage moves as a coherent surface rather than as random points. The
// ground grass optionally gets a subtle coherent sway of its own.
//
// @credit
// title: Knock Community Hall
// author: scbenoit
// source: https://superspl.at/scene/0ff2e6dc
// license: CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)

import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    CameraComponentSystem,
    CameraFrame,
    ContainerHandler,
    Entity,
    FILLMODE_FILL_WINDOW,
    GSplatComponentSystem,
    GSplatHandler,
    LightComponentSystem,
    Mouse,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    ScriptComponentSystem,
    ScriptHandler,
    TEXTURETYPE_RGBP,
    TONEMAP_ACES,
    TextureHandler,
    TouchDevice,
    createGraphicsDevice,
    math
} from 'playcanvas';

import { data, deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const gfxOptions = {
    deviceTypes: [deviceType],

    // disable antialiasing as gaussian splats do not benefit from it and it's expensive
    antialias: false
};

const device = await createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new AppOptions();
createOptions.graphicsDevice = device;
createOptions.mouse = new Mouse(document.body);
createOptions.touch = new TouchDevice(document.body);

createOptions.componentSystems = [
    RenderComponentSystem,
    CameraComponentSystem,
    LightComponentSystem,
    ScriptComponentSystem,
    GSplatComponentSystem
];
createOptions.resourceHandlers = [TextureHandler, ContainerHandler, ScriptHandler, GSplatHandler];

const app = new AppBase(canvas);
app.init(createOptions);

app.setCanvasFillMode(FILLMODE_FILL_WINDOW);
app.setCanvasResolution(RESOLUTION_AUTO);

const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => {
    window.removeEventListener('resize', resize);
});

const assets = {
    hall: new Asset('gsplat', 'gsplat', { url: './assets/splats/knock-community-hall.sog' }),
    orbit: new Asset('script', 'script', { url: './scripts/camera/orbit-camera.js' }),
    envAtlas: new Asset(
        'env-atlas',
        'texture',
        { url: './assets/cubemaps/helipad-env-atlas.png' },
        { type: TEXTURETYPE_RGBP, mipmaps: false }
    )
};

// Tree skeletons, expressed in the splat's model space (the raw splat coordinates). The scene
// entity is rotated 180 degrees about X, so world-up maps to model -Y: the ground grass sits at
// model Y ~ -1 and the canopies rise (in the world) towards model Y ~ -9. These values were
// measured by clustering the green foliage splats of this specific scene into two trees.
const CANOPY_BOTTOM_Y = -1.8; // model Y where the canopy meets the trunk (bones anchored here)
const CANOPY_TOP_Y = -9.0; // model Y at the tree tops (highest point in the world)
const BONES_PER_TREE = 10;
const TREES = [
    { cx: -4.3, cz: -5.65, phase: 0.0 },
    { cx: -4.6, cz: 2.64, phase: 2.1 }
];
const BONE_COUNT = TREES.length * BONES_PER_TREE;

// Per-bone rest data as vec4 (xyz = model-space rest position, w = influence radius). vec4 is
// used rather than vec3 so the uniform array has a matching 16-byte stride on WebGL2 and WebGPU.
const boneData = new Float32Array(BONE_COUNT * 4);
TREES.forEach((tree, ti) => {
    for (let k = 0; k < BONES_PER_TREE; k++) {
        const t = k / (BONES_PER_TREE - 1);
        const y = CANOPY_BOTTOM_Y + (CANOPY_TOP_Y - CANOPY_BOTTOM_Y) * t;
        // tighter influence near the trunk (keeps the trunk rigid), wider up in the canopy
        const radius = 2.0 + 1.7 * t;
        const o = (ti * BONES_PER_TREE + k) * 4;
        boneData[o] = tree.cx;
        boneData[o + 1] = y;
        boneData[o + 2] = tree.cz;
        boneData[o + 3] = radius;
    }
});

// Per-bone horizontal offset (vec4, xyz used) recomputed every frame on the CPU.
const boneOffset = new Float32Array(BONE_COUNT * 4);

const windShaderGLSL = /* glsl */ `
    uniform mat4 uInvWorld;                     // world -> model space of the splat entity
    uniform mat4 uWorld;                        // model -> world space of the splat entity
    uniform vec4 uBoneData[${BONE_COUNT}];      // xyz = model-space rest position, w = influence radius
    uniform vec4 uBoneOffset[${BONE_COUNT}];    // xyz = current model-space horizontal offset
    uniform float uTime;
    uniform vec2 uGrassDir;                     // horizontal wind direction (model XZ)
    uniform float uGrassAmp;

    void modifySplatCenter(inout vec3 center) {
        // the unified renderer provides world-space centers; work in the splat's model space
        // (where the measured bone/grass values live) and transform the result back to world
        vec3 mc = (uInvWorld * vec4(center, 1.0)).xyz;
        vec3 model = vec3(0.0);

        // foliage: blend the offsets of the nearby bones (compact-support weights), so the
        // canopy skins to the swaying skeleton and the trunk (near the anchored base bone,
        // whose offset is zero) stays still
        vec3 disp = vec3(0.0);
        float sumW = 0.0;
        for (int i = 0; i < ${BONE_COUNT}; i++) {
            vec3 delta = mc - uBoneData[i].xyz;
            float rad = uBoneData[i].w;
            float q = dot(delta, delta) / (rad * rad);
            if (q < 1.0) {
                float w = 1.0 - q;
                w *= w;
                disp += w * uBoneOffset[i].xyz;
                sumW += w;
            }
        }
        if (sumW > 0.0001) {
            model = disp / sumW;
        }

        // grass: subtle coherent horizontal wave in a narrow band around the ground plane
        float gw = smoothstep(-1.3, -1.05, mc.y) * (1.0 - smoothstep(-0.35, -0.1, mc.y));
        if (gw > 0.0 && uGrassAmp > 0.0) {
            vec2 p = mc.xz;
            float wave = 0.7 * sin(dot(p, vec2(0.9, 0.6)) + uTime * 1.7) +
                         0.3 * sin(dot(p, vec2(-0.5, 1.1)) * 1.7 + uTime * 2.3);
            model.x += uGrassDir.x * (uGrassAmp * gw * wave);
            model.z += uGrassDir.y * (uGrassAmp * gw * wave);
        }

        center += mat3(uWorld) * model;
    }

    void modifySplatRotationScale(vec3 originalCenter, vec3 modifiedCenter, inout vec4 rotation, inout vec3 scale) {
    }

    void modifySplatColor(vec3 center, inout vec4 color) {
    }
`;

const windShaderWGSL = /* wgsl */ `
    uniform uInvWorld: mat4x4f;                         // world -> model space of the splat entity
    uniform uWorld: mat4x4f;                            // model -> world space of the splat entity
    uniform uBoneData: array<vec4f, ${BONE_COUNT}>;     // xyz = model-space rest position, w = influence radius
    uniform uBoneOffset: array<vec4f, ${BONE_COUNT}>;   // xyz = current model-space horizontal offset
    uniform uTime: f32;
    uniform uGrassDir: vec2f;                           // horizontal wind direction (model XZ)
    uniform uGrassAmp: f32;

    fn modifySplatCenter(center: ptr<function, vec3f>) {
        // the unified renderer provides world-space centers; work in the splat's model space
        // (where the measured bone/grass values live) and transform the result back to world
        let mc = (uniform.uInvWorld * vec4f(*center, 1.0)).xyz;
        var model = vec3f(0.0);

        var disp = vec3f(0.0);
        var sumW = 0.0;
        for (var i = 0; i < ${BONE_COUNT}; i++) {
            let delta = mc - uniform.uBoneData[i].xyz;
            let rad = uniform.uBoneData[i].w;
            let q = dot(delta, delta) / (rad * rad);
            if (q < 1.0) {
                var w = 1.0 - q;
                w = w * w;
                disp += w * uniform.uBoneOffset[i].xyz;
                sumW += w;
            }
        }
        if (sumW > 0.0001) {
            model = disp / sumW;
        }

        let gw = smoothstep(-1.3, -1.05, mc.y) * (1.0 - smoothstep(-0.35, -0.1, mc.y));
        if (gw > 0.0 && uniform.uGrassAmp > 0.0) {
            let p = mc.xz;
            let wave = 0.7 * sin(dot(p, vec2f(0.9, 0.6)) + uniform.uTime * 1.7) +
                       0.3 * sin(dot(p, vec2f(-0.5, 1.1)) * 1.7 + uniform.uTime * 2.3);
            model.x += uniform.uGrassDir.x * (uniform.uGrassAmp * gw * wave);
            model.z += uniform.uGrassDir.y * (uniform.uGrassAmp * gw * wave);
        }

        let w3 = mat3x3f(uniform.uWorld[0].xyz, uniform.uWorld[1].xyz, uniform.uWorld[2].xyz);
        *center += w3 * model;
    }

    fn modifySplatRotationScale(originalCenter: vec3f, modifiedCenter: vec3f, rotation: ptr<function, vec4f>, scale: ptr<function, vec3f>) {
    }

    fn modifySplatColor(center: vec3f, color: ptr<function, vec4f>) {
    }
`;

await new Promise((resolve) => {
    new AssetListLoader(Object.values(assets), app.assets).load(resolve);
});

app.start();

// soft environment for the background and any reflections
app.scene.envAtlas = assets.envAtlas.resource;
app.scene.skyboxMip = 2;
app.scene.skyboxIntensity = 0.8;
app.scene.exposure = 1.2;

// default UI values
data.set('strength', 0.25);
data.set('speed', 1.0);
data.set('direction', 45);
data.set('gustiness', 0.4);
data.set('flutter', 0.3);
data.set('grass', 0.25);

// the splat scene
const hall = new Entity('hall');
hall.addComponent('gsplat', {
    asset: assets.hall
});
hall.setLocalEulerAngles(180, 0, 0);
app.root.addChild(hall);

// apply the wind vertex customization to the scene-wide gsplat material. modifySplatCenter runs
// in the per-frame render vertex stage, so updating the uniforms each frame animates the sway
// without re-rendering the work buffer.
const material = app.scene.gsplat.material;
material.getShaderChunks('glsl').set('gsplatModifyVS', windShaderGLSL);
material.getShaderChunks('wgsl').set('gsplatModifyVS', windShaderWGSL);
material.setParameter('uBoneData[0]', boneData);
// the entity transform is static, so pass the model<->world matrices once. modifySplatCenter
// receives world-space centers, which are converted to model space and back with these.
const worldMatrix = hall.getWorldTransform();
const invWorldMatrix = worldMatrix.clone().invert();
material.setParameter('uWorld', worldMatrix.data);
material.setParameter('uInvWorld', invWorldMatrix.data);
material.update();

// Create an Entity with a camera component
const camera = new Entity();
camera.addComponent('camera', {
    fov: 60,
    toneMapping: TONEMAP_ACES
});
camera.setLocalPosition(6, 4, 10);

camera.addComponent('script');
camera.script?.create('orbitCamera', {
    attributes: {
        inertiaFactor: 0.2,
        focusEntity: hall,
        distanceMin: 3,
        distanceMax: 40,
        frameOnStart: true
    }
});
camera.script?.create('orbitCameraInputMouse');
camera.script?.create('orbitCameraInputTouch');
app.root.addChild(camera);

const cameraFrame = new CameraFrame(app, camera.camera);
cameraFrame.rendering.samples = 4;
cameraFrame.rendering.toneMapping = TONEMAP_ACES;
cameraFrame.bloom.intensity = 0.02;
cameraFrame.update();

let time = 0;
app.on('update', (dt) => {
    time += dt;

    const strength = data.get('strength');
    const speed = data.get('speed');
    const gustiness = data.get('gustiness');
    const flutter = data.get('flutter');
    const angle = data.get('direction') * math.DEG_TO_RAD;
    const dirX = Math.cos(angle);
    const dirZ = Math.sin(angle);

    // Cantilever chain sway per tree: motion is zero at the anchored base bone and grows towards
    // the tips, with a wave travelling up the tree, a slow gust envelope and a fast flutter.
    TREES.forEach((tree, ti) => {
        const gust = 1.0 + gustiness * Math.sin(time * 0.5 + tree.phase * 1.7);
        for (let k = 0; k < BONES_PER_TREE; k++) {
            const t = k / (BONES_PER_TREE - 1);
            const bend = Math.pow(t, 1.5);
            const sway = strength * bend * gust * Math.sin(time * speed - t * 2.5 + tree.phase);
            const flick = strength * flutter * bend * Math.sin(time * speed * 3.1 + t * 17.0 + tree.phase * 2.3);
            const o = (ti * BONES_PER_TREE + k) * 4;
            boneOffset[o] = dirX * sway - dirZ * flick;
            boneOffset[o + 1] = 0;
            boneOffset[o + 2] = dirZ * sway + dirX * flick;
            boneOffset[o + 3] = 0;
        }
    });

    material.setParameter('uBoneOffset[0]', boneOffset);
    material.setParameter('uTime', time);
    material.setParameter('uGrassDir', [dirX, dirZ]);
    material.setParameter('uGrassAmp', data.get('grass') * 0.12);
});
