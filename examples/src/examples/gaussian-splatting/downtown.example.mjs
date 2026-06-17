// @config
//
// Streams a large real-world city downtown (Lublin, Poland) reconstructed as Gaussian splats.
// 250M splats, 18856 files, 6.0 GB for streaming.
//
// @flag NO_MINISTATS
// @flag PREFERRED_DEVICE=webgpu
//
// @credit
// title: Lublin downtown
// author: Andrii Shramko, Teleportour
// source: https://www.linkedin.com/in/andrii-shramko/
// license: teleportour.com https://teleportour.com
//
// @credit
// title: Kloofendal 48d Partly Cloudy (Pure Sky) HDRI
// author: Poly Haven
// source: https://polyhaven.com/a/kloofendal_48d_partly_cloudy_puresky
// license: CC0

import * as pc from 'playcanvas';
import { CameraControls } from 'playcanvas/scripts/esm/camera-controls.mjs';
import { GsplatRevealRadial } from 'playcanvas/scripts/esm/gsplat/reveal-radial.mjs';

import { data, deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const gfxOptions = {
    deviceTypes: [deviceType],

    // disable antialiasing as gaussian splats do not benefit from it and it's expensive
    antialias: false
};

const device = await pc.createGraphicsDevice(canvas, gfxOptions);

const createOptions = new pc.AppOptions();
createOptions.graphicsDevice = device;
createOptions.mouse = new pc.Mouse(document.body);
createOptions.touch = new pc.TouchDevice(document.body);
createOptions.keyboard = new pc.Keyboard(document.body);

createOptions.componentSystems = [
    pc.RenderComponentSystem,
    pc.CameraComponentSystem,
    pc.LightComponentSystem,
    pc.ScriptComponentSystem,
    pc.GSplatComponentSystem
];
createOptions.resourceHandlers = [pc.TextureHandler, pc.ContainerHandler, pc.ScriptHandler, pc.GSplatHandler];

const app = new pc.AppBase(canvas);
app.init(createOptions);

// Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
app.setCanvasResolution(pc.RESOLUTION_AUTO);

// auto resolution: treat DPR >= 2 as high-DPI (drops to half)
const applyResolution = () => {
    const dpr = window.devicePixelRatio || 1;
    device.maxPixelRatio = dpr >= 2 ? dpr * 0.5 : dpr;
};
applyResolution();

const resize = () => {
    applyResolution();
    app.resizeCanvas();
    // With on-demand rendering (autoRender is set to false once the reveal completes), a resize is
    // a viewport change the app makes itself — it does not raise 'frame:request' — so request a
    // render to draw the scene at the new canvas size.
    app.renderNextFrame = true;
};
window.addEventListener('resize', resize);
app.on('destroy', () => {
    window.removeEventListener('resize', resize);
});

const config = {
    name: 'Lublin-downtown',
    // The capture was split into 4 balanced pieces, each built as a multi-LOD streamed SOG bundle.
    // All pieces share the original world coordinates, so they load at the origin and reassemble.
    urls: [
        'https://code.playcanvas.com/examples_data/downtown_01/ssog0/lod-meta.json',
        'https://code.playcanvas.com/examples_data/downtown_01/ssog1/lod-meta.json',
        'https://code.playcanvas.com/examples_data/downtown_01/ssog2/lod-meta.json',
        'https://code.playcanvas.com/examples_data/downtown_01/ssog3/lod-meta.json'
    ],
    // Whole-scene orientation (euler degrees). The capture stores height on Z; this rotates it to
    // be Y-up for the fly camera. VERIFY/ADJUST once the real data is loaded.
    sceneRotation: [-90, 0, 0],
    lodUpdateDistance: 4,
    lodUnderfillLimit: 5,
    // distance-based LOD ramp base distance (LOD = 1 + log(d / base) / log(mult)); the multiplier
    // is derived from the splat budget — see the budget section below
    lodBaseDistance: 20,
    // fly speeds
    moveSpeed: 13,
    moveFastSpeed: 100,
    // default start view
    cameraPosition: [-87.42, -14.23, 179.97],
    cameraRotation: [-14.85, -64.12, 0],
    // partly-cloudy HDRI backdrop, downloaded at runtime from Poly Haven (CC0)
    skyUrl: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/2k/kloofendal_48d_partly_cloudy_puresky_2k.hdr'
};

const assets = {
    ssog0: new pc.Asset('ssog0', 'gsplat', { url: config.urls[0] }),
    ssog1: new pc.Asset('ssog1', 'gsplat', { url: config.urls[1] }),
    ssog2: new pc.Asset('ssog2', 'gsplat', { url: config.urls[2] }),
    ssog3: new pc.Asset('ssog3', 'gsplat', { url: config.urls[3] }),
    sky: new pc.Asset('hdri', 'texture', { url: config.skyUrl }, { mipmaps: false })
};

const assetListLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
assetListLoader.load(() => {
    app.start();

    // custom mini stats showing gsplat counts
    const miniStats = new pc.MiniStats(app, pc.MiniStats.getDefaultOptions(['gsplats', 'gsplatsCopy'])); // eslint-disable-line no-unused-vars

    const pieces = [assets.ssog0, assets.ssog1, assets.ssog2, assets.ssog3];

    // --- scene-wide gsplat defaults ---
    app.scene.gsplat.lodUpdateAngle = 90;
    app.scene.gsplat.lodBehindPenalty = 3;
    app.scene.gsplat.radialSorting = true;
    app.scene.gsplat.lodUpdateDistance = config.lodUpdateDistance;
    app.scene.gsplat.lodUnderfillLimit = config.lodUnderfillLimit;
    app.scene.gsplat.minPixelSize = 2;
    app.scene.gsplat.alphaClipForward = 1 / 255;
    app.scene.gsplat.minContribution = 3;
    app.scene.gsplat.dataFormat = pc.GSPLATDATA_COMPACT;

    // Colorize LODs debug toggle (off by default)
    data.set('colorizeLods', false);
    const applyColorizeLods = () => {
        app.scene.gsplat.debug = data.get('colorizeLods') ? pc.GSPLAT_DEBUG_LOD : pc.GSPLAT_DEBUG_NONE;
    };
    applyColorizeLods();
    data.on('colorizeLods:set', applyColorizeLods);

    // Renderer: CPU-sort raster on WebGL, GPU-sort raster on WebGPU
    app.scene.gsplat.renderer = device.isWebGPU ?
        pc.GSPLAT_RENDERER_RASTER_GPU_SORT :
        pc.GSPLAT_RENDERER_RASTER_CPU_SORT;

    // --- create the 4 streamed pieces under a single root (shared coordinate frame) ---
    const root = new pc.Entity('downtown');
    root.setLocalEulerAngles(config.sceneRotation[0], config.sceneRotation[1], config.sceneRotation[2]);
    app.root.addChild(root);

    /** @type {any[]} */
    const gsInstances = [];
    let totalSplats = 0;
    let lodLevels = 1;
    for (let i = 0; i < pieces.length; i++) {
        const entity = new pc.Entity(`${config.name}-${i}`);
        entity.addComponent('gsplat', { asset: pieces[i] });
        root.addChild(entity);
        gsInstances.push(/** @type {any} */ (entity.gsplat));

        const res = /** @type {any} */ (pieces[i].resource);
        totalSplats += res.numSplats ?? 0;
        lodLevels = Math.max(lodLevels, res.octree?.lodLevels ?? 1);
    }
    const toM = v => `${(v / 1e6).toFixed(1)}M`;
    data.set('data.stats.splatsTotal', toM(totalSplats));

    // combined world-space bounds, for framing the camera
    const worldAabb = new pc.BoundingBox();
    root.children.forEach((entity, i) => {
        const res = /** @type {any} */ (pieces[i].resource);
        const b = new pc.BoundingBox();
        b.setFromTransformedAabb(res.aabb, entity.getWorldTransform());
        if (i === 0) worldAabb.copy(b); else worldAabb.add(b);
    });
    const center = worldAabb.center.clone();
    const radius = worldAabb.halfExtents.length();

    // --- circular reveal: keep all splats hidden until the first frame is ready, then sweep them
    // in from the INITIAL CAMERA POSITION. Runs on the shared (unified) gsplat material, so one
    // instance drives all four pieces. While loading, the effect time is pinned negative
    // (everything hidden, see the update loop); it is released on frame:ready below. ---
    const camStart = new pc.Vec3(config.cameraPosition[0], config.cameraPosition[1], config.cameraPosition[2]);
    const revealReach = camStart.distance(center) + radius;   // furthest splat from the camera start
    const revealHost = /** @type {pc.Entity} */ (root.children[0]);
    revealHost.addComponent('script');
    const reveal = /** @type {any} */ ((/** @type {any} */ (revealHost.script)).create(GsplatRevealRadial));
    reveal.center.copy(camStart);
    reveal.endRadius = revealReach * 1.1;         // reaches the whole scene from the camera start
    reveal.speed = (revealReach * 1.1) / 3;       // sweep across in ~3s
    reveal.acceleration = 0;
    reveal.delay = 0;
    reveal.bandWidth = 10;                        // ~10-unit-wide highlight edge
    reveal.oscillationIntensity = 0.2;
    reveal.dotTint.set(0, 0, 0);                  // no leading dot tint
    reveal.waveTint.set(5, 0, 0);                 // red highlight edge
    let revealStarted = false;

    // --- infinite HDRI backdrop (partly-cloudy sky), backdrop only ---
    // Reproject the equirect HDRI into a skybox cubemap. We do NOT build an env-atlas / set
    // scene.envAtlas — the splats are pre-lit, so the sky contributes no lighting, just a backdrop.
    // Generated up front but revealed together with the scene (on frame:ready), so it doesn't pop
    // in before the splats.
    const skyboxCubemap = pc.EnvLighting.generateSkyboxCubemap(assets.sky.resource, 1024);
    app.scene.sky.type = pc.SKYTYPE_INFINITE;

    // Start with the 4 lowest (coarsest) LODs for a fast initial display that still gets some
    // nearby detail, then open up to the full range once the first frame's data is ready.
    const worstLod = lodLevels - 1;
    gsInstances.forEach((gs) => {
        gs.lodRangeMin = Math.max(0, worstLod - 3);
        gs.lodRangeMax = worstLod;
    });
    const gsplatSystem = /** @type {any} */ (app.systems.gsplat);
    const onFrameReady = (/** @type {any} */ cam, /** @type {any} */ layer, /** @type {boolean} */ ready, /** @type {number} */ loadingCount) => {
        if (ready && loadingCount === 0) {
            gsplatSystem.off('frame:ready', onFrameReady);
            gsInstances.forEach((gs) => {
                gs.lodRangeMin = 0;
                gs.lodRangeMax = worstLod;
            });
            // reveal the backdrop and sweep the splats in, together, now that the scene is ready
            app.scene.skybox = skyboxCubemap;
            revealStarted = true;
            reveal.effectTime = 0;
        }
    };
    gsplatSystem.on('frame:ready', onFrameReady);

    // --- fly camera, framed on the combined scene bounds ---
    const camera = new pc.Entity('camera');
    camera.addComponent('camera', {
        clearColor: new pc.Color(0.1, 0.11, 0.13),
        fov: 75,
        toneMapping: pc.TONEMAP_LINEAR,
        farClip: Math.max(10000, radius * 20)
    });
    camera.setLocalPosition(config.cameraPosition[0], config.cameraPosition[1], config.cameraPosition[2]);
    camera.setLocalEulerAngles(config.cameraRotation[0], config.cameraRotation[1], config.cameraRotation[2]);
    app.root.addChild(camera);

    // focus point straight ahead of the camera's initial orientation — CameraControls derives the
    // starting yaw/pitch from (position -> focus), reproducing the configured rotation.
    const focusPoint = camera.forward.clone().mulScalar(radius * 0.5).add(camera.getPosition());

    camera.addComponent('script');
    const cc = /** @type {CameraControls} */ ((/** @type {any} */ (camera.script)).create(CameraControls));
    Object.assign(cc, {
        sceneSize: radius,
        moveSpeed: config.moveSpeed,
        moveFastSpeed: config.moveFastSpeed,
        // high damping: the camera accelerates / decelerates much more gradually (floaty glide),
        // most noticeable at fast (shift) speed
        moveDamping: 0.997,
        enableOrbit: false,
        enablePan: false,
        focusPoint: focusPoint
    });

    // --- Splat budget (millions; 0 = no cap), driving both the cap and the LOD multiplier.
    // Base distance is fixed (config.lodBaseDistance); the multiplier interpolates 1.5 (at 2M) to
    // 2.5 (at the Extreme budget), clamped — coarser falloff as the budget grows. Default to the
    // Medium quality preset (desktop 8M / mobile 2M), so a quality button is lit at launch. ---
    const extremeBudget = pc.platform.mobile ? 8 : 25;
    data.set('splatBudget', pc.platform.mobile ? 4 : 8);
    const applySplatBudget = () => {
        const budget = data.get('splatBudget');
        app.scene.gsplat.splatBudget = Math.round(budget * 1000000);
        const t = pc.math.clamp((budget - 2) / (extremeBudget - 2), 0, 1);
        const mult = 1.5 + t * (2.5 - 1.5);
        for (let i = 0; i < gsInstances.length; i++) {
            gsInstances[i].lodBaseDistance = config.lodBaseDistance;
            gsInstances[i].lodMultiplier = mult;
        }
    };
    applySplatBudget();
    data.on('splatBudget:set', applySplatBudget);

    // --- on-screen quality buttons: each sets the splat budget. The Splat Budget slider in the
    // controls stays two-way bound to the same value, so it tracks the buttons and can still be
    // dragged; clicking a button just resets the value. ---
    const QUALITY = pc.platform.mobile ?
        [['Low', 2], ['Medium', 4], ['High', 6], ['Extreme', 8]] :
        [['Low', 4], ['Medium', 8], ['High', 16], ['Extreme', 25]];

    const qualityBar = document.createElement('div');
    Object.assign(qualityBar.style, {
        position: 'fixed',
        bottom: '16px',
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        gap: '6px',
        zIndex: '12',
        font: '500 13px/1 sans-serif'
    });
    const qualityButtons = QUALITY.map(([label, budget]) => {
        const b = document.createElement('button');
        b.textContent = /** @type {string} */ (label);
        Object.assign(b.style, {
            padding: '8px 14px',
            border: 'none',
            borderRadius: '4px',
            color: '#fff',
            cursor: 'pointer'
        });
        b.onclick = () => data.set('splatBudget', budget);
        qualityBar.appendChild(b);
        return b;
    });
    document.body.appendChild(qualityBar);
    app.on('destroy', () => qualityBar.remove());

    // highlight the button matching the current budget (none, if the slider is on another value)
    const updateQualityButtons = () => {
        const v = data.get('splatBudget');
        qualityButtons.forEach((b, i) => {
            b.style.background = QUALITY[i][1] === v ? 'rgba(255,140,0,0.9)' : 'rgba(0,0,0,0.5)';
        });
    };
    updateQualityButtons();
    data.on('splatBudget:set', updateQualityButtons);

    // --- On-demand rendering ----------------------------------------------------------------
    // Gaussian-splat streaming (LOD evaluation + file loading) runs every frame regardless of
    // rendering. We render continuously while the scene loads and the reveal animation plays, then
    // switch to rendering only on demand: when streaming has new data to show (the 'frame:request'
    // event), when the camera moves, or on a resize / UI change (handled where those occur). This
    // keeps the GPU idle while the huge city sits still, yet still streams in the background.

    // render whenever streaming produced new data (or a CPU sort result became ready to apply)
    app.systems.gsplat.on('frame:request', () => {
        app.renderNextFrame = true;
    });

    let onDemand = false;
    const lastCamPos = new pc.Vec3();
    const lastCamRot = new pc.Quat();

    // --- Stats + on-demand driver ---
    app.on('update', () => {
        // keep the reveal frozen (all splats hidden) until it is released on frame:ready
        if (!revealStarted) reveal.effectTime = -1e6;

        // update HUD stats
        data.set('data.stats.gsplats', toM(app.stats.frame.gsplats));
        const bb = app.graphicsDevice.backBufferSize;
        data.set('data.stats.resolution', `${bb.x} x ${bb.y}`);

        if (!onDemand) {
            // The reveal starts once the first frame is ready and disables itself when its animation
            // completes. Until then autoRender stays true so the scene streams in and the reveal
            // animates every frame; once it finishes, switch to on-demand rendering.
            if (revealStarted && reveal && !reveal.enabled) {
                onDemand = true;
                app.autoRender = false;

                // The reveal finishing is a draw-state change (it stops masking the splats), not a
                // streaming change, so it does not raise 'frame:request'. Render one final frame so
                // the fully-revealed scene is shown before we go idle.
                app.renderNextFrame = true;

                lastCamPos.copy(camera.getPosition());
                lastCamRot.copy(camera.getRotation());
            }
        } else {
            // keep the fly camera interactive: render when it has moved or rotated this frame
            const pos = camera.getPosition();
            const rot = camera.getRotation();
            if (!pos.equals(lastCamPos) || !rot.equals(lastCamRot)) {
                app.renderNextFrame = true;
                lastCamPos.copy(pos);
                lastCamRot.copy(rot);
            }
        }
    });
});
