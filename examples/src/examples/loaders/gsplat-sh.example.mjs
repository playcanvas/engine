// @config E2E_TEST
import { deviceType, rootPath } from 'examples/utils';
import * as pc from 'playcanvas';


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

const assets = {
    skull: new pc.Asset('gsplat', 'gsplat', { url: `${rootPath}/static/assets/splats/skull.ply` }),
    orbit: new pc.Asset('script', 'script', { url: `${rootPath}/static/scripts/camera/orbit-camera.js` }),
    hdri_street: new pc.Asset(
        'hdri',
        'texture',
        { url: `${rootPath}/static/assets/hdri/st-peters-square.hdr` },
        { mipmaps: false }
    )
};

const assetListLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
assetListLoader.load(() => {
    app.start();

    // create a splat entity and place it in the world
    const skull = new pc.Entity();
    skull.addComponent('gsplat', {
        asset: assets.skull,
        castShadows: true
    });
    skull.setLocalPosition(-1.5, 0.05, 0);
    skull.setLocalEulerAngles(180, 90, 0);
    skull.setLocalScale(0.7, 0.7, 0.7);
    app.root.addChild(skull);

    // set alpha clip value, used by shadows and picking
    skull.gsplat.material.setParameter('alphaClip', 0.4);
    skull.gsplat.material.setParameter('alphaClip', 0.1);

    // Create an Entity with a camera component
    const camera = new pc.Entity();
    camera.addComponent('camera', {
        clearColor: new pc.Color(0.2, 0.2, 0.2),
        toneMapping: pc.TONEMAP_ACES
    });
    camera.setLocalPosition(-2, 1.5, 2);

    // add orbit camera script with a mouse and a touch support
    camera.addComponent('script');
    camera.script.create('orbitCamera', {
        attributes: {
            inertiaFactor: 0.2,
            focusEntity: skull,
            distanceMax: 60,
            frameOnStart: false
        }
    });
    camera.script.create('orbitCameraInputMouse');
    camera.script.create('orbitCameraInputTouch');
    app.root.addChild(camera);

    // create ground to receive shadows
    const material = new pc.StandardMaterial();
    material.diffuse = new pc.Color(0.5, 0.5, 0.4);
    material.gloss = 0.2;
    material.metalness = 0.5;
    material.useMetalness = true;
    material.update();

    const ground = new pc.Entity();
    ground.addComponent('render', {
        type: 'box',
        material: material,
        castShadows: false
    });
    ground.setLocalScale(10, 1, 10);
    ground.setLocalPosition(0, -0.45, 0);
    app.root.addChild(ground);

    // shadow casting directional light
    // Note: it does not affect gsplat, as lighting is not supported there currently
    const directionalLight = new pc.Entity();
    directionalLight.addComponent('light', {
        type: 'directional',
        color: pc.Color.WHITE,
        castShadows: true,
        intensity: 1,
        shadowBias: 0.2,
        normalOffsetBias: 0.05,
        shadowDistance: 10,
        shadowIntensity: 0.5,
        shadowResolution: 2048,
        shadowType: pc.SHADOW_PCSS_32F,
        penumbraSize: 10,
        penumbraFalloff: 4,
        shadowSamples: 16,
        shadowBlockerSamples: 16
    });
    directionalLight.setEulerAngles(55, 90, 20);
    app.root.addChild(directionalLight);
});

export { app };
