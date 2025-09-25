// @config HIDDEN
import { data } from 'examples/observer';
import { deviceType, rootPath, fileImport } from 'examples/utils';
import * as pc from 'playcanvas';

const { CameraControls } = await fileImport(`${rootPath}/static/scripts/esm/camera-controls.mjs`);

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

// Configuration: Uncomment one block below (or add your own) and comment out others
// const config = {
//     name: 'iceland-church',
//     url: `${rootPath}/static/assets/splats/iceland-church/lod-meta.json`,
//     lodPresetDesktop: 'great',
//     lodPresetMobile: 'low',
//     lodDistances: [50, 100, 150, 250, 300],
//     cameraPosition: [1.3, 2.6, 8.2],
//     eulerAngles: [-90, 0, 0],
//     moveSpeed: 4,
//     moveFastSpeed: 15
// };

// const config = {
//     name: 'colt-tower',
//     url: `${rootPath}/static/assets/splats/colt-tower/lod-meta.json`,
//     lodPresetDesktop: 'normal',
//     lodPresetMobile: 'low',
//     lodDistances: [0.5, 1, 2, 8, 10],
//     cameraPosition: [10.3, 2, 8.2],
//     eulerAngles: [-90, 0, 0],
//     moveSpeed: 4,
//     moveFastSpeed: 15
// };


const config = {
    name: 'skatepark',
    url: 'https://code.playcanvas.com/examples_data/skatepark/lod-meta.json',
    lodPresetDesktop: 'great',
    lodPresetMobile: 'low',
    lodDistances: [15, 30, 80, 250, 300],
    cameraPosition: [10.3, 2, 8.2],
    eulerAngles: [-90, 0, 0],
    moveSpeed: 4,
    moveFastSpeed: 15
};

// const config = {
//     name: 'cityblock',
//     url: `${rootPath}/static/assets/splats/cityblock/lod-meta.json`,
//     lodPresetDesktop: 'normal',
//     lodPresetMobile: 'low',
//     lodDistances: [50, 100, 150, 250, 300],
//     cameraPosition: [1.3, 200, 8.2],
//     moveSpeed: 40,
//     moveFastSpeed: 150
// };

// const config = {
//     name: 'skatepark-decimated',
//     url: `${rootPath}/static/assets/splats/skatepark-decimated/lod-meta.json`,
//     lodPresetDesktop: 'great',
//     lodPresetMobile: 'low',
//     lodDistances: [15, 30, 80, 250, 300],
//     cameraPosition: [10.3, 2, 8.2],
//     eulerAngles: [-90, 0, 0],
//     moveSpeed: 4,
//     moveFastSpeed: 15
// };

// const config = {
//     name: 'grid',
//     url: `${rootPath}/static/assets/splats/grid/lod-meta.json`,
//     lodPresetDesktop: 'great',
//     lodPresetMobile: 'low',
//     lodDistances: [15, 30, 80, 250, 300],
//     cameraPosition: [10.3, 2, 8.2],
//     eulerAngles: [0, 0, 0],
//     moveSpeed: 4,
//     moveFastSpeed: 15
// };


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
    app.scene.envAtlas = assets.envatlas.resource;
    app.scene.skyboxMip = 1;
    app.scene.exposure = 1.5;

    // Mini-Stats: add VRAM on top of default stats
    const msOptions = pc.MiniStats.getDefaultOptions();
    msOptions.stats.push({
        name: 'VRAM',
        stats: ['vram.tex'],
        decimalPlaces: 1,
        multiplier: 1 / (1024 * 1024),
        unitsName: 'MB',
        watermark: 1024
    });
    const miniStats = new pc.MiniStats(app, msOptions); // eslint-disable-line no-unused-vars

    // enable rotation-based LOD updates and behind-camera penalty
    app.scene.gsplat.lodUpdateAngle = 90;
    app.scene.gsplat.lodBehindPenalty = 4;
    app.scene.gsplat.lodUpdateDistance = 3;
    app.scene.gsplat.lodUnderfillLimit = 10;

    // initialize UI settings and wire to scene flags
    data.set('debugAabbs', false);
    data.set('debugLod', false);
    data.set('lodPreset', pc.platform.mobile ? config.lodPresetMobile : config.lodPresetDesktop);

    app.scene.gsplat.debugAabbs = !!data.get('debugAabbs');
    app.scene.gsplat.colorizeLod = !!data.get('debugLod');

    data.on('debugAabbs:set', () => {
        app.scene.gsplat.debugAabbs = !!data.get('debugAabbs');
    });
    data.on('debugLod:set', () => {
        app.scene.gsplat.colorizeLod = !!data.get('debugLod');
    });

    // LOD preset definitions: map preset key to [min, max]
    /** @type {Record<string, number[]>} */
    const LOD_PRESETS = {
        normal: [0, 3],
        great: [0, 1],
        high: [1, 2],
        low: [1, 3],
        zero: [0, 0],
        one: [1, 1],
        two: [2, 2],
        three: [3, 3]
    };

    const applyPreset = () => {
        const preset = data.get('lodPreset');
        const range = LOD_PRESETS[preset] || LOD_PRESETS.normal;
        app.scene.gsplat.lodRangeMin = range[0];
        app.scene.gsplat.lodRangeMax = range[1];
    };

    applyPreset();
    data.on('lodPreset:set', applyPreset);

    // const lodDistances = [10, 15, 20, 25, 30];
    const lodDistances = config.lodDistances;

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
    gs.lodDistances = lodDistances;

    // Create a camera with fly controls
    const camera = new pc.Entity('camera');
    camera.addComponent('camera', {
        clearColor: new pc.Color(0.2, 0.2, 0.2),
        fov: 75,
        toneMapping: pc.TONEMAP_ACES
    });

    //    camera.setLocalPosition(1.3, 2.6, 8.2);
    const [camX, camY, camZ] = /** @type {[number, number, number]} */ (config.cameraPosition);
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
        focusPoint: new pc.Vec3(0, 0.6, 0)
    });

    // update HUD stats every frame
    app.on('update', () => {
        data.set('data.stats.gsplats', app.stats.frame.gsplats.toLocaleString());
        const bb = app.graphicsDevice.backBufferSize;
        data.set('data.stats.resolution', `${bb.x} x ${bb.y}`);
    });
});

export { app };
