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
    url: 'https://code.playcanvas.com/examples_data/example_skatepark_01/lod-meta.json',
    environment: 'https://code.playcanvas.com/examples_data/example_skatepark_01/environment.sog',
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
/** @type {Record<string, { range: number[], lodDistances: number[] }>} */
const LOD_PRESETS = {
    'desktop-max': {
        range: [0, 5],
        lodDistances: [15, 30, 80, 250, 300]
    },
    'desktop': {
        range: [0, 2],
        lodDistances: [15, 30, 80, 250, 300]
    },
    'mobile-max': {
        range: [1, 2],
        lodDistances: [15, 30, 80, 250, 300]
    },
    'mobile': {
        range: [2, 5],
        lodDistances: [15, 30, 80, 250, 300]
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

// Add environment asset if specified in config
if (config.environment) {
    assets.environment = new pc.Asset('gsplat-environment', 'gsplat', { url: config.environment });
}

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









    app.scene.gsplat.colorUpdateDistance = 10;
    app.scene.gsplat.colorUpdateAngle = 2;







    // initialize UI settings
    data.set('debugLod', false);
    data.set('colorizeSH', false);
    data.set('lodPreset', pc.platform.mobile ? 'mobile' : 'desktop');

    app.scene.gsplat.colorizeLod = !!data.get('debugLod');
    app.scene.gsplat.colorizeColorUpdate = !!data.get('colorizeSH');

    data.on('debugLod:set', () => {
        app.scene.gsplat.colorizeLod = !!data.get('debugLod');
    });

    data.on('colorizeSH:set', () => {
        app.scene.gsplat.colorizeColorUpdate = !!data.get('colorizeSH');
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

    // Add environment gsplat if specified
    if (assets.environment) {
        const envEntity = new pc.Entity('gsplat-environment');
        envEntity.addComponent('gsplat', {
            asset: assets.environment,
            unified: true
        });
        envEntity.setLocalPosition(0, 0, 0);
        envEntity.setLocalEulerAngles(rotX, rotY, rotZ);
        envEntity.setLocalScale(1, 1, 1);
        app.root.addChild(envEntity);
    }

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

    // // Add the GsplatRevealGridEruption script to the gsplat entity
    // entity.addComponent('script');
    // const revealScript = entity.script?.create(GsplatRevealGridEruption);
    // if (revealScript) {
    //     revealScript.center.set(focusX, focusY, focusZ);
    //     revealScript.blockCount = 10;
    //     revealScript.blockSize = 2;
    //     revealScript.delay = 0.2;
    //     revealScript.duration = 0.5;
    //     revealScript.dotSize = 0.01;
    //     revealScript.endRadius = 35;
    // }

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
