// @config DESCRIPTION Shows view-dependent color effects using spherical harmonics with Gaussian Splats.
import { data } from 'examples/observer';
import { deviceType, rootPath } from 'examples/utils';
import * as pc from 'playcanvas';

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
    skull: new pc.Asset('gsplat', 'gsplat', { url: `${rootPath}/static/assets/splats/skull.compressed.ply` }),
    orbit: new pc.Asset('script', 'script', { url: `${rootPath}/static/scripts/camera/orbit-camera.js` })
};

const assetListLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
assetListLoader.load(() => {
    app.start();

    data.on('renderer:set', () => {
        app.scene.gsplat.renderer = data.get('renderer');
        const current = app.scene.gsplat.currentRenderer;
        if (current !== data.get('renderer')) {
            setTimeout(() => data.set('renderer', current), 0);
        }
    });
    data.set('renderer', pc.GSPLAT_RENDERER_AUTO);

    // create a splat entity and place it in the world
    const skull = new pc.Entity();
    skull.addComponent('gsplat', {
        asset: assets.skull,
        castShadows: true,
        unified: true
    });
    skull.setLocalPosition(-1.5, 0.05, 0);
    skull.setLocalEulerAngles(180, 90, 0);
    skull.setLocalScale(0.7, 0.7, 0.7);
    app.root.addChild(skull);

    // Orbit pivot at splat (unified gsplats have no mesh AABB for focusEntity framing).
    const ORBIT_PIVOT = new pc.Vec3().copy(skull.getPosition());
    ORBIT_PIVOT.y += 0.2;
    const ORBIT_DISTANCE = 4;
    const ORBIT_INITIAL_YAW = 32;
    const ORBIT_INITIAL_PITCH = -10;

    // alpha clip for unified splats (shadows / cutout); scene-level for unified path
    app.scene.gsplat.alphaClip = 0.1;

    // Create an Entity with a camera component
    const camera = new pc.Entity();
    camera.addComponent('camera', {
        clearColor: new pc.Color(0.2, 0.2, 0.2),
        toneMapping: pc.TONEMAP_ACES
    });
    app.root.addChild(camera);

    camera.addComponent('script');
    const orbitCam = /** @type {any} */ (camera.script.create('orbitCamera', {
        attributes: {
            inertiaFactor: 0.2,
            distanceMax: 60,
            frameOnStart: false
        }
    }));
    if (orbitCam) {
        orbitCam.pivotPoint.copy(ORBIT_PIVOT);
        orbitCam.reset(ORBIT_INITIAL_YAW, ORBIT_INITIAL_PITCH, ORBIT_DISTANCE);
        orbitCam._updatePosition();
    }
    camera.script.create('orbitCameraInputMouse');
    camera.script.create('orbitCameraInputTouch');

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
