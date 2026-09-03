// @config
//
// Volumetric fog and depth of field in a Gaussian Splat scene, with no proxy geometry of any kind -
// both read a scene depth the splats write themselves, see {accent:Scene#gsplat.sceneDepthWrite}.
//
// @flag NO_MINISTATS
//
// @credit
// title: SplatGen_demo_addon
// author: shehab mekky
// source: https://superspl.at/scene/c1e6297e
// license: CC BY 4.0 (http://creativecommons.org/licenses/by/4.0/)

import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    CameraComponentSystem,
    CameraFrame,
    Entity,
    FILLMODE_FILL_WINDOW,
    GSplatComponentSystem,
    GSplatHandler,
    Keyboard,
    LightComponentSystem,
    Mouse,
    MiniStats,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    SHADOWUPDATE_REALTIME,
    SHADOW_PCF3_32F,
    SceneDepthReader,
    ScriptComponentSystem,
    ScriptHandler,
    TONEMAP_LINEAR,
    TextureHandler,
    TouchDevice,
    Vec3,
    Vec4,
    createGraphicsDevice,
    platform
} from 'playcanvas';
import { CameraControls } from 'playcanvas/scripts/esm/camera-controls.mjs';
import { ProceduralSky } from 'playcanvas/scripts/esm/sky/procedural-sky.mjs';

import { data, deviceType } from 'examples/context';

/**
 * @import { LightComponent } from 'playcanvas'
 */

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const gfxOptions = {
    deviceTypes: [deviceType],

    // Disable antialiasing as gaussian splats do not benefit from it and it's expensive. Scene
    // texture depth also requires it to be off, as resolving a depth attachment would average
    // depths across a silhouette.
    antialias: false
};

const device = await createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

// The scene depth is stored as the reciprocal of the distance, in the widest float format the device
// can render and blend into - R32F for preference, R16F where that is not available. One over the far
// clip has to stay a normal half float on the fallback, which caps the far clip at 16384 there, so it
// is kept well inside that: generous where the format can carry it, tight where it cannot, which costs
// the far mountains rather than the precision the fog and the DOF need.
const FAR_CLIP = device.textureFloatBlendable ? 1000 : 200;

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
    GSplatComponentSystem
];
createOptions.resourceHandlers = [TextureHandler, ScriptHandler, GSplatHandler];

const app = new AppBase(canvas);
app.init(createOptions);

app.setCanvasFillMode(FILLMODE_FILL_WINDOW);
app.setCanvasResolution(RESOLUTION_AUTO);

const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => {
    window.removeEventListener('resize', resize);
});

// The capture is Y down and reconstructed at its own scale, so everything with a world space unit
// attached to it is gathered here.
const CAPTURE = {
    // A copy of the credited capture with part of the scene - a logo - removed, which is what the
    // CC BY 4.0 it is under asks to be noted. The author's page is https://superspl.at/user/shehabmekky
    splatUrl: 'https://s3.eu-west-1.amazonaws.com/code.playcanvas.com/examples_data/splatgen_01/editted.sog',

    // a single SOG capture roughly 5 units across, framed from just off its axis with the sun turned
    // round behind it so the shafts rake across the frame
    cameraPosition: [1.9, 3.66, 7.49],
    focusPoint: [0.21, 3.18, -0.22],
    moveSpeed: 1.5,
    sceneSize: 4,
    shadowDistance: 15,

    // The furthest the autofocus is allowed to focus. Where the splats thin out, their depth fades
    // toward the far clip, so a focus distance landing inside that fade would put a thin in focus
    // contour through an otherwise blurred background - the depth crosses the whole focus range within
    // a pixel or two there. A read past this is clamped to it rather than discarded, so looking into
    // the distance pulls the focus out to the limit instead of leaving it wherever it happened to be,
    // which is what the reticle turning orange-red indicates. The capture sits about 8 units away and
    // is 5 across, so this clears it comfortably.
    focusMaxDistance: 15,

    // the capture spans about y -1.5 to 1.8, so the density is held constant past its top and only
    // thins above that - the fog reaches through the whole of it rather than pooling in the bottom
    fogHeightBase: 2.2,
    fogHeightFalloff: 0.4
};

