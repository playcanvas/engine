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
    url: 'https://code.playcanvas.com/examples_data/example_skatepark_02/lod-meta.json',
    lodUpdateDistance: 1,
    lodUnderfillLimit: 10,
    cameraPosition: [32, 2, 2],
    eulerAngles: [-90, 0, 0],
    focusPoint: [18, -1.3, 13.5],
    moveSpeed: 4,
    moveFastSpeed: 15,
    enableOrbit: false,
    enablePan: false
};

// LOD preset definitions
/** @type {Record<string, { range: number[], lodDistances: number[] }>} */
const LOD_PRESETS = {
    'desktop': {
        range: [0, 2],
        lodDistances: [15, 30, 80, 250, 300]
    },
    'mobile': {
        range: [2, 5],
        lodDistances: [15, 30, 80, 250, 300]
    }
};

const assets = {
    skatepark: new pc.Asset('skatepark', 'gsplat', { url: config.url }),
    logo: new pc.Asset('logo', 'gsplat', { url: `${rootPath}/static/assets/splats/playcanvas-logo/meta.json` }),
    biker: new pc.Asset('biker', 'gsplat', { url: `${rootPath}/static/assets/splats/biker.compressed.ply` }),

    envatlas: new pc.Asset(
        'env-atlas',
        'texture',
        { url: `${rootPath}/static/assets/cubemaps/table-mountain-env-atlas.png` },
        { type: pc.TEXTURETYPE_RGBP, mipmaps: false }
    )
};

const assetListLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
assetListLoader.load(() => {

    // Enable GPU sorting (desktop only for now)
    if (!pc.platform.mobile) {
        app.scene.gsplat.gpuSorting = true;
    }

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
    app.scene.gsplat.colorUpdateDistance = 1;
    app.scene.gsplat.colorUpdateAngle = 4;
    app.scene.gsplat.colorUpdateDistanceLodScale = 2;
    app.scene.gsplat.colorUpdateAngleLodScale = 2;

    // Auto-select LOD preset based on device
    const preset = pc.platform.mobile ? 'mobile' : 'desktop';
    const presetData = LOD_PRESETS[preset];

    app.scene.gsplat.lodRangeMin = presetData.range[0];
    app.scene.gsplat.lodRangeMax = presetData.range[1];

    // Create skatepark entity
    const skatepark = new pc.Entity('Skatepark');
    skatepark.addComponent('gsplat', {
        asset: assets.skatepark,
        unified: true
    });
    skatepark.setLocalPosition(0, 0, 0);
    const [rotX, rotY, rotZ] = /** @type {[number, number, number]} */ (config.eulerAngles);
    skatepark.setLocalEulerAngles(rotX, rotY, rotZ);
    skatepark.setLocalScale(1, 1, 1);
    app.root.addChild(skatepark);

    // Apply LOD distances to skatepark
    const gs = /** @type {any} */ (skatepark.gsplat);
    gs.lodDistances = presetData.lodDistances;

    // World center coordinates
    const worldCenter = { x: 18, y: -1.3, z: 13.5 };

    // Create biker entity at center, ground level
    const biker = new pc.Entity('Biker');
    biker.addComponent('gsplat', {
        asset: assets.biker,
        unified: true
    });
    biker.setLocalPosition(worldCenter.x, worldCenter.y, worldCenter.z);
    biker.setLocalEulerAngles(180, 0, 0);
    biker.setLocalScale(1, 1, 1);
    app.root.addChild(biker);

    // Create first orbiting logo
    const logo1 = new pc.Entity('Logo1');
    logo1.addComponent('gsplat', {
        asset: assets.logo,
        unified: true
    });
    logo1.setLocalEulerAngles(180, 90, 0);
    app.root.addChild(logo1);

    // Create second orbiting logo
    const logo2 = new pc.Entity('Logo2');
    logo2.addComponent('gsplat', {
        asset: assets.logo,
        unified: true
    });
    logo2.setLocalEulerAngles(180, 90, 0);
    logo2.setLocalScale(0.5, 0.5, 0.5);
    app.root.addChild(logo2);

    // Create camera
    const camera = new pc.Entity('Camera');
    camera.addComponent('camera', {
        clearColor: new pc.Color(0.2, 0.2, 0.2),
        fov: 75,
        toneMapping: pc.TONEMAP_ACES
    });

    // Set camera position
    const [camX, camY, camZ] = /** @type {[number, number, number]} */ (config.cameraPosition);
    const [focusX, focusY, focusZ] = /** @type {[number, number, number]} */ (config.focusPoint);
    const focusPoint = new pc.Vec3(focusX, focusY, focusZ);
    camera.setLocalPosition(camX, camY, camZ);
    app.root.addChild(camera);

    // Add camera controls
    camera.addComponent('script');
    const cc = /** @type {CameraControls} */ ((/** @type {any} */ (camera.script)).create(CameraControls));
    Object.assign(cc, {
        sceneSize: 500,
        moveSpeed: config.moveSpeed,
        moveFastSpeed: config.moveFastSpeed,
        enableOrbit: config.enableOrbit,
        enablePan: config.enablePan,
        focusPoint: focusPoint
    });

    // Orbit parameters
    const logo1Radius = 3;
    const logo1Speed = 0.6;
    const logo2Radius = 5;
    const logo2Speed = -0.2;
    const orbitHeight = 3;

    // Animation update
    let time = 0;
    const centerVec = new pc.Vec3(worldCenter.x, worldCenter.y + orbitHeight, worldCenter.z);
    const rollSpeed1 = 90; // degrees per second
    const rollSpeed2 = 120; // degrees per second
    app.on('update', (dt) => {
        time += dt;

        // Orbit logo 1 around world center
        const angle1 = time * logo1Speed;
        logo1.setLocalPosition(
            worldCenter.x + logo1Radius * Math.sin(angle1),
            worldCenter.y + orbitHeight,
            worldCenter.z + logo1Radius * Math.cos(angle1)
        );
        logo1.lookAt(centerVec);
        logo1.rotateLocal(0, 0, time * rollSpeed1);

        // Orbit logo 2 around world center (opposite direction)
        const angle2 = time * logo2Speed;
        logo2.setLocalPosition(
            worldCenter.x + logo2Radius * Math.sin(angle2),
            worldCenter.y + orbitHeight,
            worldCenter.z + logo2Radius * Math.cos(angle2)
        );
        logo2.lookAt(centerVec);
        logo2.rotateLocal(0, 0, time * rollSpeed2);
    });
});

export { app };
