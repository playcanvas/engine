// @config
//
// Renders a huge Gaussian Splat world by instancing a single multi-LOD streamed scene many times,
// each at a different position / rotation. The LOD streaming system keeps performance stable while
// the combined splat count reaches into the billions.
//
// @flag NO_MINISTATS
// @flag PREFERRED_DEVICE=webgpu
//
// @credit
// title: Poland village
// author: Andrii Shramko
// source: https://www.linkedin.com/in/andrii-shramko/

import * as pc from 'playcanvas';
import { CameraControls } from 'playcanvas/scripts/esm/camera-controls.mjs';

import { data, deviceType } from 'examples/context';

import { CylinderController } from './cylinder-controller.mjs';

// When true, bend the world into a full cylinder (a complete loop at the max instance count) and
// fly inside it with a custom controller whose "up" follows the curved surface. When false, use
// the gentle strip bend + the standard CameraControls fly camera.
const USE_CYLINDER_CONTROLLER = true;

// Max instances the slider allows (kept in sync with billions.controls.jsx). At this count the
// layout is LAYOUT.maxCols full rings wide (each ring is a complete 360° loop); fewer instances
// fill ring-by-ring, and a single partial ring forms an arc you can fly along.
const MAX_INSTANCES = 100;

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
};
window.addEventListener('resize', resize);
app.on('destroy', () => {
    window.removeEventListener('resize', resize);
});

// Poland village configuration. Each instance is flipped 180° around X to compensate for the
// capture storing Y as "down"; otherwise the world arrives upside-down.
const config = {
    name: 'Poland-village',
    url: 'https://s3.eu-west-1.amazonaws.com/code.playcanvas.com/examples_data/example_poland_02/lod-meta.json',
    // Camera-movement threshold (world units) that retriggers LOD evaluation. Each instance
    // footprint is hundreds of units across, so re-evaluating every 0.5 units was overkill —
    // 32 still updates well before the camera crosses a meaningful fraction of a tile.
    lodUpdateDistance: 32,
    lodUnderfillLimit: 5,
    cameraPosition: [10.3, 2, -10],
    focusPoint: [12, 3, 0],
    // camera fly speeds — the instanced world is enormous. Normal speed is 10x the lod-streaming
    // example; fast (shift) is 80x.
    moveSpeed: 4 * 10,          // 40
    moveFastSpeed: 15 * 20 * 4  // 1200
};

// Instance layout: identical gsplat tiles wrapped into the cylinder. Tiles run along the loop
// (the tile's short Z axis) and up to LAYOUT.maxCols rings wide along the axis (the tile's long X
// axis). Instance count is driven by the 'instances' observer at runtime — the desktop default of
// 50 tiles (~104M splats each) is two full rings and tens of billions of splats at full detail.
const LAYOUT = {
    // number of rings (full loops) the layout is wide along the cylinder axis at max capacity;
    // MAX_INSTANCES / maxCols tiles make one ring (a complete loop)
    maxCols: 4,
    // multiplier applied to the tile's world-space footprint to derive grid spacing.
    // 0.8 = 20% overlap so neighbouring AABBs interpenetrate and hide the seams
    spacingFactor: 0.8,
    // Bend the strip into the inside of a very large cylinder along its length (Z), so the
    // ground curves gently upward at both ends. Value is the fraction of a full circle the
    // strip's reference length wraps: 0.1 = 10% (~36° total arc). 0 = flat ground.
    bendFraction: 0.1
};

// Default number of instances. Mobile defaults low for memory/perf headroom.
const DEFAULT_INSTANCES_DESKTOP = 50;
const DEFAULT_INSTANCES_MOBILE = 2;

// Default per-instance LOD ramp tuned for this instanced-world scale. The multiplier sets how
// fast detail falls off with distance (LOD = 1 + log(d/base)/log(mult)): a smaller multiplier
// drops distant tiles to coarse LODs sooner, which flattens how the active-splat count grows
// with instance count. The base distance sets the LOD0 radius and barely affects the far-tile
// growth, so it stays as-is.
// Mobile uses the aggressive 1.6 falloff (~3M active at 20 instances) to keep the load light;
// desktop uses a gentler 1.8 so distant tiles stay more detailed (~6M active at 20 instances).
const DEFAULT_LOD_BASE_DISTANCE = 40;
const DEFAULT_LOD_MULTIPLIER = pc.platform.mobile ? 1.6 : 1.8;

