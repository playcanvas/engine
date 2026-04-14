// @config DESCRIPTION Demonstrates LOD streaming combined with spherical harmonics for view-dependent effects.
import { data } from 'examples/observer';
import { deviceType, rootPath, fileImport } from 'examples/utils';
import * as pc from 'playcanvas';

const { CameraControls } = await fileImport(`${rootPath}/static/scripts/esm/camera-controls.mjs`);
const { GsplatRevealGridEruption } = await fileImport(`${rootPath}/static/scripts/esm/gsplat/reveal-grid-eruption.mjs`);

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

// Ensure canvas is updated when window changes size
const onResize = () => app.resizeCanvas();
window.addEventListener('resize', onResize);
app.on('destroy', () => {
    window.removeEventListener('resize', onResize);
});

// Skatepark configuration
const config = {
    name: 'Skatepark',
    url: 'https://code.playcanvas.com/examples_data/example_skatepark_02/lod-meta.json',
    lodUpdateDistance: 1,
    lodUnderfillLimit: 10,
    cameraPosition: [32, 2, 2],
    eulerAngles: [-90, 0, 0],
    moveSpeed: 4,
    moveFastSpeed: 15,
    enableOrbit: false,
    enablePan: false,
    focusPoint: [0, 0.6, 0]
};

// LOD preset definitions with customizable distances
/** @type {Record<string, { range: number[], lodBaseDistance: number }>} */
const LOD_PRESETS = {
    'desktop-max': {
        range: [0, 5],
        lodBaseDistance: 15
    },
    'desktop': {
        range: [0, 2],
        lodBaseDistance: 15
    },
    'mobile-max': {
        range: [1, 2],
        lodBaseDistance: 15
    },
    'mobile': {
        range: [2, 5],
        lodBaseDistance: 15
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

    // enable rotation-based LOD updates and behind-camera penalty
    app.scene.gsplat.lodUpdateAngle = 90;
    app.scene.gsplat.lodBehindPenalty = 2;
    app.scene.gsplat.radialSorting = true;
    app.scene.gsplat.lodUpdateDistance = config.lodUpdateDistance;
    app.scene.gsplat.lodUnderfillLimit = config.lodUnderfillLimit;

    // set up SH update parameters
    app.scene.gsplat.colorUpdateAngle = 10;

    data.on('renderer:set', () => {
        app.scene.gsplat.renderer = data.get('renderer');
        const current = app.scene.gsplat.currentRenderer;
        if (current !== data.get('renderer')) {
            setTimeout(() => data.set('renderer', current), 0);
        }
    });

    // initialize UI settings
    data.set('renderer', pc.GSPLAT_RENDERER_AUTO);
    data.set('debug', pc.GSPLAT_DEBUG_NONE);
    data.set('lodPreset', pc.platform.mobile ? 'mobile' : 'desktop');
    data.set('splatBudget', pc.platform.mobile ? 1 : 3);

    data.on('debug:set', () => {
        app.scene.gsplat.debug = data.get('debug');
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
        gs.lodBaseDistance = presetData.lodBaseDistance;
        data.set('lodBaseDistance', presetData.lodBaseDistance);
    };

    applyPreset();
    data.on('lodPreset:set', applyPreset);

    data.set('lodMultiplier', 4);
    gs.lodMultiplier = 4;

    data.on('lodBaseDistance:set', () => {
        gs.lodBaseDistance = data.get('lodBaseDistance');
    });
    data.on('lodMultiplier:set', () => {
        gs.lodMultiplier = data.get('lodMultiplier');
    });

    const applySplatBudget = () => {
        const millions = data.get('splatBudget');
        app.scene.gsplat.splatBudget = Math.round(millions * 1000000);
    };

    applySplatBudget();
    data.on('splatBudget:set', applySplatBudget);

    // Create a camera with fly controls
    const camera = new pc.Entity('camera');
    camera.addComponent('camera', {
        clearColor: new pc.Color(0.2, 0.2, 0.2),
        fov: 75,
        toneMapping: pc.TONEMAP_ACES
    });

    // Set camera position
    const [camX, camY, camZ] = /** @type {[number, number, number]} */ (config.cameraPosition);
    const [focusX, focusY, focusZ] = /** @type {[number, number, number]} */ (config.focusPoint || [0, 0.6, 0]);
    const focusPoint = new pc.Vec3(focusX, focusY, focusZ);

    camera.setLocalPosition(camX, camY, camZ);

    app.root.addChild(camera);

    // Add the GsplatRevealGridEruption script to the gsplat entity
    entity.addComponent('script');
    const revealScript = entity.script?.create(GsplatRevealGridEruption);
    if (revealScript) {
        revealScript.center.set(focusX, focusY, focusZ);
        revealScript.blockCount = 6;
        revealScript.blockSize = 4;
        revealScript.delay = 0.2;
        revealScript.duration = 0.7;
        revealScript.dotSize = 0.01;
        revealScript.endRadius = 35;
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
    });
});

export { app };
