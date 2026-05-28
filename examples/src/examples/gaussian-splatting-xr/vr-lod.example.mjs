// @config
// @flag HIDDEN
// @flag NO_MINISTATS
//
// @credit
// title: Roman Parish
// author: Andrii Shramko
// source: https://www.linkedin.com/in/andrii-shramko/

import * as pc from 'playcanvas';
import { CameraControls } from 'playcanvas/scripts/esm/camera-controls.mjs';
import { GsplatRevealRadial } from 'playcanvas/scripts/esm/gsplat/reveal-radial.mjs';
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
    pc.GSplatComponentSystem
];
createOptions.resourceHandlers = [pc.TextureHandler, pc.ContainerHandler, pc.ScriptHandler, pc.GSplatHandler];
createOptions.xr = pc.XrManager;

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
    church: new pc.Asset('gsplat', 'gsplat', { url: config.url })
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
        top: '12px',
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

    data.set('renderer', pc.GSPLAT_RENDERER_AUTO);
    data.set('splatBudget', 1);
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
    cameraRig.script.create(XrNavigation, {
        properties: {
            enableTeleport: false,
            enableSnapVertical: false,
            movementThreshold: 0,
            turnMode: 'smooth',
            smoothTurnSpeed: 90
        }
    });

    /** @type {pc.Entity|null} */
    let gsplatEntity = null;
    /** @type {any} */
    let gsplatGs = null;

    const applyPreset = () => {
        const presetData = LOD_PRESETS[lodPresetKey] || LOD_PRESETS.desktop;
        app.scene.gsplat.lodRangeMin = presetData.range[0];
        app.scene.gsplat.lodRangeMax = presetData.range[1];
        if (gsplatGs) {
            gsplatGs.lodBaseDistance = presetData.lodBaseDistance;
            gsplatGs.lodMultiplier = presetData.lodMultiplier;
        }
    };

    const loadGsplat = () => {
        if (gsplatEntity) {
            gsplatEntity.destroy();
            gsplatEntity = null;
            gsplatGs = null;
        }

        const asset = assets.church;

        gsplatEntity = new pc.Entity(config.name || 'gsplat');
        gsplatEntity.addComponent('gsplat', {
            asset: asset,
            unified: true
        });
        gsplatEntity.setLocalPosition(0, 0, 0);
        gsplatEntity.setLocalEulerAngles(270, 0, 0);
        gsplatEntity.setLocalScale(1, 1, 1);
        app.root.addChild(gsplatEntity);
        gsplatGs = /** @type {any} */ (gsplatEntity.gsplat);

        const presetData = LOD_PRESETS[lodPresetKey] || LOD_PRESETS.desktop;
        gsplatGs.lodBaseDistance = presetData.lodBaseDistance;
        gsplatGs.lodMultiplier = presetData.lodMultiplier;

        const lodLevels = gsplatGs.resource?.octree?.lodLevels;
        if (lodLevels) {
            const worstLod = lodLevels - 1;
            app.scene.gsplat.lodRangeMin = worstLod;
            app.scene.gsplat.lodRangeMax = worstLod;
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
            revealScript.center.set(focusX, focusY, focusZ);
            revealScript.speed = 5;
            revealScript.acceleration = 0;
            revealScript.delay = 3;
            revealScript.oscillationIntensity = 0.2;
            revealScript.endRadius = 25;
        }
    };

    loadGsplat();

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
            app.fire('vr:start', pc.XRSPACE_LOCALFLOOR);
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

    app.on('update', () => {
        data.set('data.stats.gsplats', app.stats.frame.gsplats.toLocaleString());
        const bb = app.graphicsDevice.backBufferSize;
        data.set('data.stats.resolution', `${bb.x} x ${bb.y}`);
    });
});
