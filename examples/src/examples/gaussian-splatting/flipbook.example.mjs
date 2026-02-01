// @config DESCRIPTION This example demonstrates gsplat flipbook animation using dynamically loaded splat sequence of ply files.
// @config NO_MINISTATS
import { deviceType, rootPath, fileImport } from 'examples/utils';
import * as pc from 'playcanvas';

const { GsplatFlipbook } = await fileImport(`${rootPath}/static/scripts/esm/gsplat/gsplat-flipbook.mjs`);
const { ShadowCatcher } = await fileImport(`${rootPath}/static/scripts/esm/shadow-catcher.mjs`);

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
app.on('destroy', () => {
    window.removeEventListener('resize', resize);
});

// Create assets for scripts and skydome
const assets = {
    helipad: new pc.Asset(
        'helipad-env-atlas',
        'texture',
        { url: `${rootPath}/static/assets/cubemaps/helipad-env-atlas.png` },
        { type: pc.TEXTURETYPE_RGBP, mipmaps: false }
    ),
    apartment: new pc.Asset('apartment', 'container', { url: `${rootPath}/static/assets/models/apartment.glb` }),
    orbit: new pc.Asset('script', 'script', { url: `${rootPath}/static/scripts/camera/orbit-camera.js` })
};

const assetListLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
assetListLoader.load(() => {
    app.start();

    // setup skydome
    app.scene.skyboxMip = 2;
    app.scene.envAtlas = assets.helipad.resource;

    // add room model
    const roomEntity = assets.apartment.resource.instantiateRenderEntity({
        castShadows: false
    });
    roomEntity.setLocalScale(30, 30, 30);
    app.root.addChild(roomEntity);

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
        toneMapping: pc.TONEMAP_ACES,
        farClip: 1500,
        fov: 80
    });

    const focusPoint = new pc.Entity();
    focusPoint.setLocalPosition(-80, 80, -20);

    // add orbit camera script with a mouse and a touch support
    camera.addComponent('script');
    camera.script.create('orbitCamera', {
        attributes: {
            inertiaFactor: 0.2,
            focusEntity: focusPoint,
            distanceMax: 500,
            frameOnStart: false
        }
    });
    camera.script.create('orbitCameraInputMouse');
    camera.script.create('orbitCameraInputTouch');
    camera.setLocalPosition(-50, 100, 220);
    camera.lookAt(0, 0, 100);
    app.root.addChild(camera);

    // Create player flipbook
    const player = new pc.Entity('Player');
    player.addComponent('gsplat', {
        castShadows: true,
        unified: true
    });
    player.addComponent('script');
    const flipbook = player.script.create(GsplatFlipbook);
    if (flipbook) {
        flipbook.fps = 30;
        flipbook.folder = 'https://code.playcanvas.com/examples_data/example_basketball_02';
        flipbook.filenamePattern = '{frame:03}.compressed.ply';
        flipbook.startFrame = 1;
        flipbook.endFrame = 149;
        flipbook.playMode = 'bounce';
        flipbook.playing = true;
    }
    player.setLocalPosition(50, 0, -80);
    player.setLocalEulerAngles(180, 20, 0);
    player.setLocalScale(80, 80, 80);
    app.root.addChild(player);

    // set alpha clip value, used by shadows
    app.scene.gsplat.material.setParameter('alphaClip', 0.1);

    // Create shadow catcher
    const shadowCatcher = new pc.Entity('ShadowCatcher');
    shadowCatcher.addComponent('render', {
        type: 'plane',
        castShadows: false
    });
    shadowCatcher.setLocalScale(300, 300, 300);

    shadowCatcher.addComponent('script');
    shadowCatcher.script?.create(ShadowCatcher, {
        properties: {
            geometry: shadowCatcher,
            scale: new pc.Vec3(1000, 1000, 1000)
        }
    });
    shadowCatcher.setLocalPosition(0, 1, -180);
    app.root.addChild(shadowCatcher);

    // Shadow casting directional light
    const directionalLight = new pc.Entity('light');
    directionalLight.addComponent('light', {
        type: 'directional',
        color: pc.Color.BLACK,
        castShadows: true,
        intensity: 0,
        shadowBias: 0.1,
        normalOffsetBias: 0.05,
        shadowDistance: 800,
        shadowIntensity: 0.3,
        shadowResolution: 2048,
        shadowType: pc.SHADOW_PCF5_16F
    });
    directionalLight.setEulerAngles(55, 70, 0);
    app.root.addChild(directionalLight);
});

export { app };