const splatAsset = new Asset('splat', 'gsplat', { url: CAPTURE.splatUrl });

await new Promise((resolve) => {
    new AssetListLoader([splatAsset], app.assets).load(resolve);
});

app.start();

const miniStats = new MiniStats(app, MiniStats.getDefaultOptions(['gsplats'])); // eslint-disable-line no-unused-vars

// The sun climbs from the horizon at 06:00 to this elevation at noon
const MAX_SUN_ELEVATION = 65;

// Initial UI state
data.set('settings', {
    // a CameraFrame.debug mode, which displays one of the values the frame generates in place of the
    // composed result. 'none' for the composed frame itself.
    debug: 'none',

    fog: {
        enabled: true,
        density: 0.071,
        anisotropy: 0.68,
        intensity: 2,
        maxDistance: 20,
        steps: 32,
        scale: 0.5
    },
    dof: {
        enabled: true,

        // the diameter of the circle the autofocus samples, as a percentage of the view
        focusSize: 2,
        focusRange: 1,
        blurRadius: 4
    },
    sky: {
        // late afternoon, so the sun rakes across the capture and the shafts are at their longest
        time: 17.8,

        // turns the sky, the sun and its shadows around Y, to orient them over the capture
        rotation: 302,

        // the scene is rendered without a tone curve, so this is what holds the brightest parts of the
        // capture off the clip - the default 1 works at this sun angle, a lower one as it comes round
        exposure: 1
    }
});

// ------ Camera ------
const camera = new Entity('camera');
camera.addComponent('camera', {
    fov: 70,
    farClip: FAR_CLIP,

    // the splats are captured in daylight and need no tone curve on top of that
    toneMapping: TONEMAP_LINEAR
});
app.root.addChild(camera);

camera.addComponent('script');

// orbit, pan and fly all enabled - CameraControls starts in orbit and switches to fly on the fly input
const cc = /** @type {CameraControls} */ (/** @type {any} */ (camera.script).create(CameraControls));

// ------ Sun ------
// A single directional light kept in sync with the procedural sky below, so the time of day drives
// its direction, color and intensity at once. The splats cast into its shadow map, which is what
// carves the shafts out of the fog.
const sun = new Entity('sun');
sun.addComponent('light', {
    type: 'directional',

    // captured by the procedural sky as the daytime peak, then faded across the day / night cycle
    intensity: 6,
    castShadows: true,
    shadowType: SHADOW_PCF3_32F,
    shadowResolution: 2048,

    // gaussian splats do not cast into cascaded shadow maps, and the fog needs their shadows to have
    // any shafts in it, so a single cascade is used
    numCascades: 1,
    shadowBias: 0.3,
    normalOffsetBias: 0.2,

    // the sun moves with the time of day, so the shadow map cannot be rendered just once
    shadowUpdateMode: SHADOWUPDATE_REALTIME
});
app.root.addChild(sun);

// ------ Procedural sky ------
const sky = new Entity('sky');
sky.addComponent('script');
const skyScript = /** @type {ProceduralSky} */ (/** @type {any} */ (sky.script).create(ProceduralSky));
skyScript.sunLight = sun;
app.root.addChild(sky);

// ------ Splats ------
// The capture is Y down, so it needs the usual 180 degree rotation around X to stand up in the
// engine's Y up world.
const splat = new Entity('capture');
splat.addComponent('gsplat', {
    asset: splatAsset,
    castShadows: true
});
splat.setLocalEulerAngles(180, 0, 0);
app.root.addChild(splat);

app.scene.gsplat.radialSorting = true;
app.scene.gsplat.splatBudget = (platform.mobile ? 1 : 6) * 1000000;

// The splats are what the fog and the DOF stop at, and only their forward pass can produce that depth -
// the prepass it would otherwise come from renders opaque meshes only, of which this scene has none.
// Whether the device can do it at all is CameraFrame.isSplatSceneDepthSupported.
app.scene.gsplat.sceneDepthWrite = true;

