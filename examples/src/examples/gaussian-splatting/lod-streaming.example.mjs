import { data } from 'examples/observer';
import { deviceType, rootPath, fileImport } from 'examples/utils';
import * as pc from 'playcanvas';

const { CameraControls } = await fileImport(`${rootPath}/static/scripts/esm/camera-controls.mjs`);
const { GsplatRevealRadial } = await fileImport(`${rootPath}/static/scripts/esm/gsplat/reveal-radial.mjs`);

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

// LOD preset definitions with customizable distances
/** @type {Record<string, { range: number[], lodDistances: number[] }>} */
const LOD_PRESETS = {
    'desktop-max': {
        range: [0, 5],
        lodDistances: [10, 20, 40, 80, 120, 150, 200]
    },
    'desktop': {
        range: [1, 5],
        lodDistances: [5, 10, 25, 50, 65, 90, 150]
    },
    'mobile-max': {
        range: [2, 5],
        lodDistances: [5, 7, 12, 25, 75, 120, 200]
    },
    'mobile': {
        range: [3, 5],
        lodDistances: [2, 4, 6, 10, 75, 120, 200]
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
assetListLoader.load(() => {
    app.start();

    // setup skydome
    app.scene.skyboxMip = 1;
    app.scene.exposure = 1.5;

    // Mini-Stats: add VRAM and gsplats on top of default stats
    const msOptions = pc.MiniStats.getDefaultOptions();
    msOptions.stats.push({
        name: 'VRAM',
        stats: ['vram.tex'],
        decimalPlaces: 1,
        multiplier: 1 / (1024 * 1024),
        unitsName: 'MB',
        watermark: 1024
    });
    msOptions.stats.push({
        name: 'GSplats',
        stats: ['frame.gsplats'],
        decimalPlaces: 3,
        multiplier: 1 / 1000000,
        unitsName: 'M',
        watermark: 10
    });
    const miniStats = new pc.MiniStats(app, msOptions); // eslint-disable-line no-unused-vars

    // enable rotation-based LOD updates and behind-camera penalty
    app.scene.gsplat.lodUpdateAngle = 90;
    app.scene.gsplat.lodBehindPenalty = 5;
    app.scene.gsplat.radialSorting = true;
    app.scene.gsplat.lodUpdateDistance = config.lodUpdateDistance;
    app.scene.gsplat.lodUnderfillLimit = config.lodUnderfillLimit;

    // initialize UI settings
    data.set('debugLod', false);
    data.set('lodPreset', pc.platform.mobile ? 'mobile' : 'desktop');
    data.set('splatBudget', pc.platform.mobile ? '1M' : '4M');

    app.scene.gsplat.colorizeLod = !!data.get('debugLod');

    data.on('debugLod:set', () => {
        app.scene.gsplat.colorizeLod = !!data.get('debugLod');
    });

    const entity = new pc.Entity(config.name || 'gsplat');
    entity.addComponent('gsplat', {
        asset: assets.church,
        unified: true
    });
    entity.setLocalPosition(0, 0, 0);
    const [rotX, rotY, rotZ] = /** @type {[number, number, number]} */ (config.eulerAngles || [-90, 0, 0]);
    entity.setLocalEulerAngles(rotX, rotY, rotZ);
    entity.setLocalScale(1, 1, 1);
    app.root.addChild(entity);
    const gs = /** @type {any} */ (entity.gsplat);

    const applyPreset = () => {
        const preset = data.get('lodPreset');
        const presetData = LOD_PRESETS[preset] || LOD_PRESETS.desktop;
        app.scene.gsplat.lodRangeMin = presetData.range[0];
        app.scene.gsplat.lodRangeMax = presetData.range[1];
        gs.lodDistances = presetData.lodDistances;
    };

    applyPreset();
    data.on('lodPreset:set', applyPreset);

    const applySplatBudget = () => {
        const preset = data.get('splatBudget');
        const budgetMap = {
            'none': 0,
            '1M': 1000000,
            '2M': 2000000,
            '3M': 3000000,
            '4M': 4000000,
            '6M': 6000000
        };
        app.scene.gsplat.splatBudget = budgetMap[preset] || 0;
    };

    applySplatBudget();
    data.on('splatBudget:set', applySplatBudget);

    // Create a camera with fly controls
    const camera = new pc.Entity('camera');
    camera.addComponent('camera', {
        clearColor: new pc.Color(0.2, 0.2, 0.2),
        fov: 75,
        toneMapping: pc.TONEMAP_LINEAR
    });

    // Set camera position
    const [camX, camY, camZ] = /** @type {[number, number, number]} */ (config.cameraPosition);
    const [focusX, focusY, focusZ] = /** @type {[number, number, number]} */ (config.focusPoint || [0, 0.6, 0]);
    const focusPoint = new pc.Vec3(focusX, focusY, focusZ);

    camera.setLocalPosition(camX, camY, camZ);

    app.root.addChild(camera);

    // Add the GsplatRevealRadial script to the gsplat entity
    entity.addComponent('script');
    const revealScript = entity.script?.create(GsplatRevealRadial);
    if (revealScript) {
        revealScript.center.set(focusX, focusY, focusZ);
        revealScript.speed = 5;
        revealScript.acceleration = 0;
        revealScript.delay = 3;
        revealScript.oscillationIntensity = 0.2;
        revealScript.endRadius = 25;
    }

    camera.addComponent('script');
    const cc = /** @type { CameraControls} */ ((/** @type {any} */ (camera.script)).create(CameraControls));
    Object.assign(cc, {
        sceneSize: 500,
        moveSpeed: /** @type {number} */ (config.moveSpeed),
        moveFastSpeed: /** @type {number} */ (config.moveFastSpeed),
        enableOrbit: config.enableOrbit ?? false,
        enablePan: config.enablePan ?? false,
        focusPoint: focusPoint
    });

    // update HUD stats every frame
    app.on('update', () => {
        data.set('data.stats.gsplats', app.stats.frame.gsplats.toLocaleString());
        const bb = app.graphicsDevice.backBufferSize;
        data.set('data.stats.resolution', `${bb.x} x ${bb.y}`);
    });
});

export { app };
