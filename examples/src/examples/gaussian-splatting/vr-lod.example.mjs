// @config
//
// Demonstrates Gaussian Splat rendering in VR (WebXR).
//
// @flag NO_MINISTATS
//
// @credit
// title: Roman Parish
// author: Andrii Shramko
// source: https://www.linkedin.com/in/andrii-shramko/
//
// @credit
// title: Ice Cave
// author: SpAItial AI
// source: https://spaitial.ai/
//
// @credit
// title: SA3D_R&D_XP47
// author: Stephane Agullo
// source: https://superspl.at/view?id=cdcec084
// license: CC BY 4.0 (http://creativecommons.org/licenses/by/4.0/)
//
// @credit
// title: Skatepark
// author: Christoph Schindelar
// source: https://superspl.at/user?id=schindelar3d

import * as pc from 'playcanvas';
import { CameraControls } from 'playcanvas/scripts/esm/camera-controls.mjs';
import { GsplatRevealRadial } from 'playcanvas/scripts/esm/gsplat/reveal-radial.mjs';
import { XrMenu } from 'playcanvas/scripts/esm/xr-menu.mjs';
import { XrNavigation } from 'playcanvas/scripts/esm/xr-navigation.mjs';
import { XrSession } from 'playcanvas/scripts/esm/xr-session.mjs';

import { data, deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const gfxOptions = {
    deviceTypes: [deviceType],
    antialias: false
};

const device = await pc.createGraphicsDevice(canvas, gfxOptions);

// Enable GPU timing (timestamp queries) so the HUD can show total GPU time per frame
// (sum of all compute + render passes), same source MiniStats uses.
device.gpuProfiler.enabled = true;

const createOptions = new pc.AppOptions();
createOptions.graphicsDevice = device;
createOptions.mouse = new pc.Mouse(document.body);
createOptions.touch = new pc.TouchDevice(document.body);
createOptions.keyboard = new pc.Keyboard(window);

createOptions.componentSystems = [
    pc.RenderComponentSystem,
    pc.CameraComponentSystem,
    pc.LightComponentSystem,
    pc.ScriptComponentSystem,
    pc.GSplatComponentSystem,
    // UI systems required by the in-XR HUD (XrMenu builds screen/element/button components).
    pc.ScreenComponentSystem,
    pc.ElementComponentSystem,
    pc.ButtonComponentSystem
];
createOptions.resourceHandlers = [
    pc.TextureHandler,
    pc.ContainerHandler,
    pc.ScriptHandler,
    pc.GSplatHandler,
    // Required to load the HUD font asset.
    pc.FontHandler
];
createOptions.xr = pc.XrManager;
// Enables element click events (desktop fallback); XR ray/finger picking is handled inside XrMenu.
createOptions.elementInput = new pc.ElementInput(canvas);

const app = new pc.AppBase(canvas);
app.init(createOptions);

app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
app.setCanvasResolution(pc.RESOLUTION_AUTO);

const dpr = window.devicePixelRatio || 1;
device.maxPixelRatio = dpr >= 2 ? dpr * 0.5 : dpr;

const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => {
    window.removeEventListener('resize', resize);
});

const config = {
    name: 'Roman-Parish',
    url: 'https://code.playcanvas.com/examples_data/example_roman_parish_02/lod-meta.json',
    lodUpdateDistance: 0.5,
    lodUnderfillLimit: 5,
    cameraPosition: [10.3, 2, -10],
    moveSpeed: 4,
    moveFastSpeed: 15,
    enableOrbit: false,
    enablePan: false,
    focusPoint: [12, 3, 0]
};

/** @type {Record<string, { range: number[], lodBaseDistance: number, lodMultiplier: number }>} */
const LOD_PRESETS = {
    'desktop-max': {
        range: [0, 5],
        lodBaseDistance: 7,
        lodMultiplier: 3
    },
    'desktop': {
        range: [1, 5],
        lodBaseDistance: 5,
        lodMultiplier: 4
    },
    'mobile-max': {
        range: [2, 5],
        lodBaseDistance: 5,
        lodMultiplier: 2
    },
    'mobile': {
        range: [3, 5],
        lodBaseDistance: 2,
        lodMultiplier: 2
    }
};

