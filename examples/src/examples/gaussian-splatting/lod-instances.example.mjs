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
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

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

// Ensure canvas is resized when window changes size
const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => {
    window.removeEventListener('resize', resize);
});

// configuration for grid instances
const GRID_SIZE = 7; // N x N grid
const GRID_SPACING = 1.0; // spacing between instances in world units
const INSTANCE_SCALE = 2;
const INSTANCE_Y = 0.0; // place on ground plane

const assets = {
    flowers: new pc.Asset('gsplat', 'gsplat', { url: `${rootPath}/static/assets/splats/flowers/lod-meta.json` }),
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

    // enable rotation-based LOD updates and behind-camera penalty
    app.scene.gsplat.lodUpdateAngle = 90;
    app.scene.gsplat.lodBehindPenalty = 4;

    // initialize UI settings and wire to scene flags
    data.set('debugAabbs', !!data.get('debugAabbs'));
    data.set('debugLod', !!data.get('debugLod'));
    const defaultPreset = pc.platform.mobile ? 'low' : 'normal';
    data.set('lodPreset', data.get('lodPreset') || defaultPreset);
    app.scene.gsplat.debugAabbs = !!data.get('debugAabbs');
    app.scene.gsplat.colorizeLod = !!data.get('debugLod');

    data.on('debugAabbs:set', () => {
        app.scene.gsplat.debugAabbs = !!data.get('debugAabbs');
    });
    data.on('debugLod:set', () => {
        app.scene.gsplat.colorizeLod = !!data.get('debugLod');
    });

    const applyPreset = () => {
        const preset = data.get('lodPreset');
        if (preset === 'ultra') {
            app.scene.gsplat.lodRangeMin = 0;
            app.scene.gsplat.lodRangeMax = 0;
        } else if (preset === 'high') {
            app.scene.gsplat.lodRangeMin = 1;
            app.scene.gsplat.lodRangeMax = 2;
        } else if (preset === 'low') {
            app.scene.gsplat.lodRangeMin = 2;
            app.scene.gsplat.lodRangeMax = 3;
        } else { // normal
            app.scene.gsplat.lodRangeMin = 0;
            app.scene.gsplat.lodRangeMax = 3;
        }
    };

    applyPreset();
    data.on('lodPreset:set', applyPreset);

    // create grid of instances centered around origin on XZ plane
    const half = (GRID_SIZE - 1) * 0.5;
    /**
     * Compute per-LOD distances from a base value.
     * @param {number} base - The base distance in world units.
     * @returns {number[]} The array of distances for LODs 0..4.
     */
    const lodBase = 0.7;
    const lodDistances = [lodBase, lodBase * 2, lodBase * 3, lodBase * 4, lodBase * 5];

    for (let z = 0; z < GRID_SIZE; z++) {
        for (let x = 0; x < GRID_SIZE; x++) {
            const entity = new pc.Entity(`flowers-${x}-${z}`);
            entity.addComponent('gsplat', {
                asset: assets.flowers,
                unified: true
            });
            const px = (x - half) * GRID_SPACING;
            const pz = (z - half) * GRID_SPACING;
            entity.setLocalPosition(px, INSTANCE_Y, pz);
            entity.setLocalEulerAngles(180, 0, 0);
            entity.setLocalScale(INSTANCE_SCALE, INSTANCE_SCALE, INSTANCE_SCALE);
            app.root.addChild(entity);
            const gs = /** @type {any} */ (entity.gsplat);
            gs.lodDistances = lodDistances;
        }
    }

    // Create a camera with fly controls
    const camera = new pc.Entity('camera');
    camera.addComponent('camera', {
        clearColor: new pc.Color(0.2, 0.2, 0.2),
        fov: 75,
        toneMapping: pc.TONEMAP_ACES
    });

    camera.setLocalPosition(4, 0.6, 4);
    app.root.addChild(camera);

    camera.addComponent('script');
    const cc = /** @type { CameraControls} */ (camera.script.create(CameraControls));
    Object.assign(cc, {
        sceneSize: 500,
        moveSpeed: 0.003,
        moveFastSpeed: 0.01,
        enableOrbit: false,
        enablePan: false,
        focusPoint: new pc.Vec3(2, 0.6, 0)
    });

    // update HUD stats every frame
    app.on('update', () => {
        data.set('data.stats.gsplats', app.stats.frame.gsplats.toLocaleString());
    });
});

export { app };
