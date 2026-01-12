// @config HIDDEN
import { deviceType, rootPath, fileImport } from 'examples/utils';
import * as pc from 'playcanvas';

const { ShadowCatcher } = await fileImport(`${rootPath}/static/scripts/esm/shadow-catcher.mjs`);

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

const assets = {
    biker: new pc.Asset('gsplat', 'gsplat', { url: `${rootPath}/static/assets/splats/biker.compressed.ply` }),
    hdri: new pc.Asset(
        'hdri',
        'texture',
        { url: `${rootPath}/static/assets/hdri/st-peters-square.hdr` },
        { mipmaps: false }
    ),
    orbit: new pc.Asset('script', 'script', { url: `${rootPath}/static/scripts/camera/orbit-camera.js` })
};

const assetListLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
assetListLoader.load(() => {
    app.start();

    // Setup projected skydome from HDR
    const hdriTexture = assets.hdri.resource;

    // Generate high resolution cubemap for skybox
    const skybox = pc.EnvLighting.generateSkyboxCubemap(hdriTexture);
    app.scene.skybox = skybox;

    // Generate env-atlas for lighting
    const lighting = pc.EnvLighting.generateLightingSource(hdriTexture);
    const envAtlas = pc.EnvLighting.generateAtlas(lighting);
    lighting.destroy();
    app.scene.envAtlas = envAtlas;

    // Set exposure and projected dome
    app.scene.exposure = 0.4;
    app.scene.sky.type = pc.SKYTYPE_DOME;
    app.scene.sky.node.setLocalScale(new pc.Vec3(50, 50, 50));
    app.scene.sky.node.setLocalPosition(pc.Vec3.ZERO);
    app.scene.sky.center = new pc.Vec3(0, 0.05, 0);

    // Customize GSplat material using unified mode material customization
    // This sets the alpha clip value for all GSplat instances in unified mode
    app.scene.gsplat.material.setParameter('alphaClip', 0.4);
    app.scene.gsplat.material.update();

    // Create first splat entity
    const biker = new pc.Entity('biker');
    biker.addComponent('gsplat', {
        asset: assets.biker,
        castShadows: true,
        unified: true
    });
    biker.setLocalPosition(-1.5, 0.05, 0);
    biker.setLocalEulerAngles(180, 90, 0);
    biker.setLocalScale(0.7, 0.7, 0.7);
    app.root.addChild(biker);

    // Create second splat entity
    const biker2 = new pc.Entity('biker2');
    biker2.addComponent('gsplat', {
        asset: assets.biker,
        castShadows: true,
        unified: true
    });
    biker2.setLocalPosition(0.5, 0.05, 0);
    biker2.setLocalEulerAngles(180, 0, 0);
    biker2.setLocalScale(0.7, 0.7, 0.7);
    app.root.addChild(biker2);

    // Create camera
    const camera = new pc.Entity('camera');
    camera.addComponent('camera', {
        clearColor: new pc.Color(1, 1, 1),
        toneMapping: pc.TONEMAP_ACES,
        fov: 60
    });
    camera.setLocalPosition(-3, 2, 4);

    // Add orbit camera script with mouse and touch support
    camera.addComponent('script');
    camera.script?.create('orbitCamera', {
        attributes: {
            inertiaFactor: 0.2,
            focusEntity: biker,
            distanceMax: 10,
            frameOnStart: false
        }
    });
    camera.script?.create('orbitCameraInputMouse');
    camera.script?.create('orbitCameraInputTouch');
    app.root.addChild(camera);

    // Create shadow catcher
    const shadowCatcher = new pc.Entity('ShadowCatcher');
    shadowCatcher.addComponent('script');
    const shadowCatcherScript = shadowCatcher.script?.create(ShadowCatcher);
    if (shadowCatcherScript) {
        shadowCatcherScript.scale = new pc.Vec3(10, 10, 10);
    }
    app.root.addChild(shadowCatcher);

    // Shadow casting directional light casting shadows
    const directionalLight = new pc.Entity('light');
    directionalLight.addComponent('light', {
        type: 'directional',
        color: pc.Color.WHITE,
        castShadows: true,
        intensity: 1,
        shadowBias: 0.1,
        normalOffsetBias: 0.05,
        shadowDistance: 20,
        shadowIntensity: 0.5,
        shadowResolution: 2048,
        shadowType: pc.SHADOW_PCF5_16F
    });
    directionalLight.setEulerAngles(55, 30, 0);
    app.root.addChild(directionalLight);

    // Auto-rotate light
    let lightAngle = 0;
    app.on('update', (/** @type {number} */ dt) => {
        lightAngle += dt * 20;
        directionalLight.setEulerAngles(55, 90 + lightAngle, 0);
    });
});

export { app };