const lodPresetKey = pc.platform.mobile ? 'mobile' : 'desktop';

const assets = {
    church: new pc.Asset('gsplat', 'gsplat', { url: config.url }),
    // Monospace font for the in-XR debug HUD (XrMenu) text rendering.
    font: new pc.Asset('font', 'font', { url: './assets/fonts/courier.json' })
};

/**
 * @param {string} msg - Status message for the mirror page.
 */
const setMessage = (msg) => {
    /** @type {HTMLDivElement | null} */
    let el = document.querySelector('.message');
    if (!el) {
        el = document.createElement('div');
        el.classList.add('message');
        document.body.append(el);
    }
    el.textContent = msg;
};

/**
 * Create a DOM Enter VR button inside the example iframe. WebXR requires transient user
 * activation from the same document as the requestSession call, so the controls-panel button
 * (which lives in the parent page) cannot start a session. This button lives next to the canvas.
 *
 * @param {() => void} onClick - Click handler that starts VR.
 * @returns {HTMLButtonElement} The created button element.
 */
const createEnterVrButton = (onClick) => {
    const btn = document.createElement('button');
    btn.textContent = 'Enter VR';
    Object.assign(btn.style, {
        position: 'fixed',
        bottom: '12px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: '10',
        padding: '10px 20px',
        font: '600 14px/1 sans-serif',
        color: '#fff',
        background: 'rgba(0, 0, 0, 0.7)',
        border: '1px solid rgba(255, 255, 255, 0.4)',
        borderRadius: '6px',
        cursor: 'pointer',
        display: 'none'
    });
    btn.onmouseenter = () => {
        btn.style.background = 'rgba(0, 0, 0, 0.85)';
    };
    btn.onmouseleave = () => {
        btn.style.background = 'rgba(0, 0, 0, 0.7)';
    };
    btn.addEventListener('click', onClick);
    document.body.append(btn);
    return btn;
};

const assetListLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
assetListLoader.load(() => {
    app.start();

    app.scene.gsplat.lodUpdateAngle = 90;
    app.scene.gsplat.lodBehindPenalty = 3;
    app.scene.gsplat.radialSorting = true;
    app.scene.gsplat.lodUpdateDistance = config.lodUpdateDistance;
    app.scene.gsplat.lodUnderfillLimit = config.lodUnderfillLimit;
    app.scene.gsplat.minPixelSize = 2;
    app.scene.gsplat.alphaClipForward = 1 / 255;
    app.scene.gsplat.minContribution = 3;
    app.scene.gsplat.dataFormat = pc.GSPLATDATA_COMPACT;
    app.scene.gsplat.debug = pc.GSPLAT_DEBUG_NONE;
    app.scene.gsplat.fisheye = 0;
    app.scene.exposure = 1;

    data.on('renderer:set', () => {
        app.scene.gsplat.renderer = data.get('renderer');
        const current = app.scene.gsplat.currentRenderer;
        if (current !== data.get('renderer')) {
            setTimeout(() => data.set('renderer', current), 0);
        }
    });

    // Pick the renderer per backend: GPU-sort (compute) on WebGPU, CPU-sort raster on WebGL.
    data.set('renderer', device.isWebGPU ? pc.GSPLAT_RENDERER_RASTER_GPU_SORT : pc.GSPLAT_RENDERER_RASTER_CPU_SORT);
    data.set('splatBudget', 2);
    // XR framebuffer scale factor (applied only when starting an XR session; does not affect 2D).
    data.set('framebufferScaleFactor', 1);
    // Foveated contribution culling strength (GPU-sort renderer only; 0 = off).
    data.set('foveationStrength', 0);
    data.set('data.stats.gsplats', '—');
    data.set('data.stats.resolution', '—');

    const gsplatSystem = /** @type {any} */ (app.systems.gsplat);

    const cameraRig = new pc.Entity('camera-rig');
    const [camX, camY, camZ] = /** @type {[number, number, number]} */ (config.cameraPosition);
    cameraRig.setLocalPosition(camX, camY, camZ);
    app.root.addChild(cameraRig);

    const camera = new pc.Entity('camera');
    camera.addComponent('camera', {
        clearColor: new pc.Color(1, 1, 1),
        fov: 75,
        toneMapping: pc.TONEMAP_LINEAR,
        farClip: 10000
    });
    camera.setLocalPosition(0, 0, 0);
    cameraRig.addChild(camera);

    const [focusX, focusY, focusZ] = /** @type {[number, number, number]} */ (config.focusPoint || [0, 0.6, 0]);
    const focusPoint = new pc.Vec3(focusX, focusY, focusZ);

    camera.addComponent('script');
    const cc = /** @type { CameraControls } */ ((/** @type {any} */ (camera.script)).create(CameraControls));
    Object.assign(cc, {
        sceneSize: 500,
        moveSpeed: /** @type {number} */ (config.moveSpeed),
        moveFastSpeed: /** @type {number} */ (config.moveFastSpeed),
        enableOrbit: false,
        enablePan: false,
        focusPoint: focusPoint
    });

    cameraRig.addComponent('script');
    cameraRig.script.create(XrSession, {
        properties: {
            startVrEvent: 'vr:start',
            endEvent: 'xr:end'
        }
    });
    const xrNavigation = /** @type {any} */ (cameraRig.script.create(XrNavigation, {
        properties: {
            enableTeleport: true,
            enableSnapVertical: false,
            movementThreshold: 0,
            turnMode: 'smooth',
            smoothTurnSpeed: 90
        }
    }));

    // In-XR debug HUD: an always-visible, camera-following menu. Label-only rows (no eventName)
    // act as live readouts updated each frame via setItemLabel. Starting with FPS.
    // Base scale at full framebuffer resolution; scaled up at lower resolutions for readability.
    const HUD_BASE_SCALE = 1.2;
    const menuEntity = new pc.Entity('XrHud');
    menuEntity.addComponent('script');
    menuEntity.script.create(XrMenu, {
        properties: {
            menuItems: [
                { label: 'FPS: --' },          // [0] label-only readout (updated each frame)
                { label: 'GPU: --' },          // [1] total GPU time per frame (updated each frame)
                { label: 'RES: --' },          // [2] label-only readout (updated each frame)
                { label: 'FOVEATION: OFF', eventName: 'xrhud:foveation' }, // [3] toggle (off by default)
                // [4] number row: splat budget, +/- 0.5M (0.5..4M)
                { type: 'number', label: 'BUDGET', value: '2.0M', decEvent: 'budget:dec', incEvent: 'budget:inc' },
                // [5] number row: scene index (0 = cave, 1 = original, 2 = skatepark)
                { type: 'number', label: 'SCENE', value: '0', decEvent: 'scene:dec', incEvent: 'scene:inc' },
                // [6] number row: minContribution, +/- 2 (1..20)
                { type: 'number', label: 'Contribution', value: '5', decEvent: 'contribution:dec', incEvent: 'contribution:inc' },
                // [7] number row: alphaClipForward, stepped 1/255 .. 1/2
                { type: 'number', label: 'AlphaClip', value: '1/16', decEvent: 'alphaclip:dec', incEvent: 'alphaclip:inc' },
                // [8] number row: foveated contribution culling strength (GPU-sort renderer only)
                { type: 'number', label: 'FovCull', value: '0.0', decEvent: 'fovcull:dec', incEvent: 'fovcull:inc' },
                { label: 'EXIT XR', eventName: 'xr:end' } // [9] interactive: ends the XR session
            ],
            fontAsset: assets.font,
            alwaysVisible: true,
            followDistance: 0.6,
            followOffset: new pc.Vec2(0.1, -0.1),
            menuScale: HUD_BASE_SCALE,
            buttonWidth: 0.13
        }
    });
    app.root.addChild(menuEntity);
    const xrHud = /** @type {any} */ (menuEntity.script).xrMenu;

    // Replace the engine's ray-to-ground teleport with a fixed-step "dash" in the direction the user
    // is looking. The ray-to-ground jump behaves badly near floor level (a near-horizontal ray hits
    // the ground far away, throwing you outside the scene), and AVP has no thumbstick for smooth
    // locomotion. A pinch moves a fixed distance along the head's horizontal forward, keeping the
    // current elevation (XZ only). The menu veto is preserved so pinches on the HUD just click.
    const MOVE_STEP = 1.5; // metres per pinch
    const moveDir = new pc.Vec3();
    xrNavigation.tryTeleport = () => {
        if (xrHud?.isPointerOverMenu) return;

        moveDir.copy(camera.forward);
        moveDir.y = 0; // flatten to the ground plane — never change elevation
        if (moveDir.lengthSq() < 1e-6) return; // looking straight up/down: no horizontal direction
        moveDir.normalize().mulScalar(MOVE_STEP);

        cameraRig.translate(moveDir.x, 0, moveDir.z);
    };

    // Fixed foveation toggle, driven from the in-XR HUD. Off by default. fixedFoveation can only be
    // set during an active session and is ignored unless anti-aliasing is off (it is here).
    let foveationEnabled = false;
    const FOVEATION_LEVEL = 1; // highest foveation when enabled
    const applyFoveation = () => {
        app.xr.fixedFoveation = foveationEnabled ? FOVEATION_LEVEL : 0;
        xrHud?.setItemLabel(3, `FOVEATION: ${foveationEnabled ? 'ON' : 'OFF'}`);
    };
    app.on('xrhud:foveation', () => {
        foveationEnabled = !foveationEnabled;
        applyFoveation();
    });

    // In-XR splat budget control (number row [4]). +/- 0.5M, clamped to 0.5..4M. Writes the same
    // 'splatBudget' observer the 2D slider uses, so both stay in sync.
    const BUDGET_ROW = 4;
    let budgetM = data.get('splatBudget') ?? 2;
    const applyBudget = () => {
        data.set('splatBudget', budgetM);
        xrHud?.setItemValue(BUDGET_ROW, `${budgetM.toFixed(1)}M`);
    };
    app.on('budget:dec', () => {
        budgetM = Math.max(0.5, Math.round((budgetM - 0.5) * 2) / 2);
        applyBudget();
    });
    app.on('budget:inc', () => {
        budgetM = Math.min(4, Math.round((budgetM + 0.5) * 2) / 2);
        applyBudget();
    });
    applyBudget(); // seed the readout

    // In-XR minContribution control (number row [6]). +/- 2, clamped to 1..20 (default 5).
    const CONTRIB_ROW = 6;
    let contribution = 5;
    const applyContribution = () => {
        app.scene.gsplat.minContribution = contribution;
        xrHud?.setItemValue(CONTRIB_ROW, `${contribution}`);
    };
    app.on('contribution:dec', () => {
        contribution = Math.max(1, contribution - 2);
        applyContribution();
    });
    app.on('contribution:inc', () => {
        contribution = Math.min(20, contribution + 2);
        applyContribution();
    });
    applyContribution(); // seed the readout

    // In-XR alphaClipForward control (number row [7]). Stepped through nice reciprocals from the
    // current default 1/255 up to 1/2 (10 steps); displayed as "1/N". '+' raises the alpha floor.
    const ALPHACLIP_ROW = 7;
    const ALPHACLIP_DENOMS = [255, 128, 64, 48, 32, 24, 16, 8, 4, 2];
    let alphaClipIndex = 6; // 1/16
    const applyAlphaClip = () => {
        const denom = ALPHACLIP_DENOMS[alphaClipIndex];
        app.scene.gsplat.alphaClipForward = 1 / denom;
        xrHud?.setItemValue(ALPHACLIP_ROW, `1/${denom}`);
    };
    app.on('alphaclip:dec', () => {
        alphaClipIndex = Math.max(0, alphaClipIndex - 1);
        applyAlphaClip();
    });
    app.on('alphaclip:inc', () => {
        alphaClipIndex = Math.min(ALPHACLIP_DENOMS.length - 1, alphaClipIndex + 1);
        applyAlphaClip();
    });
    applyAlphaClip(); // seed the readout

    // Foveated contribution culling strength (number row [8]). +/- 5, clamped to 0..50
    // (default 0 = off). Only affects the GPU-sort (hybrid) renderer.
    const FOVCULL_ROW = 8;
    const applyFovCull = () => {
        const v = data.get('foveationStrength') ?? 0;
        app.scene.gsplat.foveationStrength = v;
        xrHud?.setItemValue(FOVCULL_ROW, v.toFixed(1));
    };
    data.on('foveationStrength:set', applyFovCull);
    app.on('fovcull:dec', () => {
        data.set('foveationStrength', Math.max(0, (data.get('foveationStrength') ?? 0) - 5));
    });
    app.on('fovcull:inc', () => {
        data.set('foveationStrength', Math.min(50, (data.get('foveationStrength') ?? 0) + 5));
    });
    applyFovCull(); // seed the engine value and readout

    /** @type {pc.Entity|null} */
    let gsplatEntity = null;
    /** @type {any} */
    let gsplatGs = null;

    const applyPreset = () => {
        const presetData = LOD_PRESETS[lodPresetKey] || LOD_PRESETS.desktop;
        if (gsplatGs) {
            gsplatGs.lodRangeMin = presetData.range[0];
            gsplatGs.lodRangeMax = presetData.range[1];
            gsplatGs.lodBaseDistance = presetData.lodBaseDistance;
            gsplatGs.lodMultiplier = presetData.lodMultiplier;
        }
    };

    const loadGsplat = (scene) => {
        if (gsplatEntity) {
            gsplatEntity.destroy();
            gsplatEntity = null;
            gsplatGs = null;
        }

        const asset = scene.asset;

        gsplatEntity = new pc.Entity(config.name || 'gsplat');
        gsplatEntity.addComponent('gsplat', {
            asset: asset,
            unified: true
        });
        gsplatEntity.setLocalPosition(0, 0, 0);
        gsplatEntity.setLocalEulerAngles(scene.euler[0], scene.euler[1], scene.euler[2]);
        gsplatEntity.setLocalScale(1, 1, 1);
        app.root.addChild(gsplatEntity);
        gsplatGs = /** @type {any} */ (gsplatEntity.gsplat);

        const presetData = LOD_PRESETS[lodPresetKey] || LOD_PRESETS.desktop;
        gsplatGs.lodBaseDistance = presetData.lodBaseDistance;
        gsplatGs.lodMultiplier = presetData.lodMultiplier;

        const lodLevels = gsplatGs.resource?.octree?.lodLevels;
        if (lodLevels) {
            const worstLod = lodLevels - 1;
            gsplatGs.lodRangeMin = worstLod;
            gsplatGs.lodRangeMax = worstLod;
        }

        const onFrameReady = (/** @type {any} */ cam, /** @type {any} */ layer, /** @type {boolean} */ ready, /** @type {number} */ loadingCount) => {
            if (ready && loadingCount === 0) {
                gsplatSystem.off('frame:ready', onFrameReady);
                applyPreset();
            }
        };
        gsplatSystem.on('frame:ready', onFrameReady);

        gsplatEntity.addComponent('script');
        const revealScript = gsplatEntity.script?.create(GsplatRevealRadial);
        if (revealScript) {
            revealScript.center.set(scene.focus[0], scene.focus[1], scene.focus[2]);
            revealScript.speed = 10;
            revealScript.acceleration = 0;
            revealScript.delay = 3;
            revealScript.oscillationIntensity = 0.2;
            revealScript.endRadius = 25;
        }
    };

    // Selectable scenes via the in-XR SCENE number row: 0 = the cave from the
    // gaussian-splatting/depth-of-field example, 1 = original. The cave splat is unrotated (its proxy
    // is what's flipped in that example), whereas the original needs a 180° flip.
    const caveAsset = new pc.Asset('gsplat-cave', 'gsplat', {
        url: 'https://code.playcanvas.com/examples_data/example_cave_01/lod-meta.json'
    });
    app.assets.add(caveAsset);

    const skateparkAsset = new pc.Asset('gsplat-skatepark', 'gsplat', {
        url: 'https://code.playcanvas.com/examples_data/example_skatepark_02/lod-meta.json'
    });
    app.assets.add(skateparkAsset);

    const apartmentAsset = new pc.Asset('gsplat-apartment', 'gsplat', {
        url: './assets/splats/apartment.sog'
    });
    app.assets.add(apartmentAsset);

    const SCENES = [
        // 0: cave — small interior; viewpoint roughly matches the depth-of-field example
        { asset: caveAsset, euler: [0, 0, 0], pos: [0.01, -0.09, -0.26], focus: [-0.22, -0.05, -1.24] },
        // 1: original Roman Parish church — rig at the configured start, looking at the focus point
        { asset: assets.church, euler: [270, 0, 0], pos: config.cameraPosition, focus: config.focusPoint || [0, 0.6, 0] },
        // 2: apartment (.sog) — start at the editor/paint "biker1" spot, transformed into this
        // scene's frame (apartment at origin, euler 180, scale 1), looking toward the interior
        { asset: apartmentAsset, euler: [180, 0, 0], pos: [-3.8, -0.1, 7.2], focus: [0, -0.1, 0] },
        // 3: skatepark — viewpoint from the lod-streaming-sh example
        { asset: skateparkAsset, euler: [-90, 0, 0], pos: [32, 2, 2], focus: [0, 0.6, 0] }
    ];
    const SCENE_ROW = 5;
    let sceneIndex = 0;

    // Place the XR rig for a scene: stand on the scene ground (y = 0, mirroring what XrSession does
    // at session start) and face the focus horizontally. In XR the headset supplies eye height and
    // pitch, so we keep yaw only — using the full desktop pos.y here would lift the viewer metres off
    // the ground (the "giant" effect), and keeping the previous yaw would leave you facing the wrong
    // way after a scene switch.
    const placeForSceneXr = (scene) => {
        const p = scene.pos;
        const f = scene.focus;
        // Stand on the ground (y = 0) by default; per-scene `xrY` lifts the spawn for scenes whose
        // floor sits below the origin.
        cameraRig.setLocalPosition(p[0], scene.xrY ?? 0, p[2]);
        cameraRig.lookAt(f[0], f[1], f[2]);
        const yaw = cameraRig.getLocalEulerAngles().y;
        cameraRig.setLocalEulerAngles(0, yaw, 0);
    };

    const setScene = (index) => {
        sceneIndex = pc.math.clamp(index, 0, SCENES.length - 1);
        xrHud?.setItemValue(SCENE_ROW, `${sceneIndex}`);
        const scene = SCENES[sceneIndex];

        // Position the viewpoint for this scene. On desktop the fly camera (cc) owns the pose; in
        // XR the rig is the floor-level navigation root and the headset supplies height/pitch.
        if (app.xr.active) {
            placeForSceneXr(scene);
        } else {
            const p = scene.pos;
            const f = scene.focus;
            cameraRig.setLocalPosition(p[0], p[1], p[2]);
            cc.reset(new pc.Vec3(f[0], f[1], f[2]), new pc.Vec3(p[0], p[1], p[2]));
        }

        if (scene.asset.loaded) {
            loadGsplat(scene);
        } else {
            // load on demand; guard against a newer selection completing first
            scene.asset.once('load', () => {
                if (SCENES[sceneIndex] === scene) loadGsplat(scene);
            });
            app.assets.load(scene.asset);
        }
    };
    app.on('scene:dec', () => setScene(sceneIndex - 1));
    app.on('scene:inc', () => setScene(sceneIndex + 1));

    setScene(0);

    const applySplatBudget = () => {
        const millions = data.get('splatBudget');
        app.scene.gsplat.splatBudget = Math.round(millions * 1000000);
    };
    applySplatBudget();
    data.on('splatBudget:set', applySplatBudget);

    const setCameraControlsForXr = () => {
        cc.enabled = !app.xr.active;
    };

    const tryStartVr = () => {
        if (!app.xr.supported) {
            setMessage('WebXR is not supported');
            return;
        }
        if (app.xr.isAvailable(pc.XRTYPE_VR)) {
            // local-floor: WebXR puts the local-space origin at the floor below the viewer at
            // session start, so the camera (child of the rig) ends up at rig + ~1.6 m on Y.
            // `local` would put the head at rig.y, sinking the viewpoint into the scene floor.
            //
            // Start XR directly (rather than firing 'vr:start') so we can pass framebufferScaleFactor
            // from the controls — it is read-only once a session is running. XrSession still performs
            // its rig setup, as that is bound to the xr 'start' event, not the start call.
            camera.camera.startXr(pc.XRTYPE_VR, pc.XRSPACE_LOCALFLOOR, {
                framebufferScaleFactor: data.get('framebufferScaleFactor'),
                callback: (err) => {
                    if (err) setMessage(`Failed to start VR: ${err.message}`);
                }
            });
        } else {
            setMessage('Immersive VR is not available');
        }
    };

    // DOM button in the iframe document so the click carries transient activation into the
    // WebXR requestSession call. Hidden while VR is active.
    const enterVrButton = createEnterVrButton(tryStartVr);

    const updateEnterVrButton = () => {
        const show = app.xr.supported && app.xr.isAvailable(pc.XRTYPE_VR) && !app.xr.active;
        enterVrButton.style.display = show ? 'block' : 'none';
    };

    if (app.xr.supported) {
        if (app.touch) {
            app.touch.on('touchend', (evt) => {
                if (app.xr.active) {
                    app.fire('xr:end');
                    evt.event.preventDefault();
                    evt.event.stopPropagation();
                }
            });
        }

        app.xr.on('start', () => {
            setCameraControlsForXr();
            updateEnterVrButton();
            // Fixed foveation is per-session (new layer each session); start disabled and sync the HUD.
            foveationEnabled = false;
            applyFoveation();
            // Scale the HUD up inversely with the framebuffer scale so text stays readable at lower
            // resolutions (e.g. 0.5x scale -> 2x larger menu). Full resolution keeps the base size.
            const scaleFactor = data.get('framebufferScaleFactor') || 1;
            xrHud?.setMenuScale(HUD_BASE_SCALE / scaleFactor);
            // Stand on the ground facing the focus for the current scene. XrSession's own 'start'
            // handler runs first (registered earlier) and derives the rig from the desktop camera —
            // re-place here so the XR viewpoint is ground-level and correctly oriented.
            placeForSceneXr(SCENES[sceneIndex]);
            setMessage('VR active — left thumbstick: move, right: turn; tap to exit');
        });
        app.xr.on('end', () => {
            setMessage('VR ended — click Enter VR to re-enter');
            // XrManager fires 'end' *before* clearing its internal session reference, so
            // `app.xr.active` still reads true at this point. Defer state-dependent updates to
            // the next microtask so they observe the cleared session.
            Promise.resolve().then(() => {
                setCameraControlsForXr();
                updateEnterVrButton();
            });
        });
        app.xr.on(`available:${pc.XRTYPE_VR}`, (available) => {
            updateEnterVrButton();
            setMessage(available ? 'Click Enter VR to start' : 'Immersive VR is unavailable');
        });

        updateEnterVrButton();
        if (!app.xr.isAvailable(pc.XRTYPE_VR)) {
            setMessage('Immersive VR is not available');
        } else {
            setMessage('Click Enter VR to start');
        }
    } else {
        setMessage('WebXR is not supported');
    }

    // Refresh the readouts at ~2 Hz so the numbers are readable rather than flickering every frame.
    let hudTimer = 0;
    app.on('update', (dt) => {
        hudTimer += dt;
        if (hudTimer < 0.5) return;
        hudTimer = 0;

        const bb = app.graphicsDevice.backBufferSize;
        data.set('data.stats.gsplats', app.stats.frame.gsplats.toLocaleString());
        data.set('data.stats.resolution', `${bb.x} x ${bb.y}`);

        // GPU time is the sum of all compute + render pass timings (device.gpuProfiler).
        xrHud?.setItemLabel(0, `FPS: ${app.stats.frame.fps}`);
        xrHud?.setItemLabel(1, `GPU: ${(device.gpuProfiler?._frameTime ?? 0).toFixed(1)}ms`);
        xrHud?.setItemLabel(2, `RES: ${bb.x} x ${bb.y}`);
    });
});
