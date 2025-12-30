// @config DESCRIPTION This example demonstrates gsplat flipbook animation using dynamically loaded splat sequences at different playback speeds.
// @config HIDDEN
// @config NO_MINISTATS
import { deviceType, rootPath, fileImport } from 'examples/utils';
import * as pc from 'playcanvas';

const { GsplatFlipbook } = await fileImport(`${rootPath}/static/scripts/esm/gsplat/gsplat-flipbook.mjs`);

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const gfxOptions = {
    deviceTypes: [deviceType],
    glslangUrl: `${rootPath}/static/lib/glslang/glslang.js`,
    twgslUrl: `${rootPath}/static/lib/twgsl/twgsl.js`,

    // disable antialiasing as gaussian splats do not benefit from it and it's expensive
    antialias: false
};

const device = await pc.createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

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

// Ensure canvas is resized when window changes size
const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', resize);
app.on('destroy', () => {
    window.removeEventListener('resize', resize);
    window.removeEventListener('orientationchange', resize);
});

// Create assets for scripts and skydome
const assets = {
    helipad: new pc.Asset(
        'helipad-env-atlas',
        'texture',
        { url: `${rootPath}/static/assets/cubemaps/helipad-env-atlas.png` },
        { type: pc.TEXTURETYPE_RGBP, mipmaps: false }
    ),
    orbit: new pc.Asset('script', 'script', { url: `${rootPath}/static/scripts/camera/orbit-camera.js` })
};

const assetListLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
assetListLoader.load(() => {
    app.start();

    // setup skydome
    app.scene.skyboxMip = 2;
    app.scene.exposure = 0.2;
    app.scene.envAtlas = assets.helipad.resource;

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

    // Create an Entity with a camera component
    const camera = new pc.Entity();
    camera.addComponent('camera', {
        clearColor: new pc.Color(0.2, 0.2, 0.2),
        toneMapping: pc.TONEMAP_ACES
    });
    camera.setLocalPosition(12.67, 1.16, -1.48);

    // add orbit camera script with a mouse and a touch support
    camera.addComponent('script');
    camera.script.create('orbitCamera', {
        attributes: {
            inertiaFactor: 0.2,
            distanceMax: 100,
            frameOnStart: false
        }
    });
    camera.script.create('orbitCameraInputMouse');
    camera.script.create('orbitCameraInputTouch');
    app.root.addChild(camera);

    // Helper function to create a flipbook entity
    const createFlipbookEntity = (name, fps, folder, filenamePattern, startFrame, endFrame, position, rotation, scale) => {
        const entity = new pc.Entity(name);
        entity.addComponent('gsplat', {
            unified: true
        });
        entity.addComponent('script');
        const flipbook = entity.script.create(GsplatFlipbook);
        if (flipbook) {
            flipbook.fps = fps;
            flipbook.folder = folder;
            flipbook.filenamePattern = filenamePattern;
            flipbook.startFrame = startFrame;
            flipbook.endFrame = endFrame;
            flipbook.playMode = 'bounce';
            flipbook.playing = true;
        }
        entity.setLocalPosition(position[0], position[1], position[2]);
        entity.setLocalEulerAngles(rotation[0], rotation[1], rotation[2]);
        entity.setLocalScale(scale, scale, scale);
        app.root.addChild(entity);
        return entity;
    };

    // Create monkey flipbook at origin (camera focus)
    const monkey = createFlipbookEntity(
        'Monkey',
        30,
        `${rootPath}/static/assets/splats/flipbook`,
        'monkey_{frame:04}.sog',
        1,
        50,
        [0, 0, 0],
        [180, 90, 0],
        0.7
    );

    // Create first wave entity at 60 fps
    createFlipbookEntity(
        'Wave 1 (60fps)',
        60,
        `${rootPath}/static/assets/splats/wave`,
        'wave_{frame:04}.sog',
        1,
        200,
        [0, -7, 0],
        [180, 90, 0],
        5
    );

    // Create second wave entity at 30 fps (flipped upside down)
    createFlipbookEntity(
        'Wave 2 (30fps)',
        30,
        `${rootPath}/static/assets/splats/wave`,
        'wave_{frame:04}.sog',
        1,
        200,
        [0, 7, 0],
        [0, 90, 0],
        5
    );

    // Update camera focus to monkey entity
    const orbitCamera = camera.script?.get('orbitCamera');
    if (orbitCamera) {
        orbitCamera.focusEntity = monkey;
    }
});

export { app };