const assets = {
    scene: new pc.Asset('gsplat', 'gsplat', { url: config.url }),
    // equirectangular (360) LDR backdrop image
    sky: new pc.Asset('sky', 'texture', { url: './assets/hdri/space.webp' }, { mipmaps: false })
};

const assetListLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
assetListLoader.load(() => {
    app.start();

    // custom mini stats showing gsplat counts
    const miniStats = new pc.MiniStats(app, pc.MiniStats.getDefaultOptions(['gsplats', 'gsplatsCopy'])); // eslint-disable-line no-unused-vars

    // --- infinite skybox backdrop from the equirectangular LDR image ---
    // The built-in infinite sky samples a cubemap, so the equirect is reprojected once into a
    // skybox cubemap (the visible backdrop only). We deliberately do NOT build an env-atlas /
    // prefiltered probes and never set scene.envAtlas, so this contributes zero lighting — it is
    // purely a background.
    // Explicit power-of-two face size: the default derives size from source.width / 4, which
    // asserts for image widths not divisible by 4 (this image is 1774 wide).
    // Generated up front (one-off GPU work) but NOT assigned to scene.skybox yet — the backdrop is
    // revealed together with the splats once their first (worst-LOD) frame is ready (see below),
    // so the sky doesn't pop in before the scene.
    const skyboxCubemap = pc.EnvLighting.generateSkyboxCubemap(assets.sky.resource, 1024);
    app.scene.sky.type = pc.SKYTYPE_INFINITE;

    // Sky rotation (degrees about the vertical axis), exposed in the UI to aim a feature of the
    // backdrop (e.g. the planet) into view rather than behind the tiles.
    data.set('skyRotation', 100);
    const applySkyRotation = () => {
        app.scene.skyboxRotation = new pc.Quat().setFromEulerAngles(0, data.get('skyRotation'), 0);
    };
    applySkyRotation();
    data.on('skyRotation:set', applySkyRotation);

    // --- scene-wide gsplat defaults (same values as the lod-streaming example) ---
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

    // --- gsplat instances, all sharing the same streamed asset; count is observer-driven ---
    /** @type {pc.Entity[]} */
    const instanceEntities = [];
    /** @type {any[]} */
    const gsInstances = [];

    // Tile spacing derived from the gsplat's local AABB. The 180° X-flip negates Z but the
    // absolute X/Z extents stay the same, so the local AABB size is enough to spread tiles.
    const aabb = /** @type {any} */ (assets.scene.resource).aabb;
    const mn = aabb.getMin();
    const mx = aabb.getMax();
    const spacingX = (mx.x - mn.x) * LAYOUT.spacingFactor;
    const spacingZ = (mx.z - mn.z) * LAYOUT.spacingFactor;

    const numSplatsPerInstance = /** @type {any} */ (assets.scene.resource).numSplats;
    const toM = v => `${(v / 1e6).toFixed(1)}M`;
    const toB = v => `${(v / 1e9).toFixed(1)}B`;

    // --- LOD tuning (temporary): seed defaults and live-apply on change ---
    data.set('lodBaseDistance', DEFAULT_LOD_BASE_DISTANCE);
    data.set('lodMultiplier', DEFAULT_LOD_MULTIPLIER);
    const applyLod = () => {
        const base = data.get('lodBaseDistance');
        const mult = data.get('lodMultiplier');
        for (let i = 0; i < gsInstances.length; i++) {
            gsInstances[i].lodBaseDistance = base;
            gsInstances[i].lodMultiplier = mult;
        }
    };
    data.on('lodBaseDistance:set', applyLod);
    data.on('lodMultiplier:set', applyLod);

    // Each instance's grid slot is a fixed function of its index — independent of the current
    // instance count — so changing the count never moves (and never re-streams) the tiles we
    // keep. Tiles are added one full RING at a time: a ring is a complete run along the loop
    // (one axial column), `ringSize` tiles, laid out centre-out so it grows symmetrically from
    // the start tile. Only once a ring is full does the next axial column (ring) begin. With the
    // cylinder calibration a full ring is exactly one 360° loop, so the default fills the first
    // loop, then the second alongside it.
    const cols = LAYOUT.maxCols;
    const ringSize = Math.ceil(MAX_INSTANCES / cols);
    const refRows = ringSize;
    const offX = (cols - 1) * 0.5 * spacingX;

    // Map a position-within-ring counter (0, 1, 2, …) to a centre-out signed offset: 0, +1, -1, …
    const rowOffset = r => Math.ceil(r / 2) * ((r % 2 === 1) ? 1 : -1);

    // Cylindrical bend along the length (Z): map each tile's centre-out length coordinate onto an
    // arc so the ground curves up to both sides and each tile tilts to stay tangent to the
    // surface. The curvature per tile is a fixed (count-independent) function of the bend radius,
    // so existing tiles stay put as the count changes.
    // - Cylinder controller on: calibrate the radius so the slider's max instance count wraps a
    //   full 360° loop (fewer instances → a partial arc you can fly along).
    // - Off: gentle LAYOUT.bendFraction strip calibrated to the default strip length.
    let bendRadius;
    if (USE_CYLINDER_CONTROLLER) {
        const maxRows = Math.ceil(MAX_INSTANCES / cols);
        bendRadius = spacingZ * maxRows / (2 * Math.PI);
    } else {
        const refLength = (refRows - 1) * spacingZ;
        const bendArc = LAYOUT.bendFraction * 2 * Math.PI;
        bendRadius = (bendArc > 0 && refLength > 0) ? refLength / bendArc : 0;
    }

    // Returns the world position and X-axis euler angle (including the 180° capture flip) for a
    // given instance index.
    const layoutForIndex = (idx) => {
        const c = Math.floor(idx / ringSize);   // ring index = axial column (fill one ring first)
        const r = idx % ringSize;               // position within the ring
        const x = c * spacingX - offX;
        const s = rowOffset(r) * spacingZ;      // centre-out length coordinate
        if (bendRadius === 0) {
            return { pos: [x, 0, s], eulerX: 180 };
        }
        const theta = s / bendRadius;           // arc angle for this tile
        const z = bendRadius * Math.sin(theta);
        const y = bendRadius * (1 - Math.cos(theta));   // ground lifts toward the ends
        const eulerX = 180 - theta * pc.math.RAD_TO_DEG; // tilt to stay tangent to the surface
        return { pos: [x, y, z], eulerX };
    };

    // Add/remove entities to match the requested count. Newly added tiles are positioned and
    // LOD-configured once, on creation; surplus tiles are destroyed from the end. Tiles that
    // remain are left completely untouched, so the shared streamed resource isn't re-fetched
    // and visible tiles don't reload between slider ticks.
    const rebuildInstances = () => {
        const N = data.get('instances');

        while (instanceEntities.length < N) {
            const idx = instanceEntities.length;
            const entity = new pc.Entity(`${config.name}-${idx}`);
            entity.addComponent('gsplat', { asset: assets.scene });
            const { pos, eulerX } = layoutForIndex(idx);
            entity.setLocalEulerAngles(eulerX, 0, 0);
            entity.setLocalPosition(pos[0], pos[1], pos[2]);
            app.root.addChild(entity);
            instanceEntities.push(entity);
            const gs = /** @type {any} */ (entity.gsplat);
            gs.lodBaseDistance = data.get('lodBaseDistance');
            gs.lodMultiplier = data.get('lodMultiplier');
            gsInstances.push(gs);
        }
        while (instanceEntities.length > N) {
            instanceEntities.pop().destroy();
            gsInstances.pop();
        }

        data.set('data.stats.splatsTotal', toB(numSplatsPerInstance * N));
    };

    data.set('instances', pc.platform.mobile ? DEFAULT_INSTANCES_MOBILE : DEFAULT_INSTANCES_DESKTOP);
    rebuildInstances();
    data.on('instances:set', rebuildInstances);

    // Start at the lowest LOD for a fast initial display, then open up to the FULL LOD range
    // (all levels, 0..worst) once the first frame's data is ready.
    const lodLevels = /** @type {any} */ (assets.scene.resource).octree?.lodLevels ?? 1;
    const worstLod = lodLevels - 1;
    app.scene.gsplat.lodRangeMin = worstLod;
    app.scene.gsplat.lodRangeMax = worstLod;

    const gsplatSystem = /** @type {any} */ (app.systems.gsplat);
    const onFrameReady = (/** @type {any} */ cam, /** @type {any} */ layer, /** @type {boolean} */ ready, /** @type {number} */ loadingCount) => {
        if (ready && loadingCount === 0) {
            gsplatSystem.off('frame:ready', onFrameReady);
            app.scene.gsplat.lodRangeMin = 0;
            app.scene.gsplat.lodRangeMax = worstLod;
            // reveal the backdrop now, together with the loaded scene (not before it)
            app.scene.skybox = skyboxCubemap;
        }
    };
    gsplatSystem.on('frame:ready', onFrameReady);

    // --- camera with fly controls (same controls as lod-streaming, much faster move speeds) ---
    const [camX, camY, camZ] = /** @type {[number, number, number]} */ (config.cameraPosition);
    const [focusX, focusY, focusZ] = /** @type {[number, number, number]} */ (config.focusPoint);

    // World-space centre of the first tile's content, used to centre the camera horizontally on
    // that tile. Only X/Z are taken from the tile centre; the camera keeps its configured
    // (absolute) elevation rather than the tile's mid-height, so it starts above the ground.
    const tile0Center = instanceEntities[0].getWorldTransform().transformPoint(
        new pc.Vec3((mn.x + mx.x) * 0.5, (mn.y + mx.y) * 0.5, (mn.z + mx.z) * 0.5),
        new pc.Vec3()
    );

    const camera = new pc.Entity('camera');
    camera.addComponent('camera', {
        clearColor: new pc.Color(0, 0, 0),
        fov: 75,
        toneMapping: pc.TONEMAP_LINEAR,
        // huge world — extend the far clip so distant instances are not culled
        farClip: 100000
    });
    camera.setLocalPosition(tile0Center.x + camX, camY, tile0Center.z + camZ);
    app.root.addChild(camera);

    if (USE_CYLINDER_CONTROLLER) {
        // Custom fly camera operating inside the cylinder; "up" follows the curved surface so the
        // controls stay consistent all the way around the loop. Starts centred on the first tile
        // (axial = its X) at the bottom of the loop (angle 0), at the configured eye height.
        const controller = new CylinderController(app, camera, {
            radius: bendRadius,
            axialStart: tile0Center.x,
            startHeight: camY,
            moveSpeed: config.moveSpeed,
            moveFastSpeed: config.moveFastSpeed,
            // strong movement damping for a smooth, floaty glide (higher = stronger; default 0.99)
            moveDamping: 0.997
        });
        app.on('update', (/** @type {number} */ dt) => controller.update(dt));
        app.on('destroy', () => controller.destroy());
    } else {
        camera.addComponent('script');
        const cc = /** @type {CameraControls} */ ((/** @type {any} */ (camera.script)).create(CameraControls));
        Object.assign(cc, {
            sceneSize: 500,
            moveSpeed: config.moveSpeed,
            moveFastSpeed: config.moveFastSpeed,
            // higher damping (default 0.98) eases the camera into a new speed, so toggling shift
            // between normal and fast ramps smoothly instead of snapping
            moveDamping: 0.995,
            enableOrbit: false,
            enablePan: false,
            focusPoint: new pc.Vec3(tile0Center.x + focusX, focusY, tile0Center.z + focusZ)
        });
    }

    // --- Splat budget ---
    // Hardcoded to 0 (no cap): the LOD ramp on each instance is what gates splat count, the
    // budget is left disabled. Kept as an observer so the value can still be overridden via
    // share-URL state if needed.
    data.set('splatBudget', 0);
    const applySplatBudget = () => {
        const millions = data.get('splatBudget');
        app.scene.gsplat.splatBudget = Math.round(millions * 1000000);
    };
    applySplatBudget();
    data.on('splatBudget:set', applySplatBudget);

    // --- Stats ---
    // Total Splats is set inside rebuildInstances (depends on the live instance count). Active
    // Splats is the per-frame visible count from the renderer.
    app.on('update', () => {
        data.set('data.stats.gsplats', toM(app.stats.frame.gsplats));
    });
});