// ------ Camera frame with volumetric fog ------
const cameraFrame = new CameraFrame(app, camera.camera);
cameraFrame.rendering.sharpness = 0.5;
cameraFrame.volumetricFog.light = /** @type {LightComponent} */ (sun.light);
cameraFrame.volumetricFog.tint.set(1, 0.93, 0.83);
cameraFrame.volumetricFog.ambientColor.set(0.55, 0.68, 0.9);
cameraFrame.volumetricFog.ambientIntensity = 0.02;

// the DOF settings which are not exposed as controls, see graphics/depth-of-field for those
cameraFrame.dof.nearBlur = true;
cameraFrame.dof.blurRings = 4;
cameraFrame.dof.blurRingPoints = 5;
cameraFrame.dof.highQuality = true;

// ------ Autofocus ------
// The engine has no autofocus, so this reads the scene depth the DOF pass consumes back to the CPU and
// eases the focus distance toward what is in the middle of the screen. SceneDepthReader renders the
// region it is asked for through the same chunk the effects sample the depth with, so this works
// whichever format the depth ended up in, and the read landing a frame or two later is hidden by the
// easing.
const FOCUS_TAU = 0.15;
const FOCUS_SAMPLES = 8;

const depthReader = new SceneDepthReader(camera.camera);
const focusRect = new Vec4();
const focusSamples = new Float32Array(FOCUS_SAMPLES * FOCUS_SAMPLES);

/** Marks the region the autofocus samples. */
const reticle = document.createElement('div');
reticle.style.cssText =
    'position:absolute;left:50%;top:50%;border:1px solid rgba(255,255,255,0.9);border-radius:50%;' +
    'box-shadow:0 0 3px rgba(0,0,0,0.8);pointer-events:none;display:none;';
document.body.appendChild(reticle);

/** The distance the last read resolved to, or null while nothing has been in focus range. */
let focusTarget = null;

/** The eased value driving the DOF pass, null until the first read lands. */
let smoothedFocus = null;

/** Whether the last read was further than the focus is allowed to go, and so was clamped to it. */
let focusClamped = false;

app.on('destroy', () => {
    depthReader.destroy();
    reticle.remove();
});

app.on('update', (/** @type {number} */ dt) => {
    const { dof } = data.get('settings');

    if (!dof.enabled) {
        reticle.style.display = 'none';
        return;
    }

    // the sampled region as a fraction of the view, and the reticle covering the same area of the screen.
    // The region is given in normalized units, which are not square on screen, so its height is corrected
    // by the aspect ratio - otherwise the round reticle would not mark what is actually read.
    const size = dof.focusSize / 100;
    const height = (size * canvas.clientWidth) / canvas.clientHeight;
    focusRect.set(0.5 - size / 2, 0.5 - height / 2, size, height);
    const cssSize = size * canvas.clientWidth;
    reticle.style.width = `${cssSize}px`;
    reticle.style.height = `${cssSize}px`;
    reticle.style.margin = `${-cssSize / 2}px 0 0 ${-cssSize / 2}px`;
    reticle.style.display = focusTarget === null ? 'none' : 'block';

    // orange-red while the read is further than the focus is allowed to go, so it is clear that the
    // focus is sitting at its limit rather than on what the reticle covers
    reticle.style.borderColor = focusClamped ? 'rgba(255, 90, 30, 0.95)' : 'rgba(255, 255, 255, 0.9)';

    // Read every frame, with no regard for whether earlier reads have landed - several can be in flight.
    // They all fill the same array, which SceneDepthReader asks callers not to do when reads overlap, so
    // a read can resolve against samples a later one has already overwritten. That only ever means the
    // focus eases toward a distance a frame or two stale, which the easing below absorbs, and it saves
    // allocating an array per frame - a reader whose result mattered exactly would pass its own.
    // The median rather than the nearest sample, as captures are full of faint floaters which would
    // otherwise grab the focus, and thinly covered pixels read too far - the splat depth is weighted by
    // transmittance, so it blends toward the value the depth was cleared to where coverage is partial.
    depthReader.read(focusRect, FOCUS_SAMPLES, FOCUS_SAMPLES, focusSamples)?.then((samples) => {
        // a region with nothing in it reads as every sample infinite, which is a read of the distance
        // like any other and clamps the same way - rather than being dropped, which would leave the
        // focus wherever it happened to be
        const finite = samples.filter(Number.isFinite).sort();
        const median = finite.length ? finite[finite.length >> 1] : Infinity;
        focusClamped = median > CAPTURE.focusMaxDistance;
        focusTarget = Math.min(median, CAPTURE.focusMaxDistance);
    });

    if (focusTarget !== null) {
        // ease toward the read distance, frame rate independent, snapping on the first one
        smoothedFocus =
            smoothedFocus === null
                ? focusTarget
                : smoothedFocus + (focusTarget - smoothedFocus) * (1 - Math.exp(-dt / FOCUS_TAU));
        cameraFrame.dof.focusDistance = smoothedFocus;
        cameraFrame.update();
    }
});

