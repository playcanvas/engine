// @config WEBGPU_DISABLED
// @config NO_MINISTATS
// @config DESCRIPTION LOD-streamed Gaussian splats (Roman Parish) with radial reveal and WebXR VR; WebGL only. Desktop fly controls; Quest-style thumbstick locomotion when in VR.
// Example route: #/gaussian-splatting-xr/vr-lod
import { data } from 'examples/observer';
import { deviceType, rootPath, fileImport } from 'examples/utils';
import * as pc from 'playcanvas';

const { CameraControls } = await fileImport(`${rootPath}/static/scripts/esm/camera-controls.mjs`);
const { GsplatRevealRadial } = await fileImport(`${rootPath}/static/scripts/esm/gsplat/reveal-radial.mjs`);

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
device.maxPixelRatio = Math.min(dpr, 2);

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
    data.set('splatBudget', 1.5);
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

    const activateXr = () => {
        if (app.xr.isAvailable(pc.XRTYPE_VR)) {
            camera.camera.startXr(pc.XRTYPE_VR, pc.XRSPACE_LOCAL, {
                callback: function (err) {
                    if (err) setMessage(`WebXR VR failed to start: ${err.message}`);
                }
            });
        } else {
            setMessage('Immersive VR is not available');
        }
    };

    if (app.xr.supported) {
        app.mouse.on('mousedown', () => {
            if (!app.xr.active) activateXr();
        });

        if (app.touch) {
            app.touch.on('touchend', (evt) => {
                if (!app.xr.active) {
                    activateXr();
                } else {
                    camera.camera.endXr();
                }
                evt.event.preventDefault();
                evt.event.stopPropagation();
            });
        }

        app.keyboard.on('keydown', (evt) => {
            if (evt.key === pc.KEY_ESCAPE && app.xr.active) {
                app.xr.end();
            }
        });

        app.xr.on('start', () => {
            setCameraControlsForXr();
            setMessage('VR active — left thumbstick: move, right: snap turn; tap to exit');
        });
        app.xr.on('end', () => {
            setCameraControlsForXr();
            setMessage('VR ended — click or tap to enter VR');
        });
        app.xr.on(`available:${pc.XRTYPE_VR}`, (available) => {
            setMessage(available ? 'Click or tap to enter VR' : 'Immersive VR is unavailable');
        });

        if (!app.xr.isAvailable(pc.XRTYPE_VR)) {
            setMessage('Immersive VR is not available');
        } else {
            setMessage('Click or tap to enter VR');
        }
    } else {
        setMessage('WebXR is not supported');
    }

    const movementSpeed = 1.5;
    const rotateSpeed = 45;
    const rotateThreshold = 0.5;
    const rotateResetThreshold = 0.25;
    let lastRotateValue = 0;

    const tmpVec2A = new pc.Vec2();
    const tmpVec2B = new pc.Vec2();
    const tmpVec3A = new pc.Vec3();

    app.on('update', (dt) => {
        data.set('data.stats.gsplats', app.stats.frame.gsplats.toLocaleString());
        const bb = app.graphicsDevice.backBufferSize;
        data.set('data.stats.resolution', `${bb.x} x ${bb.y}`);

        if (!app.xr.active) return;

        const sources = app.xr.input.inputSources;
        for (let i = 0; i < sources.length; i++) {
            const inputSource = sources[i];
            if (!inputSource.gamepad) continue;

            if (inputSource.handedness === pc.XRHAND_LEFT) {
                tmpVec2A.set(inputSource.gamepad.axes[2], inputSource.gamepad.axes[3]);
                if (tmpVec2A.length()) {
                    tmpVec2A.normalize();
                    tmpVec2B.x = camera.forward.x;
                    tmpVec2B.y = camera.forward.z;
                    tmpVec2B.normalize();
                    const rad = Math.atan2(tmpVec2B.x, tmpVec2B.y) - Math.PI / 2;
                    const t = tmpVec2A.x * Math.sin(rad) - tmpVec2A.y * Math.cos(rad);
                    tmpVec2A.y = tmpVec2A.y * Math.sin(rad) + tmpVec2A.x * Math.cos(rad);
                    tmpVec2A.x = t;
                    tmpVec2A.mulScalar(movementSpeed * dt);
                    cameraRig.translate(tmpVec2A.x, 0, tmpVec2A.y);
                }
            } else if (inputSource.handedness === pc.XRHAND_RIGHT) {
                const rotate = -inputSource.gamepad.axes[2];
                if (lastRotateValue > 0 && rotate < rotateResetThreshold) {
                    lastRotateValue = 0;
                } else if (lastRotateValue < 0 && rotate > -rotateResetThreshold) {
                    lastRotateValue = 0;
                }
                if (lastRotateValue === 0 && Math.abs(rotate) > rotateThreshold) {
                    lastRotateValue = Math.sign(rotate);
                    tmpVec3A.copy(camera.getLocalPosition());
                    cameraRig.translateLocal(tmpVec3A);
                    cameraRig.rotateLocal(0, Math.sign(rotate) * rotateSpeed, 0);
                    cameraRig.translateLocal(tmpVec3A.mulScalar(-1));
                }
            }
        }
    });
});

export { app };
