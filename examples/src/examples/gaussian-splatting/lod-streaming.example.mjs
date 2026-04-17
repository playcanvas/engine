// @config NO_MINISTATS
// @config DESCRIPTION Demonstrates LOD streaming with radial reveal effect for progressive loading of Gaussian Splats.
import { data } from 'examples/observer';
import { deviceType, rootPath, fileImport } from 'examples/utils';
import * as pc from 'playcanvas';

const { CameraControls } = await fileImport(`${rootPath}/static/scripts/esm/camera-controls.mjs`);
const { GsplatRevealRadial } = await fileImport(`${rootPath}/static/scripts/esm/gsplat/reveal-radial.mjs`);

// allow overriding scene url and orientation via hash query params, e.g.
// #/gaussian-splatting/lod-streaming?url=https://example.com/scene/lod-meta.json&orientation=90
const hashQuery = (window.top?.location.hash || window.location.hash || '').split('?')[1] || '';
const hashParams = new URLSearchParams(hashQuery);
const paramUrl = hashParams.get('url');
const paramOrientation = hashParams.get('orientation');

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

// High Res toggle (false by default): when false, use half native DPR; when true, use min(DPR, 2)
data.set('highRes', !!data.get('highRes'));
const applyResolution = () => {
    const dpr = window.devicePixelRatio || 1;
    // auto: treat DPR >= 2 as high-DPI (drops to half); High Res forces native capped at 2
    device.maxPixelRatio = data.get('highRes') ? Math.min(dpr, 2) : (dpr >= 2 ? dpr * 0.5 : dpr);
};
applyResolution();
const applyAndResize = () => {
    applyResolution(); app.resizeCanvas();
};
data.on('highRes:set', applyAndResize);

// Ensure DPR and canvas are updated when window changes size
window.addEventListener('resize', applyAndResize);
app.on('destroy', () => {
    window.removeEventListener('resize', applyAndResize);
});

// Roman-Parish configuration
// original dataset: https://www.youtube.com/watch?v=3RtY_cLK13k
const config = {
    name: 'Roman-Parish',
    url: 'https://code.playcanvas.com/examples_data/example_roman_parish_02/lod-meta.json',
    lodUpdateDistance: 0.5,
    lodUnderfillLimit: 5,
    cameraPosition: [10.3, 2, -10],
    eulerAngles: [-90, 0, 0],
    moveSpeed: 4,
    moveFastSpeed: 15,
    enableOrbit: false,
    enablePan: false,
    focusPoint: [12, 3, 0]
};

// HDRI environment presets (Poly Haven, infinite projection)
/** @type {Record<string, { url: string, exposure: number } | null>} */
const ENV_PRESETS = {
    'none': null,
    'rosendal': {
        url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/2k/rosendal_park_sunset_puresky_2k.hdr',
        exposure: 0.06
    },
    'industrial-sunset': {
        url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/2k/industrial_sunset_puresky_2k.hdr',
        exposure: 0.8
    },
    'partly-cloudy': {
        url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/2k/kloofendal_48d_partly_cloudy_puresky_2k.hdr',
        exposure: 0.9
    },
    'moonlit': {
        url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/2k/qwantani_moon_noon_puresky_2k.hdr',
        exposure: 0.4
    },
    'sunflowers': {
        url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/2k/sunflowers_puresky_2k.hdr',
        exposure: 0.8
    },
    'table-mountain': {
        url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/2k/table_mountain_2_puresky_2k.hdr',
        exposure: 1
    },
    'cloud-layers': {
        url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/2k/cloud_layers_2k.hdr',
        exposure: 1
    },
    'night': {
        url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/2k/qwantani_night_puresky_2k.hdr',
        exposure: 0.2
    }
};

// LOD preset definitions
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

const assets = {
    church: new pc.Asset('gsplat', 'gsplat', { url: config.url }),

    envatlas: new pc.Asset(
        'env-atlas',
        'texture',
        { url: `${rootPath}/static/assets/cubemaps/table-mountain-env-atlas.png` },
        { type: pc.TEXTURETYPE_RGBP, mipmaps: false }
    )
};

const assetListLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
assetListLoader.load(async () => {
    app.start();

    const miniStats = new pc.MiniStats(app, pc.MiniStats.getDefaultOptions(['gsplats', 'gsplatsCopy'])); // eslint-disable-line no-unused-vars

    // enable rotation-based LOD updates and behind-camera penalty
    app.scene.gsplat.lodUpdateAngle = 90;
    app.scene.gsplat.lodBehindPenalty = 3;
    app.scene.gsplat.radialSorting = true;

    data.on('radialSorting:set', () => {
        app.scene.gsplat.radialSorting = !!data.get('radialSorting');
    });

    app.scene.gsplat.lodUpdateDistance = config.lodUpdateDistance;
    app.scene.gsplat.lodUnderfillLimit = config.lodUnderfillLimit;

    data.on('renderer:set', () => {
        app.scene.gsplat.renderer = data.get('renderer');
        const current = app.scene.gsplat.currentRenderer;
        if (current !== data.get('renderer')) {
            setTimeout(() => data.set('renderer', current), 0);
        }
    });
    data.on('minPixelSize:set', () => {
        app.scene.gsplat.minPixelSize = data.get('minPixelSize');
    });
    data.on('minContribution:set', () => {
        app.scene.gsplat.minContribution = data.get('minContribution');
    });
    data.on('debug:set', () => {
        app.scene.gsplat.debug = data.get('debug');
    });
    data.on('compact:set', () => {
        app.scene.gsplat.dataFormat = data.get('compact') ? pc.GSPLATDATA_COMPACT : pc.GSPLATDATA_LARGE;
    });

    const MAX_PERSPECTIVE_FOV = 140;

    // initialize UI settings (must be after observer registration)
    data.set('fisheye', 0);
    data.set('cameraFov', 75);
    data.set('toneMapping', pc.TONEMAP_LINEAR);
    data.set('exposure', 1);
    data.set('minPixelSize', 2);
    data.set('minContribution', 3);
    data.set('radialSorting', true);
    data.set('renderer', pc.GSPLAT_RENDERER_AUTO);
    data.set('culling', device.isWebGPU);
    data.set('compact', true);
    data.set('debug', pc.GSPLAT_DEBUG_NONE);
    data.set('lodPreset', pc.platform.mobile ? 'mobile' : 'desktop');
    data.set('splatBudget', pc.platform.mobile ? 1 : 4);
    data.set('environment', 'none');
    data.set('fogDensity', 0);
    data.set('url', paramUrl || '');
    data.set('orientation', paramOrientation ? parseFloat(paramOrientation) : 270);

    const gsplatSystem = /** @type {any} */ (app.systems.gsplat);

    // Create a camera with fly controls
    const camera = new pc.Entity('camera');
    camera.addComponent('camera', {
        clearColor: new pc.Color(1, 1, 1),
        fov: 75,
        toneMapping: pc.TONEMAP_LINEAR
    });

    const [camX, camY, camZ] = /** @type {[number, number, number]} */ (config.cameraPosition);
    const [focusX, focusY, focusZ] = /** @type {[number, number, number]} */ (config.focusPoint || [0, 0.6, 0]);
    const focusPoint = new pc.Vec3(focusX, focusY, focusZ);

    camera.setLocalPosition(camX, camY, camZ);
    app.root.addChild(camera);

    camera.addComponent('script');
    const cc = /** @type { CameraControls} */ ((/** @type {any} */ (camera.script)).create(CameraControls));
    Object.assign(cc, {
        sceneSize: 500,
        moveSpeed: /** @type {number} */ (config.moveSpeed),
        moveFastSpeed: /** @type {number} */ (config.moveFastSpeed),
        enableOrbit: false,
        enablePan: false,
        focusPoint: focusPoint
    });

    // Orange occluder cube (hidden by default, toggled via UI)
    const cube = new pc.Entity('orange-cube');
    cube.addComponent('render', { type: 'box' });
    const orangeMat = new pc.StandardMaterial();
    orangeMat.diffuse = new pc.Color(0, 0, 0);
    orangeMat.emissive = new pc.Color(1, 0.5, 0);
    orangeMat.update();
    cube.render.meshInstances[0].material = orangeMat;
    cube.setLocalPosition(6, 1, -2);
    cube.setLocalScale(2, 2, 2);
    cube.enabled = false;
    app.root.addChild(cube);
    // CameraFrame for HDR linear rendering (created lazily on first enable)
    /** @type {pc.CameraFrame|null} */
    let cameraFrame = null;

    // Enable depth prepass so the compute splat rasterizer can depth-test
    // against scene geometry (e.g. the occluder cube).
    const applyOccluder = () => {
        const enabled = !!data.get('occluder');
        cube.enabled = enabled;
        if (cameraFrame) {
            cameraFrame.rendering.sceneDepthMap = enabled;
            cameraFrame.update();
        }
    };

    data.set('occluder', false);
    data.on('occluder:set', applyOccluder);

    const applyToneMapping = () => {
        const tm = data.get('toneMapping');
        if (cameraFrame?.enabled) {
            cameraFrame.rendering.toneMapping = tm;
            cameraFrame.update();
        } else {
            camera.camera.toneMapping = tm;
        }
    };

    data.set('cameraFrame', false);
    data.on('cameraFrame:set', () => {
        if (data.get('cameraFrame')) {
            if (!cameraFrame) {
                cameraFrame = new pc.CameraFrame(app, camera.camera);
                cameraFrame.rendering.toneMapping = data.get('toneMapping');
                applyOccluder();
            }
            cameraFrame.enabled = true;
            cameraFrame.update();
        } else if (cameraFrame) {
            cameraFrame.destroy();
            cameraFrame = null;
        }
        applyToneMapping();
    });

    const applyFov = () => {
        const fov = data.get('cameraFov');
        camera.camera.fov = (data.get('fisheye') === 0) ? Math.min(fov, MAX_PERSPECTIVE_FOV) : fov;
    };
    data.on('cameraFov:set', applyFov);
    data.on('fisheye:set', () => {
        const fisheye = data.get('fisheye');
        app.scene.gsplat.fisheye = fisheye;
        app.scene.sky.fisheye = fisheye;
        applyFov();
    });
    data.on('toneMapping:set', applyToneMapping);
    data.on('exposure:set', () => {
        app.scene.exposure = data.get('exposure');
    });

    data.on('fogDensity:set', () => {
        const density = data.get('fogDensity');
        if (density > 0) {
            app.scene.fog.type = pc.FOG_EXP;
            app.scene.fog.density = density;
            app.scene.fog.color.copy(camera.camera.clearColor);
        } else {
            app.scene.fog.type = pc.FOG_NONE;
        }
    });

    // Poly Haven credit overlay (shown when an HDRI is active)
    const phCredit = document.createElement('a');
    phCredit.href = 'https://polyhaven.com';
    phCredit.target = '_blank';
    phCredit.rel = 'noopener';
    phCredit.textContent = 'HDRI by Poly Haven';
    Object.assign(phCredit.style, {
        position: 'fixed',
        bottom: '6px',
        right: '10px',
        zIndex: '11',
        font: '400 16px/1 sans-serif',
        color: 'rgba(255,255,255,0.25)',
        textDecoration: 'none',
        pointerEvents: 'auto',
        display: 'none'
    });
    phCredit.onmouseenter = () => {
        phCredit.style.color = 'rgba(255,255,255,0.5)';
    };
    phCredit.onmouseleave = () => {
        phCredit.style.color = 'rgba(255,255,255,0.25)';
    };
    document.body.appendChild(phCredit);
    app.on('destroy', () => phCredit.remove());

    // HDRI environment loading
    /** @type {Map<string, { skybox: pc.Texture, envAtlas: pc.Texture }>} */
    const hdriCache = new Map();

    const applyEnvironment = async (/** @type {string} */ name) => {
        const preset = ENV_PRESETS[name];
        if (!preset) {
            app.scene.skybox = null;
            app.scene.envAtlas = null;
            phCredit.style.display = 'none';
            data.set('exposure', 1);
            return;
        }

        if (!hdriCache.has(preset.url)) {
            const asset = new pc.Asset('hdri', 'texture', { url: preset.url }, { mipmaps: false });
            await new Promise((resolve, reject) => {
                asset.on('load', resolve);
                asset.on('error', (/** @type {string} */ err) => {
                    console.error('Failed to load HDRI:', err);
                    reject(err);
                });
                app.assets.add(asset);
                app.assets.load(asset);
            });

            const source = asset.resource;
            const skybox = pc.EnvLighting.generateSkyboxCubemap(source);
            const lighting = pc.EnvLighting.generateLightingSource(source);
            const envAtlas = pc.EnvLighting.generateAtlas(lighting);
            lighting.destroy();
            hdriCache.set(preset.url, { skybox, envAtlas });
        }

        const cached = /** @type {{ skybox: pc.Texture, envAtlas: pc.Texture }} */ (hdriCache.get(preset.url));
        app.scene.skybox = cached.skybox;
        app.scene.envAtlas = cached.envAtlas;
        app.scene.sky.type = pc.SKYTYPE_INFINITE;
        data.set('exposure', preset.exposure ?? 1);
        phCredit.style.display = 'block';
    };

    data.on('environment:set', () => {
        applyEnvironment(data.get('environment')).catch((err) => {
            console.warn('Environment load failed:', err);
        });
    });

    // Gsplat loading state
    /** @type {pc.Entity|null} */
    let gsplatEntity = null;
    /** @type {any} */
    let gsplatGs = null;
    /** @type {pc.Asset|null} */
    let customAsset = null;

    const applyPreset = () => {
        const preset = data.get('lodPreset');
        const presetData = LOD_PRESETS[preset] || LOD_PRESETS.desktop;
        app.scene.gsplat.lodRangeMin = presetData.range[0];
        app.scene.gsplat.lodRangeMax = presetData.range[1];
        if (gsplatGs) {
            gsplatGs.lodBaseDistance = presetData.lodBaseDistance;
            gsplatGs.lodMultiplier = presetData.lodMultiplier;
        }
        data.set('lodBaseDistance', presetData.lodBaseDistance);
        data.set('lodMultiplier', presetData.lodMultiplier);
    };

    const loadGsplat = async (/** @type {string|null} */ url) => {
        if (gsplatEntity) {
            gsplatEntity.destroy();
            gsplatEntity = null;
            gsplatGs = null;
        }

        if (customAsset) {
            app.assets.remove(customAsset);
            customAsset.unload();
            customAsset = null;
        }

        /** @type {pc.Asset} */
        let asset;
        if (url) {
            asset = new pc.Asset('gsplat', 'gsplat', { url: url });
            app.assets.add(asset);
            await new Promise((resolve, reject) => {
                asset.on('load', resolve);
                asset.on('error', (/** @type {string} */ err) => {
                    console.error('Failed to load gsplat:', err);
                    reject(err);
                });
                app.assets.load(asset);
            });
            customAsset = asset; // eslint-disable-line require-atomic-updates
        } else {
            asset = assets.church;
        }

        gsplatEntity = new pc.Entity(config.name || 'gsplat'); // eslint-disable-line require-atomic-updates
        gsplatEntity.addComponent('gsplat', {
            asset: asset,
            unified: true
        });
        gsplatEntity.setLocalPosition(0, 0, 0);
        gsplatEntity.setLocalEulerAngles(data.get('orientation'), 0, 0);
        gsplatEntity.setLocalScale(1, 1, 1);
        app.root.addChild(gsplatEntity);
        gsplatGs = /** @type {any} */ (gsplatEntity.gsplat);

        const presetData = LOD_PRESETS[data.get('lodPreset')] || LOD_PRESETS.desktop;
        gsplatGs.lodBaseDistance = presetData.lodBaseDistance;
        gsplatGs.lodMultiplier = presetData.lodMultiplier;

        // Start with lowest LOD for fast initial display, then stream up
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

        // Radial reveal effect
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

    // Initial load (use URL from hash params if provided)
    await loadGsplat(paramUrl || null);

    data.on('lodPreset:set', applyPreset);

    data.on('lodBaseDistance:set', () => {
        if (gsplatGs) gsplatGs.lodBaseDistance = data.get('lodBaseDistance');
    });
    data.on('lodMultiplier:set', () => {
        if (gsplatGs) gsplatGs.lodMultiplier = data.get('lodMultiplier');
    });

    const applySplatBudget = () => {
        const millions = data.get('splatBudget');
        app.scene.gsplat.splatBudget = Math.round(millions * 1000000);
    };

    applySplatBudget();
    data.on('splatBudget:set', applySplatBudget);

    data.on('orientation:set', () => {
        if (gsplatEntity) {
            gsplatEntity.setLocalEulerAngles(data.get('orientation'), 0, 0);
        }
    });

    data.on('url:set', () => {
        const url = data.get('url');
        loadGsplat(url || null).catch((err) => {
            console.warn('Loading failed, reverting to default:', err);
            loadGsplat(null);
        });
    });

    // update HUD stats every frame
    app.on('update', () => {
        data.set('data.stats.gsplats', app.stats.frame.gsplats.toLocaleString());
        const bb = app.graphicsDevice.backBufferSize;
        data.set('data.stats.resolution', `${bb.x} x ${bb.y}`);
    });
});

export { app };