// Everything with a world space unit attached to it comes from CAPTURE
camera.setLocalPosition(.../** @type {[number, number, number]} */ (CAPTURE.cameraPosition));
Object.assign(cc, {
    sceneSize: CAPTURE.sceneSize,
    moveSpeed: CAPTURE.moveSpeed,
    moveFastSpeed: CAPTURE.moveSpeed * 4,
    focusPoint: new Vec3(.../** @type {[number, number, number]} */ (CAPTURE.focusPoint))
});
sun.light.shadowDistance = CAPTURE.shadowDistance;

cameraFrame.volumetricFog.heightBase = CAPTURE.fogHeightBase;
cameraFrame.volumetricFog.heightFalloff = CAPTURE.fogHeightFalloff;

const applySettings = () => {
    const { debug, dof, fog, sky: skySettings } = data.get('settings');

    cameraFrame.debug = debug === 'none' ? null : debug;

    cameraFrame.volumetricFog.enabled = fog.enabled;
    cameraFrame.volumetricFog.density = fog.density;
    cameraFrame.volumetricFog.anisotropy = fog.anisotropy;
    cameraFrame.volumetricFog.intensity = fog.intensity;
    cameraFrame.volumetricFog.maxDistance = fog.maxDistance;
    cameraFrame.volumetricFog.steps = fog.steps;
    cameraFrame.volumetricFog.scale = fog.scale;

    // the autofocus drives the focus distance itself, see above
    cameraFrame.dof.enabled = dof.enabled;
    cameraFrame.dof.focusRange = dof.focusRange;
    cameraFrame.dof.blurRadius = dof.blurRadius;

    cameraFrame.update();

    skyScript.rotation = skySettings.rotation;
    app.scene.exposure = skySettings.exposure;
};

applySettings();
data.on('*:set', () => applySettings());

// ------ Time of day ------
// The sun sweeps 15 degrees of azimuth per hour, so 06:00 is due east, noon due south and 18:00
// due west, and its elevation follows a sine that puts sunrise and sunset at 06:00 and 18:00.
app.on('update', () => {
    const hour = data.get('settings.sky.time');
    skyScript.azimuth = hour * 15;
    skyScript.elevation = MAX_SUN_ELEVATION * Math.sin(((hour - 6) / 12) * Math.PI);
});

// ------ Hold the loading screen until the capture is on screen ------
// The examples loading screen is dismissed once this module finishes evaluating, so waiting here for the
// first frame with nothing left to load keeps it up until the splats are being rendered - instead of
// handing over an empty sky and popping them in a moment later. Rendering runs during the wait, and
// everything above is already set up, so the first frame handed over is a composed one. The timeout is
// only there so that a capture which never finishes loading cannot leave the example on the loading
// screen for good.
await new Promise((resolve) => {
    const timer = setTimeout(resolve, 20000);
    const onFrameReady = (
        /** @type {any} */ cam,
        /** @type {any} */ layer,
        /** @type {boolean} */ ready,
        /** @type {number} */ loadingCount
    ) => {
        if (ready && loadingCount === 0) {
            app.systems.gsplat.off('frame:ready', onFrameReady);
            clearTimeout(timer);
            resolve();
        }
    };
    app.systems.gsplat.on('frame:ready', onFrameReady);
});
